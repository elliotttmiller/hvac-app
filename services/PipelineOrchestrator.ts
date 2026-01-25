// backend/services/PipelineOrchestrator.ts

import { ProjectState, Room, EquipmentDetails, ManualJInput } from '../types';
import { extractTakeoffFromPDF, normalizeDataForPhysics, fetchEquipmentScenarios } from './ai/geminiService';
import { ManualJEngine } from './engines/manualJEngine';
import { rasterizePdfToParts } from './pdfProcessor';
import { Part } from '@google/genai';

export class PipelineOrchestrator {
  public static async execute(file: File): Promise<ProjectState> {
    const projectId = 'ccip-' + Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    console.log(`[Orchestrator] Starting pipeline for project: ${projectId}`);

    // --- STAGE 1: INGESTION & VISUAL TAKEOFF ---
    const fileBuffer = await file.arrayBuffer();
    const imageParts = await rasterizePdfToParts(fileBuffer);
    const visionResult = await extractTakeoffFromPDF(imageParts);
    console.log('[Orchestrator] Visual Takeoff complete.');

    // --- STAGE 2: LOGIC NORMALIZATION ---
    // The truthful output of the vision stage becomes the direct input for the normalization stage.
    const mjInput: ManualJInput = await normalizeDataForPhysics(visionResult);
    console.log('[Orchestrator] Logic normalization complete.');

    // --- STAGE 3: PHYSICS - WHOLE-HOUSE CALCULATION ---
    // We first calculate the load for the entire building envelope.
    const systemJResult = ManualJEngine.calculate(mjInput);
    console.log('[Orchestrator] System-wide physics calculation complete.');

    // --- STAGE 4: PHYSICS - ROOM-BY-ROOM APPORTIONMENT ---
    // We distribute the total load across rooms based on their area percentage.
    const totalArea = visionResult.roomList.reduce((sum, room) => sum + room.area, 0);
    const calculatedRooms: Room[] = visionResult.roomList.map(roomData => {
      const areaFraction = roomData.area / totalArea;
      return {
        id: `room-${roomData.name.replace(/\s+/g, '-')}`,
        name: roomData.name,
        area: roomData.area,
        calculationResult: {
          heatingLoad: Math.round(systemJResult.heatingLoad * areaFraction),
          coolingLoad: Math.round(systemJResult.totalCooling * areaFraction),
          heatingCFM: Math.round(systemJResult.heatingCFM * areaFraction),
          coolingCFM: Math.round(systemJResult.coolingCFM * areaFraction)
        }
      };
    });

    // --- STAGE 5: PROCUREMENT ---
    const equipmentScenarios = await fetchEquipmentScenarios(systemJResult.totalCooling, systemJResult.heatingLoad);
    console.log('[Orchestrator] Procurement complete.');

    // --- STAGE 6: ADVANCED SIMULATIONS ---
    const aedResult = ManualJEngine.calculateAED(mjInput);
    const multiOrientationResult = ManualJEngine.calculateMultiOrientation(mjInput);
    console.log('[Orchestrator] Advanced simulations complete.');

    // --- STAGE 7: FINAL ASSEMBLY ---

    // Process breakdown to fulfill systemTotals requirements
    const breakdown = systemJResult.breakdown || [];
    const findComponent = (term: string) => {
        const h = breakdown.find((b: any) => b.component.includes(term))?.heating || 0;
        const c = breakdown.find((b: any) => b.component.includes(term))?.cooling || 0;
        return { heating: h, cooling: c };
    };

    const ductLoad = findComponent('Duct');
    const ventLoad = findComponent('Infiltration');
    const structureLoad = {
        heating: Math.max(0, systemJResult.heatingLoad - ductLoad.heating - ventLoad.heating),
        cooling: Math.max(0, systemJResult.totalCooling - ductLoad.cooling - ventLoad.cooling)
    };

    const finalProjectState: ProjectState = {
      id: projectId,
      metadata: visionResult.projectMetadata,
      designConditions: {
        heating: { outdoorDB: mjInput.design.outdoorTempWinter, indoorDB: mjInput.design.indoorTempWinter, designTD: mjInput.design.indoorTempWinter - mjInput.design.outdoorTempWinter },
        cooling: { outdoorDB: mjInput.design.outdoorTempSummer, indoorDB: mjInput.design.indoorTempSummer, designTD: mjInput.design.outdoorTempSummer - mjInput.design.indoorTempSummer, dailyRange: mjInput.design.dailyRange },
        infiltration: { method: 'N/A', quality: 'N/A' }, // This would come from visionResult
        moistureDiff: systemJResult.psychrometrics.grainsDifference,
      },
      rooms: calculatedRooms,
      selectedEquipment: { // This would be populated from the user's choice in the UI later
        heating: { type: 'HEATING', make: 'TBD', model: 'TBD', trade: 'Generic', ahriRef: 'TBD', efficiencyRating: 'AFUE 80', efficiencyValue: 80, outputBTU: systemJResult.heatingLoad, airflowCFM: systemJResult.heatingCFM } as EquipmentDetails,
        cooling: { type: 'COOLING', make: 'TBD', model: 'TBD', trade: 'Generic', ahriRef: 'TBD', efficiencyRating: 'SEER 14', efficiencyValue: 14, outputBTU: systemJResult.totalCooling, airflowCFM: systemJResult.coolingCFM, sensibleBTU: systemJResult.coolingSensible, latentBTU: systemJResult.coolingLatent } as EquipmentDetails,
      },
      advancedSimulations: { aed: aedResult, multiOrientation: multiOrientationResult },
      systemTotals: {
        totalHeating: systemJResult.heatingLoad,
        totalCooling: systemJResult.totalCooling,
        structureLoad: structureLoad,
        ductLoad: { heating: ductLoad.heating, cooling: ductLoad.cooling },
        ventilationLoad: { heating: ventLoad.heating, cooling: ventLoad.cooling },
        totalEquipmentLoad: { heating: systemJResult.heatingLoad, cooling: systemJResult.totalCooling },
        totalSensible: systemJResult.coolingSensible,
        totalLatent: systemJResult.coolingLatent,
        totalAirflow: systemJResult.coolingCFM,
      },
      status: 'COMPLETE',
      processingMetrics: { calculationTime: (Date.now() - startTime) / 1000 },
    };

    console.log(`[Orchestrator] Pipeline complete for project: ${projectId}`);
    return finalProjectState;
  }
}