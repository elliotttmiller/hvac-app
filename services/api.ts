
import { ProjectState } from '../types';
import { PipelineOrchestrator } from './PipelineOrchestrator';

/**
 * API GATEWAY
 * This simulates a secure backend API endpoint.
 * In production, this would be an Express/FastAPI route handler.
 */
export const runFullEngineeringPipeline = async (file: File): Promise<ProjectState> => {
  // Simulate network latency if desired, but for now direct call
  console.log('[API] Received engineering request:', file.name);
  return await PipelineOrchestrator.execute(file);
};
