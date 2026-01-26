// services/api.ts

import { ProjectState } from '../types';
import { PipelineOrchestrator } from './PipelineOrchestrator';

/**
 * API GATEWAY
 * Standardized error reporting for clear frontend communication.
 */
export const runFullEngineeringPipeline = async (file: File, onLog?: (msg: string) => void): Promise<ProjectState> => {
  try {
    console.log('[API] Received engineering request:', file.name);
    return await PipelineOrchestrator.execute(file, onLog);
  } catch (error: any) {
    console.error('[API Error] Pipeline failed:', error.message);
    throw error; // Re-throw to be caught by Workspace component
  }
};