import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { AnnotationResult } from '../types';
import { SYSTEM_PROMPTS } from './prompts';

// ==================== ENVIRONMENT & CONFIGURATION ====================

/**
 * Safely retrieves environment variables with fallback support
 * Supports both Vite and Node.js environments
 */
const getEnv = (key: string): string => {
  const viteKey = `VITE_${key}`;
  const metaEnv = (import.meta as any).env || {};
  const processEnv = (typeof process !== 'undefined' ? process.env : {}) || {};
  return metaEnv[viteKey] || metaEnv[key] || processEnv[viteKey] || processEnv[key] || '';
};

/**
 * Supported AI providers for the vision pipeline
 */
type VisionProvider = 'scitely' | 'openai' | 'anthropic' | 'custom';

interface ProviderConfig {
  name: string;
  baseURL: string;
  supportsStructuredOutputs: boolean;
  requiresApiKey: boolean;
}

/**
 * Provider configurations for different AI services
 */
const PROVIDER_CONFIGS: Record<VisionProvider, ProviderConfig> = {
  scitely: {
    name: 'scitely',
    baseURL: 'https://api.scitely.com/v1',
    supportsStructuredOutputs: true,
    requiresApiKey: true,
  },
  openai: {
    name: 'openai',
    baseURL: 'https://api.openai.com/v1',
    supportsStructuredOutputs: true,
    requiresApiKey: true,
  },
  anthropic: {
    name: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    supportsStructuredOutputs: false,
    requiresApiKey: true,
  },
  custom: {
    name: 'custom',
    baseURL: '',
    supportsStructuredOutputs: true,
    requiresApiKey: false,
  },
};

/**
 * Creates and configures the AI model engine based on provider settings
 */
const getEngine = (stage: 'vision') => {
  const provider = getEnv('VISION_PROVIDER') as VisionProvider;
  const modelName = getEnv('VISION_MODEL');
  
  if (!provider) {
    throw new Error('VISION_PROVIDER environment variable is required. Set it to: scitely, openai, anthropic, or custom');
  }
  if (!modelName) {
    throw new Error('VISION_MODEL environment variable is required (e.g., gpt-4o, claude-3-5-sonnet-20241022)');
  }
  
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}. Supported: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`);
  }
  
  // Get API key based on provider
  const apiKeyMap: Record<VisionProvider, string> = {
    scitely: getEnv('SCITELY_API_KEY'),
    openai: getEnv('OPENAI_API_KEY'),
    anthropic: getEnv('ANTHROPIC_API_KEY'),
    custom: getEnv('CUSTOM_API_KEY'),
  };
  
  const apiKey = apiKeyMap[provider];
  if (config.requiresApiKey && !apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY environment variable is required`);
  }
  
  // Create provider instance
  const providerInstance = createOpenAICompatible({
    name: config.name,
    apiKey: apiKey || 'not-required',
    baseURL: provider === 'custom' ? getEnv('CUSTOM_BASE_URL') : config.baseURL,
    supportsStructuredOutputs: config.supportsStructuredOutputs,
  });
  
  return providerInstance(modelName);
};

