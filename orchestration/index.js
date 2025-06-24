/**
 * ORCHESTRATION INDEX - Central Export Module
 * Provides clean imports for all VibesFlow orchestration components
 */

// Import all orchestration modules
import { WebOrchestrator } from './web.js';
import { MobileOrchestrator } from './mobile.js';
import { SensorInterpreter } from './interpreter.js';
import { LyriaOrchestrator } from './orchestrator.js';
import { PerformanceMonitor } from './performance.js';

// Create singleton instances for optimal performance
export const webOrchestrator = new WebOrchestrator();
export const mobileOrchestrator = new MobileOrchestrator();
export const sensorInterpreter = new SensorInterpreter();
export const lyriaOrchestrator = new LyriaOrchestrator();
export const performanceMonitor = new PerformanceMonitor();

// Export classes for additional instances if needed
export { WebOrchestrator, MobileOrchestrator, SensorInterpreter, LyriaOrchestrator, PerformanceMonitor };

// Export type definitions for TypeScript support
export * from './types.ts';

console.log('VibesFlow orchestration modules loaded successfully'); 