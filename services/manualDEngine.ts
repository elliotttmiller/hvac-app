
/**
 * MANUAL D: RESIDENTIAL DUCT DESIGN
 * Core logic for friction rate calculation and branch sizing.
 */

export interface DuctSizing {
  frictionRate: number;
  totalCFM: number;
  branches: Array<{
    name: string;
    cfm: number;
    roundSize: number;
    velocity: number;
  }>;
}

export class ManualDEngine {
  /**
   * Friction Rate = (ASP * 100) / TEL
   * ASP: Available Static Pressure
   * TEL: Total Equivalent Length
   */
  public static designSystem(rooms: Array<{ name: string, cfm: number }>, asp: number = 0.5, tel: number = 250): DuctSizing {
    const frictionRate = (asp * 100) / tel;
    const totalCFM = rooms.reduce((acc, r) => acc + r.cfm, 0);

    const branches = rooms.map(room => {
      // Simplified D-Chart lookup approximation
      const roundSize = Math.ceil(Math.pow(room.cfm / 15, 0.45) * 2) / 2;
      const areaSqFt = Math.PI * Math.pow((roundSize / 2) / 12, 2);
      const velocity = room.cfm / areaSqFt;

      return {
        name: room.name,
        cfm: Math.round(room.cfm),
        roundSize: Math.max(5, roundSize),
        velocity: Math.round(velocity)
      };
    });

    return {
      frictionRate: parseFloat(frictionRate.toFixed(3)),
      totalCFM: Math.round(totalCFM),
      branches
    };
  }
}
