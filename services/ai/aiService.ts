import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'; // Official import
import { z } from 'zod';
import {
  ZoneLabel,
  DiscoveryResult,
  ZoneAnnotation,
  AnnotationResult,
  VisionTakeoffResult,
  VisionTakeoffResultSchema
} from '../types';
import { SYSTEM_PROMPTS } from './prompts';

/**
 * Environment variable helper
 */
const getEnv = (key: string): string => {
  const viteKey = `VITE_${key}`;
  const metaEnv = (import.meta as any).env || {};
  const processEnv = (typeof process !== 'undefined' ? process.env : {}) || {};
  const value = metaEnv[viteKey] || metaEnv[key] || processEnv[viteKey] || processEnv[key] || '';
  return value;
};

/**
 * Get the AI engine for the specified stage
 * Using official Scitely OpenAI-compatible provider
 */
const getEngine = (stage: 'vision' | 'logic') => {
  const provider = stage === 'vision' ? getEnv('VISION_PROVIDER') : getEnv('LOGIC_PROVIDER');
  const modelName = stage === 'vision' ? getEnv('VISION_MODEL') : getEnv('LOGIC_MODEL');
  
  if (provider === 'scitely') {
    // Official OpenAI Compatible Provider setup from documentation
    const scitelyProvider = createOpenAICompatible({
      name: 'scitely', // Required name parameter per documentation
      apiKey: getEnv('SCITELY_API_KEY'),
      baseURL: 'https://api.scitely.com/v1',
      includeUsage: true, // Optional but recommended for usage tracking
      supportsStructuredOutputs: true // Required for generateObject functionality
    });
    
    // Create model using official provider model creation pattern
    return scitelyProvider(modelName || 'qwen3-coder-plus');
  }
  
  throw new Error(`Unsupported provider: ${provider}. Only 'scitely' is currently configured.`);
};

