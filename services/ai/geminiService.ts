import { GoogleGenAI, Part, Content, FunctionDeclaration, Type, Schema } from "@google/genai";
import { z } from "zod";
import { ZoneLabel, DiscoveryResult, ZoneAnnotation, AnnotationResult, VisionTakeoffResult, VisionTakeoffResultSchema } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONFIGURATION: THE EXPERT STANDARD ---
const VISION_MODEL = 'gemini-3-flash-preview';    // DO NOT CHANGE: Required for architectural reasoning
const LOGIC_MODEL = 'gemini-2.5-flash';   // Optimized for speed and math
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MIN_VALID_BOX_AREA = 100 * 100;

// --- GENAI SDK SCHEMAS ---

const discoverySchema: Schema = {
    type: Type.OBJECT,
    properties: {
        layout_reasoning: { type: Type.STRING },
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
            reasoning: { type: Type.STRING, nullable: true }
        },
        required: ["roomName", "boundingBox", "dimensionsText"]
    }
};

const circulationSchema: Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            roomName: { type: Type.STRING },
            boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            dimensionsText: { type: Type.STRING, nullable: true },
            reasoning: { type: Type.STRING, nullable: true }
        },
        required: ["roomName", "boundingBox"]
    }
};

const calculatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    math_trace: { type: Type.STRING },
    rooms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          area: { type: Type.NUMBER },
          isConditioned: { type: Type.BOOLEAN }
        },
        required: ["name", "area", "isConditioned"]
      }
    },
    totalEnvelope: {
        type: Type.OBJECT,
        properties: { conditionedFloorArea: { type: Type.NUMBER } },
        required: ["conditionedFloorArea"]
    }
  },
  required: ["math_trace", "rooms", "totalEnvelope"]
};

// --- HELPER FUNCTIONS ---

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
                config: { responseMimeType: 'application/json', responseSchema: responseSchema }
            });
            if (!result.text) throw new Error("AI returned empty content");
            return result.text;
        } catch (error: any) {
            attempt++;
            const isRetryable = error.message?.includes('overloaded') || error.code === 503 || error.status === 'UNAVAILABLE';
            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                log(`[AI Service] ⚠️ ${modelName} unavailable. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Max retries exceeded for ${modelName}`);
}

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
            const threshold = namesMatch ? 0.10 : 0.60;
            if (iou > threshold) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) uniqueZones.push(zone);
    }
    return uniqueZones;
}

// --- PIPELINE STAGES ---

async function discoverZoneLabels(imageParts: Part[], log: (msg: string) => void): Promise<DiscoveryResult> {
    const prompt: Part = { text: SYSTEM_PROMPTS.PROMPT_DISCOVER_ZONES };
    const contents: Content[] = [{ role: 'user', parts: [...imageParts, prompt] }];
    const responseText = await generateContentWithRetry(VISION_MODEL, contents, discoverySchema, log);
    return JSON.parse(responseText);
}

async function analyzeZoneBatch(imageParts: Part[], zoneBatch: ZoneLabel[], log: (msg: string) => void): Promise<ZoneAnnotation[]> {
    const prompt: Part = { text: SYSTEM_PROMPTS.PROMPT_ANALYZE_ZONE_BATCH(zoneBatch) };
    const contents: Content[] = [{ role: 'user', parts: [...imageParts, prompt] }];
    const responseText = await generateContentWithRetry(VISION_MODEL, contents, batchAnalysisSchema, log);
    return JSON.parse(responseText);
}

async function findCirculationZones(imageParts: Part[], foundZones: ZoneAnnotation[], log: (msg: string) => void): Promise<ZoneAnnotation[]> {
    const foundBoxes = foundZones.map(z => ({ roomName: z.roomName, boundingBox: z.boundingBox }));
    const prompt: Part = { text: SYSTEM_PROMPTS.PROMPT_FIND_CIRCULATION_ZONES(JSON.stringify(foundBoxes)) };
    const contents: Content[] = [{ role: 'user', parts: [...imageParts, prompt] }];
    const responseText = await generateContentWithRetry(VISION_MODEL, contents, circulationSchema, log);
    return JSON.parse(responseText);
}

