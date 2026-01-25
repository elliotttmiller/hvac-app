
/**
 * MANUAL T: RESIDENTIAL AIR DISTRIBUTION
 * Logic for register selection and air distribution performance.
 */

export interface TerminalSelection {
  roomName: string;
  requiredCFM: number;
  registerCount: number;
  cfmPerRegister: number;
  estimatedThrow: number; // in feet
  velocityFPM: number;
}

export class ManualTEngine {
  /**
   * Basic Manual T Rule: 
   * Maintain terminal velocity of 50 FPM at the boundary (75% of room length/width).
   */
  public static selectTerminals(roomName: string, cfm: number, area: number): TerminalSelection {
    const registerCount = Math.max(1, Math.ceil(cfm / 180)); 
    const cfmPerRegister = cfm / (registerCount || 1);
    
    // Using 4x10 register (0.28 sq ft free area)
    const akFactor = 0.28; 
    const velocity = cfmPerRegister / akFactor;
    
    const roomSide = Math.sqrt(area);
    const throwDistance = roomSide * 0.75; 

    return {
      roomName,
      requiredCFM: Math.round(cfm),
      registerCount,
      cfmPerRegister: Math.round(cfmPerRegister),
      estimatedThrow: Math.round(throwDistance),
      velocityFPM: Math.round(velocity)
    };
  }
}
