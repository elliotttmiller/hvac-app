/**
 * Type Definitions for HVAC Compliance Engine
 * 
 * This module contains all TypeScript interfaces and types for:
 * - AI Vision Pipeline data structures
 * - Manual J load calculation inputs/outputs
 * - HVAC equipment and system data
 * - Compliance reporting (Manual S, D, T)
 * - Project state management
 */

import { z } from "zod";

// ==================== AI SDK CONTENT PART TYPES ====================

export type TextPart = {
  type: 'text';
  text: string;
};

export type ImagePart = {
  type: 'image';
  image: string; // Base64 or URL
  mimeType?: string;
};

export type FilePart = {
  type: 'file';
  file: string; // Base64 or URL
  mimeType: string;
  fileName: string;
};

export type ReasoningPart = {
  type: 'reasoning';
  content: string;
};

export type ToolCallPart = {
  type: 'tool-call';
  toolName: string;
  toolArguments: Record<string, any>;
};

export type ToolResultPart = {
  type: 'tool-result';
  toolName: string;
  result: any;
};

export type ToolApprovalRequest = {
  type: 'tool-approval-request';
  toolName: string;
  toolArguments: Record<string, any>;
};

export type ToolApprovalResponse = {
  type: 'tool-approval-response';
  approved: boolean;
  reasoning?: string;
};

/**
 * Union type for all possible content parts in AI messages
 */
export type ContentPart =
  | string
  | TextPart
  | ImagePart
  | FilePart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | ToolApprovalRequest
  | ToolApprovalResponse;

// ==================== AI VISION PIPELINE DATA STRUCTURES ====================

/**
 * Room type classification
 */
export type RoomType = 
  | 'bedroom' 
  | 'bathroom' 
  | 'living' 
  | 'kitchen' 
  | 'dining' 
  | 'hallway' 
  | 'foyer' 
  | 'utility' 
  | 'garage' 
  | 'patio' 
  | 'storage' 
  | 'closet' 
  | 'mechanical' 
  | 'room'
  | 'corridor';

/**
 * Connection type between rooms
 */
export type ConnectionType = 
  | 'door' 
  | 'opening' 
  | 'archway' 
  | 'sliding_door';

/**
 * Label detected during OCR phase (Stage 1A)
 */
export interface ZoneLabel {
  roomName: string;
  labelCoordinates: { x: number; y: number };
}

/**
 * Legacy discovery result structure (if needed for compatibility)
 */
export interface DiscoveryResult {
  layout_reasoning: string;
  scaleText: string | null;
  zones: ZoneLabel[];
  confidenceScore?: number;
  processingTime?: number;
}

/**
 * Spatial annotation for a single room/zone
 * Used in multi-pass vision analysis output
 */
export interface ZoneAnnotation {
  roomName: string;
  boundingBox: [number, number, number, number]; // [xMin, yMin, xMax, yMax] in pixels
  dimensionsText?: string | null;
  reasoning?: string | null;
  confidenceScore?: number;
  widthFeet?: number;
  type?: RoomType;
  connectivityScore?: number;
  connectedRooms?: string[];
}

/**
 * Complete annotation result from vision analysis
 * This is the primary output of the AI vision pipeline
 */
export interface AnnotationResult {
  scaleAnnotation?: {
    text?: string;
    pixelLength?: number;
    pixelsPerFoot?: number;
    confidence?: number;
  };
  rooms: ZoneAnnotation[];
  metadata?: {
    bedroomCount?: number;
    bathroomCount?: number;
    kitchenCount?: number;
    totalSpaces?: number;
  };
}

/**
 * Zod schema for vision takeoff validation
 * Used when AI generates complete project data in one pass
 */
