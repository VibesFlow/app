/**
 * ORCHESTRATOR.JS - Lyria Communication Orchestration Module
 * Manages two-way communication with Google's Lyria RealTime API
 * Optimized for ultra-low latency with smooth transitions and intelligent batching
 */

import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';
import { EventEmitter } from 'events';

export class LyriaOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.session = null;
    this.apiKey = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.autoReconnect = true;
    this.enableSmoothing = true;
    this.connectionState = 'disconnected';
    this.currentPlaylist = null;
    this.callbacks = {
      onAudioChunk: [],
      onError: [],
      onStateChange: []
    };
    
    // Performance tracking
    this.processingMetrics = {
      recentTimes: [],
      average: 0,
      isHeavy: false
    };
    
    // Adaptive batching parameters
    this.minBatchInterval = 200; // 200ms when processing chunks
    this.maxBatchInterval = 50;  // 50ms when idle
    this.adaptiveBatchInterval = this.maxBatchInterval;
    
    // Chunk processing state
    this.isProcessingChunk = false;
    this.processingStartTime = 0;
    
    // ENHANCED ADAPTIVE BATCHING with processing state awareness
    this.updateQueue = [];
    this.chunkProcessingStartTime = 0;
    this.lastChunkTimestamp = 0;
    this.processingBatchInterval = 100; // Slower updates during processing
    this.idleBatchInterval = 40; // Faster updates during idle
    this.currentBatchInterval = 40;
    
    // INTELLIGENT SMOOTHING SYSTEM
    this.smoothingBuffer = [];
    this.maxSmoothingBuffer = 8; // Increased buffer size
    this.lastInterpretation = null;
    this.lastConfig = {};
    this.lastStyle = null;
    this.lastUpdateTime = 0;
    this.isTransitioning = false;
    this.transitionDuration = 1500; // Reduced for more responsiveness
    
    // PROCESSING STATE MONITORING
    this.processingStateMonitor = {
      chunkCount: 0,
      averageProcessingTime: 0,
      recentProcessingTimes: [],
      maxProcessingTimes: 10,
      heavyProcessingThreshold: 100, // ms
      isHeavyProcessing: false
    };
    
    // CONNECTION MANAGEMENT
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000;
    
    // Initialize orchestrator
    this.initializeOrchestrator();
  }

  async initializeOrchestrator() {
    try {
      return true;
    } catch (error) {
      return false;
    }
  }

  // Initialize orchestrator with API key
  async initialize(apiKey) {
    this.apiKey = apiKey;
    
    if (!apiKey) {
      console.warn('Lyria API key not provided');
      return false;
    }

    try {
      return true;
    } catch (error) {
      console.error('Orchestrator initialization failed:', error);
      return false;
    }
  }

  // Register callback for audio chunks with processing state tracking
  onAudioChunk(callback) {
    this.callbacks.onAudioChunk.push((data) => {
      // Track chunk processing periods for adaptive batching
      this.isProcessingChunk = true;
      this.processingStartTime = Date.now();
      
      // Increase batch interval during chunk processing to reduce interruptions
      this.adaptiveBatchInterval = this.minBatchInterval;
      
      try {
        callback(data);
      } catch (error) {
        console.warn('Audio chunk callback error:', error);
      }
      
      // Reset processing state after 200ms
      setTimeout(() => {
        this.isProcessingChunk = false;
        this.adaptiveBatchInterval = this.maxBatchInterval; // Return to responsive mode
      }, 200);
    });
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
      
      // Start ADAPTIVE batched update processing
      this.startAdaptiveBatchProcessing();
      
      console.info('✅ Successfully connected to Lyria RealTime API');
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to Lyria API:', error);
      this.handleConnectionError(error);
      return false;
    }
  }

  // ENHANCED message handling with processing state tracking
  handleMessage(message) {
    try {
      console.log('🔍 Received Lyria message:', message);
      
      // Handle audio chunks with multiple possible formats
      let audioData = null;
      
      // Try different possible audio data locations
      if (message.serverContent?.audioData) {
        audioData = message.serverContent.audioData;
      } else if (message.serverContent?.audioChunks?.length > 0) {
        const audioChunk = message.serverContent.audioChunks[0];
        if (audioChunk.audioChunk) {
          audioData = audioChunk.audioChunk;
        } else if (audioChunk.data) {
          audioData = audioChunk.data;
        }
      } else if (message.serverContent?.audioChunk) {
        audioData = message.serverContent.audioChunk;
      }
      
      // Debug: Log the structure of the serverContent to help identify where audio data might be
      if (!audioData && message.serverContent) {
        console.log('🔍 No audio data found. ServerContent structure:', Object.keys(message.serverContent));
        if (message.serverContent.audioChunks) {
          console.log('🔍 AudioChunks structure:', message.serverContent.audioChunks);
        }
      }
      
      if (audioData) {
        // TRACK CHUNK PROCESSING STATE
        this.updateChunkProcessingState(true);
        
        // Monitor processing performance
        const processingStartTime = Date.now();
        
        // Emit audio chunk
        this.emit('onAudioChunk', audioData);
        
        // Track processing time
        const processingTime = Date.now() - processingStartTime;
        this.updateProcessingMetrics(processingTime);
        
        // Update streaming state if not already set
        if (!this.isStreaming) {
          this.isStreaming = true;
          this.emit('onStateChange', { connected: true, streaming: true });
          console.info('🎵 Lyria streaming state updated to: true');
        }
        
        // Update chunk processing state with delay
        setTimeout(() => {
          this.updateChunkProcessingState(false);
        }, 200); // 200ms window for chunk processing
      }
      
      // Handle other message types
      if (message.serverContent?.status) {
        console.info('Lyria status:', message.serverContent.status);
      }
      
    } catch (error) {
      console.error('Message handling error:', error);
      this.emit('onError', error);
    }
  }

  // INTELLIGENT PROCESSING STATE MANAGEMENT
  updateChunkProcessingState(isProcessing) {
    if (isProcessing) {
      this.isProcessingChunk = true;
      this.chunkProcessingStartTime = Date.now();
      this.lastChunkTimestamp = Date.now();
      this.processingStateMonitor.chunkCount++;
      
      // Adjust batch interval for processing state
      this.currentBatchInterval = this.processingBatchInterval;
      
      console.log('🎵 Chunk processing started');
    } else {
      this.isProcessingChunk = false;
      
      // Adjust batch interval back to idle
      this.currentBatchInterval = this.idleBatchInterval;
      
      console.log('🎵 Chunk processing ended');
    }
  }

  // PROCESSING PERFORMANCE MONITORING
  updateProcessingMetrics(processingTime) {
    const metrics = this.processingStateMonitor;
    
    // Add to recent processing times
    metrics.recentProcessingTimes.push(processingTime);
    
    // Keep only recent measurements
    if (metrics.recentProcessingTimes.length > metrics.maxProcessingTimes) {
      metrics.recentProcessingTimes.shift();
    }
    
    // Calculate average processing time
    metrics.averageProcessingTime = metrics.recentProcessingTimes.reduce((sum, time) => sum + time, 0) / metrics.recentProcessingTimes.length;
    
    // Detect heavy processing periods
    metrics.isHeavyProcessing = metrics.averageProcessingTime > metrics.heavyProcessingThreshold;
    
    // Adjust batch intervals based on processing load
    if (metrics.isHeavyProcessing) {
      this.processingBatchInterval = Math.min(this.processingBatchInterval * 1.1, 150); // Slower during heavy processing
    } else {
      this.processingBatchInterval = Math.max(this.processingBatchInterval * 0.98, 80); // Faster during light processing
    }
  }

  // ENHANCED ADAPTIVE BATCH PROCESSING with intelligent load balancing
  startAdaptiveBatchProcessing() {
    const processUpdates = () => {
      if (this.updateQueue.length === 0) {
        // Schedule next check with current adaptive interval
        setTimeout(processUpdates, this.currentBatchInterval);
        return;
      }

      // INTELLIGENT FILTERING: During chunk processing, be more selective about updates
      let updateToProcess;
      
      if (this.isProcessingChunk || this.processingStateMonitor.isHeavyProcessing) {
        // During chunk processing, only process significant changes
        const significantUpdates = this.updateQueue.filter(update => {
          return this.isSignificantChange(update.interpretation);
        });
        
        if (significantUpdates.length > 0) {
          updateToProcess = significantUpdates[significantUpdates.length - 1];
          // Remove processed updates
          this.updateQueue = this.updateQueue.filter(u => !significantUpdates.includes(u));          
        } else {
          // No significant updates during processing, skip this cycle
          setTimeout(processUpdates, this.currentBatchInterval);
          return;
        }
      } else {
        // During idle periods, process the most recent update
        updateToProcess = this.updateQueue[this.updateQueue.length - 1];
        this.updateQueue = [];
      }

      if (updateToProcess) {
        this.processSmoothedUpdate(updateToProcess.interpretation);
      }

      // Schedule next processing cycle with adaptive interval
      setTimeout(processUpdates, this.currentBatchInterval);
    };

    processUpdates();
  }

  // ENHANCED SIGNIFICANCE DETECTION for processing state
  isSignificantChange(interpretation) {
    if (!this.lastInterpretation) return true;
    
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;
    
    // ADAPTIVE THRESHOLDS based on processing state
    const bpmThreshold = this.isProcessingChunk ? 8 : 4;
    const densityThreshold = this.isProcessingChunk ? 0.2 : 0.1;
    const brightnessThreshold = this.isProcessingChunk ? 0.2 : 0.1;
    const guidanceThreshold = this.isProcessingChunk ? 0.3 : 0.15;
    
    // Only consider MAJOR changes during chunk processing
    const majorBpmChange = Math.abs((lastConfig.bpm || 0) - config.bpm) > bpmThreshold;
    const majorDensityChange = Math.abs((lastConfig.density || 0) - config.density) > densityThreshold;
    const majorBrightnessChange = Math.abs((lastConfig.brightness || 0) - config.brightness) > brightnessThreshold;
    const majorGuidanceChange = Math.abs((lastConfig.guidance || 0) - config.guidance) > guidanceThreshold;
    const majorStyleChange = interpretation.stylePrompt !== this.lastStyle;
    
    return majorBpmChange || majorDensityChange || majorBrightnessChange || majorGuidanceChange || majorStyleChange;
  }

  // ENHANCED SMOOTHING with processing state awareness
  async processSmoothedUpdate(interpretation) {
    try {
      const now = Date.now();
      const timeSinceLastUpdate = now - this.lastUpdateTime;
      
      // Add to smoothing buffer
      this.smoothingBuffer.push({
        interpretation,
        timestamp: now,
        isProcessing: this.isProcessingChunk
      });
      
      // Keep only recent entries in smoothing buffer
      this.smoothingBuffer = this.smoothingBuffer.filter(entry => 
        now - entry.timestamp < 2000 // Extended to 2 seconds for better smoothing
      );
      
      // Limit buffer size
      if (this.smoothingBuffer.length > this.maxSmoothingBuffer) {
        this.smoothingBuffer = this.smoothingBuffer.slice(-this.maxSmoothingBuffer);
      }
      
      // Apply smoothing if we have enough data points
      let smoothedInterpretation = interpretation;
      if (this.smoothingBuffer.length > 2) {
        smoothedInterpretation = this.applySmoothingToInterpretation(interpretation);
      }
      
      let hasUpdates = false;

      // Check for style/prompt changes with smoothing
      if (this.hasStyleChanged(smoothedInterpretation)) {
        await this.updatePromptsSmoothed(smoothedInterpretation);
        hasUpdates = true;
      }

      // Check for configuration changes with smoothing
      if (this.hasConfigChanged(smoothedInterpretation)) {
        await this.updateConfigurationSmoothed(smoothedInterpretation);
        hasUpdates = true;
      }

      if (hasUpdates) {
        this.lastUpdateTime = now;
        this.lastInterpretation = smoothedInterpretation;
      }

    } catch (error) {
      console.error('Smoothed update processing error:', error);
      this.emit('onError', error);
    }
  }

  // ENHANCED SMOOTHING with processing state awareness
  applySmoothingToInterpretation(currentInterpretation) {
    if (this.smoothingBuffer.length < 2) return currentInterpretation;
    
    const recentInterpretations = this.smoothingBuffer.map(entry => entry.interpretation);
    
    // ADAPTIVE SMOOTHING FACTOR based on processing state
    let smoothingFactor = 0.3; // Default: 30% new value, 70% average
    
    if (this.isProcessingChunk) {
      smoothingFactor = 0.2; // More smoothing during chunk processing
    } else if (this.processingStateMonitor.isHeavyProcessing) {
      smoothingFactor = 0.25; // Medium smoothing during heavy processing
    }
    
    // Smooth numerical config values
    const smoothedConfig = { ...currentInterpretation.lyriaConfig };
    
    // Smooth BPM with processing state awareness
    const avgBpm = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.bpm, 0) / recentInterpretations.length;
    smoothedConfig.bpm = Math.round(smoothedConfig.bpm * smoothingFactor + avgBpm * (1 - smoothingFactor));
    
    // Smooth density with processing state awareness
    const avgDensity = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.density, 0) / recentInterpretations.length;
    smoothedConfig.density = parseFloat((smoothedConfig.density * smoothingFactor + avgDensity * (1 - smoothingFactor)).toFixed(3));
    
    // Smooth brightness with processing state awareness
    const avgBrightness = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.brightness, 0) / recentInterpretations.length;
    smoothedConfig.brightness = parseFloat((smoothedConfig.brightness * smoothingFactor + avgBrightness * (1 - smoothingFactor)).toFixed(3));
    
    // Smooth guidance with processing state awareness
    const avgGuidance = recentInterpretations.reduce((sum, interp) => sum + (interp.lyriaConfig.guidance || 0), 0) / recentInterpretations.length;
    smoothedConfig.guidance = parseFloat((smoothedConfig.guidance * smoothingFactor + avgGuidance * (1 - smoothingFactor)).toFixed(3));
    
    return {
      ...currentInterpretation,
      lyriaConfig: smoothedConfig
    };
  }

  // ENHANCED CHANGE DETECTION with processing state awareness
  hasConfigChanged(interpretation) {
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;

    // ADAPTIVE THRESHOLDS: Higher thresholds during chunk processing for smoother experience
    const bpmThreshold = this.isProcessingChunk ? 4 : 2;
    const densityThreshold = this.isProcessingChunk ? 0.1 : 0.05;
    const brightnessThreshold = this.isProcessingChunk ? 0.1 : 0.05;
    const guidanceThreshold = this.isProcessingChunk ? 0.25 : 0.15;
    const temperatureThreshold = this.isProcessingChunk ? 0.2 : 0.1;

    const bpmChanged = Math.abs((lastConfig.bpm || 0) - config.bpm) > bpmThreshold;
    const densityChanged = Math.abs((lastConfig.density || 0) - config.density) > densityThreshold;
    const brightnessChanged = Math.abs((lastConfig.brightness || 0) - config.brightness) > brightnessThreshold;
    const guidanceChanged = Math.abs((lastConfig.guidance || 0) - config.guidance) > guidanceThreshold;
    const temperatureChanged = Math.abs((lastConfig.temperature || 0) - (config.temperature || 0)) > temperatureThreshold;

    return bpmChanged || densityChanged || brightnessChanged || guidanceChanged || temperatureChanged;
  }

  // ENHANCED TRANSITION HANDLING with processing state awareness
  handleSmoothStyleTransition(interpretation) {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    
    // ADAPTIVE TRANSITION TIMING based on processing state
    let transitionTime = this.transitionDuration;
    
    if (this.isProcessingChunk) {
      transitionTime = this.transitionDuration * 1.5; // Slower during chunk processing
    } else if (this.processingStateMonitor.isHeavyProcessing) {
      transitionTime = this.transitionDuration * 1.2; // Slightly slower during heavy processing
    }
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, transitionTime);
    
    console.log(`🌊 Style transition started (${transitionTime}ms duration)`);
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

  // Handle connection errors during initial connection
  handleConnectionError(error) {
    console.error('❌ Lyria connection error:', error);
    this.isConnected = false;
    this.emit('onError', error);
    
    // Attempt reconnection for recoverable errors
    if (this.shouldReconnect(error)) {
      setTimeout(() => this.attemptReconnection(), 2000);
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
      console.info('Starting Lyria RealTime stream');
      
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
      
      // Set streaming state immediately when play() succeeds
      this.isStreaming = true;
      this.emit('onStateChange', { connected: this.isConnected, streaming: true });
      
      // Store last values for change detection
      this.lastStyle = interpretation.stylePrompt;
      this.lastConfig = { ...interpretation.lyriaConfig };
      this.lastUpdateTime = Date.now();      
      return true;

    } catch (error) {
      console.error('Failed to start Lyria stream:', error);
      this.emit('onError', error);
      return false;
    }
  }

  // Update Lyria with INTELLIGENT batching that adapts to processing state
  async updateStream(interpretation) {
    if (!this.session || !this.isConnected) {
      return false;
    }

    // Add timestamp and processing state info to update
    this.updateQueue.push({
      interpretation,
      timestamp: Date.now(),
      isProcessingChunk: this.isProcessingChunk
    });

    // Limit queue size to prevent memory buildup
    if (this.updateQueue.length > 10) {
      this.updateQueue = this.updateQueue.slice(-5); // Keep only latest 5
    }

    return true;
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