// ==================== RETRY LOGIC WITH EXPONENTIAL BACKOFF ====================

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Generic retry wrapper with exponential backoff and configurable options
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  stage: string,
  onLog: (msg: string) => void,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBase = 2,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      onLog(`[SUCCESS] ${stage} (${duration}ms, attempt ${attempt}/${maxRetries})`);
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      onLog(`[ERROR] ${stage} failed on attempt ${attempt}/${maxRetries}: ${error.message}`);
      
      if (attempt === maxRetries) {
        break; // Exit loop to throw error below
      }
      
      // Calculate backoff delay with exponential increase and cap
      const backoff = Math.min(
        baseDelay * Math.pow(exponentialBase, attempt - 1),
        maxDelay
      );
      
      onLog(`[RETRY] Waiting ${backoff}ms before retry...`);
      
      // Optional retry callback
      if (onRetry) {
        try {
          onRetry(attempt, error);
        } catch (callbackError) {
          onLog(`[WARNING] Retry callback error: ${callbackError}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  
  throw new Error(
    `[CRITICAL] ${stage} failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

// ==================== VALIDATION SCHEMAS ====================

/**
 * Schema for global layout analysis (Pass 1)
 */
const GlobalLayoutSchema = z.object({
  envelopeBounds: z.object({
    minX: z.number().describe("Minimum X coordinate of building envelope"),
    minY: z.number().describe("Minimum Y coordinate of building envelope"),
    maxX: z.number().describe("Maximum X coordinate of building envelope"),
    maxY: z.number().describe("Maximum Y coordinate of building envelope"),
  }).describe("Precise building envelope in pixels - ALL rooms must be within this")
    .refine(data => data.maxX > data.minX && data.maxY > data.minY, {
      message: "Envelope bounds must have positive dimensions",
    }),
  
  scaleText: z.string().nullable().describe("Exact scale notation as shown on blueprint (e.g., '1/4\" = 1'-0\"')"),
  scaleConfidence: z.number().min(0).max(100).describe("Confidence in scale detection (0-100)"),
  
  overallDimensions: z.object({
    widthFeet: z.number().nullable().describe("Overall building width in feet"),
    depthFeet: z.number().nullable().describe("Overall building depth in feet"),
  }),
  
  visualDescription: z.string()
    .min(20)
    .describe("Detailed description: major spaces, layout pattern, organization"),
  
  spaceCount: z.number()
    .int()
    .positive()
    .describe("Approximate number of major spaces visible"),
});

/**
 * Schema for room label detection (Pass 2)
 */
const RoomLabelSchema = z.object({
  labels: z.array(z.object({
    roomName: z.string().min(1, "Room name cannot be empty"),
    
    type: z.enum([
      'bedroom', 'bathroom', 'living', 'kitchen', 'dining', 
      'hallway', 'foyer', 'utility', 'garage', 'patio', 
      'storage', 'closet', 'mechanical', 'room'
    ]).describe("Classified room type"),
    
    labelCenter: z.object({ 
      x: z.number(), 
      y: z.number() 
    }).describe("Center point of text label in pixels"),
    
    dimensionsText: z.string()
      .nullable()
      .describe("Room dimensions as written (e.g., '12'-4\" x 12'-11\"')"),
    
    confidence: z.number()
      .min(0)
      .max(100)
      .describe("OCR confidence level (0-100)"),
  }))
    .min(1, "At least one room label must be detected"),
});

/**
 * Schema for boundary tracing (Pass 3)
 */
const BoundarySchema = z.object({
  boundaries: z.array(z.object({
    roomName: z.string().min(1, "Room name must match a detected label"),
    
    boundingBox: z.tuple([
      z.number(), 
      z.number(), 
      z.number(), 
      z.number()
    ]).describe("Room bounds [xMin, yMin, xMax, yMax] in pixels"),
    
    extractedDimensions: z.object({
      widthFeet: z.number().positive(),
      depthFeet: z.number().positive(),
      confidence: z.number().min(0).max(100),
    }).nullable().describe("Parsed dimensions from text"),
    
    hasExteriorWalls: z.boolean().describe("True if room touches building envelope"),
    wallCount: z.number().int().min(0).max(4).describe("Number of walls enclosing the room"),
  }))
    .min(1, "At least one boundary must be traced"),
});

/**
 * Schema for connectivity analysis (Pass 4)
 */
const ConnectivitySchema = z.object({
  connections: z.array(z.object({
    room1: z.string().min(1, "First room name"),
    room2: z.string().min(1, "Second room name"),
    
    connectionType: z.enum([
      'door', 
      'opening', 
      'archway', 
      'sliding_door'
    ]).describe("Type of connection between rooms"),
    
    doorSwingVisible: z.boolean().describe("True if door swing arc is visible"),
    
    confidence: z.number()
      .min(0)
      .max(100)
      .describe("Confidence in connection detection"),
  })),
});

// ==================== VALIDATION UTILITIES ====================

/**
 * Validates that room boundaries are within the building envelope
 */
function validateRoomBounds(
  rooms: any[], 
  envelope: { minX: number; minY: number; maxX: number; maxY: number },
  onLog: (msg: string) => void
): { valid: number; outliers: any[] } {
  const envWidth = envelope.maxX - envelope.minX;
  const envHeight = envelope.maxY - envelope.minY;
  const margin = Math.min(envWidth, envHeight) * 0.02; // 2% tolerance
  
  const outliers = rooms.filter(r => {
    const [x1, y1, x2, y2] = r.boundingBox;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    
    return (
      centerX < envelope.minX - margin || 
      centerX > envelope.maxX + margin || 
      centerY < envelope.minY - margin || 
      centerY > envelope.maxY + margin
    );
  });
  
  if (outliers.length > 0) {
    onLog(`[WARNING] ${outliers.length} rooms outside envelope (potential hallucinations):`);
    outliers.forEach(r => onLog(`[WARNING]   - "${r.roomName}"`));
  }
  
  return {
    valid: rooms.length - outliers.length,
    outliers,
  };
}

/**
 * Validates that detected labels match expected space count
 */
function validateLabelCount(
  labelCount: number, 
  expectedCount: number,
  onLog: (msg: string) => void
): boolean {
  const threshold = expectedCount * 0.7; // 70% detection threshold
  
  if (labelCount < threshold) {
    onLog(`[WARNING] Only found ${labelCount} labels but visual assessment suggested ~${expectedCount} spaces`);
    onLog(`[WARNING] Possible OCR failure - labels may be too small or image quality insufficient`);
    return false;
  }
  
  return true;
}

// ==================== MAIN VISION PIPELINE ====================

export interface VisionPipelineOptions {
  maxRetries?: number;
  enableValidation?: boolean;
  strictMode?: boolean;
}

/**
 * Multi-pass vision analysis pipeline for architectural blueprints
 * 
 * @param imageParts - Array of base64-encoded images from PDF processing
 * @param onLog - Optional logging callback
 * @param options - Pipeline configuration options
 * @returns Structured annotation result with room data
 */
export async function runVisionStage(
  imageParts: any[],
  onLog?: (msg: string) => void,
  options: VisionPipelineOptions = {}
): Promise<AnnotationResult> {
  const {
    maxRetries = 2,
    enableValidation = true,
    strictMode = false,
  } = options;

  const log = (msg: string) => { 
    onLog?.(msg); 
    console.log(`[AI-Pipeline] ${msg}`); 
  };
  
  log('=== STARTING OPTIMIZED MULTI-PASS VISION PIPELINE ===');
  log(`[CONFIG] Max retries: ${maxRetries}, Validation: ${enableValidation}, Strict: ${strictMode}`);
  
  // Validate input images
  const base64Images = imageParts.map((part: any, index: number) => {
    if (!part.inlineData || !part.inlineData.data) {
      throw new Error(`Invalid image part at index ${index}: missing inlineData or data`);
    }
    return part.inlineData.data;
  });
  
  log(`[INIT] Processing ${base64Images.length} images`);
  
  if (base64Images.length === 0) {
    throw new Error('No images were generated from PDF processing');
  }

  // ==================== PASS 1: GLOBAL LAYOUT ====================
  log(`\n[PASS 1/4] Global Layout Analysis...`);
  
  const globalLayout = await withRetry(
    async () => {
      const result = await generateObject({
        model: getEngine('vision'),
        schema: GlobalLayoutSchema,
        messages: [{
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_GLOBAL_LAYOUT },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const
        }]
      });
      return result.object;
    },
    'Pass 1: Global Layout',
    log,
    { maxRetries }
  );
  
  log(`[PASS 1] Envelope: [${globalLayout.envelopeBounds.minX}, ${globalLayout.envelopeBounds.minY}, ${globalLayout.envelopeBounds.maxX}, ${globalLayout.envelopeBounds.maxY}]`);
  log(`[PASS 1] Scale: "${globalLayout.scaleText}" (${globalLayout.scaleConfidence}% confidence)`);
  log(`[PASS 1] Description: ${globalLayout.visualDescription}`);
  log(`[PASS 1] Approximate space count: ${globalLayout.spaceCount}`);

  // ==================== PASS 2: ROOM LABELS ====================
  log(`\n[PASS 2/4] Room Label Detection (OCR)...`);
  
  const envelopeStr = `[${globalLayout.envelopeBounds.minX}, ${globalLayout.envelopeBounds.minY}, ${globalLayout.envelopeBounds.maxX}, ${globalLayout.envelopeBounds.maxY}]`;
  
  const roomLabels = await withRetry(
    async () => {
      const result = await generateObject({
        model: getEngine('vision'),
        schema: RoomLabelSchema,
        messages: [{
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_ROOM_LABELS(envelopeStr) },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const
        }]
      });
      return result.object;
    },
    'Pass 2: Room Labels',
    log,
    { maxRetries }
  );
  
  log(`[PASS 2] Detected ${roomLabels.labels.length} labeled rooms`);
  
  if (enableValidation) {
    validateLabelCount(roomLabels.labels.length, globalLayout.spaceCount, log);
  }
  
  const typeCount = roomLabels.labels.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  log(`[PASS 2] Distribution: ${JSON.stringify(typeCount)}`);

  // ==================== PASS 3: BOUNDARIES ====================
  log(`\n[PASS 3/4] Boundary Tracing...`);
  
  const roomNames = roomLabels.labels.map(r => r.roomName).join(', ');
  
  const boundaries = await withRetry(
    async () => {
      const result = await generateObject({
        model: getEngine('vision'),
        schema: BoundarySchema,
        messages: [{
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_BOUNDARIES(roomNames, envelopeStr) },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const
        }]
      });
      return result.object;
    },
    'Pass 3: Boundaries',
    log,
    { maxRetries }
  );
  
  log(`[PASS 3] Traced ${boundaries.boundaries.length} boundaries`);

  // ==================== PASS 4: CONNECTIVITY ====================
  log(`\n[PASS 4/4] Connectivity Analysis...`);
  
  const connectivity = await withRetry(
    async () => {
      const result = await generateObject({
        model: getEngine('vision'),
        schema: ConnectivitySchema,
        messages: [{
          role: 'user',
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPTS.PROMPT_CONNECTIVITY(roomNames) },
            ...base64Images.map(img => ({ type: 'image' as const, image: img }))
          ] as const
        }]
      });
      return result.object;
    },
    'Pass 4: Connectivity',
    log,
    { maxRetries }
  );
  
  log(`[PASS 4] Found ${connectivity.connections.length} connections`);

  // ==================== ASSEMBLY ====================
  log(`\n[ASSEMBLY] Merging results...`);
  
  const rooms = roomLabels.labels.map(label => {
    const boundary = boundaries.boundaries.find(b => b.roomName === label.roomName);
    const connections = connectivity.connections
      .filter(c => c.room1 === label.roomName || c.room2 === label.roomName)
      .map(c => c.room1 === label.roomName ? c.room2 : c.room1);
    
    return {
      roomName: label.roomName,
      boundingBox: boundary?.boundingBox || [0, 0, 0, 0] as [number, number, number, number],
      dimensionsText: label.dimensionsText,
      reasoning: `Label: "${label.roomName}" at [${label.labelCenter.x}, ${label.labelCenter.y}]; Type: ${label.type}; ${boundary ? `Boundary traced with ${boundary.wallCount} walls` : 'Boundary not traced'}`,
      confidenceScore: Math.min(label.confidence, boundary?.extractedDimensions?.confidence || 50),
      type: label.type as 'hallway' | 'foyer' | 'corridor' | 'room',
      connectedRooms: connections,
      widthFeet: boundary?.extractedDimensions?.widthFeet,
    };
  });

  // ==================== VALIDATION ====================
  if (enableValidation) {
    log(`\n[VALIDATION] Checking results...`);
    
    const validationResult = validateRoomBounds(rooms, globalLayout.envelopeBounds, log);
    
    if (strictMode && validationResult.outliers.length > 0) {
      throw new Error(`Strict mode: ${validationResult.outliers.length} rooms failed validation`);
    }
  }

  const annotationResult: AnnotationResult = {
    scaleAnnotation: { 
      text: globalLayout.scaleText || "SCALE_NOT_DETECTED", 
      pixelLength: 100, 
      pixelsPerFoot: 100,
      confidence: globalLayout.scaleConfidence
    },
    rooms: rooms,
    metadata: {
      bedroomCount: typeCount['bedroom'] || 0,
      bathroomCount: typeCount['bathroom'] || 0,
      kitchenCount: typeCount['kitchen'] || 0,
      totalSpaces: rooms.length
    }
  };
  
  log(`\n[COMPLETE] Pipeline finished successfully`);
  log(`[SUMMARY] ${rooms.length} spaces detected`);
  log(`[SUMMARY] ${typeCount['bedroom'] || 0} bedrooms, ${typeCount['bathroom'] || 0} bathrooms, ${typeCount['kitchen'] || 0} kitchens`);
  
  return annotationResult;
}

/**
 * Legacy export for backward compatibility
 */
export const TOOLS = [];

/**
 * Export schemas for external validation
 */
export const VISION_SCHEMAS = {
  GlobalLayoutSchema,
  RoomLabelSchema,
  BoundarySchema,
  ConnectivitySchema,
} as const;