import { ProjectState } from '../types';
import { runVisionStage } from './ai/geminiService';
import { rasterizePdfToParts } from './pdfProcessor';

export class PipelineOrchestrator {
  public static async execute(file: File, onLog?: (msg: string) => void): Promise<ProjectState> {
    const log = (msg: string) => { onLog?.(msg); console.log(msg); };
    const projectId = 'ccip-' + Math.random().toString(36).substr(2, 9);
    
    log(`[Orchestrator] Initializing Vision-Only Pipeline: ${projectId}`);
    log(`[Orchestrator] CONFIG: Physics Engines (Manual J/S/D) are DISABLED.`);
    
    try {
      // --- STAGE 1: INGESTION ---
      log(`[Ingestion] Processing ${file.name}...`);
      const fileBuffer = await file.arrayBuffer();
      const imageParts = await rasterizePdfToParts(fileBuffer);
      log(`[Ingestion] Rasterization complete. Generated ${imageParts.length} high-fidelity viewports.`);
      
      // --- STAGE 2: VISION INFERENCE ---
      log(`[Vision] Sending to AI Vision Pipeline...`);
      const visionResult = await runVisionStage(imageParts, onLog);

      // --- VALIDATION GATE ---
      if (!visionResult) {
        throw new Error(`Vision Failure: Model returned null result.`);
      }
      
      const totalArea = visionResult.totalEnvelope?.conditionedFloorArea || 0;
      if (totalArea < 10) {
         log(`[Vision Warning] Total area is suspiciously low (${totalArea} sq ft). Review logs.`);
      } else {
         log(`[Vision] Inference Successful. Extracted ${visionResult.rooms.length} architectural zones.`);
         log(`[Vision] Total Conditioned Area: ${Math.round(totalArea)} sq ft.`);
      }

      // --- CONSTRUCT DEBUG STATE (NO PHYSICS ENGINES) ---
      const debugState: ProjectState = {
        id: projectId,
        status: 'COMPLETE',
        metadata: {
            jobName: visionResult.metadata?.jobName || 'Vision Audit Job',
            clientName: visionResult.metadata?.client || 'Unknown Client',
            designerName: 'CCIP AI Vision',
            reportDate: new Date().toISOString()
        },
        visionRawData: visionResult,
        designConditions: {
          location: { city: 'Pending Input', state: '--', latitude: 35, elevation: 0 },
          heating: { outdoorDB: 0, indoorDB: 0 },
          cooling: { outdoorDB: 0, indoorDB: 0, dailyRange: 'M' }
        },
        construction: { 
            infiltrationACH50: 0, 
            shieldingClass: 1, 
            ductSystem: { location: 'conditioned', rValue: 0, supplyArea: 0, returnArea: 0 } 
        },
        
        rooms: visionResult.rooms.map((r, i) => ({
            id: `room-${i}`,
            name: r.name,
            area: r.area,
            volume: r.area * 9, // Assumption for volume
            surfaces: [],
            internals: { occupants: 0 },
            calculationResult: { 
                heatingLoad: 0, coolingSensible: 0, coolingLatent: 0, coolingLoad: 0, 
                totalCooling: 0, heatingCFM: 0, coolingCFM: 0
            },
            terminals: []
        })),

        systemTotals: {
             totalHeating: 0, 
             totalCooling: 0,
             breakdown: [] 
        },
        selectedEquipment: {
            heating: { make: '-', model: '-', outputBTU: 0, ahriRef: '', performance: { heatingBTUh: 0, totalCoolingBTUh: 0, sensibleCoolingBTUh: 0 } },
            cooling: { make: '-', model: '-', outputBTU: 0, ahriRef: '', performance: { heatingBTUh: 0, totalCoolingBTUh: 0, sensibleCoolingBTUh: 0 } }
        },
        compliance: {
            manualS: { status: 'Pass', totalCapacityRatio: 0, sensibleCapacityRatio: 0, heatingCapacityRatio: 0, sizingLimits: { minCoolingBTU: 0, maxCoolingBTU: 0 } },
            manualD: { frictionRate: 0, totalCFM: 0, branches: [] },
            manualT: { terminals: [] }
        },
        advancedSimulations: {
            aed: { hourlyLoads: [], maxExcursionPercent: 0, limitPercent: 0, status: 'Pass' },
            multiOrientation: []
        }
      };
      
      log('[Orchestrator] Vision Pipeline Complete. Physics engines bypassed.');
      return debugState;

    } catch (e: any) {
      log(`[Fatal Error] Pipeline Failed: ${e.message}`);
      throw e;
    }
  }
}