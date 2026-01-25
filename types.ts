
export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum SourceType {
  AI_VISION = 'AI_VISION',
  USER_OVERRIDE = 'USER_OVERRIDE',
  PHYSICS_ENGINE = 'PHYSICS_ENGINE',
  RAG_LOOKUP = 'RAG_LOOKUP',
  MANUAL_J_TABLE = 'MANUAL_J_TABLE'
}

export interface TraceableValue<T> {
  value: T;
  unit: string;
  source: SourceType;
  citation: string;
  confidence: ConfidenceLevel;
  timestamp: string;
  id: string;
}

export interface ConstructionDetails {
  wallType: string; 
  rValue: number;
  uValue: number;
  glazingRatio: number;
  headerType?: string;
}

export interface MechanicalSpace {
  type: 'CLOSET' | 'CHASE' | 'ATTIC' | 'BASEMENT';
  dimensions: string;
  clearanceVerified: boolean;
}

export interface RoomLoadBreakdown {
  component: string;
  heating: number;
  cooling: number;
}

export interface RoomData {
  id: string;
  name: string;
  area: TraceableValue<number>;
  exteriorWallLength: number;
  windowsArea: number;
  construction: ConstructionDetails;
  mechanicalSpaces?: MechanicalSpace[];
  calculatedLoads?: {
    heating: number;
    cooling: number;
    parityVariance: number; 
    notes: string;
    breakdown: RoomLoadBreakdown[];
  };
}

export interface SafetyFactors {
  heating: number; // ACCA standard: 1.15
  cooling: number; // ACCA standard: 1.10
}

export interface EquipmentScenario {
  id: string;
  label: 'VALUE' | 'EFFICIENCY' | 'PREMIUM';
  modelNumber: string;
  manufacturer: string;
  seer2: number;
  hspf2: number;
  capacityBtuh: number;
  estimatedPrice: number;
  roiYears: number;
  pros: string[];
  compliance: {
    manualS: boolean;
    localCode: boolean;
  };
}

export interface ProjectState {
  id: string;
  name: string;
  location: {
    city: string;
    winterDesign: number;
    summerDesign: number;
    climateZone: number;
    elevation?: number;
    latitude?: number;
  };
  rooms: RoomData[];
  safetyFactors: SafetyFactors;
  scenarios: EquipmentScenario[];
  status: 'INGESTING' | 'CALCULATING' | 'MATCHING' | 'COMPLETE';
  processingMetrics: {
    visionConfidence: number;
    calculationTime: number;
    wrightsoftParity: number;
  };
}
