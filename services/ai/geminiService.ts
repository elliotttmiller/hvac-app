import { GoogleGenAI, Part, Content, FunctionDeclaration, Type, Schema } from "@google/genai";
import { z } from "zod";
import { ZoneLabel, DiscoveryResult, ZoneAnnotation, AnnotationResult, VisionTakeoffResult, VisionTakeoffResultSchema } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// CONFIGURATION
const VISION_MODEL = 'gemini-3-flash-preview'; 
const LOGIC_MODEL = 'gemini-2.5-flash'; 
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

// --- GENAI SDK SCHEMAS ---

const discoverySchema: Schema = {
    type: Type.OBJECT,
    properties: {
        layout_reasoning: { type: Type.STRING, description: "A detailed description of the floor plan layout, specifically noting vertical stacks of rooms." },
        scaleText: { type: Type.STRING, nullable: true },
        zones: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    roomName: { type: Type.STRING },
                    labelCoordinates: {
                        type: Type.OBJECT,
                        properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                        required: ["x", "y"]
                    }
                },
                required: ["roomName", "labelCoordinates"]
            }
        }
    },
    required: ["layout_reasoning", "scaleText", "zones"]
};

const batchAnalysisSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            roomName: { type: Type.STRING },
            boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            dimensionsText: { type: Type.STRING, nullable: true },
            reasoning: { type: Type.STRING }
        },
        required: ["roomName", "boundingBox", "dimensionsText", "reasoning"]
    }
};

const calculatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    math_trace: { type: Type.STRING },
    metadata: { type: Type.OBJECT, properties: { jobName: { type: Type.STRING }, client: { type: Type.STRING } } },
    rooms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          area: { type: Type.NUMBER },
          windows: { type: Type.NUMBER },
          orientation: { type: Type.STRING }
        },
        required: ["name", "area"]
      }
    },
    construction: { type: Type.OBJECT, properties: { wallType: { type: Type.STRING }, windowType: { type: Type.STRING } } },
    totalEnvelope: { type: Type.OBJECT, properties: { conditionedFloorArea: { type: Type.NUMBER } }, required: ["conditionedFloorArea"] },
    error: { type: Type.STRING }
  },
  required: ["math_trace", "rooms", "totalEnvelope"]
};

// --- ZOD SCHEMAS ---

const ZoneLabelSchema = z.object({
  roomName: z.string(),
  labelCoordinates: z.object({ x: z.number(), y: z.number() })
});

const DiscoveryResultSchema = z.object({
    layout_reasoning: z.string(),
    scaleText: z.string().nullable().optional(),
    zones: z.array(ZoneLabelSchema)
});

const ZoneAnnotationSchema = z.object({
    roomName: z.string(),
    boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    dimensionsText: z.string().optional().nullable(),
    reasoning: z.string().optional()
});

const AnnotationSchema = z.object({
  scaleAnnotation: z.object({
    text: z.string().optional(),
    pixelLength: z.number().optional(),
    pixelsPerFoot: z.number().optional()
  }).optional(),
  rooms: z.array(ZoneAnnotationSchema).min(1, "No rooms detected in annotation step."),
  windows: z.array(z.object({
    boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  })).optional()
});

// --- HELPER: FAULT TOLERANCE (RETRY LOGIC) ---

