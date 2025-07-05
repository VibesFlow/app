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

// Import new advanced modules
import { AudioBufferManager, audioBufferManager } from './buffer.js';
import { BackgroundChunkProcessor, backgroundChunkProcessor } from './bgProcessing.js';

// Create singleton instances for optimal performance
export const webOrchestrator = new WebOrchestrator();
export const mobileOrchestrator = new MobileOrchestrator();
export const sensorInterpreter = new SensorInterpreter();
export const lyriaOrchestrator = new LyriaOrchestrator();
export const performanceMonitor = new PerformanceMonitor();

// Export new advanced instances
export { audioBufferManager, backgroundChunkProcessor };

// Export classes for additional instances if needed
export { 
  WebOrchestrator, 
  MobileOrchestrator, 
  SensorInterpreter, 
  LyriaOrchestrator, 
  PerformanceMonitor,
  AudioBufferManager,
  BackgroundChunkProcessor
};

// Export type definitions for TypeScript support
export * from './types.ts';

// Comprehensive diagnostic function for troubleshooting
export async function runOrchestrationDiagnostics() {
  console.log('🔍 === VIBESFLOW ORCHESTRATION DIAGNOSTICS ===');
  
  const diagnostics = {
    webOrchestrator: {
      isInitialized: webOrchestrator.isInitialized,
      audioContext: !!webOrchestrator.audioContext,
      audioContextState: webOrchestrator.audioContext?.state || 'not initialized'
    },
    audioBufferManager: {
      isInitialized: audioBufferManager.isInitialized,
      status: audioBufferManager.getStatus(),
      effectsEnabled: audioBufferManager.enableEffects
    },
    backgroundChunkProcessor: {
      status: backgroundChunkProcessor.getStatus()
    },
    lyriaOrchestrator: {
      status: lyriaOrchestrator.getStatus()
    },
    performanceMonitor: {
      status: performanceMonitor.getStatus()
    },
    sensorInterpreter: {
      hasGenres: Object.keys(sensorInterpreter.raveGenres).length,
      lastInterpretation: !!sensorInterpreter.getLastInterpretation()
    }
  };
  
  console.log('📊 System Status:', diagnostics);
  
  // Check for common issues
  const issues = [];
  
  if (!diagnostics.webOrchestrator.isInitialized) {
    issues.push('Web orchestrator not initialized');
  }
  
  if (!diagnostics.audioBufferManager.isInitialized) {
    issues.push('Audio buffer manager not initialized');
  }
  
  if (!diagnostics.lyriaOrchestrator.status.isConnected) {
    issues.push('Lyria orchestrator not connected');
  }
  
  if (diagnostics.webOrchestrator.audioContextState === 'suspended') {
    issues.push('Audio context is suspended - user interaction required');
  }
  
  if (issues.length > 0) {
    console.warn('⚠️ Issues detected:', issues);
    return { healthy: false, issues, diagnostics };
  } else {
    console.log('✅ All systems healthy');
    return { healthy: true, issues: [], diagnostics };
  }
}

// Auto-test function for development
export async function testOrchestrationSystems() {
  console.log('🧪 Testing orchestration systems...');
  
  try {
    // Test audio buffer manager
    if (typeof window !== 'undefined') {
      console.log('Testing audio buffer manager...');
      const audioSuccess = await audioBufferManager.initialize();
      console.log(`Audio buffer manager: ${audioSuccess ? '✅' : '❌'}`);
    }
    
    // Test background processor
    console.log('Testing background chunk processor...');
    const bgSuccess = await backgroundChunkProcessor.initialize();
    console.log(`Background processor: ${bgSuccess ? '✅' : '❌'}`);
    
    // Test sensor interpreter with dummy data
    console.log('Testing sensor interpreter...');
    const testSensorData = { x: 0.5, y: 0.3, z: 0.8, timestamp: Date.now(), source: 'test' };
    const interpretation = sensorInterpreter.interpretSensorData(testSensorData);
    console.log(`Sensor interpreter: ${interpretation ? '✅' : '❌'}`);
    
    console.log('🎉 All system tests completed');
    return true;
  } catch (error) {
    console.error('❌ System test failed:', error);
    return false;
  }
}

console.log('VibesFlow orchestration modules loaded successfully with advanced audio processing');
console.log('📋 Available diagnostics: runOrchestrationDiagnostics(), testOrchestrationSystems()'); 