/**
 * ORCHESTRATOR.JS - Lyria Communication Orchestration Module
 * Manages two-way communication with Google's Lyria RealTime API
 * Optimized for ultra-low latency with smooth transitions and intelligent batching
 */

import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';
import { performanceMonitor } from './performance.js';

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
    this.lastInterpretation = null;
    this.batchInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Smooth transition management
    this.transitionBuffer = [];
    this.isTransitioning = false;
    this.transitionDuration = 2000; // 2 seconds for smooth transitions

    // Performance monitoring
    this.performanceMetrics = {};
    this.lastConfigUpdate = 0;
    this.pendingUpdates = [];
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
      
      // Start performance monitoring
      performanceMonitor.startMonitoring();
      
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
      console.log('🔍 Performance monitoring active');
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

    // Add update to pending updates for batched processing
    this.pendingUpdates.push({
      interpretation,
      timestamp: Date.now()
    });

    return true;
  }

  // Start batched update processing for optimal performance
  startBatchProcessing() {
    if (this.batchInterval) return;
    
    this.batchInterval = setInterval(() => {
      this.processBatchedUpdates();
    }, 50); // Process updates every 50ms for ultra-responsive feedback
    
    console.log('🔄 Batched update processing started for optimal performance');
  }

  // Process batched updates with enhanced performance monitoring
  processBatchedUpdates() {
    if (this.pendingUpdates.length === 0) return;
    
    const startTime = performance.now();
    
    try {
      // Process all pending updates
      const updates = [...this.pendingUpdates];
      this.pendingUpdates = [];
      
      for (const update of updates) {
        this.processUpdate(update);
      }
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime, updates.length);
      
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  // Process individual update with enhanced sensor mapping
  processUpdate(update) {
    try {
      const { interpretation, timestamp } = update;
      
      // Store current interpretation for change detection
      const previousInterpretation = this.lastInterpretation;
      this.lastInterpretation = interpretation;
      
      // Enhanced sensor response with micro-movement detection
      if (interpretation.isMicroMovement) {
        // Apply subtle parameter changes for micro-movements
        this.applySubtleParameterChanges(interpretation);
      } else {
        // Apply standard parameter updates
        this.applyStandardParameterChanges(interpretation);
      }
      
      // Handle acceleration-based effects
      if (interpretation.isAccelerating) {
        this.applyAccelerationEffects(interpretation);
      }
      
      // Update configuration if significant changes detected
      if (this.detectSignificantChange(interpretation, previousInterpretation)) {
        this.updateConfiguration(interpretation);
      }
      
      // Update weighted prompts if style transition detected
      if (interpretation.hasTransition) {
        this.updateWeightedPrompts(interpretation);
      }

    } catch (error) {
      console.warn('Update processing failed:', error);
    }
  }

  // Apply subtle parameter changes for micro-movements
  applySubtleParameterChanges(interpretation) {
    if (!this.session) return;
    
    try {
      // Micro-adjustments to density and brightness
      const config = {
        ...this.lastConfig,
        density: Math.max(0.1, Math.min(1.0, this.lastConfig.density + (interpretation.magnitude - 0.5) * 0.1)),
        brightness: Math.max(0.0, Math.min(1.0, this.lastConfig.brightness + (interpretation.magnitude - 0.5) * 0.05))
      };
      
      // Apply micro-changes without triggering major updates
      this.session.setMusicGenerationConfig({
        musicGenerationConfig: config
      }).catch(error => console.debug('Micro-update failed:', error));
      
      console.debug(`🔬 Micro-movement update: density=${config.density.toFixed(3)}, brightness=${config.brightness.toFixed(3)}`);
      
    } catch (error) {
      console.debug('Subtle parameter update failed:', error);
    }
  }

  // Apply standard parameter changes for normal movements
  applyStandardParameterChanges(interpretation) {
    if (!this.session) return;
    
    try {
    const config = interpretation.lyriaConfig;
      
      // Check if changes are significant enough to apply
      const densityChange = Math.abs(config.density - this.lastConfig.density);
      const brightnessChange = Math.abs(config.brightness - this.lastConfig.brightness);
      
      if (densityChange > 0.05 || brightnessChange > 0.05) {
        this.session.setMusicGenerationConfig({
          musicGenerationConfig: config
        }).catch(error => console.warn('Standard update failed:', error));
        
        this.lastConfig = { ...config };
        
        console.log(`🎵 Standard movement update: BPM=${config.bpm}, density=${config.density.toFixed(2)}, brightness=${config.brightness.toFixed(2)}`);
      }
      
    } catch (error) {
      console.warn('Standard parameter update failed:', error);
    }
  }

  // Apply acceleration-based effects
  applyAccelerationEffects(interpretation) {
    if (!this.session) return;

    try {
      // Temporary BPM boost for acceleration
      const boostedConfig = {
        ...interpretation.lyriaConfig,
        bpm: Math.min(200, interpretation.lyriaConfig.bpm + 10),
        guidance: Math.min(0.8, interpretation.lyriaConfig.guidance + 0.1)
      };
      
      this.session.setMusicGenerationConfig({
        musicGenerationConfig: boostedConfig
      }).catch(error => console.debug('Acceleration effect failed:', error));
      
      // Revert after short duration
      setTimeout(() => {
        this.session.setMusicGenerationConfig({
          musicGenerationConfig: interpretation.lyriaConfig
        }).catch(error => console.debug('Acceleration revert failed:', error));
      }, 2000);
      
      console.log(`🚀 Acceleration effect: BPM boost to ${boostedConfig.bpm}`);

    } catch (error) {
      console.warn('Acceleration effects failed:', error);
    }
  }

  // Detect significant changes that warrant style updates
  detectSignificantChange(interpretation, previousInterpretation) {
    if (!previousInterpretation) return true;
    
    const intensityChange = Math.abs(interpretation.magnitude - previousInterpretation.magnitude);
    const movementTypeChange = interpretation.movement.type !== previousInterpretation.movement.type;
    const hasTransition = interpretation.hasTransition;
    
    return intensityChange > 0.2 || movementTypeChange || hasTransition;
  }

  // Update performance metrics
  updatePerformanceMetrics(processingTime, updateCount) {
    this.performanceMetrics = this.performanceMetrics || {
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      totalUpdates: 0,
      updateFrequency: 0
    };
    
    this.performanceMetrics.totalUpdates += updateCount;
    this.performanceMetrics.maxProcessingTime = Math.max(this.performanceMetrics.maxProcessingTime, processingTime);
    this.performanceMetrics.averageProcessingTime = 
      (this.performanceMetrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
    
    // Log performance warnings
    if (processingTime > 20) { // 20ms threshold
      console.warn(`⚠️ Slow batch processing: ${processingTime.toFixed(1)}ms for ${updateCount} updates`);
    }
  }

  // Enhanced update configuration with performance optimization
  async updateConfiguration(interpretation) {
    if (!this.session) return;

    try {
      const config = interpretation.lyriaConfig;
      
      // Throttle configuration updates to prevent overwhelming Lyria
      const now = Date.now();
      if (now - this.lastConfigUpdate < 100) { // 100ms throttle
        return;
      }
      this.lastConfigUpdate = now;
      
      const result = this.session.setMusicGenerationConfig({
        musicGenerationConfig: config
      });
      
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.warn('Failed to update config:', error));
      }

      this.lastConfig = { ...config };

      console.log('🎛️ Configuration updated:', {
        bpm: config.bpm,
        density: config.density.toFixed(2),
        brightness: config.brightness.toFixed(2),
        guidance: config.guidance.toFixed(2),
        intensity: interpretation.intensity,
        movement: interpretation.movement.type
      });

    } catch (error) {
      console.warn('Configuration update failed:', error);
    }
  }

  // Enhanced weighted prompts update with style transitions
  async updateWeightedPrompts(interpretation) {
    if (!this.session || !interpretation.hasTransition) return;

    try {
      // Only update prompts on significant style transitions
      const result = this.session.setWeightedPrompts({
        weightedPrompts: interpretation.weightedPrompts
      });
      
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.warn('Failed to update prompts:', error));
      }

      console.log(`🎨 Style transition: ${interpretation.stylePrompt}`);

    } catch (error) {
      console.warn('Weighted prompts update failed:', error);
    }
  }

  // Get enhanced orchestrator status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isStreaming: this.isStreaming,
      reconnectAttempts: this.reconnectAttempts,
      lastConfigUpdate: this.lastConfigUpdate,
      pendingUpdates: this.pendingUpdates.length,
      performanceMetrics: this.performanceMetrics || {},
      lastInterpretation: this.lastInterpretation ? {
        intensity: this.lastInterpretation.intensity,
        movement: this.lastInterpretation.movement.type,
        isMicroMovement: this.lastInterpretation.isMicroMovement,
        isAccelerating: this.lastInterpretation.isAccelerating,
        timestamp: this.lastInterpretation.timestamp
      } : null
    };
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
    
    // Stop performance monitoring
    performanceMonitor.stopMonitoring();
    
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
    this.pendingUpdates = [];
    this.lastInterpretation = null;
    this.reconnectAttempts = 0;
    
    this.emit('onStateChange', { connected: false, streaming: false });
    console.log('Disconnected from Lyria');
  }

  // Cleanup all resources
  cleanup() {
    // Stop performance monitoring
    performanceMonitor.stopMonitoring();
    
    // Stop batch processing
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Clear pending updates
    this.pendingUpdates = [];

    // Disconnect session
    if (this.session) {
      try {
        this.session.disconnect();
      } catch (error) {
        console.warn('Session disconnect error:', error);
      }
      this.session = null;
    }

    // Reset state
    this.isConnected = false;
    this.isStreaming = false;
    this.callbacks = {
      onAudioChunk: [],
      onStateChange: [],
      onError: []
    };

    console.log('🧹 Lyria Orchestrator cleanup completed');
    console.log('📊 Final performance summary:');
    performanceMonitor.logSummary();
  }
}

// Export singleton instance
export const lyriaOrchestrator = new LyriaOrchestrator(); 