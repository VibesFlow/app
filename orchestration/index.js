/**
 * ORCHESTRATION INDEX - Platform-aware module coordination
 * Handles proper initialization and coordination between all orchestration modules
 * Supports both Web (production) and React Native mobile platforms
 */

import { Platform } from 'react-native';

// Import polyfills first to ensure proper environment setup
import '../configs/polyfills.js';

// Platform-aware module imports with safe loading
let webOrchestrator = null;
let mobileOrchestrator = null;
let sensorInterpreter = null;
let lyriaOrchestrator = null;

// Import sensor interpreter (works on all platforms)
import { sensorInterpreter as interpreter } from './interpreter.js';
sensorInterpreter = interpreter;

// Import Lyria orchestrator (platform-aware)
import { lyriaOrchestrator as orchestrator } from './orchestrator.js';
lyriaOrchestrator = orchestrator;

// Platform-specific imports with safe error handling
try {
  if (Platform.OS === 'web') {
    // Web-only imports
    const webModule = require('./web.js');
    webOrchestrator = webModule.webOrchestrator;
    console.log('✅ Web orchestrator loaded');
  } else {
    // Mobile-only imports  
    const mobileModule = require('./mobile.js');
    mobileOrchestrator = mobileModule.mobileOrchestrator;
    console.log('✅ Mobile orchestrator loaded');
  }
} catch (error) {
  console.warn(`Platform orchestrator loading failed for ${Platform.OS}:`, error.message);
}

// PRODUCTION-READY COORDINATION SYSTEM
class OrchestrationCoordinator {
  constructor() {
    this.isInitialized = false;
    this.platform = Platform.OS;
    this.activeOrchestrator = null;
    this.sensorInterpreter = sensorInterpreter;
    this.lyriaOrchestrator = lyriaOrchestrator;
    this.cleanupFunctions = [];
    
    // Initialize coordination synchronously
    this.initializeCoordinationSync();
  }

  initializeCoordinationSync() {
    try {
      console.log(`🚀 Initializing orchestration coordination for ${this.platform}`);
      
      // Set active orchestrator based on platform
      if (this.platform === 'web' && webOrchestrator) {
        this.activeOrchestrator = webOrchestrator;
      } else if (this.platform !== 'web' && mobileOrchestrator) {
        this.activeOrchestrator = mobileOrchestrator;
      } else {
        console.warn(`No orchestrator available for platform: ${this.platform}`);
        // Continue without orchestrator for now
      }

      // Coordinate modules for zero-latency feedback
      if (this.lyriaOrchestrator && this.lyriaOrchestrator.coordinateWithPlatformOrchestrators) {
        this.lyriaOrchestrator.coordinateWithPlatformOrchestrators(
          mobileOrchestrator,
          webOrchestrator,
          this.sensorInterpreter
        );
      }

      this.isInitialized = true;
      console.log('✅ Orchestration coordination initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Orchestration coordination failed:', error);
      this.isInitialized = true; // Still mark as initialized to allow basic functionality
      return false;
    }
  }

  // Initialize sensors for the active platform
  async initializeSensors() {
    if (!this.isInitialized) {
      console.warn('Orchestration not initialized, cannot start sensors');
      return [];
    }

    if (!this.activeOrchestrator) {
      console.warn('No active orchestrator available for sensors');
      return [];
    }

    try {
      const cleanupFunctions = await this.activeOrchestrator.initializeSensors();
      this.cleanupFunctions.push(...cleanupFunctions);
      
      console.log(`🎯 ${this.platform} sensors initialized`);
      return cleanupFunctions;
    } catch (error) {
      console.error(`Sensor initialization failed on ${this.platform}:`, error);
      return [];
    }
  }

  // Initialize Lyria connection
  async initializeLyria(apiKey) {
    if (!this.isInitialized) {
      console.warn('Orchestration not initialized, cannot connect to Lyria');
      return false;
    }

    if (!apiKey) {
      console.warn('No API key provided for Lyria');
      return false;
    }

    try {
      // Initialize Lyria orchestrator first
      const lyriaResult = await this.lyriaOrchestrator.initialize(apiKey);
      
      // Initialize platform-specific Lyria connection
      let platformResult = true;
      if (this.platform !== 'web' && mobileOrchestrator) {
        platformResult = await mobileOrchestrator.initializeLyriaConnection(apiKey);
      }

      const success = lyriaResult && platformResult;
      
      if (success) {
        console.log('🎵 Lyria connection established');
      } else {
        console.error('❌ Lyria connection failed');
      }
      
      return success;
    } catch (error) {
      console.error('Lyria initialization error:', error);
      return false;
    }
  }

