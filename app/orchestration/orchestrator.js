/**
 * ORCHESTRATOR.JS - Lyria Communication Orchestration Module
 * Manages two-way communication with Google's Lyria RealTime API
 * Optimized for ultra-low latency with smooth transitions and intelligent batching
 */

import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';

export class LyriaOrchestrator {
  constructor() {
    this.session = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.apiKey = null;
    this.callbacks = {
      onAudioChunk: [],
      onError: [],
      onStateChange: []
    };
    
    // Performance optimization
    this.lastConfig = {};
    this.lastStyle = '';
    this.updateQueue = [];
    this.batchInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Smooth transition management
    this.transitionBuffer = [];
    this.isTransitioning = false;
    this.transitionDuration = 2000; // 2 seconds for smooth transitions
  }

  // Initialize orchestrator with API key
  async initialize(apiKey) {
    this.apiKey = apiKey;
    
    if (!apiKey) {
      console.warn('Lyria API key not provided');
      return false;
    }

    try {
      console.log('Initializing Lyria orchestrator');
      return true;
    } catch (error) {
      console.error('Orchestrator initialization failed:', error);
      return false;
    }
  }

  // Register callback for audio chunks
  onAudioChunk(callback) {
    this.callbacks.onAudioChunk.push(callback);
  }

  // Register callback for errors
  onError(callback) {
    this.callbacks.onError.push(callback);
  }

  // Register callback for state changes
  onStateChange(callback) {
    this.callbacks.onStateChange.push(callback);
  }

