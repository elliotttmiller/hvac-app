
/**
 * MANUAL J: RESIDENTIAL LOAD CALCULATION (ACCA 8th Edition)
 * Core deterministic engine for heating loss and cooling gain.
 */

export interface ClimateConditions {
  outdoorTempWinter: number;
  outdoorTempSummer: number;
  indoorTempWinter: number;
  indoorTempSummer: number;
  humidityRatio: number; 
  orientation: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest' | 'mixed';
}

export interface BuildingEnvelope {
  wallArea: number;
  windowArea: number;
  doorArea: number;
  roofArea: number;
  floorArea: number;
  ceilingHeight: number;
  foundationType: 'slab' | 'basement' | 'crawlspace';
}

export interface PhysicsProps {
  wallUValue: number;
  windowUValue: number;
  windowSHGC: number;
  doorUValue: number;
  roofUValue: number;
  floorUValue: number;
  airChanges: number; 
  ventilationCFM: number;
}

export interface InternalLoads {
  occupancy: number;
  applianceLoadWatts: number;
  lightingLoadWatts: number;
}

export interface ManualJInput {
  climate: ClimateConditions;
  envelope: BuildingEnvelope;
  physics: PhysicsProps;
  internals: InternalLoads;
}

export interface ManualJOutput {
  heatingLoad: number;
  coolingSensible: number;
  coolingLatent: number;
  totalCooling: number;
  breakdown: Array<{
    component: string;
    heating: number;
    cooling: number;
  }>;
  sizing: {
    heatingBTU: number;
    coolingBTU: number;
    sensibleBTU: number;
    latentBTU: number;
    nominalTons: number;
  };
}

const CONSTANTS = {
  SOLAR_GAINS: {
    north: 15, south: 50, east: 120, west: 120,
    northeast: 80, northwest: 80, southeast: 100, southwest: 100, mixed: 80
  },
  FOUNDATION_FACTORS: { slab: 0.8, basement: 1.0, crawlspace: 1.2 },
  SENSIBLE_PER_PERSON: 230,
  LATENT_PER_PERSON: 200,
  SAFETY_FACTOR: 1.1,
  BTU_PER_WATT: 3.413
};

export class ManualJEngine {
  public static calculate(input: ManualJInput): ManualJOutput {
    const { climate, envelope, physics, internals } = input;
    const results = { heating: 0, sensible: 0, latent: 0, breakdown: [] as any[] };

    const dT_Heat = Math.max(0, climate.indoorTempWinter - climate.outdoorTempWinter);
    const dT_Cool = Math.max(0, climate.outdoorTempSummer - climate.indoorTempSummer);

    const addLoad = (name: string, heat: number, coolSens: number, coolLat: number = 0) => {
      results.heating += heat;
      results.sensible += coolSens;
      results.latent += coolLat;
      results.breakdown.push({
        component: name,
        heating: Math.round(heat),
        cooling: Math.round(coolSens + coolLat)
      });
    };

    // 1. Envelope Transmission
    addLoad('Walls', (physics.wallUValue || 0.05) * envelope.wallArea * dT_Heat, (physics.wallUValue || 0.05) * envelope.wallArea * dT_Cool);
    addLoad('Windows (Cond)', (physics.windowUValue || 0.55) * envelope.windowArea * dT_Heat, (physics.windowUValue || 0.55) * envelope.windowArea * dT_Cool);
    addLoad('Doors', (physics.doorUValue || 0.2) * envelope.doorArea * dT_Heat, (physics.doorUValue || 0.2) * envelope.doorArea * dT_Cool);
    addLoad('Roof/Ceiling', (physics.roofUValue || 0.03) * envelope.roofArea * dT_Heat, (physics.roofUValue || 0.03) * envelope.roofArea * dT_Cool);
    
    const fFactor = CONSTANTS.FOUNDATION_FACTORS[envelope.foundationType] || 1.0;
    addLoad('Floor', (physics.floorUValue || 0.04) * envelope.floorArea * dT_Heat * fFactor, (physics.floorUValue || 0.04) * envelope.floorArea * dT_Cool * fFactor * 0.5);

    // 2. Solar Gain
    const solarFactor = CONSTANTS.SOLAR_GAINS[climate.orientation] || 80;
    addLoad('Solar Gain', 0, envelope.windowArea * (physics.windowSHGC || 0.4) * solarFactor);

    // 3. Infiltration & Ventilation
    const vol = envelope.floorArea * envelope.ceilingHeight;
    const totalCFM = (((physics.airChanges || 0.35) * vol) / 60) + (physics.ventilationCFM || 15);
    addLoad('Air Link', totalCFM * 1.08 * dT_Heat, totalCFM * 1.08 * dT_Cool);
    
    const humidityDiff = Math.max(0, (climate.humidityRatio - 60) / 7000); 
    addLoad('Latent (Air)', 0, 0, totalCFM * 0.68 * humidityDiff * 1076);

    // 4. Internal Gains
    addLoad('Occupants', 0, internals.occupancy * CONSTANTS.SENSIBLE_PER_PERSON, internals.occupancy * CONSTANTS.LATENT_PER_PERSON);
    addLoad('Internal Power', 0, (internals.applianceLoadWatts + internals.lightingLoadWatts) * CONSTANTS.BTU_PER_WATT);

    const sensibleTotal = results.sensible * CONSTANTS.SAFETY_FACTOR;
    const latentTotal = results.latent * CONSTANTS.SAFETY_FACTOR;
    const coolingTotal = sensibleTotal + latentTotal;

    return {
      heatingLoad: Math.round(results.heating * CONSTANTS.SAFETY_FACTOR),
      coolingSensible: Math.round(sensibleTotal),
      coolingLatent: Math.round(latentTotal),
      totalCooling: Math.round(coolingTotal),
      breakdown: results.breakdown,
      sizing: {
        heatingBTU: Math.round(results.heating * 1.15),
        coolingBTU: Math.round(coolingTotal * 1.10),
        sensibleBTU: Math.round(sensibleTotal),
        latentBTU: Math.round(latentTotal),
        nominalTons: Math.round((coolingTotal * 1.10) / 12000 * 2) / 2
      }
    };
  }
}