export const VisionTakeoffResultSchema = z.object({
  vision_reasoning: z.string().optional(),
  math_trace: z.string().optional(),
  metadata: z.object({
    jobName: z.string().optional(),
    client: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  rooms: z.array(z.object({
    name: z.string().min(1, "Room name cannot be empty"),
    area: z.number().gt(0, "Area must be positive"),
    windows: z.number().optional(),
    orientation: z.string().optional(),
    isConditioned: z.boolean().describe(
      "True if heated/cooled (Living, Bed, Kitchen), False for Garage/Patio/Porch"
    ),
    confidenceScore: z.number().min(0).max(100).optional(),
  })).min(1, "The rooms array cannot be empty."),
  construction: z.object({
    wallType: z.string().optional(),
    windowType: z.string().optional(),
  }).optional(),
  totalEnvelope: z.object({
    conditionedFloorArea: z.number().gt(50, "Conditioned area too small for residence"),
    grossTotalArea: z.number().optional().describe(
      "Total footprint including unconditioned spaces"
    ),
    scaleConfidence: z.number().min(0).max(100).optional(),
  }),
  error: z.string().optional(),
  processingMetrics: z.object({
    totalDuration: z.number().optional(),
    stageDurations: z.record(z.number()).optional(),
  }).optional(),
});

export type VisionTakeoffResult = z.infer<typeof VisionTakeoffResultSchema>;

// ==================== PROJECT STATE & METADATA ====================

/**
 * Pipeline execution status
 */
export type PipelineStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'PARTIAL_SUCCESS';

/**
 * Project execution status
 */
export type ProjectStatus = 'COMPLETE' | 'PROCESSING' | 'ERROR';

/**
 * Warning severity levels
 */
export type WarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Pipeline error details
 */
export interface PipelineError {
  stage: string;
  message: string;
  timestamp: string;
  attempts?: number;
  provider?: string;
}

/**
 * Pipeline warning details
 */
export interface PipelineWarning {
  message: string;
  timestamp: string;
  severity?: WarningSeverity;
}

/**
 * Metrics for a single pipeline stage
 */
export interface PipelineStageMetrics {
  duration: number;
  [key: string]: any; // Allow additional stage-specific metrics
}

/**
 * Complete pipeline execution metrics
 */
export interface PipelineMetrics {
  pipelineId: string;
  stages: Record<string, PipelineStageMetrics>;
  totalDuration: number;
  errors: PipelineError[];
  warnings: PipelineWarning[];
  pipelineStatus: PipelineStatus;
  aiProvider?: string;
  modelUsed?: string;
  retryCount?: number;
}

/**
 * Project metadata and identification
 */
export interface ProjectMetadata {
  jobName: string;
  clientName: string;
  clientCompany?: string;
  designerName: string;
  reportDate: string; // ISO 8601 format
  pipelineMetrics?: PipelineMetrics;
}

// ==================== DESIGN CONDITIONS ====================

/**
 * Geographic location information
 */
export interface Location {
  city: string;
  state: string;
  latitude: number;
  elevation: number; // feet above sea level
}

/**
 * Heating design conditions
 */
export interface HeatingConditions {
  outdoorDB: number;  // Outdoor design dry-bulb (°F)
  indoorDB: number;   // Indoor design dry-bulb (°F)
  designTD?: number;  // Design temperature difference
}

/**
 * Daily temperature range classification
 */
export type DailyRange = 'L' | 'M' | 'H'; // Low, Medium, High

/**
 * Cooling design conditions
 */
export interface CoolingConditions {
  outdoorDB: number;      // Outdoor design dry-bulb (°F)
  indoorDB: number;       // Indoor design dry-bulb (°F)
  outdoorWB?: number;     // Outdoor wet-bulb (°F)
  indoorRH?: number;      // Indoor relative humidity (%)
  dailyRange: DailyRange; // Daily temperature swing
  designTD?: number;      // Design temperature difference
}

/**
 * Complete design conditions for load calculations
 */
export interface DesignConditions {
  location: Location;
  heating: HeatingConditions;
  cooling: CoolingConditions;
  moistureDiff?: number;
  infiltration?: { 
    method: string; 
    quality?: string; 
  };
}

// ==================== CONSTRUCTION DETAILS ====================

/**
 * Shielding class for infiltration calculations
 */
export type ShieldingClass = 1 | 2 | 3 | 4 | 5;

/**
 * Duct system location
 */
export type DuctLocation = 'conditioned' | 'attic' | 'crawlspace' | 'basement' | 'garage';

/**
 * Duct system specifications
 */
export interface DuctSystem {
  location: DuctLocation;
  rValue: number;      // Duct insulation R-value
  supplyArea: number;  // Supply duct surface area (sq ft)
  returnArea: number;  // Return duct surface area (sq ft)
}

/**
 * Building construction characteristics
 */
export interface Construction {
  infiltrationACH50: number;  // Air changes per hour at 50 Pa
  shieldingClass: ShieldingClass;
  ductSystem: DuctSystem;
}

// ==================== ROOM & SURFACE DEFINITIONS ====================

/**
 * Surface orientation
 */
export type Orientation = 
  | 'N' | 'S' | 'E' | 'W' 
  | 'NE' | 'NW' | 'SE' | 'SW' 
  | 'Horizontal';

/**
 * Surface type
 */
export type SurfaceType = 'wall' | 'window' | 'door' | 'roof' | 'floor' | 'ceiling';

/**
 * Building surface (wall, window, etc.)
 */
export interface Surface {
  id: string;
  name?: string;
  type: SurfaceType;
  area: number;                   // Square feet
  uValue: number;                 // U-factor (BTU/hr·ft²·°F)
  cltd?: number;                  // Cooling load temperature difference
  shgc?: number;                  // Solar heat gain coefficient (for windows)
  internalShading?: number;       // Internal shading factor
  orientation?: Orientation;
}

/**
 * Manual J calculation result for a single room
 */
export interface ManualJRoomResult {
  heatingLoad: number;        // BTU/hr
  coolingSensible: number;    // BTU/hr
  coolingLatent: number;      // BTU/hr
  coolingLoad: number;        // BTU/hr (sensible + latent)
  totalCooling: number;       // BTU/hr (with ventilation/infiltration)
  heatingCFM: number;         // Required heating airflow
  coolingCFM: number;         // Required cooling airflow
}

/**
 * Manual T register/terminal specification
 */
export interface ManualTRegisterResult {
  roomName: string;
  requiredCFM: number;
  registerCount: number;
  cfmPerRegister: number;
  estimatedThrow: number;     // feet
  velocityFPM: number;        // feet per minute
  type?: 'Floor' | 'Ceiling' | 'High-Wall';
  size?: string;              // e.g., "4x10", "6x12"
  status?: 'Pass' | 'Fail: Noisy' | 'Fail: Poor Throw';
}

/**
 * Room/space definition
 */
export interface Room {
  id: string;
  name: string;
  area: number;              // Square feet
  volume: number;            // Cubic feet
  surfaces: Surface[];
  internals: { 
    occupants: number;       // Number of people
  };
  calculationResult: ManualJRoomResult;
  terminals: ManualTRegisterResult[];
}

// ==================== LOAD CALCULATION TYPES ====================

/**
 * Climate conditions for load calculations
 */
export interface ClimateConditions {
  outdoorTempWinter: number;
  outdoorTempSummer: number;
  indoorTempWinter: number;
  indoorTempSummer: number;
  dailyRange: DailyRange;
  latitude: number;
  orientation: string;
}

/**
 * Manual J calculation input
 */
export interface ManualJInput {
  design: ClimateConditions;
  surfaces: Array<{
    name: string;
    type: string;
    area: number;
    uValue: number;
    shgc?: number;
    orientation?: string;
    cltd?: number;
    internalShading?: number;
  }>;
  infiltration: {
    method: 'ACH' | 'CFM';
    value: number;
    volume: number;
  };
  ducts: {
    location: string;
    rValue: number;
    area: number;
  };
  internals: {
    occupants: number;
    applianceSensible: number;
    applianceLatent: number;
  };
}

/**
 * Manual J system-level results
 */
export interface ManualJSystemResult {
  roomResults?: Record<string, ManualJRoomResult>;
  totalHeating: number;
  totalCooling: number;
  totalCoolingSensible?: number;
  totalCoolingLatent?: number;
  totalCoolingLoad?: number;
  totalHeatingCFM?: number;
  totalCoolingCFM?: number;
  breakdown?: Array<{ 
    component: string; 
    heating: number; 
    cooling: number; 
  }>;
}

/**
 * Detailed Manual J output with breakdown
 */
export interface ManualJOutput {
  heatingLoad: number;
  coolingSensible: number;
  coolingLatent: number;
  totalCooling: number;
  coolingLoad: number;
  heatingCFM: number;
  coolingCFM: number;
  breakdown: Array<{ 
    component: string; 
    heating: number; 
    cooling: number; 
  }>;
  psychrometrics: { 
    grainsDifference: number; 
  };
}

// ==================== EQUIPMENT TYPES ====================

/**
 * Equipment performance specifications
 */
export interface EquipmentPerformance {
  heatingBTUh: number;
  totalCoolingBTUh: number;
  sensibleCoolingBTUh: number;
}

/**
 * HVAC equipment details
 */
export interface EquipmentDetails {
  make: string;
  model: string;
  ahriRef: string;                  // AHRI reference number
  trade?: string;
  efficiencyRating?: string;        // SEER, AFUE, HSPF, etc.
  airflowCFM?: number;
  outputBTU: number;
  sensibleBTU?: number;
  latentBTU?: number;
  performance: EquipmentPerformance;
}

// ==================== COMPLIANCE RESULTS ====================

/**
 * Manual S sizing compliance status
 */
export type ManualSStatus = 
  | 'Pass' 
  | 'Fail: Undersized' 
  | 'Fail: Oversized' 
  | 'Warning: SHR Mismatch' 
  | 'Fail';

/**
 * Manual S equipment sizing result
 */
export interface ManualSResult {
  status: ManualSStatus;
  totalCapacityRatio: number;
  sensibleCapacityRatio: number;
  heatingCapacityRatio: number;
  sizingLimits: {
    minCoolingBTU: number;
    maxCoolingBTU: number;
  };
}

/**
 * Manual D duct branch specification
 */
export interface ManualDBranch {
  name: string;
  cfm: number;
  roundSize: number;    // inches
  velocity: number;     // FPM
}

/**
 * Manual D duct design result
 */
export interface ManualDResult {
  frictionRate: number;
  totalCFM: number;
  branches: ManualDBranch[];
}

/**
 * Manual T air distribution result
 */
export interface ManualTResult {
  terminals: ManualTRegisterResult[];
}

// ==================== ADVANCED SIMULATIONS ====================

/**
 * AED excursion analysis status
 */
export type AEDStatus = 'Pass' | 'Fail';

/**
 * Annual Energy Distribution excursion analysis
 */
export interface AEDExcursion {
  hourlyLoads: number[];
  maxExcursionPercent: number;
  limitPercent: number;
  status: AEDStatus;
}

/**
 * Multi-orientation load analysis
 */
export interface OrientationLoad {
  direction: string;
  sensible: number;
  latent: number;
  total: number;
  heatingCFM: number;
  coolingCFM: number;
}

// ==================== MAIN PROJECT STATE ====================

/**
 * Complete project state
 * 
 * This is the primary data structure that contains all information
 * about a project, from vision analysis through load calculations
 * to equipment selection and compliance reporting.
 */
export interface ProjectState {
  id: string;
  metadata: ProjectMetadata;
  designConditions: DesignConditions;
  construction: Construction;
  rooms: Room[];
  systemTotals: ManualJSystemResult;
  selectedEquipment: {
    heating: EquipmentDetails;
    cooling: EquipmentDetails;
  };
  compliance: {
    manualS: ManualSResult;
    manualD: ManualDResult;
    manualT: ManualTResult;
  };
  advancedSimulations: {
    aed: AEDExcursion;
    multiOrientation: OrientationLoad[];
  };
  status: ProjectStatus;
  processingMetrics?: { 
    calculationTime: number; 
  };
  visionRawData?: AnnotationResult;  // Stores raw vision data for audit
}

// ==================== UTILITY TYPES ====================

/**
 * AI failure tracking
 */
export interface AIFailureDetails {
  stage: string;
  attempts: number;
  lastError: string;
  timestamp: string;
}

/**
 * Type guard to check if a value is a valid RoomType
 */
export function isRoomType(value: any): value is RoomType {
  const validTypes: RoomType[] = [
    'bedroom', 'bathroom', 'living', 'kitchen', 'dining',
    'hallway', 'foyer', 'utility', 'garage', 'patio',
    'storage', 'closet', 'mechanical', 'room', 'corridor'
  ];
  return typeof value === 'string' && validTypes.includes(value as RoomType);
}

/**
 * Type guard to check if a value is a valid ConnectionType
 */
export function isConnectionType(value: any): value is ConnectionType {
  const validTypes: ConnectionType[] = ['door', 'opening', 'archway', 'sliding_door'];
  return typeof value === 'string' && validTypes.includes(value as ConnectionType);
}

/**
 * Type guard to check if a project state is complete
 */
export function isCompleteProject(state: ProjectState): boolean {
  return (
    state.status === 'COMPLETE' &&
    state.rooms.length > 0 &&
    state.systemTotals.totalHeating > 0 &&
    state.systemTotals.totalCooling > 0
  );
}

/**
 * Helper to calculate total conditioned area
 */
export function getConditionedArea(rooms: Room[]): number {
  return rooms
    .filter(r => r.internals.occupants > 0)
    .reduce((sum, r) => sum + r.area, 0);
}

/**
 * Helper to get room count by type
 */
export function getRoomCountsByType(annotations: ZoneAnnotation[]): Record<string, number> {
  return annotations.reduce((counts, room) => {
    const type = room.type || 'room';
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

/**
 * Helper to validate bounding box
 */
export function isValidBoundingBox(box: [number, number, number, number]): boolean {
  const [x1, y1, x2, y2] = box;
  return x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0;
}