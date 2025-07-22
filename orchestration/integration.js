/**
 * INTEGRATION.JS - Orchestration Integration Helper
 * Coordinates wallet system with all orchestration modules for seamless operation
 * Ensures proper cross-platform functionality between web and mobile
 */

import { Platform } from 'react-native';
import { lyriaOrchestrator } from './orchestrator';
import { sensorInterpreter } from './interpreter';

// Platform-specific orchestrator imports
let mobileOrchestrator = null;
let webOrchestrator = null;

if (Platform.OS !== 'web') {
  try {
    const { mobileOrchestrator: mobile } = require('./mobile');
    mobileOrchestrator = mobile;
  } catch (error) {
    console.warn('Mobile orchestrator not available:', error);
  }
} else {
  try {
    // Web orchestrator would be imported here if available
    // const { webOrchestrator: web } = require('./web');
    // webOrchestrator = web;
  } catch (error) {
    console.warn('Web orchestrator not available:', error);
  }
}

export class OrchestrationIntegration {
  constructor() {
    this.isInitialized = false;
    this.walletIntegration = null;
    this.orchestrators = {
      lyria: lyriaOrchestrator,
      mobile: mobileOrchestrator,
      web: webOrchestrator,
      interpreter: sensorInterpreter
    };
    this.coordinationEnabled = false;
  }

  // Initialize integration with wallet system
  async initializeWithWallet(walletIntegration) {
    try {
      console.log('🔗 Initializing orchestration integration with wallet system...');
      
      this.walletIntegration = walletIntegration;
      
      // Coordinate Lyria orchestrator with platform-specific modules
      if (this.orchestrators.lyria) {
        this.orchestrators.lyria.coordinateWithPlatformOrchestrators(
          this.orchestrators.mobile,
          this.orchestrators.web,
          this.orchestrators.interpreter,
          walletIntegration
        );
      }

      // Initialize mobile-specific coordination if available
      if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        await this.initializeMobileCoordination(walletIntegration);
      }

      // Initialize web-specific coordination if available
      if (Platform.OS === 'web' && this.orchestrators.web) {
        await this.initializeWebCoordination(walletIntegration);
      }

      this.coordinationEnabled = true;
      this.isInitialized = true;
      
      console.log('✅ Orchestration integration initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize orchestration integration:', error);
      return false;
    }
  }

  // Initialize mobile-specific coordination
  async initializeMobileCoordination(walletIntegration) {
    if (!this.orchestrators.mobile) {
      console.warn('Mobile orchestrator not available');
      return false;
    }

    try {
      console.log('📱 Initializing mobile orchestration coordination...');
      
      // Set up wallet integration for mobile orchestrator
      if (this.orchestrators.mobile.setWalletIntegration) {
        this.orchestrators.mobile.setWalletIntegration(
          walletIntegration,
          walletIntegration.account
        );
      }

      // Initialize Lyria connection for mobile if wallet has API key
      const lyriaApiKey = process.env.EXPO_PUBLIC_LYRIA_API_KEY;
      if (lyriaApiKey && this.orchestrators.mobile.initializeLyriaConnection) {
        await this.orchestrators.mobile.initializeLyriaConnection(lyriaApiKey);
      }

      // Initialize mobile sensors if available
      if (this.orchestrators.mobile.initializeSensors) {
        await this.orchestrators.mobile.initializeSensors();
      }

      console.log('✅ Mobile orchestration coordination initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize mobile coordination:', error);
      return false;
    }
  }

  // Initialize web-specific coordination
  async initializeWebCoordination(walletIntegration) {
    try {
      console.log('🌐 Initializing web orchestration coordination...');
      
      // Web coordination would be implemented here
      // For now, we primarily rely on Lyria orchestrator for web
      
      console.log('✅ Web orchestration coordination initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize web coordination:', error);
      return false;
    }
  }

  // Start orchestration with wallet context
  async startOrchestration(interpretation) {
    if (!this.isInitialized) {
      console.warn('Orchestration integration not initialized');
      return false;
    }

    try {
      // Initialize Lyria orchestrator if not already done
      if (this.orchestrators.lyria && !this.orchestrators.lyria.session) {
        const lyriaApiKey = process.env.EXPO_PUBLIC_LYRIA_API_KEY;
        if (lyriaApiKey) {
          await this.orchestrators.lyria.initialize(lyriaApiKey);
          await this.orchestrators.lyria.connect();
        }
      }

      // Start the stream with the provided interpretation
      if (this.orchestrators.lyria && this.orchestrators.lyria.isConnected) {
        return await this.orchestrators.lyria.startStream(interpretation);
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to start orchestration:', error);
      return false;
    }
  }

  // Update orchestration with new interpretation
  async updateOrchestration(interpretation) {
    if (!this.isInitialized || !this.coordinationEnabled) {
      return false;
    }

    try {
      // Update Lyria orchestrator
      if (this.orchestrators.lyria && this.orchestrators.lyria.isConnected) {
        await this.orchestrators.lyria.updateStream(interpretation);
      }

      // Update mobile orchestrator if available
      if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        this.updateMobileOrchestration(interpretation);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to update orchestration:', error);
      return false;
    }
  }

  // Update mobile-specific orchestration
  updateMobileOrchestration(interpretation) {
    if (!this.orchestrators.mobile) return;

    try {
      // Update Lyria prompts on mobile if connected
      if (this.orchestrators.mobile.isLyriaConnected) {
        if (interpretation.weightedPrompts) {
          this.orchestrators.mobile.sendWeightedPrompts(interpretation.weightedPrompts);
        }
        
        if (interpretation.lyriaConfig) {
          this.orchestrators.mobile.sendMusicGenerationConfig(interpretation.lyriaConfig);
        }
      }
    } catch (error) {
      console.warn('Mobile orchestration update failed:', error);
    }
  }

  // Stop orchestration
  async stopOrchestration() {
    try {
      // Stop Lyria orchestrator
      if (this.orchestrators.lyria) {
        await this.orchestrators.lyria.stop();
      }

      // Clean up mobile orchestrator
      if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        this.orchestrators.mobile.cleanup();
      }

      console.log('✅ Orchestration stopped');
      return true;
    } catch (error) {
      console.error('❌ Failed to stop orchestration:', error);
      return false;
    }
  }

  // Get orchestration status
  getStatus() {
    return {
      initialized: this.isInitialized,
      coordinationEnabled: this.coordinationEnabled,
      platform: Platform.OS,
      walletConnected: !!this.walletIntegration?.account,
      lyriaStatus: this.orchestrators.lyria?.getStatus() || null,
      mobileStatus: Platform.OS !== 'web' ? this.orchestrators.mobile?.getLyriaState() || null : null,
    };
  }

  // Register audio chunk callback
  onAudioChunk(callback) {
    if (this.orchestrators.lyria) {
      this.orchestrators.lyria.onAudioChunk(callback);
    }
  }

  // Register error callback
  onError(callback) {
    if (this.orchestrators.lyria) {
      this.orchestrators.lyria.onError(callback);
    }
  }

  // Register state change callback
  onStateChange(callback) {
    if (this.orchestrators.lyria) {
      this.orchestrators.lyria.onStateChange(callback);
    }
  }

  // Cleanup integration
  cleanup() {
    try {
      // Stop orchestration
      this.stopOrchestration();

      // Reset state
      this.isInitialized = false;
      this.coordinationEnabled = false;
      this.walletIntegration = null;

      console.log('✅ Orchestration integration cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup orchestration integration:', error);
    }
  }
}

// Export singleton instance
export const orchestrationIntegration = new OrchestrationIntegration(); 