/**
 * Enhanced retry logic with debug information
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  stage: string,
  maxRetries: number = 3,
  onLog: (msg: string) => void
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      onLog(`[SUCCESS] ${stage} completed on attempt ${attempt}/${maxRetries} (${duration}ms)`);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      onLog(`[ERROR] ${stage} failed on attempt ${attempt}/${maxRetries}: ${errorMessage}`);
      
      if (attempt === maxRetries) {
        throw new Error(`[CRITICAL] ${stage} failed after ${maxRetries} attempts: ${errorMessage}`);
      }
      
      const backoff = Math.pow(2, attempt - 1) * 1000;
      onLog(`[RETRY] Waiting ${backoff}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw new Error(`Unexpected failure in ${stage}`);
}

// --- SCHEMAS ---
const DiscoverySchema = z.object({
  layout_reasoning: z.string(),
  scaleText: z.string().nullable(),
  zones: z.array(z.object({
    roomName: z.string(),
    labelCoordinates: z.object({ x: z.number(), y: z.number() })
  }))
});

const AnalysisSchema = z.array(z.object({
  roomName: z.string(),
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  dimensionsText: z.string().nullable(),
  reasoning: z.string().nullable()
}));

// --- PIPELINE STAGES ---
async function discoverZones(
  base64Images: string[],
  onLog: (msg: string) => void
): Promise<DiscoveryResult> {
  return withRetry(async () => {
    const { object } = await generateObject({
      model: getEngine('vision'),
      schema: DiscoverySchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_DISCOVER_ZONES },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const,
        },
      ],
    });
    return object;
  }, 'Zone Discovery', 3, onLog);
}

async function analyzeBatch(
  base64Images: string[],
  batch: ZoneLabel[],
  onLog: (msg: string) => void
): Promise<ZoneAnnotation[]> {
  return withRetry(async () => {
    const { object } = await generateObject({
      model: getEngine('vision'),
      schema: AnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_ANALYZE_ZONE_BATCH(batch) },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const,
        },
      ],
    });
    return object;
  }, `Batch Analysis (${batch.length} zones)`, 2, onLog);
}

async function findCirculation(
  base64Images: string[],
  foundZones: ZoneAnnotation[],
  onLog: (msg: string) => void
): Promise<ZoneAnnotation[]> {
  return withRetry(async () => {
    const { object } = await generateObject({
      model: getEngine('vision'),
      schema: AnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_FIND_CIRCULATION_ZONES(JSON.stringify(foundZones)) },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const,
        },
      ],
    });
    return object;
  }, 'Circulation Analysis', 2, onLog);
}

async function runCalculator(
  annotations: AnnotationResult,
  onLog: (msg: string) => void
): Promise<VisionTakeoffResult> {
  return withRetry(async () => {
    const { object } = await generateObject({
      model: getEngine('logic'),
      schema: VisionTakeoffResultSchema,
      prompt: SYSTEM_PROMPTS.DATA_CALCULATOR_PROMPT(JSON.stringify(annotations)),
    });
    return object;
  }, 'Data Calculator', 3, onLog);
}

// --- MAIN ORCHESTRATOR ---
export async function runVisionStage(
  imageParts: any[],
  onLog?: (msg: string) => void
): Promise<VisionTakeoffResult> {
  const log = (msg: string) => { 
    onLog?.(msg); 
    console.log(`[AI-Pipeline] ${msg}`); 
  };
  
  log('=== STARTING VISION PIPELINE ===');
  
  // Validate Scitely configuration
  const visionProvider = getEnv('VISION_PROVIDER');
  const scitelyApiKey = getEnv('SCITELY_API_KEY');
  
  if (visionProvider === 'scitely' && !scitelyApiKey) {
    throw new Error('SCITELY_API_KEY is required when using Scitely as VISION_PROVIDER');
  }
  
  log(`[CONFIG] Vision Provider: ${visionProvider}`);
  
  // Standardize images to Base64
  const base64Images = imageParts.map((part: any) => part.inlineData.data);
  log(`[INIT] Processing ${base64Images.length} images`);
  
  if (base64Images.length === 0) {
    throw new Error('No images were generated from PDF processing');
  }
  
  // 1A. Discovery
  log(`[Annotator] Step 1A: Discovering labeled zones...`);
  const discovery = await discoverZones(base64Images, log);
  
  if (discovery.zones.length === 0) {
    throw new Error('No zones discovered. Check image quality and scale detection.');
  }
  
  log(`[Annotator] Step 1A Complete: Found ${discovery.zones.length} zones`);
  
  // 1B. Batched Analysis
  let labeledAnnotations: ZoneAnnotation[] = [];
  const BATCH_SIZE = 4;
  
  log(`[Annotator] Step 1B: Analyzing zones in batches of ${BATCH_SIZE}...`);
  
  for (let i = 0; i < discovery.zones.length; i += BATCH_SIZE) {
    const batch = discovery.zones.slice(i, i + BATCH_SIZE);
    log(`[Annotator] Step 1B: Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(discovery.zones.length/BATCH_SIZE)}`);
    const batchResults = await analyzeBatch(base64Images, batch, log);
    labeledAnnotations.push(...batchResults);
  }
  
  log(`[Annotator] Step 1B Complete: Analyzed ${labeledAnnotations.length} zones`);
  
  // 1C. Circulation
  log(`[Annotator] Step 1C: Identifying circulation spaces...`);
  const circulation = await findCirculation(base64Images, labeledAnnotations, log);
  log(`[Annotator] Step 1C Complete: Found ${circulation.length} circulation zones`);
  
  // 2. Calculation
  log(`[Vision Stage] Step 2: Running Math Synthesis...`);
  const final = await runCalculator({
    scaleAnnotation: { 
      text: discovery.scaleText || "SCALE_NOT_DETECTED", 
      pixelLength: 100, 
      pixelsPerFoot: 100 
    },
    rooms: [...labeledAnnotations, ...circulation]
  }, log);
  
  log(`[Vision Stage] Step 2 Complete: Processed ${final.rooms.length} rooms`);
  log('=== VISION PIPELINE COMPLETED SUCCESSFULLY ===');
  return final;
}

export const TOOLS = [];