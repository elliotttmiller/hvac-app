import { ManualJInput, ManualJOutput, AEDExcursion, OrientationLoad, ClimateConditions } from '../../types';

const PSYCH = {
  LATENT_FACTOR: 0.68,
  SENSIBLE_FACTOR: 1.1,
  HUMIDITY_RATIO_INDOOR: 65
};

const SOLAR_PEAK_GAINS: Record<number, Record<string, number>> = {
  30: { N: 37, NE: 114, E: 202, SE: 198, S: 110, SW: 198, W: 202, NW: 114, Horizontal: 262 },
  40: { N: 39, NE: 108, E: 216, SE: 200, S: 106, SW: 200, W: 216, NW: 108, Horizontal: 258 },
  50: { N: 39, NE: 100, E: 219, SE: 195, S: 104, SW: 195, W: 219, NW: 100, Horizontal: 246 }
};

export class ManualJEngine {

  private static calculateGrainsDiff(design: ClimateConditions): number {
    const estimatedOutdoorGrains = design.outdoorTempSummer * 1.4 - 10;
    return Math.max(0, estimatedOutdoorGrains - PSYCH.HUMIDITY_RATIO_INDOOR);
  }

  private static getSolarGainFactor(lat: number, orient: string): number {
    const bucket = Math.round(lat / 10) * 10;
    const safeBucket = Math.max(30, Math.min(50, bucket));
    const table = SOLAR_PEAK_GAINS[safeBucket];
    if (!table || !table[orient]) return 50;
    return table[orient];
  }

  public static calculate(input: ManualJInput): ManualJOutput {
    const { design, surfaces, infiltration, ducts, internals } = input;
    
    const dT_Heat = Math.max(0, design.indoorTempWinter - design.outdoorTempWinter);
    const dT_Cool = Math.max(0, design.outdoorTempSummer - design.indoorTempSummer);

    const output = {
      heating: { total: 0, breakdown: {} as Record<string, number> },
      cooling: { sensible: 0, latent: 0, total: 0, breakdown: {} as Record<string, number> },
      psychrometrics: { grainsDifference: 0 }
    };

    surfaces.forEach((surf: any) => {
      const heatLoad = surf.uValue * surf.area * dT_Heat;
      output.heating.total += heatLoad;
      output.heating.breakdown[surf.name] = (output.heating.breakdown[surf.name] || 0) + Math.round(heatLoad);

      let coolLoad = 0;
      if (surf.type === 'window' && surf.shgc && surf.orientation) {
        const transmission = surf.uValue * surf.area * dT_Cool;
        const pshgf = this.getSolarGainFactor(design.latitude, surf.orientation);
        const solar = surf.area * surf.shgc * pshgf * (surf.internalShading || 1.0);
        coolLoad = transmission + solar;
      } else if (surf.cltd !== undefined) {
        coolLoad = surf.uValue * surf.area * surf.cltd;
      } else {
        coolLoad = surf.uValue * surf.area * dT_Cool;
      }
      output.cooling.sensible += coolLoad;
      output.cooling.breakdown[surf.name] = (output.cooling.breakdown[surf.name] || 0) + Math.round(coolLoad);
    });

    let cfm = 0;
    if (infiltration.method === 'ACH') {
      cfm = (infiltration.value * infiltration.volume) / 60;
    } else {
      cfm = infiltration.value * 0.05;
    }

    const infHeat = cfm * PSYCH.SENSIBLE_FACTOR * dT_Heat;
    const infCoolSens = cfm * PSYCH.SENSIBLE_FACTOR * dT_Cool;
    
    const grainsDiff = this.calculateGrainsDiff(design);
    output.psychrometrics.grainsDifference = grainsDiff;
    const infCoolLat = cfm * PSYCH.LATENT_FACTOR * grainsDiff;

    output.heating.total += infHeat;
    output.heating.breakdown['Infiltration'] = Math.round(infHeat);
    output.cooling.sensible += infCoolSens;
    output.cooling.breakdown['Infiltration Sensible'] = Math.round(infCoolSens);
    output.cooling.latent += infCoolLat;
    output.cooling.breakdown['Infiltration Latent'] = Math.round(infCoolLat);

    const peopleSens = internals.occupants * 230;
    const peopleLat = internals.occupants * 200;
    output.cooling.sensible += peopleSens + internals.applianceSensible;
    output.cooling.latent += peopleLat + internals.applianceLatent;
    output.cooling.breakdown['Internals'] = Math.round(peopleSens + internals.applianceSensible);

    if (ducts.location !== 'conditioned') {
      const ductLossFactor = 0.15;
      const ductGainFactor = 0.20;
      const ductHeat = output.heating.total * ductLossFactor;
      const ductCool = output.cooling.sensible * ductGainFactor;
      output.heating.total += ductHeat;
      output.heating.breakdown['Duct Loss'] = Math.round(ductHeat);
      output.cooling.sensible += ductCool;
      output.cooling.breakdown['Duct Gain'] = Math.round(ductCool);
    }

    const heatingLoad = Math.round(output.heating.total);
    const coolingSensible = Math.round(output.cooling.sensible);
    const coolingLatent = Math.round(output.cooling.latent);
    const totalCooling = coolingSensible + coolingLatent;
    const heatingCFM = Math.round(heatingLoad / (1.08 * 50));
    const coolingCFM = Math.round(coolingSensible / (1.08 * 20));

    return {
      heatingLoad,
      coolingSensible,
      coolingLatent,
      totalCooling,
      coolingLoad: totalCooling, // Key alignment for UI
      heatingCFM,
      coolingCFM,
      breakdown: Object.entries(output.heating.breakdown).map(([k, v]) => ({ component: k, heating: v, cooling: output.cooling.breakdown[k] || 0 })),
      psychrometrics: output.psychrometrics
    };
  }