  // Connect to Lyria and start streaming
  async connect() {
    if (!this.isInitialized || !this.lyriaOrchestrator) {
      console.warn('Orchestration not initialized, cannot connect');
      return false;
    }

    try {
      const success = await this.lyriaOrchestrator.connect();
      if (success) {
        console.log('🔗 Lyria streaming connected');
      }
      return success;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  // Start music generation with initial interpretation
  async startStream(initialPrompt = 'minimal techno') {
    if (!this.isInitialized || !this.sensorInterpreter || !this.lyriaOrchestrator) {
      console.warn('Orchestration not initialized, cannot start stream');
      return false;
    }

    try {
      // Create initial interpretation
      const initialSensorData = {
        x: 0.1,
        y: 0.1,
        z: 0.5,
        timestamp: Date.now(),
        source: 'initialization'
      };

      const interpretation = this.sensorInterpreter.interpretSensorData(initialSensorData);
      
      // Override with custom prompt if provided
      if (initialPrompt !== 'minimal techno') {
        interpretation.weightedPrompts = [{ text: initialPrompt, weight: 1.0 }];
      }

      const success = await this.lyriaOrchestrator.startStream(interpretation);
      
      if (success) {
        console.log('🎶 Music generation started');
      }
      
      return success;
    } catch (error) {
      console.error('Stream start error:', error);
      return false;
    }
  }

  // Update stream with sensor data
  updateWithSensorData(sensorData) {
    if (!this.isInitialized || !this.sensorInterpreter || !this.lyriaOrchestrator) {
      return false;
    }

    try {
      const interpretation = this.sensorInterpreter.interpretSensorData(sensorData);
      return this.lyriaOrchestrator.updateStream(interpretation);
    } catch (error) {
      console.error('Sensor data update error:', error);
      return false;
    }
  }

  // Stop music generation
  async stop() {
    if (!this.isInitialized || !this.lyriaOrchestrator) return false;

    try {
      const success = await this.lyriaOrchestrator.stop();
      console.log('⏹️ Music generation stopped');
      return success;
    } catch (error) {
      console.error('Stop error:', error);
      return false;
    }
  }

  // Get current status
  getStatus() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        platform: this.platform,
        error: 'Not initialized'
      };
    }

    const status = {
      initialized: this.isInitialized,
      platform: this.platform,
      activeOrchestrator: this.activeOrchestrator ? 'available' : 'unavailable',
      sensorInterpreter: this.sensorInterpreter ? 'available' : 'unavailable',
      lyriaOrchestrator: this.lyriaOrchestrator ? 'available' : 'unavailable'
    };

    // Add platform-specific status
    if (this.lyriaOrchestrator) {
      status.lyria = this.lyriaOrchestrator.getStatus();
    }

    if (this.platform !== 'web' && mobileOrchestrator) {
      status.mobile = mobileOrchestrator.getLyriaState();
    }

    return status;
  }

  // Cleanup all resources
  async cleanup() {
    console.log('🧹 Cleaning up orchestration coordination');
    
    // Cleanup sensor subscriptions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      } catch (error) {
        console.warn('Cleanup function error:', error);
      }
    });
    this.cleanupFunctions = [];

    // Cleanup orchestrators
    if (this.lyriaOrchestrator) {
      await this.lyriaOrchestrator.cleanup();
    }
    
    if (mobileOrchestrator) {
      mobileOrchestrator.cleanup();
    }
    
    if (webOrchestrator) {
      webOrchestrator.cleanup();
    }

    this.isInitialized = false;
    console.log('✅ Orchestration cleanup completed');
  }
}

// Create and export singleton instance
export const orchestrationCoordinator = new OrchestrationCoordinator();

// Export individual modules for direct access (compatible with destructuring imports)
export {
  webOrchestrator,
  mobileOrchestrator,
  sensorInterpreter,
  lyriaOrchestrator
};

// Also export for compatibility with VibePlayer imports
export { orchestrationCoordinator as default };

// Ensure backward compatibility
console.log('📦 Orchestration modules exported:', {
  webOrchestrator: !!webOrchestrator,
  mobileOrchestrator: !!mobileOrchestrator,
  sensorInterpreter: !!sensorInterpreter,
  lyriaOrchestrator: !!lyriaOrchestrator,
  orchestrationCoordinator: !!orchestrationCoordinator
}); 