
/**
 * MANUAL S: RESIDENTIAL EQUIPMENT SELECTION
 * Standard for verifying equipment capacity matches the design load.
 */

export interface SizingCompliance {
  isCompliant: boolean;
  coolingRatio: number;
  heatingRatio: number;
  status: 'OPTIMAL' | 'OVERSIZED' | 'UNDERSIZED';
  notes: string;
  coolingCompliance: string;
  sensibleCompliance: string;
  heatingCompliance: string;
}

export class ManualSEngine {
  /**
   * ACCA Rules:
   * Cooling: 95% to 115% of total cooling load (125% for variable speed).
   * Heating: 100% to 140% of design heating load.
   */
  public static verifySelection(
    load: { sensible: number, total: number, heating: number },
    equipment: { sensible: number, total: number, heating: number }
  ): SizingCompliance {
    const coolingRatio = equipment.total / (load.total || 1);
    const heatingRatio = equipment.heating / (load.heating || 1);
    const sensibleRatio = equipment.sensible / (load.sensible || 1);

    let status: 'OPTIMAL' | 'OVERSIZED' | 'UNDERSIZED' = 'OPTIMAL';
    if (coolingRatio < 0.95) status = 'UNDERSIZED';
    else if (coolingRatio > 1.25) status = 'OVERSIZED';

    const isCompliant = coolingRatio >= 0.95 && coolingRatio <= 1.25 && heatingRatio >= 1.0;

    return {
      isCompliant,
      coolingRatio,
      heatingRatio,
      status,
      coolingCompliance: coolingRatio.toFixed(2),
      sensibleCompliance: sensibleRatio.toFixed(2),
      heatingCompliance: heatingRatio.toFixed(2),
      notes: isCompliant 
        ? "Selection is within ACCA Manual S tolerances." 
        : `Non-compliant: ${status === 'OVERSIZED' ? 'Equipment capacity exceeds 125% limit.' : 'Equipment capacity fails to meet 95% threshold.'}`
    };
  }
}
