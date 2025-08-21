/**
 * ORCHESTRATION INDEX - Streamlined Client-Side Orchestration
 * 
 * Exports orchestration components for VibesFlow music generation.
 * Now simplified: client handles sensors → server processes → Lyria streams back
 * 
 * Key Components:
 * - OrchestrationCoordinator: Main coordinator for sensor data and Lyria streaming
 * - Platform orchestrators: Web and mobile sensor/audio handling
 * 
 * Server-side processing via Alith wrapper handles:
 * - Sensor interpretation with Alith Agent
 * - Music parameter optimization  
 * - Lyria API coordination
 */

import { Platform } from 'react-native';
import { orchestrationCoordinator } from './coordinator.js';
import { webOrchestrator } from './web.js';
import { mobileOrchestrator } from './mobile.js';

// Export main coordinator for simplified usage
export { orchestrationCoordinator };

// Export platform orchestrators for direct access if needed
export { webOrchestrator, mobileOrchestrator };

// Initialize and coordinate platform orchestrators
async function initializeOrchestration() {
  try {
    console.log('🚀 Initializing streamlined orchestration system...');
    
    // Initialize the main coordinator
    const success = await orchestrationCoordinator.initializeOrchestrator();
    
    if (success) {
      // Coordinate with platform orchestrators
      orchestrationCoordinator.coordinateWithPlatformOrchestrators();
      
      // Coordinate with Lyria
      orchestrationCoordinator.coordinateWithLyria();
      
      console.log('✅ Streamlined orchestration system initialized');
      return true;
    } else {
      console.error('❌ Failed to initialize orchestration system');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Orchestration initialization error:', error);
    return false;
  }
}

// NOTE: Auto-initialization removed to prevent participant interference
// Orchestration will only be initialized when needed by creators in VibePlayer

// Default export
export default orchestrationCoordinator; 