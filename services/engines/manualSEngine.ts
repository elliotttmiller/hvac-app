
// backend/engines/manualSEngine.ts

import { ManualSResult, EquipmentDetails } from '../types';

export class ManualSEngine {
  public static selectEquipment(heatingLoad: number, coolingLoad: number): { heating: EquipmentDetails, cooling: EquipmentDetails } {
    // Deterministic selection based on load for demo purposes
    const heatingOutput = Math.ceil(heatingLoad * 1.15); // 15% safety
    const coolingOutput = Math.ceil(coolingLoad * 1.05); // 5% safety
    
    return {
      heating: {
        make: "Carrier",
        model: "59TP6",
        ahriRef: "8923412",
        trade: "Furnace",
        efficiencyRating: "96.5% AFUE",
        airflowCFM: Math.round(heatingOutput / 50),
        outputBTU: heatingOutput,
        performance: {
           heatingBTUh: heatingOutput,
           totalCoolingBTUh: 0,
           sensibleCoolingBTUh: 0
        }
      },
      cooling: {
        make: "Carrier",
        model: "24VNA9",
        ahriRef: "2039481",
        trade: "A/C Split System",
        efficiencyRating: "19 SEER",
        airflowCFM: Math.round(coolingOutput / 20),
        outputBTU: coolingOutput,
        sensibleBTU: Math.round(coolingOutput * 0.75),
        latentBTU: Math.round(coolingOutput * 0.25),
        performance: {
          heatingBTUh: 0,
          totalCoolingBTUh: coolingOutput,
          sensibleCoolingBTUh: Math.round(coolingOutput * 0.75)
        }
      }
    };
  }

  public static verifySelection(
    load: { totalHeating: number; totalCooling: number; totalSensible: number; },
    equipment: EquipmentDetails
  ): ManualSResult {
    
    const { performance } = equipment;
    const totalCapacityRatio = performance.totalCoolingBTUh / load.totalCooling;
    const sensibleCapacityRatio = performance.sensibleCoolingBTUh / load.totalSensible;
    const heatingCapacityRatio = performance.heatingBTUh / load.totalHeating;

    let status: ManualSResult['status'] = 'Pass';
    if (totalCapacityRatio < 0.95) status = 'Fail: Undersized';
    if (totalCapacityRatio > 1.15) status = 'Fail: Oversized';
    if (sensibleCapacityRatio < 1.0) status = 'Warning: SHR Mismatch';

    return {
      status,
      totalCapacityRatio: parseFloat(totalCapacityRatio.toFixed(2)),
      sensibleCapacityRatio: parseFloat(sensibleCapacityRatio.toFixed(2)),
      heatingCapacityRatio: parseFloat(heatingCapacityRatio.toFixed(2)),
      sizingLimits: {
        minCoolingBTU: Math.round(load.totalCooling * 0.95),
        maxCoolingBTU: Math.round(load.totalCooling * 1.15)
      }
    };
  }
}
