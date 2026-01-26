/**
 * Pipeline Orchestrator
 * 
 * Coordinates the complete workflow from PDF upload to structured output:
 * 1. PDF → Enhanced Images (pdfProcessor)
 * 2. Images → Spatial Analysis (aiService)  
 * 3. Analysis → Project State (data mapping)
 */

import type { ProjectState, AnnotationResult, PipelineMetrics } from './types';
import { runVisionStage } from './ai/aiService';
import { rasterizePdfToParts, PRESETS, getRecommendedPreset } from './pdfProcessor';

/**
 * Pipeline execution options
 */
export interface PipelineOptions {
  preset?: keyof typeof PRESETS | 'auto';
  enableValidation?: boolean;
  strictMode?: boolean;
  maxRetries?: number;
  onProgress?: (stage: string, progress: number) => void;
}

/**
 * Pipeline execution result with metrics
 */
export interface PipelineResult {
  projectState: ProjectState;
  metrics: PipelineMetrics;
  success: boolean;
}

/**
 * Main Pipeline Orchestrator
 * 
 * Handles the complete processing pipeline with comprehensive error
 * handling, validation, and performance monitoring.
 */
export class PipelineOrchestrator {
  /**
   * Execute the complete vision pipeline
   * 
   * @param file - PDF file to process
   * @param onLog - Optional logging callback
   * @param options - Pipeline configuration options
   * @returns Complete project state with metrics
   */
  public static async execute(
    file: File, 
    onLog?: (msg: string) => void,
    options: PipelineOptions = {}
  ): Promise<ProjectState> {
    const {
      preset = 'auto',
      enableValidation = true,
      strictMode = false,
      maxRetries = 2,
      onProgress,
    } = options;

    const startTime = Date.now();
    const log = (msg: string) => { 
      onLog?.(msg); 
      console.log(msg); 
    };
    
    const projectId = 'ccip-' + Math.random().toString(36).substr(2, 9);
    
    // Initialize metrics
    const metrics: PipelineMetrics = {
      pipelineId: projectId,
      stages: {},
      totalDuration: 0,
      errors: [],
      warnings: [],
      pipelineStatus: 'PROCESSING',
    };
    
    log('═══════════════════════════════════════════════════════════');
    log('[Orchestrator] OPTIMIZED VISION PIPELINE STARTING');
    log('═══════════════════════════════════════════════════════════');
    log(`[Orchestrator] Pipeline ID: ${projectId}`);
    log(`[Orchestrator] File: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    log(`[Orchestrator] Preset: ${preset}, Validation: ${enableValidation}, Strict: ${strictMode}`);
    
    try {
      // ==================== STAGE 1: PDF PROCESSING ====================
      log('\n[STAGE 1/3] PDF Processing & Image Enhancement');
      log('─────────────────────────────────────────────────────────');
      
      const stage1Start = Date.now();
      onProgress?.('pdf_processing', 0);
      
      const fileBuffer = await file.arrayBuffer();
      
      // Determine preprocessing preset
      let selectedPreset = preset === 'auto' 
        ? getRecommendedPreset({
            isScanned: file.name.toLowerCase().includes('scan'),
            quality: 'medium',
            urgency: 'medium',
          })
        : PRESETS[preset as keyof typeof PRESETS] || PRESETS.CAD_BLUEPRINT;
      
      log(`[PDF] Using preset: ${preset === 'auto' ? 'AUTO (CAD_BLUEPRINT)' : preset}`);
      
      const imageParts = await rasterizePdfToParts(fileBuffer, selectedPreset);
      
      if (imageParts.length === 0) {
        throw new Error('PDF processing produced no images');
      }
      
      metrics.stages.pdf_processing = {
        duration: Date.now() - stage1Start,
        pageCount: imageParts.length,
        preset: preset,
      };
      
      log(`[PDF] ✓ Generated ${imageParts.length} optimized images`);
      log(`[PDF] ✓ Processing time: ${metrics.stages.pdf_processing.duration}ms`);
      
      onProgress?.('pdf_processing', 100);
      
      // ==================== STAGE 2: VISION ANALYSIS ====================
      log('\n[STAGE 2/3] Multi-Pass Vision Analysis');
      log('─────────────────────────────────────────────────────────');
      
      const stage2Start = Date.now();
      onProgress?.('vision_analysis', 0);
      
      const visionResult: AnnotationResult = await runVisionStage(
        imageParts, 
        onLog,
        {
          maxRetries,
          enableValidation,
          strictMode,
        }
      );
      
      if (!visionResult || !visionResult.rooms || visionResult.rooms.length === 0) {
        throw new Error('Vision analysis produced no spatial elements');
      }
      
      metrics.stages.vision_analysis = {
        duration: Date.now() - stage2Start,
        roomCount: visionResult.rooms.length,
        scaleConfidence: visionResult.scaleAnnotation?.confidence || 0,
      };
      
      log(`[Vision] ✓ Detected ${visionResult.rooms.length} spatial elements`);
      log(`[Vision] ✓ Processing time: ${metrics.stages.vision_analysis.duration}ms`);
      
      onProgress?.('vision_analysis', 100);
      
      // ==================== STAGE 3: DATA MAPPING ====================
      log('\n[STAGE 3/3] Data Mapping & Project Assembly');
      log('─────────────────────────────────────────────────────────');
      
      const stage3Start = Date.now();
      onProgress?.('data_mapping', 0);
      
      // Calculate detection metrics
      const totalBedrooms = visionResult.rooms.filter(r => 
        r.roomName?.toUpperCase().includes('BDRM') || 
        r.roomName?.toUpperCase().includes('BEDROOM')
      ).length;
      
      const totalBathrooms = visionResult.rooms.filter(r =>
        r.roomName?.toUpperCase().includes('BATH')
      ).length;
      
      const totalKitchens = visionResult.rooms.filter(r =>
        r.roomName?.toUpperCase().includes('KITCHEN') ||
        r.roomName?.toUpperCase().includes('KIT')
      ).length;
      
      log(`[Mapping] Bedrooms: ${totalBedrooms}, Bathrooms: ${totalBathrooms}, Kitchens: ${totalKitchens}`);
      
      // Map vision data to room objects
      const rooms = visionResult.rooms.map((el, i) => {
        let area = 0;
        
        // Method 1: Parse dimensionsText
        if (el.dimensionsText) {
          const dims = el.dimensionsText.match(/(\d+\.?\d*)['"]?\s*[xX×]\s*(\d+\.?\d*)['"]?/);
          if (dims?.[1] && dims?.[2]) {
            const width = parseFloat(dims[1]);
            const depth = parseFloat(dims[2]);
            area = width * depth;
          }
        }
        
        // Method 2: Calculate from bounding box using scale
        if (area === 0 && el.boundingBox && visionResult.scaleAnnotation?.pixelsPerFoot) {
          const [x1, y1, x2, y2] = el.boundingBox;
          const widthPx = x2 - x1;
          const depthPx = y2 - y1;
          const ppf = visionResult.scaleAnnotation.pixelsPerFoot;
          
          if (ppf > 0) {
            const widthFt = widthPx / ppf;
            const depthFt = depthPx / ppf;
            area = widthFt * depthFt;
          }
        }
        
        // Fallback: Use a default area
        if (area === 0) {
          area = 100; // Default 100 sq ft
          metrics.warnings.push({
            message: `Room "${el.roomName}" has no valid dimensions, using default 100 sq ft`,
            timestamp: new Date().toISOString(),
            severity: 'MEDIUM',
          });
        }
        
        // Determine if space is conditioned
        const unconditionedKeywords = ['GARAGE', 'PATIO', 'DECK', 'PORCH', 'LANAI', 'BALCONY'];
        const isConditioned = !unconditionedKeywords.some(keyword => 
          el.roomName?.toUpperCase().includes(keyword)
        );
        
        return {
          id: `room-${i}`,
          name: el.roomName || `Room ${i}`,
          area: area,
          volume: area * 9, // Assume 9' ceiling
          surfaces: [],
          internals: { 
            occupants: isConditioned ? 1 : 0 
          },
          calculationResult: {
            heatingLoad: 0,
            coolingSensible: 0,
            coolingLatent: 0,
            coolingLoad: 0,
            totalCooling: 0,
            heatingCFM: 0,
            coolingCFM: 0,
          },
          terminals: [],
        };
      });
      
      // Validate room areas
      const conditionedRooms = rooms.filter(r => r.internals.occupants > 0);
      const totalConditionedArea = conditionedRooms.reduce((sum, r) => sum + r.area, 0);
      const grossTotalArea = rooms.reduce((sum, r) => sum + r.area, 0);
      
      log(`[Mapping] Total rooms: ${rooms.length}`);
      log(`[Mapping] Conditioned rooms: ${conditionedRooms.length}`);
      log(`[Mapping] Conditioned area: ${Math.round(totalConditionedArea)} sq ft`);
      log(`[Mapping] Gross area: ${Math.round(grossTotalArea)} sq ft`);
      
      // Validation warnings
      if (enableValidation) {
        if (totalConditionedArea < 500) {
          const warning = `Conditioned area (${Math.round(totalConditionedArea)} sq ft) seems very low`;
          log(`[WARNING] ${warning}`);
          metrics.warnings.push({
            message: warning,
            timestamp: new Date().toISOString(),
            severity: 'HIGH',
          });
        }
        
        if (totalConditionedArea > 10000) {
          const warning = `Conditioned area (${Math.round(totalConditionedArea)} sq ft) seems very high`;
          log(`[WARNING] ${warning}`);
          metrics.warnings.push({
            message: warning,
            timestamp: new Date().toISOString(),
            severity: 'MEDIUM',
          });
        }
        
        if (totalBedrooms === 0) {
          const warning = 'No bedrooms detected - possible OCR failure';
          log(`[WARNING] ${warning}`);
          metrics.warnings.push({
            message: warning,
            timestamp: new Date().toISOString(),
            severity: 'HIGH',
          });
        }
        
        if (totalBathrooms === 0) {
          const warning = 'No bathrooms detected - possible OCR failure';
          log(`[WARNING] ${warning}`);
          metrics.warnings.push({
            message: warning,
            timestamp: new Date().toISOString(),
            severity: 'HIGH',
          });
        }
      }
      
      metrics.stages.data_mapping = {
        duration: Date.now() - stage3Start,
        totalRooms: rooms.length,
        conditionedArea: totalConditionedArea,
        grossArea: grossTotalArea,
      };
      
      log(`[Mapping] ✓ Data mapping complete`);
      log(`[Mapping] ✓ Processing time: ${metrics.stages.data_mapping.duration}ms`);
      
      onProgress?.('data_mapping', 100);
      
      // ==================== PROJECT STATE ASSEMBLY ====================
      const projectState: ProjectState = {
        id: projectId,
        status: 'COMPLETE',
        metadata: {
          jobName: 'Multi-Pass Vision Analysis',
          clientName: 'AI Vision Pipeline',
          designerName: 'CCIP Vision Engine',
          reportDate: new Date().toISOString(),
          pipelineMetrics: metrics,
        },
        visionRawData: visionResult,
        designConditions: {
          location: { 
            city: 'Vision Analysis', 
            state: 'VA', 
            latitude: 35, 
            elevation: 0 
          },
          heating: { 
            outdoorDB: 0, 
            indoorDB: 70 
          },
          cooling: { 
            outdoorDB: 95, 
            indoorDB: 75, 
            dailyRange: 'M' 
          },
        },
        construction: {
          infiltrationACH50: 5.0,
          shieldingClass: 3,
          ductSystem: { 
            location: 'attic', 
            rValue: 6, 
            supplyArea: 0, 
            returnArea: 0 
          },
        },
        rooms: rooms,
        systemTotals: {
          totalHeating: 0,
          totalCooling: 0,
          breakdown: [],
        },
        selectedEquipment: {
          heating: { 
            make: '-', 
            model: '-', 
            outputBTU: 0, 
            ahriRef: '', 
            performance: { 
              heatingBTUh: 0, 
              totalCoolingBTUh: 0, 
              sensibleCoolingBTUh: 0 
            } 
          },
          cooling: { 
            make: '-', 
            model: '-', 
            outputBTU: 0, 
            ahriRef: '', 
            performance: { 
              heatingBTUh: 0, 
              totalCoolingBTUh: 0, 
              sensibleCoolingBTUh: 0 
            } 
          },
        },
        compliance: {
          manualS: { 
            status: 'Pass', 
            totalCapacityRatio: 0, 
            sensibleCapacityRatio: 0, 
            heatingCapacityRatio: 0, 
            sizingLimits: { 
              minCoolingBTU: 0, 
              maxCoolingBTU: 0 
            } 
          },
          manualD: { 
            frictionRate: 0, 
            totalCFM: 0, 
            branches: [] 
          },
          manualT: { 
            terminals: [] 
          },
        },
        advancedSimulations: {
          aed: { 
            hourlyLoads: [], 
            maxExcursionPercent: 0, 
            limitPercent: 0, 
            status: 'Pass' 
          },
          multiOrientation: [],
        },
      };
      
      // Finalize metrics
      metrics.totalDuration = Date.now() - startTime;
      metrics.pipelineStatus = 'SUCCESS';
      
      // ==================== FINAL SUMMARY ====================
      log('\n═══════════════════════════════════════════════════════════');
      log('[Orchestrator] PIPELINE COMPLETE');
      log('═══════════════════════════════════════════════════════════');
      log(`[Summary] Total Duration: ${metrics.totalDuration}ms`);
      log(`[Summary] Images Processed: ${imageParts.length}`);
      log(`[Summary] Rooms Detected: ${rooms.length}`);
      log(`[Summary] Bedrooms: ${totalBedrooms}, Bathrooms: ${totalBathrooms}`);
      log(`[Summary] Conditioned Area: ${Math.round(totalConditionedArea)} sq ft`);
      log(`[Summary] Warnings: ${metrics.warnings.length}`);
      log(`[Summary] Errors: ${metrics.errors.length}`);
      log('═══════════════════════════════════════════════════════════');
      
      if (metrics.warnings.length > 0) {
        log('\n[Warnings]:');
        metrics.warnings.forEach(w => {
          log(`  - [${w.severity}] ${w.message}`);
        });
      }
      
      return projectState;
      
    } catch (error: any) {
      // Error handling
      const errorMsg = `Pipeline failed: ${error.message}`;
      log(`\n[FATAL ERROR] ${errorMsg}`);
      
      metrics.pipelineStatus = 'FAILED';
      metrics.totalDuration = Date.now() - startTime;
      metrics.errors.push({
        stage: 'pipeline',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
      
      // Return partial state with error info
      const errorState: ProjectState = {
        id: projectId,
        status: 'ERROR',
        metadata: {
          jobName: 'Failed Pipeline',
          clientName: 'Error',
          designerName: 'Error',
          reportDate: new Date().toISOString(),
          pipelineMetrics: metrics,
        },
        designConditions: {
          location: { city: '', state: '', latitude: 0, elevation: 0 },
          heating: { outdoorDB: 0, indoorDB: 0 },
          cooling: { outdoorDB: 0, indoorDB: 0, dailyRange: 'M' },
        },
        construction: {
          infiltrationACH50: 0,
          shieldingClass: 1,
          ductSystem: { location: 'conditioned', rValue: 0, supplyArea: 0, returnArea: 0 },
        },
        rooms: [],
        systemTotals: {
          totalHeating: 0,
          totalCooling: 0,
          breakdown: [],
        },
        selectedEquipment: {
          heating: { make: '', model: '', outputBTU: 0, ahriRef: '', performance: { heatingBTUh: 0, totalCoolingBTUh: 0, sensibleCoolingBTUh: 0 } },
          cooling: { make: '', model: '', outputBTU: 0, ahriRef: '', performance: { heatingBTUh: 0, totalCoolingBTUh: 0, sensibleCoolingBTUh: 0 } },
        },
        compliance: {
          manualS: { status: 'Fail', totalCapacityRatio: 0, sensibleCapacityRatio: 0, heatingCapacityRatio: 0, sizingLimits: { minCoolingBTU: 0, maxCoolingBTU: 0 } },
          manualD: { frictionRate: 0, totalCFM: 0, branches: [] },
          manualT: { terminals: [] },
        },
        advancedSimulations: {
          aed: { hourlyLoads: [], maxExcursionPercent: 0, limitPercent: 0, status: 'Fail' },
          multiOrientation: [],
        },
      };
      
      throw error; // Re-throw for upstream handling
    }
  }
  
  /**
   * Validate project state structure
   */
  public static validateProjectState(state: ProjectState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!state.id) errors.push('Missing project ID');
    if (!state.metadata) errors.push('Missing metadata');
    if (!state.rooms || state.rooms.length === 0) errors.push('No rooms detected');
    if (state.status !== 'COMPLETE' && state.status !== 'ERROR' && state.status !== 'PROCESSING') {
      errors.push('Invalid status');
    }
    
    // Validate room data
    state.rooms?.forEach((room, i) => {
      if (!room.id) errors.push(`Room ${i}: Missing ID`);
      if (!room.name) errors.push(`Room ${i}: Missing name`);
      if (room.area <= 0) errors.push(`Room ${i}: Invalid area`);
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}