  public static calculateAED(input: ManualJInput): AEDExcursion {
    const { design, surfaces } = input; 
    const fullCalc = this.calculate(input);
    const solarFactor = this.getSolarGainFactor(design.latitude, design.orientation);
    const windows = surfaces.filter(s => s.type === 'window');
    const windowArea = windows.reduce((a, b) => a + b.area, 0);
    const windowSHGC = windows.length > 0 ? windows[0].shgc || 0.3 : 0.3;

    const peakGlassLoad = windowArea * windowSHGC * solarFactor;
    const baseCoolingLoad = fullCalc.totalCooling - peakGlassLoad;

    const hourlyLoads: number[] = [];
    let totalGlazingLoad = 0;
    for (let hour = 0; hour < 24; hour++) {
       const sunIntensity = Math.max(0, Math.sin(((hour - 7) / 13) * Math.PI));
       const hourlyGlassLoad = peakGlassLoad * sunIntensity;
       hourlyLoads.push(baseCoolingLoad + hourlyGlassLoad);
       totalGlazingLoad += hourlyGlassLoad;
    }
    
    const averageGlazingLoad = totalGlazingLoad / 24;
    const maxGlazingLoad = Math.max(...hourlyLoads) - baseCoolingLoad;
    const excursion = ((maxGlazingLoad - averageGlazingLoad) / averageGlazingLoad) * 100;
    
    return {
      hourlyLoads,
      maxExcursionPercent: parseFloat(excursion.toFixed(1)),
      limitPercent: 30.0,
      status: excursion < 30 ? 'Pass' : 'Fail'
    };
  }

  public static calculateMultiOrientation(input: ManualJInput): OrientationLoad[] {
    const directions: Array<'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'> = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions.map(dir => {
      const tempInput = JSON.parse(JSON.stringify(input));
      tempInput.design.orientation = dir;
      const result = this.calculate(tempInput);
      return {
        direction: dir,
        sensible: result.coolingSensible,
        latent: result.coolingLatent,
        total: result.totalCooling,
        heatingCFM: result.heatingCFM,
        coolingCFM: result.coolingCFM
      };
    });
  }
}