async function runIntelligentAnnotator(imageParts: Part[], onLog?: (msg: string) => void): Promise<AnnotationResult> {
  const log = (msg: string) => { onLog?.(msg); console.log(msg); };

  log(`[Annotator] Step 1A: Discovering labeled zones...`);
  const discoveryResult = await discoverZoneLabels(imageParts, log);
  log(`[Annotator] AI Visual Reasoning:\n${discoveryResult.layout_reasoning}\n`);
  
  let labeledAnnotations: ZoneAnnotation[] = [];
  const discoveredZones = discoveryResult.zones;
  if (discoveredZones.length > 0) {
    const midpoint = Math.ceil(discoveredZones.length / 2);
    const batch1 = discoveredZones.slice(0, midpoint);
    const batch2 = discoveredZones.slice(midpoint);
    
    log(`[Annotator] Step 1B: Analyzing labeled zones...`);
    try {
      const res1 = await analyzeZoneBatch(imageParts, batch1, log);
      labeledAnnotations.push(...res1);
    } catch (e) { log(`[Annotator] WARN: Batch 1 failed: ${e}`); }
    
    if (batch2.length > 0) {
      try {
        const res2 = await analyzeZoneBatch(imageParts, batch2, log);
        labeledAnnotations.push(...res2);
      } catch (e) { log(`[Annotator] WARN: Batch 2 failed: ${e}`); }
    }
  }

  log(`[Annotator] Step 1C: Identifying unnamed circulation space...`);
  let circulationAnnotations: ZoneAnnotation[] = [];
  try {
      circulationAnnotations = await findCirculationZones(imageParts, labeledAnnotations, log);
  } catch (e) { log(`[Annotator] WARN: Circulation analysis failed: ${e}`); }

  const combined = filterOverlappingZones([...labeledAnnotations, ...circulationAnnotations]);
  
  return {
      scaleAnnotation: { text: discoveryResult.scaleText || "FALLBACK", pixelsPerFoot: 15 }, 
      rooms: combined
  };
}

async function runDataCalculator(annotations: AnnotationResult, log: (msg: string) => void): Promise<VisionTakeoffResult> {
  const prompt: Part = { text: SYSTEM_PROMPTS.DATA_CALCULATOR_PROMPT(JSON.stringify(annotations)) };
  const contents: Content[] = [{ role: 'user', parts: [prompt] }];
  const responseText = await generateContentWithRetry(LOGIC_MODEL, contents, calculatorSchema, log);
  return VisionTakeoffResultSchema.parse(JSON.parse(responseText));
}

export async function runVisionStage(imageParts: Part[], onLog?: (msg: string) => void): Promise<VisionTakeoffResult> {
  const log = (msg: string) => { onLog?.(msg); console.log(msg); };

  log(`[Vision Stage] Step 1: Running Intelligent Annotator AI (${VISION_MODEL})...`);
  const annotations = await runIntelligentAnnotator(imageParts, onLog);
  
  log(`[Vision Stage] Step 2: Running Data Calculator AI (${LOGIC_MODEL})...`);
  const finalTakeoff = await runDataCalculator(annotations, log);
  
  const mergedResult: VisionTakeoffResult = {
      ...finalTakeoff,
      vision_reasoning: annotations.rooms.map(r => `[${r.roomName}]: ${r.reasoning || 'No reasoning'}`).join('\n')
  };

  log(`[Vision Stage] Complete. Total Area: ${Math.round(mergedResult.totalEnvelope.conditionedFloorArea)} sq ft.`);
  return mergedResult;
}

export const TOOLS: FunctionDeclaration[] = [];