  // Emit events to registered callbacks
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.warn(`Callback error for ${event}:`, error);
        }
      });
    }
  }

  // Connect to Lyria RealTime API with optimized settings
  async connect() {
    if (this.isConnected || !this.apiKey) {
      return this.isConnected;
    }

    try {
      console.log('Connecting to Lyria RealTime API...');
      
      // Initialize GoogleGenAI client with optimized settings
      const genAI = new GoogleGenAI({
        apiKey: this.apiKey,
        apiVersion: 'v1alpha',
      });

      // Create Lyria RealTime session with ultra-low latency callbacks
      this.session = await genAI.live.music.connect({
        model: 'models/lyria-realtime-exp',
        callbacks: {
          onmessage: (message) => this.handleMessage(message),
          onerror: (error) => this.handleError(error),
          onclose: () => this.handleClose()
        }
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('onStateChange', { connected: true, streaming: false });
      
      // Start batched update processing for optimal performance
      this.startBatchProcessing();
      
      console.log('Successfully connected to Lyria RealTime API');
      return true;

    } catch (error) {
      console.error('Failed to connect to Lyria:', error);
      this.handleConnectionError(error);
      return false;
    }
  }

  // Handle incoming messages from Lyria with optimized audio processing
  handleMessage(message) {
    try {
      if (message.serverContent?.audioChunks?.length > 0) {
        const audioChunk = message.serverContent.audioChunks[0];
        
        // Optimized audio chunk processing
        let audioData = null;
        if (audioChunk.audioChunk) {
          audioData = audioChunk.audioChunk;
        } else if (audioChunk.data) {
          audioData = audioChunk.data;
        }

        if (audioData) {
          // Emit audio chunk with minimal delay
          this.emit('onAudioChunk', audioData);
          
          // Update streaming state if not already set
          if (!this.isStreaming) {
            this.isStreaming = true;
            this.emit('onStateChange', { connected: true, streaming: true });
          }
        }
      }
      
      // Handle other message types (metadata, status, etc.)
      if (message.serverContent?.status) {
        console.log('Lyria status:', message.serverContent.status);
      }
      
    } catch (error) {
      console.error('Message handling error:', error);
      this.emit('onError', error);
    }
  }

  // Handle connection errors with smart reconnection
  handleError(error) {
    console.error('Lyria session error:', error);
    this.emit('onError', error);
    
    // Attempt reconnection for recoverable errors
    if (this.shouldReconnect(error)) {
      this.attemptReconnection();
    }
  }

  // Handle connection close with cleanup
  handleClose() {
    console.log('Lyria RealTime stream closed');
    this.isConnected = false;
    this.isStreaming = false;
    this.emit('onStateChange', { connected: false, streaming: false });
    
    // Attempt reconnection if unexpected
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.attemptReconnection(), this.reconnectDelay);
    }
  }

  // Start music generation with initial parameters
  async startStream(interpretation) {
    if (!this.session || !this.isConnected) {
      console.warn('Cannot start stream: not connected to Lyria');
      return false;
    }

    try {
      console.log('Starting Lyria music generation');
      
      // Set initial weighted prompts
      await this.session.setWeightedPrompts({
        weightedPrompts: interpretation.weightedPrompts
      });

      // Set initial configuration
      await this.session.setMusicGenerationConfig({
        musicGenerationConfig: interpretation.lyriaConfig
      });

      // Start music generation
      await this.session.play();
      
      // Store last values for change detection
      this.lastStyle = interpretation.stylePrompt;
      this.lastConfig = { ...interpretation.lyriaConfig };
      
      console.log('Lyria music generation started successfully');
      return true;

    } catch (error) {
      console.error('Failed to start Lyria stream:', error);
      this.emit('onError', error);
      return false;
    }
  }

  // Update Lyria with new interpretation (batched for performance)
  async updateStream(interpretation) {
    if (!this.session || !this.isConnected) {
      return false;
    }

    // Add update to queue for batched processing
    this.updateQueue.push({
      interpretation,
      timestamp: Date.now()
    });

    return true;
  }

  // Process updates in batches for ULTRA-LOW LATENCY
  startBatchProcessing() {
    this.batchInterval = setInterval(() => {
      if (this.updateQueue.length === 0) return;

      // Get the most recent update (discard stale ones)
      const latestUpdate = this.updateQueue[this.updateQueue.length - 1];
      this.updateQueue = [];

      this.processUpdate(latestUpdate.interpretation);
    }, 50); // FASTER processing - every 50ms for maximum rave responsiveness
  }

  // Process individual update with intelligent change detection
  async processUpdate(interpretation) {
    try {
      let hasUpdates = false;

      // Check for style/prompt changes
      if (this.hasStyleChanged(interpretation)) {
        await this.updatePrompts(interpretation);
        hasUpdates = true;
      }

      // Check for configuration changes
      if (this.hasConfigChanged(interpretation)) {
        await this.updateConfiguration(interpretation);
        hasUpdates = true;
      }

      if (hasUpdates) {
        console.log('Lyria updated with new parameters');
      }

    } catch (error) {
      console.error('Update processing error:', error);
      this.emit('onError', error);
    }
  }

  // Check if style has changed significantly
  hasStyleChanged(interpretation) {
    if (!this.lastStyle) return true;
    
    // For smooth transitions, check if we need weighted prompts
    if (interpretation.hasTransition) {
      return true;
    }
    
    return interpretation.stylePrompt !== this.lastStyle;
  }

  // Check if configuration has changed significantly - ULTRA-SENSITIVE for rave
  hasConfigChanged(interpretation) {
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;

    // MUCH more sensitive change detection for instant rave response
    const bpmChanged = Math.abs((lastConfig.bpm || 0) - config.bpm) > 1; // Was 3, now 1
    const densityChanged = Math.abs((lastConfig.density || 0) - config.density) > 0.02; // Was 0.05, now 0.02
    const brightnessChanged = Math.abs((lastConfig.brightness || 0) - config.brightness) > 0.02; // Was 0.05, now 0.02
    const guidanceChanged = Math.abs((lastConfig.guidance || 0) - config.guidance) > 0.1; // Was 0.3, now 0.1

    return bpmChanged || densityChanged || brightnessChanged || guidanceChanged;
  }

  // Update prompts with smooth transitions
  async updatePrompts(interpretation) {
    if (!this.session) return;

    try {
      // Use weighted prompts for smooth transitions
      const result = this.session.setWeightedPrompts({
        weightedPrompts: interpretation.weightedPrompts
      });
      
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.warn('Failed to update prompts:', error));
      }

      this.lastStyle = interpretation.stylePrompt;
      
      // Handle transitions
      if (interpretation.hasTransition) {
        this.handleStyleTransition(interpretation);
      }

    } catch (error) {
      console.warn('Prompt update failed:', error);
    }
  }

  // Update configuration parameters
  async updateConfiguration(interpretation) {
    if (!this.session) return;

    try {
      const config = interpretation.lyriaConfig;
      
      const result = this.session.setMusicGenerationConfig({
        musicGenerationConfig: config
      });
      
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.warn('Failed to update config:', error));
      }

      this.lastConfig = { ...config };

      console.log('Config updated:', {
        bpm: config.bpm,
        density: config.density.toFixed(2),
        brightness: config.brightness.toFixed(2),
        guidance: config.guidance.toFixed(2)
      });

    } catch (error) {
      console.warn('Configuration update failed:', error);
    }
  }

  // Handle style transitions with buffering
  handleStyleTransition(interpretation) {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    
    // Implement cross-fading logic here if needed
    setTimeout(() => {
      this.isTransitioning = false;
    }, this.transitionDuration);
  }

  // Determine if reconnection should be attempted
  shouldReconnect(error) {
    // Reconnect for network errors, but not for authentication errors
    const reconnectableErrors = ['network', 'timeout', 'connection'];
    const errorStr = error.toString().toLowerCase();
    
    return reconnectableErrors.some(errType => errorStr.includes(errType));
  }

  // Attempt reconnection with exponential backoff
  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      const success = await this.connect();
      if (success && this.isStreaming) {
        // Resume streaming if it was active
        console.log('Reconnected successfully, resuming stream');
      }
    }, delay);
  }

  // Pause music generation
  async pause() {
    if (!this.session || !this.isStreaming) return false;

    try {
      await this.session.pause();
      this.isStreaming = false;
      this.emit('onStateChange', { connected: this.isConnected, streaming: false });
      console.log('Lyria stream paused');
      return true;
    } catch (error) {
      console.error('Failed to pause stream:', error);
      return false;
    }
  }

  // Resume music generation
  async resume() {
    if (!this.session || this.isStreaming) return false;

    try {
      await this.session.play();
      this.isStreaming = true;
      this.emit('onStateChange', { connected: this.isConnected, streaming: true });
      console.log('Lyria stream resumed');
      return true;
    } catch (error) {
      console.error('Failed to resume stream:', error);
      return false;
    }
  }

  // Stop music generation
  async stop() {
    if (!this.session) return false;

    try {
      if (typeof this.session.stop === 'function') {
        const result = this.session.stop();
        if (result && typeof result.catch === 'function') {
          result.catch((error) => console.warn('Session stop error:', error));
        }
      }
      
      this.isStreaming = false;
      this.emit('onStateChange', { connected: this.isConnected, streaming: false });
      console.log('Lyria stream stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop stream:', error);
      return false;
    }
  }

  // Reset context for major parameter changes
  async resetContext() {
    if (!this.session) return false;

    try {
      if (typeof this.session.reset_context === 'function') {
        await this.session.reset_context();
        console.log('Lyria context reset');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to reset context:', error);
      return false;
    }
  }

  // Disconnect and cleanup
  async disconnect() {
    console.log('Disconnecting from Lyria...');
    
    // Stop batch processing
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Stop streaming
    await this.stop();

    // Clean up session
    if (this.session) {
      try {
        if (typeof this.session.disconnect === 'function') {
          await this.session.disconnect();
        }
      } catch (error) {
        console.warn('Session disconnect error:', error);
      }
      this.session = null;
    }

    this.isConnected = false;
    this.isStreaming = false;
    this.updateQueue = [];
    this.reconnectAttempts = 0;
    
    this.emit('onStateChange', { connected: false, streaming: false });
    console.log('Disconnected from Lyria');
  }

  // Get current connection status
  getStatus() {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.updateQueue.length
    };
  }

  // Cleanup all resources
  cleanup() {
    this.disconnect();
    this.callbacks = {
      onAudioChunk: [],
      onError: [],
      onStateChange: []
    };
    console.log('Lyria orchestrator cleanup completed');
  }
}

// Export singleton instance
export const lyriaOrchestrator = new LyriaOrchestrator(); 