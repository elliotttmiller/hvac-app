

export interface TraceableValue<T> {
  readonly value: T;
  readonly unit: string;
  readonly source: 'AI_VISION' | 'USER_OVERRIDE' | 'PHYSICS_ENGINE';
  readonly confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly timestamp: string;
}

export interface ProjectMetadata {
  readonly jobName: string;
  readonly clientName: string;
  readonly clientCompany: string;
  readonly designerName: string;
  readonly planName: string;
  readonly reportDate: string;
}

export interface EquipmentDetails {
  readonly type: 'HEATING' | 'COOLING';
  readonly make: string;
  readonly trade: string;
  readonly model: string;
  readonly ahriRef: string;
  readonly efficiencyRating: string;
  readonly efficiencyValue: number;
  readonly inputBTU?: number;
  readonly outputBTU: number;
  readonly sensibleBTU?: number;
  readonly latentBTU?: number;
  readonly airflowCFM: number;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly area: number;
  readonly calculationResult: {
    readonly heatingLoad: number;
    readonly coolingLoad: number;
    readonly heatingCFM: number;
    readonly coolingCFM: number;
  };
}

export interface AEDExcursion {
  readonly hourlyLoads: number[];
  readonly maxExcursionPercent: number;
  readonly limitPercent: number;
  readonly status: 'Pass' | 'Fail';
}

export interface OrientationLoad {
  readonly direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  readonly sensible: number;
  readonly latent: number;
  readonly total: number;
  readonly heatingCFM: number;
  readonly coolingCFM: number;
}

export interface ProjectState {
  readonly id: string;
  readonly metadata: ProjectMetadata;
  readonly designConditions: {
    readonly heating: { outdoorDB: number; indoorDB: number; designTD: number; };
    readonly cooling: { outdoorDB: number; indoorDB: number; designTD: number; dailyRange: 'L' | 'M' | 'H'; };
    readonly infiltration: { method: string; quality: string; };
    readonly moistureDiff: number;
  };
  readonly rooms: ReadonlyArray<Room>;
  readonly selectedEquipment: {
    readonly heating: EquipmentDetails;
    readonly cooling: EquipmentDetails;
  };
  readonly advancedSimulations: {
    readonly aed: AEDExcursion;
    readonly multiOrientation: ReadonlyArray<OrientationLoad>;
  };
  readonly systemTotals: {
    readonly totalHeating: number;
    readonly totalCooling: number;
    readonly structureLoad: { heating: number; cooling: number; };
    readonly ductLoad: { heating: number; cooling: number; };
    readonly ventilationLoad: { heating: number; cooling: number; };
    readonly totalEquipmentLoad: { heating: number; cooling: number; };
    readonly totalSensible: number;
    readonly totalLatent: number;
    readonly totalAirflow: number;
  };
  readonly status: 'COMPLETE';
  readonly processingMetrics: {
    readonly calculationTime: number;
  };
}

export interface ManualJInput {
  design: any;
  surfaces: any[];
  infiltration: any;
  ducts: any;
  internals: any;
}

export interface ManualJOutput {
  heatingLoad: number;
  coolingSensible: number;
  coolingLatent: number;
  totalCooling: number;
  heatingCFM: number;
  coolingCFM: number;
  breakdown: any[];
  psychrometrics: any;
}

export interface ClimateConditions {
    outdoorTempWinter: number;
    outdoorTempSummer: number;
    indoorTempWinter: number;
    indoorTempSummer: number;
    indoorRHSummer: number;
    latitude: number;
    dailyRange: string;
    orientation: string;
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
  terminals: Array<{
    roomName: string;
    requiredCFM: number;
    registerCount: number;
    cfmPerRegister: number;
    estimatedThrow: number;
    velocityFPM: number;
  }>;
}