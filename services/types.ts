import { z } from "zod";

// --- NEW AI Vision Pipeline Data Structures ---

export interface ZoneLabel {
  roomName: string;
  labelCoordinates: { x: number; y: number };
}

export interface DiscoveryResult {
  layout_reasoning: string; // NEW: The "Brain" of the operation
  scaleText: string | null;
  zones: ZoneLabel[];
}

export interface ZoneAnnotation {
  roomName: string;
  boundingBox: [number, number, number, number]; // [xmin, ymin, xmax, ymax]
  dimensionsText?: string | null;
  reasoning?: string;
}

export interface AnnotationResult {
  scaleAnnotation?: {
    text?: string;
    pixelLength?: number;
    pixelsPerFoot?: number;
  };
  rooms: ZoneAnnotation[];
  windows?: {
    boundingBox: [number, number, number, number];
  }[];
}

export const VisionTakeoffResultSchema = z.object({
  vision_reasoning: z.string().optional(),
  math_trace: z.string().optional(),
  metadata: z.object({
    jobName: z.string().optional(),
    client: z.string().optional()
  }).optional(),
  rooms: z.array(z.object({
    name: z.string().min(1, "Room name cannot be empty"),
    area: z.number().gt(0, "Room area must be greater than zero"), 
    windows: z.number().optional(),
    orientation: z.string().optional()
  })).min(1, "The rooms array cannot be empty. Vision AI failed to detect conditioned zones."),
  construction: z.object({
    wallType: z.string().optional(),
    windowType: z.string().optional()
  }).optional(),
  totalEnvelope: z.object({
     conditionedFloorArea: z.number().gt(50, "Total area too small")
  }),
  error: z.string().optional()
});

export type VisionTakeoffResult = z.infer<typeof VisionTakeoffResultSchema>;


// --- Core Application State & Engineering Data Structures ---

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
  status: 'COMPLETE';
  processingMetrics?: { calculationTime: number };
  visionRawData?: AnnotationResult;
}

export interface ProjectMetadata {
  jobName: string;
  clientName: string;
  clientCompany?: string;
  designerName: string;
  reportDate: string;
}

export interface DesignConditions {
  location: {
    city: string;
    state: string;
    latitude: number;
    elevation: number;
  };
  heating: { 
      outdoorDB: number; 
      indoorDB: number; 
      designTD?: number;
  };
  cooling: { 
      outdoorDB: number; 
      indoorDB: number; 
      outdoorWB?: number; 
      indoorRH?: number; 
      dailyRange: 'L' | 'M' | 'H'; 
      designTD?: number;
  };
  moistureDiff?: number;
  infiltration?: { method: string; quality?: string };
}

export interface Construction {
  infiltrationACH50: number;
  shieldingClass: 1 | 2 | 3 | 4 | 5;
  ductSystem: {
    location: 'conditioned' | 'attic' | 'crawlspace';
    rValue: number;
    supplyArea: number;
    returnArea: number;
  };
}

export interface Room {
  id: string;
  name: string;
  area: number;
  volume: number;
  surfaces: Surface[];
  internals: { occupants: number; };
  calculationResult: ManualJRoomResult;
  terminals: ManualTRegisterResult[];
}

export interface Surface {
  id: string;
  name?: string;
  type: 'wall' | 'window' | 'door' | 'roof' | 'floor';
  area: number;
  uValue: number;
  cltd?: number;
  shgc?: number;
  internalShading?: number;
  orientation?: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW' | 'Horizontal';
}

export interface ClimateConditions {
    outdoorTempWinter: number;
    outdoorTempSummer: number;
    indoorTempWinter: number;
    indoorTempSummer: number;
    dailyRange: 'L'|'M'|'H';
    latitude: number;
    orientation: string;
}

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

export interface ManualJRoomResult {
  heatingLoad: number;
  coolingSensible: number;
  coolingLatent: number;
  coolingLoad: number;
  totalCooling: number;
  heatingCFM: number;
  coolingCFM: number;
}

export interface ManualJSystemResult {
  roomResults?: Record<string, ManualJRoomResult>;
  totalHeating: number;
  totalCooling: number;
  totalCoolingSensible?: number;
  totalCoolingLatent?: number;
  totalCoolingLoad?: number;
  totalHeatingCFM?: number;
  totalCoolingCFM?: number;
  breakdown?: Array<{ component: string; heating: number; cooling: number }>;
}

export interface ManualJOutput {
  heatingLoad: number;
  coolingSensible: number;
  coolingLatent: number;
  totalCooling: number;
  coolingLoad: number;
  heatingCFM: number;
  coolingCFM: number;
  breakdown: Array<{ component: string; heating: number; cooling: number }>;
  psychrometrics: { grainsDifference: number };
}

export interface EquipmentDetails {
  make: string;
  model: string;
  ahriRef: string;
  trade?: string;
  efficiencyRating?: string;
  airflowCFM?: number;
  outputBTU: number;
  sensibleBTU?: number;
  latentBTU?: number;
  performance: {
    heatingBTUh: number;
    totalCoolingBTUh: number;
    sensibleCoolingBTUh: number;
  };
}

export interface ManualSResult {
  status: 'Pass' | 'Fail: Undersized' | 'Fail: Oversized' | 'Warning: SHR Mismatch';
  totalCapacityRatio: number;
  sensibleCapacityRatio: number;
  heatingCapacityRatio: number;
  sizingLimits: {
    minCoolingBTU: number;
    maxCoolingBTU: number;
  };
}

export interface ManualDResult {
  frictionRate: number;
  totalCFM: number;
  branches: Array<{
    name: string;
    cfm: number;
    roundSize: number;
    velocity: number;
  }>;
}

export interface ManualTResult {
  terminals: ManualTRegisterResult[];
}

export interface ManualTRegisterResult {
  roomName: string;
  requiredCFM: number;
  registerCount: number;
  cfmPerRegister: number;
  estimatedThrow: number;
  velocityFPM: number;
  type?: 'Floor' | 'Ceiling' | 'High-Wall';
  size?: string;
  status?: 'Pass' | 'Fail: Noisy' | 'Fail: Poor Throw';
}

export interface AEDExcursion { 
    hourlyLoads: number[];
    maxExcursionPercent: number;
    limitPercent: number;
    status: 'Pass' | 'Fail';
}

export interface OrientationLoad {
    direction: string;
    sensible: number;
    latent: number;
    total: number;
    heatingCFM: number;
    coolingCFM: number;
}