async function generateContentWithRetry(
    modelName: string, 
    contents: Content[], 
    responseSchema: Schema, 
    log: (msg: string) => void
): Promise<string> {
    let attempt = 0;
    
    while (attempt < MAX_RETRIES) {
        try {
            const result = await ai.models.generateContent({
                model: modelName,
                contents,
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema 
                }
            });
            
            if (!result.text) throw new Error("Empty response from AI model");
            return result.text;

        } catch (error: any) {
            attempt++;
            const isOverloaded = error.message?.includes('overloaded') || error.code === 503 || error.status === 'UNAVAILABLE';
            
            if (isOverloaded && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                log(`[AI Service] ⚠️ Model ${modelName} overloaded. Retrying in ${delay}ms (Attempt ${attempt}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Failed to generate content after ${MAX_RETRIES} attempts.`);
}

// --- HELPER: SPATIAL DEDUPLICATION (IoU) ---

function calculateIoU(boxA: [number, number, number, number], boxB: [number, number, number, number]): number {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[2], boxB[2]);
    const yB = Math.min(boxA[3], boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

    return interArea / (boxAArea + boxBArea - interArea);
}

function filterOverlappingZones(zones: ZoneAnnotation[]): ZoneAnnotation[] {
    const uniqueZones: ZoneAnnotation[] = [];
    const sortedZones = [...zones].sort((a, b) => {
        const areaA = (a.boundingBox[2] - a.boundingBox[0]) * (a.boundingBox[3] - a.boundingBox[1]);
        const areaB = (b.boundingBox[2] - b.boundingBox[0]) * (b.boundingBox[3] - b.boundingBox[1]);
        return areaB - areaA;
    });

    for (const zone of sortedZones) {
        let isDuplicate = false;
        for (const existing of uniqueZones) {
            const iou = calculateIoU(zone.boundingBox, existing.boundingBox);
            const namesMatch = zone.roomName.toLowerCase().replace(/[^a-z0-9]/g, '') === existing.roomName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const threshold = namesMatch ? 0.30 : 0.60;

            if (iou > threshold) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            uniqueZones.push(zone);
        }
    }
    return uniqueZones;
}

// --- PIPELINE FUNCTIONS ---

async function discoverZoneLabels(imageParts: Part[], log: (msg: string) => void): Promise<DiscoveryResult> {
    const prompt: Part = { text: SYSTEM_PROMPTS.PROMPT_DISCOVER_ZONES };
    const contents: Content[] = [{ role: 'user', parts: [...imageParts, prompt] }];
    
    const responseText = await generateContentWithRetry(VISION_MODEL, contents, discoverySchema, log);
    
    const rawJson = JSON.parse(responseText);
    const validation = DiscoveryResultSchema.safeParse(rawJson);

    if (!validation.success) throw new Error(`Zone Discovery Validation Failed: ${JSON.stringify(validation.error.issues)}`);
    
    return {
        layout_reasoning: validation.data.layout_reasoning,
        scaleText: validation.data.scaleText ?? null,
        zones: validation.data.zones
    };
}

async function analyzeZoneBatch(imageParts: Part[], zoneBatch: ZoneLabel[], log: (msg: string) => void): Promise<ZoneAnnotation[]> {
    const prompt: Part = { text: SYSTEM_PROMPTS.PROMPT_ANALYZE_ZONE_BATCH(zoneBatch) };
    const contents: Content[] = [{ role: 'user', parts: [...imageParts, prompt] }];

    const responseText = await generateContentWithRetry(VISION_MODEL, contents, batchAnalysisSchema, log);

    const rawJson = JSON.parse(responseText) as ZoneAnnotation[];
    const validation = z.array(ZoneAnnotationSchema).safeParse(rawJson);

    if (!validation.success) throw new Error(`Zone Batch Analysis Validation Failed`);
    return validation.data;
}

async function runIntelligentAnnotator(imageParts: Part[], onLog?: (msg: string) => void): Promise<AnnotationResult> {
  const log = (msg: string) => { onLog?.(msg); console.log(msg); };

  log(`[Annotator] Step 1A: Discovering zones and scale...`);
  const discoveryResult = await discoverZoneLabels(imageParts, log);
  
  log(`[Annotator] AI Visual Reasoning:\n${discoveryResult.layout_reasoning}\n`);
  
  const discoveredZones = discoveryResult.zones;
  const scaleText = discoveryResult.scaleText || "FALLBACK_DEFAULT";
  
  log(`[Annotator] Step 1A Complete. Found Scale: "${scaleText}". Found ${discoveredZones.length} potential zones.`);
  
  const allRoomAnnotations: ZoneAnnotation[] = [];

  if (discoveredZones.length > 0) {
    const midpoint = Math.ceil(discoveredZones.length / 2);
    const batch1 = discoveredZones.slice(0, midpoint);
    const batch2 = discoveredZones.slice(midpoint);

    log(`[Annotator] Step 1B: Analyzing batch 1 of ${batch2.length > 0 ? 2 : 1}...`);
    try {
      const b1 = await analyzeZoneBatch(imageParts, batch1, log);
      allRoomAnnotations.push(...b1);
    } catch (e) { log(`[Annotator] WARN: Batch 1 failed: ${e}`); }

    if (batch2.length > 0) {
      log(`[Annotator] Step 1B: Analyzing batch 2 of 2...`);
      try {
        const b2 = await analyzeZoneBatch(imageParts, batch2, log);
        allRoomAnnotations.push(...b2);
      } catch (e) { log(`[Annotator] WARN: Batch 2 failed: ${e}`); }
    }
  }
  
  const initialCount = allRoomAnnotations.length;
  const uniqueAnnotations = filterOverlappingZones(allRoomAnnotations);
  const removedCount = initialCount - uniqueAnnotations.length;
  
  if (removedCount > 0) {
      log(`[Annotator] Deduplication: Removed ${removedCount} overlapping/duplicate zones.`);
  }
  log(`[Annotator] Step 1B Complete. Final unique zones: ${uniqueAnnotations.length}.`);

  const finalAnnotationData: AnnotationResult = {
      scaleAnnotation: { text: scaleText, pixelsPerFoot: 15 }, 
      rooms: uniqueAnnotations,
      windows: []
  };

  const validation = AnnotationSchema.safeParse(finalAnnotationData);
  if (!validation.success) throw new Error(`Final assembled annotation failed validation`);
  return validation.data;
}

async function runDataCalculator(annotations: AnnotationResult, log: (msg: string) => void): Promise<VisionTakeoffResult> {
  const prompt: Part = { text: SYSTEM_PROMPTS.DATA_CALCULATOR_PROMPT(JSON.stringify(annotations)) };
  const contents: Content[] = [{ role: 'user', parts: [prompt] }];

  const responseText = await generateContentWithRetry(LOGIC_MODEL, contents, calculatorSchema, log);

  const rawJson = JSON.parse(responseText);
  const validation = VisionTakeoffResultSchema.safeParse(rawJson);
  if (!validation.success) throw new Error(`Calculator output failed validation`);
  return validation.data;
}

export async function runVisionStage(imageParts: Part[], onLog?: (msg: string) => void): Promise<VisionTakeoffResult> {
  const log = (msg: string) => { onLog?.(msg); console.log(msg); };

  log(`[Vision Stage] Step 1: Running Intelligent Annotator AI (${VISION_MODEL})...`);
  const annotations = await runIntelligentAnnotator(imageParts, onLog);
  log(`[Vision Stage] Step 1 Complete. Found annotations for ${annotations.rooms.length} rooms.`);

  if (!annotations.rooms || annotations.rooms.length === 0) {
     log('[Vision Stage] WARN: No rooms detected. Skipping Calculator Step.');
     return {
         metadata: {},
         rooms: [],
         totalEnvelope: { conditionedFloorArea: 0 },
         error: "No rooms were detected in the annotation stage."
     };
  }

  log(`[Vision Stage] Step 2: Running Data Calculator AI (${LOGIC_MODEL})...`);
  const finalTakeoff = await runDataCalculator(annotations, log);
  
  const mergedResult: VisionTakeoffResult = {
      ...finalTakeoff,
      vision_reasoning: annotations.rooms.map(r => `[${r.roomName}]: ${r.reasoning || 'No reasoning'}`).join('\n')
  };

  log(`[Vision Stage] Step 2 Complete. Calculated total area: ${Math.round(mergedResult.totalEnvelope.conditionedFloorArea)} sq ft.`);
  
  if (mergedResult.vision_reasoning) {
    log(`[Vision Stage] AI Vision Reasoning Trace:\n---\n${mergedResult.vision_reasoning}\n---`);
  }
  if (mergedResult.math_trace) {
    log(`[Vision Stage] AI Math Trace:\n---\n${mergedResult.math_trace}\n---`);
  }
  
  return mergedResult;
}

export const TOOLS: FunctionDeclaration[] = [];