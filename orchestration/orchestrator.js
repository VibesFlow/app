/**
 * ORCHESTRATOR.JS - Lyria Communication Orchestration Module
 * Manages two-way communication with Google's Lyria RealTime API
 * Optimized for ultra-low latency with smooth transitions and intelligent batching
 */

// Ensure polyfills are loaded for platform compatibility (includes crypto wrapper)
import '../configs/polyfills';

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
    
    // Near-zero latency coordination
    this.mobileOrchestrator = null;
    this.webOrchestrator = null;
    this.sensorInterpreter = null;
    this.isZeroLatencyMode = false;
    this.lastSensorTimestamp = 0;
    this.sensorLatencyThreshold = 10; // 10ms maximum latency
    this.immediateUpdateQueue = [];
    this.isProcessingImmediate = false;
    
    // Performance tracking with mobile optimization
    this.processingMetrics = {
      recentTimes: [],
      average: 0,
      isHeavy: false,
      mobileOptimized: Platform.OS !== 'web'
    };
    
    // ENHANCED ADAPTIVE BATCHING for mobile
    this.minBatchInterval = Platform.OS === 'web' ? 200 : 100; // Faster on mobile
    this.maxBatchInterval = Platform.OS === 'web' ? 50 : 25;   // Ultra-fast on mobile
    this.adaptiveBatchInterval = this.maxBatchInterval;
    
    // Chunk processing state with mobile awareness
    this.isProcessingChunk = false;
    this.processingStartTime = 0;
    this.mobileChunkProcessing = Platform.OS !== 'web';
    
    // ULTRA-RESPONSIVE BATCHING with mobile coordination
    this.updateQueue = [];
    this.chunkProcessingStartTime = 0;
    this.lastChunkTimestamp = 0;
    this.processingBatchInterval = Platform.OS === 'web' ? 100 : 50; // Faster on mobile
    this.idleBatchInterval = Platform.OS === 'web' ? 40 : 20;        // Ultra-fast on mobile
    this.currentBatchInterval = this.idleBatchInterval;
    
    // INTELLIGENT SMOOTHING SYSTEM with mobile optimization
    this.smoothingBuffer = [];
    this.maxSmoothingBuffer = Platform.OS === 'web' ? 8 : 4; // Smaller buffer on mobile
    this.lastInterpretation = null;
    this.lastConfig = {};
    this.lastStyle = null;
    this.lastUpdateTime = 0;
    this.isTransitioning = false;
    this.transitionDuration = Platform.OS === 'web' ? 1500 : 800; // Faster on mobile
    
    // MOBILE-OPTIMIZED PROCESSING STATE MONITORING
    this.processingStateMonitor = {
      chunkCount: 0,
      averageProcessingTime: 0,
      recentProcessingTimes: [],
      maxProcessingTimes: Platform.OS === 'web' ? 10 : 5, // Smaller on mobile
      heavyProcessingThreshold: Platform.OS === 'web' ? 100 : 50, // Lower threshold on mobile
      isHeavyProcessing: false,
      mobileOptimized: Platform.OS !== 'web'
    };
    
    // CONNECTION MANAGEMENT with mobile awareness
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = Platform.OS === 'web' ? 1000 : 500; // Faster reconnection on mobile
    
    // Initialize orchestrator with mobile coordination
    this.initializeOrchestrator();
  }

  async initializeOrchestrator() {
    try {
      // Enable zero-latency mode for mobile
      if (Platform.OS !== 'web') {
        this.isZeroLatencyMode = true;
        console.log('🚀 Zero-latency mode enabled for mobile');
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // COORDINATE WITH MOBILE/WEB ORCHESTRATORS for zero-latency
  coordinateWithPlatformOrchestrators(mobileOrchestrator, webOrchestrator, sensorInterpreter, walletIntegration = null) {
    this.mobileOrchestrator = mobileOrchestrator;
    this.webOrchestrator = webOrchestrator;
    this.sensorInterpreter = sensorInterpreter;
    this.walletIntegration = walletIntegration;
    
    // Set up ZERO-LATENCY sensor coordination
    if (Platform.OS !== 'web' && this.mobileOrchestrator) {
      this.mobileOrchestrator.onSensorData((sensorData) => {
        this.handleZeroLatencySensorData(sensorData);
      });
      
      // Coordinate wallet integration for mobile
      if (walletIntegration && this.mobileOrchestrator.setWalletIntegration) {
        this.mobileOrchestrator.setWalletIntegration(walletIntegration, walletIntegration.account);
      }
    }
    
    if (Platform.OS === 'web' && this.webOrchestrator) {
      this.webOrchestrator.onSensorData((sensorData) => {
        this.handleZeroLatencySensorData(sensorData);
      });
    }
    
    console.log('🔗 Platform orchestrators coordinated for zero-latency feedback');
  }

  // HANDLE ZERO-LATENCY SENSOR DATA immediately
  handleZeroLatencySensorData(sensorData) {
    const now = Date.now();
    const latency = now - sensorData.timestamp;
    
    // Track sensor latency
    this.lastSensorTimestamp = sensorData.timestamp;
    
    // If latency is within threshold, process immediately
    if (latency <= this.sensorLatencyThreshold && this.sensorInterpreter) {
      const interpretation = this.sensorInterpreter.interpretSensorData(sensorData);
      
      // Add to immediate update queue for ZERO-LATENCY processing
      this.immediateUpdateQueue.push({
        interpretation,
        timestamp: now,
        sensorLatency: latency,
        isZeroLatency: true
      });
      
      // Process immediately if not already processing
      if (!this.isProcessingImmediate) {
        this.processImmediateUpdates();
      }
    } else {
      // Fall back to normal batching for high-latency sensors
      if (this.sensorInterpreter) {
        const interpretation = this.sensorInterpreter.interpretSensorData(sensorData);
        this.updateStream(interpretation);
      }
    }
  }

  // PROCESS IMMEDIATE UPDATES for zero-latency feedback
  async processImmediateUpdates() {
    if (this.isProcessingImmediate || this.immediateUpdateQueue.length === 0) {
      return;
    }
    
    this.isProcessingImmediate = true;
    
    try {
      // Process all queued immediate updates
      while (this.immediateUpdateQueue.length > 0) {
        const update = this.immediateUpdateQueue.shift();
        
        // Skip if interpretation is too similar to last (avoid spam)
        if (!this.isSignificantImmediateChange(update.interpretation)) {
          continue;
        }
        
        // Send IMMEDIATE updates to Lyria
        await this.sendImmediateUpdate(update.interpretation);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    } finally {
      this.isProcessingImmediate = false;
    }
  }

  // Check if immediate change is significant enough to send
  isSignificantImmediateChange(interpretation) {
    if (!this.lastInterpretation) return true;
    
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;
    
    // ZERO-LATENCY thresholds (more sensitive)
    const bpmThreshold = 2;
    const densityThreshold = 0.03;
    const brightnessThreshold = 0.03;
    const guidanceThreshold = 0.1;
    
    const bpmChanged = Math.abs((lastConfig.bpm || 0) - config.bpm) > bpmThreshold;
    const densityChanged = Math.abs((lastConfig.density || 0) - config.density) > densityThreshold;
    const brightnessChanged = Math.abs((lastConfig.brightness || 0) - config.brightness) > brightnessThreshold;
    const guidanceChanged = Math.abs((lastConfig.guidance || 0) - config.guidance) > guidanceThreshold;
    const styleChanged = interpretation.stylePrompt !== this.lastStyle;
    
    return bpmChanged || densityChanged || brightnessChanged || guidanceChanged || styleChanged;
  }

  // Send IMMEDIATE update to Lyria (bypassing batching)
  async sendImmediateUpdate(interpretation) {
    if (!this.session || !this.isConnected) {
      return false;
    }

    try {
      // Send style changes immediately
      if (this.hasStyleChanged(interpretation)) {
        await this.session.setWeightedPrompts({
          weightedPrompts: interpretation.weightedPrompts
        });
        this.lastStyle = interpretation.stylePrompt;
      }

      // Send config changes immediately
      if (this.hasConfigChanged(interpretation)) {
        await this.session.setMusicGenerationConfig({
          musicGenerationConfig: interpretation.lyriaConfig
        });
        this.lastConfig = { ...interpretation.lyriaConfig };
      }

      this.lastUpdateTime = Date.now();
      this.lastInterpretation = interpretation;
      
      return true;
    } catch (error) {
      console.error('Immediate update failed:', error);
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

  // Register callback for audio chunks with MOBILE-OPTIMIZED processing state tracking
  onAudioChunk(callback) {
    this.callbacks.onAudioChunk.push((data) => {
      // Track chunk processing periods for adaptive batching
      this.isProcessingChunk = true;
      this.processingStartTime = Date.now();
      
      // Adjust batch interval for mobile processing
      this.adaptiveBatchInterval = this.mobileChunkProcessing ? 
        this.minBatchInterval * 0.8 : this.minBatchInterval;
      
      try {
        callback(data);
        
        // Coordinate with mobile orchestrator for audio playback
        if (Platform.OS !== 'web' && this.mobileOrchestrator) {
          this.mobileOrchestrator.processRealAudioChunk(data).catch(console.warn);
        }
        
        // Coordinate with web orchestrator for audio playback
        if (Platform.OS === 'web' && this.webOrchestrator) {
          this.webOrchestrator.playAudioChunk(data).catch(console.warn);
        }
      } catch (error) {
        console.warn('Audio chunk callback error:', error);
      }
      
      // Reset processing state with mobile optimization
      setTimeout(() => {
        this.isProcessingChunk = false;
        this.adaptiveBatchInterval = this.maxBatchInterval;
      }, this.mobileChunkProcessing ? 100 : 200);
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

  // Connect to Lyria RealTime API with MOBILE-OPTIMIZED settings
  async connect() {
    if (this.isConnected || !this.apiKey) {
      return this.isConnected;
    }

    try {
      // Use mobile orchestrator's WebSocket if on mobile platform
      if (Platform.OS !== 'web' && this.mobileOrchestrator) {
        const mobileConnected = await this.mobileOrchestrator.initializeLyriaConnection(this.apiKey);
        if (mobileConnected) {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('onStateChange', { connected: true, streaming: false });
          
          // Start MOBILE-OPTIMIZED batched update processing
          this.startMobileOptimizedBatchProcessing();
          
          console.info('✅ Successfully connected to Lyria via mobile orchestrator');
          return true;
        }
      }

      // Fall back to web connection
      const genAI = new GoogleGenAI({
        apiKey: this.apiKey,
        apiVersion: 'v1alpha',
      });

      // Create Lyria RealTime session with MOBILE-OPTIMIZED callbacks
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

  handleMessage(message) {
    try {      
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
        // TRACK CHUNK PROCESSING STATE with mobile optimization
        this.updateChunkProcessingState(true);
        
        // Monitor processing performance with mobile awareness
        const processingStartTime = Date.now();
        
        // Emit audio chunk
        this.emit('onAudioChunk', audioData);
        
        // Track processing time with mobile optimization
        const processingTime = Date.now() - processingStartTime;
        this.updateProcessingMetrics(processingTime);
        
        // Update streaming state if not already set
        if (!this.isStreaming) {
          this.isStreaming = true;
          this.emit('onStateChange', { connected: true, streaming: true });
          console.info('🎵 Lyria streaming state updated to: true');
        }
        
        // Update chunk processing state with mobile-optimized delay
        setTimeout(() => {
          this.updateChunkProcessingState(false);
        }, this.mobileChunkProcessing ? 100 : 200);
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

  // INTELLIGENT PROCESSING STATE MANAGEMENT with mobile optimization
  updateChunkProcessingState(isProcessing) {
    if (isProcessing) {
      this.isProcessingChunk = true;
      this.chunkProcessingStartTime = Date.now();
      this.lastChunkTimestamp = Date.now();
      this.processingStateMonitor.chunkCount++;
      
      // Adjust batch interval for processing state with mobile optimization
      this.currentBatchInterval = this.mobileChunkProcessing ? 
        this.processingBatchInterval * 0.8 : this.processingBatchInterval;
      
      // Adjust batch interval back to idle with mobile optimization
      this.currentBatchInterval = this.mobileChunkProcessing ?
        this.idleBatchInterval * 0.8 : this.idleBatchInterval;      
    }
  }

  // PROCESSING PERFORMANCE MONITORING with mobile awareness
  updateProcessingMetrics(processingTime) {
    const metrics = this.processingStateMonitor;
    
    // Add to recent processing times
    metrics.recentProcessingTimes.push(processingTime);
    
    // Keep only recent measurements (fewer on mobile)
    if (metrics.recentProcessingTimes.length > metrics.maxProcessingTimes) {
      metrics.recentProcessingTimes.shift();
    }
    
    // Calculate average processing time
    metrics.averageProcessingTime = metrics.recentProcessingTimes.reduce((sum, time) => sum + time, 0) / metrics.recentProcessingTimes.length;
    
    // Detect heavy processing periods with mobile-aware threshold
    metrics.isHeavyProcessing = metrics.averageProcessingTime > metrics.heavyProcessingThreshold;
    
    // Adjust batch intervals based on processing load with mobile optimization
    if (metrics.isHeavyProcessing) {
      const multiplier = metrics.mobileOptimized ? 1.05 : 1.1;
      const maxInterval = metrics.mobileOptimized ? 120 : 150;
      this.processingBatchInterval = Math.min(this.processingBatchInterval * multiplier, maxInterval);
    } else {
      const multiplier = metrics.mobileOptimized ? 0.99 : 0.98;
      const minInterval = metrics.mobileOptimized ? 40 : 80;
      this.processingBatchInterval = Math.max(this.processingBatchInterval * multiplier, minInterval);
    }
  }

  // ENHANCED ADAPTIVE BATCH PROCESSING with MOBILE-OPTIMIZED load balancing
  startAdaptiveBatchProcessing() {
    const processUpdates = () => {
      if (this.updateQueue.length === 0) {
        // Schedule next check with current adaptive interval
        setTimeout(processUpdates, this.currentBatchInterval);
        return;
      }

      // MOBILE-OPTIMIZED FILTERING: During chunk processing, be more selective about updates
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

  // Start MOBILE-OPTIMIZED batch processing
  startMobileOptimizedBatchProcessing() {
    const processUpdates = () => {
      if (this.updateQueue.length === 0) {
        setTimeout(processUpdates, this.currentBatchInterval);
        return;
      }

      // MOBILE-OPTIMIZED filtering: Process only most significant changes
      let updateToProcess;
      
      if (this.isProcessingChunk || this.processingStateMonitor.isHeavyProcessing) {
        // During processing, only handle major changes
        const significantUpdates = this.updateQueue.filter(update => {
          return this.isSignificantChange(update.interpretation);
        });
        
        if (significantUpdates.length > 0) {
          updateToProcess = significantUpdates[significantUpdates.length - 1];
          this.updateQueue = this.updateQueue.filter(u => !significantUpdates.includes(u));          
        } else {
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

      // Schedule next processing cycle with MOBILE-OPTIMIZED interval
      setTimeout(processUpdates, this.currentBatchInterval);
    };

    processUpdates();
  }

  // ENHANCED SIGNIFICANCE DETECTION for processing state with mobile optimization
  isSignificantChange(interpretation) {
    if (!this.lastInterpretation) return true;
    
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;
    
    // MOBILE-OPTIMIZED THRESHOLDS: Lower thresholds for mobile responsiveness
    const bpmThreshold = this.mobileChunkProcessing ? 3 : (this.isProcessingChunk ? 8 : 4);
    const densityThreshold = this.mobileChunkProcessing ? 0.08 : (this.isProcessingChunk ? 0.2 : 0.1);
    const brightnessThreshold = this.mobileChunkProcessing ? 0.08 : (this.isProcessingChunk ? 0.2 : 0.1);
    const guidanceThreshold = this.mobileChunkProcessing ? 0.12 : (this.isProcessingChunk ? 0.3 : 0.15);
    
    // Only consider MAJOR changes during chunk processing
    const majorBpmChange = Math.abs((lastConfig.bpm || 0) - config.bpm) > bpmThreshold;
    const majorDensityChange = Math.abs((lastConfig.density || 0) - config.density) > densityThreshold;
    const majorBrightnessChange = Math.abs((lastConfig.brightness || 0) - config.brightness) > brightnessThreshold;
    const majorGuidanceChange = Math.abs((lastConfig.guidance || 0) - config.guidance) > guidanceThreshold;
    const majorStyleChange = interpretation.stylePrompt !== this.lastStyle;
    
    return majorBpmChange || majorDensityChange || majorBrightnessChange || majorGuidanceChange || majorStyleChange;
  }

  // ENHANCED SMOOTHING with mobile optimization and processing state awareness
  async processSmoothedUpdate(interpretation) {
    try {
      const now = Date.now();
      const timeSinceLastUpdate = now - this.lastUpdateTime;
      
      // Add to smoothing buffer
      this.smoothingBuffer.push({
        interpretation,
        timestamp: now,
        isProcessing: this.isProcessingChunk,
        isMobile: this.mobileChunkProcessing
      });
      
      // Keep only recent entries in smoothing buffer with mobile optimization
      const bufferDuration = this.mobileChunkProcessing ? 1500 : 2000; // Shorter on mobile
      this.smoothingBuffer = this.smoothingBuffer.filter(entry => 
        now - entry.timestamp < bufferDuration
      );
      
      // Limit buffer size
      if (this.smoothingBuffer.length > this.maxSmoothingBuffer) {
        this.smoothingBuffer = this.smoothingBuffer.slice(-this.maxSmoothingBuffer);
      }
      
      // Apply smoothing if we have enough data points (fewer required on mobile)
      const minDataPoints = this.mobileChunkProcessing ? 1 : 2;
      let smoothedInterpretation = interpretation;
      if (this.smoothingBuffer.length > minDataPoints) {
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

  // ENHANCED SMOOTHING with mobile optimization and processing state awareness
  applySmoothingToInterpretation(currentInterpretation) {
    if (this.smoothingBuffer.length < 2) return currentInterpretation;
    
    const recentInterpretations = this.smoothingBuffer.map(entry => entry.interpretation);
    
    // MOBILE-OPTIMIZED SMOOTHING FACTOR based on processing state
    let smoothingFactor = this.mobileChunkProcessing ? 0.4 : 0.3; // Less smoothing on mobile for responsiveness
    
    if (this.isProcessingChunk) {
      smoothingFactor = this.mobileChunkProcessing ? 0.25 : 0.2; // More smoothing during chunk processing
    } else if (this.processingStateMonitor.isHeavyProcessing) {
      smoothingFactor = this.mobileChunkProcessing ? 0.3 : 0.25; // Medium smoothing during heavy processing
    }
    
    // Smooth numerical config values
    const smoothedConfig = { ...currentInterpretation.lyriaConfig };
    
    // Smooth BPM with mobile optimization
    const avgBpm = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.bpm, 0) / recentInterpretations.length;
    smoothedConfig.bpm = Math.round(smoothedConfig.bpm * smoothingFactor + avgBpm * (1 - smoothingFactor));
    
    // Smooth density with mobile optimization
    const avgDensity = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.density, 0) / recentInterpretations.length;
    smoothedConfig.density = parseFloat((smoothedConfig.density * smoothingFactor + avgDensity * (1 - smoothingFactor)).toFixed(3));
    
    // Smooth brightness with mobile optimization
    const avgBrightness = recentInterpretations.reduce((sum, interp) => sum + interp.lyriaConfig.brightness, 0) / recentInterpretations.length;
    smoothedConfig.brightness = parseFloat((smoothedConfig.brightness * smoothingFactor + avgBrightness * (1 - smoothingFactor)).toFixed(3));
    
    // Smooth guidance with mobile optimization
    const avgGuidance = recentInterpretations.reduce((sum, interp) => sum + (interp.lyriaConfig.guidance || 0), 0) / recentInterpretations.length;
    smoothedConfig.guidance = parseFloat((smoothedConfig.guidance * smoothingFactor + avgGuidance * (1 - smoothingFactor)).toFixed(3));
    
    return {
      ...currentInterpretation,
      lyriaConfig: smoothedConfig
    };
  }

  // Check if style changed
  hasStyleChanged(interpretation) {
    return interpretation.stylePrompt !== this.lastStyle;
  }

  // ENHANCED CHANGE DETECTION with mobile optimization and processing state awareness
  hasConfigChanged(interpretation) {
    const config = interpretation.lyriaConfig;
    const lastConfig = this.lastConfig;

    // MOBILE-OPTIMIZED THRESHOLDS: Lower thresholds for mobile responsiveness
    const bpmThreshold = this.mobileChunkProcessing ? 2 : (this.isProcessingChunk ? 4 : 2);
    const densityThreshold = this.mobileChunkProcessing ? 0.03 : (this.isProcessingChunk ? 0.1 : 0.05);
    const brightnessThreshold = this.mobileChunkProcessing ? 0.03 : (this.isProcessingChunk ? 0.1 : 0.05);
    const guidanceThreshold = this.mobileChunkProcessing ? 0.1 : (this.isProcessingChunk ? 0.25 : 0.15);
    const temperatureThreshold = this.mobileChunkProcessing ? 0.08 : (this.isProcessingChunk ? 0.2 : 0.1);

    const bpmChanged = Math.abs((lastConfig.bpm || 0) - config.bpm) > bpmThreshold;
    const densityChanged = Math.abs((lastConfig.density || 0) - config.density) > densityThreshold;
    const brightnessChanged = Math.abs((lastConfig.brightness || 0) - config.brightness) > brightnessThreshold;
    const guidanceChanged = Math.abs((lastConfig.guidance || 0) - config.guidance) > guidanceThreshold;
    const temperatureChanged = Math.abs((lastConfig.temperature || 0) - (config.temperature || 0)) > temperatureThreshold;

    return bpmChanged || densityChanged || brightnessChanged || guidanceChanged || temperatureChanged;
  }

  // Update prompts with mobile-optimized smoothing
  async updatePromptsSmoothed(interpretation) {
    if (!this.session || !this.isConnected) return false;

    try {
      // Use mobile orchestrator if available and on mobile
      if (Platform.OS !== 'web' && this.mobileOrchestrator && this.mobileOrchestrator.isLyriaConnected) {
        this.mobileOrchestrator.sendWeightedPrompts(interpretation.weightedPrompts);
        this.lastStyle = interpretation.stylePrompt;
        return true;
      }

      // Fall back to web session
      await this.session.setWeightedPrompts({
        weightedPrompts: interpretation.weightedPrompts
      });

      this.lastStyle = interpretation.stylePrompt;
      return true;
    } catch (error) {
      console.error('Failed to update prompts:', error);
      return false;
    }
  }

  // Update configuration with mobile-optimized smoothing
  async updateConfigurationSmoothed(interpretation) {
    if (!this.session || !this.isConnected) return false;

    try {
      // Use mobile orchestrator if available and on mobile
      if (Platform.OS !== 'web' && this.mobileOrchestrator && this.mobileOrchestrator.isLyriaConnected) {
        this.mobileOrchestrator.sendMusicGenerationConfig(interpretation.lyriaConfig);
        this.lastConfig = { ...interpretation.lyriaConfig };
        return true;
      }

      // Fall back to web session
      await this.session.setMusicGenerationConfig({
        musicGenerationConfig: interpretation.lyriaConfig
      });

      this.lastConfig = { ...interpretation.lyriaConfig };
      return true;
    } catch (error) {
      console.error('Failed to update configuration:', error);
      return false;
    }
  }

  // MOBILE-OPTIMIZED TRANSITION HANDLING with processing state awareness
  handleSmoothStyleTransition(interpretation) {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    
    // MOBILE-OPTIMIZED TRANSITION TIMING based on processing state
    let transitionTime = this.transitionDuration;
    
    if (this.isProcessingChunk) {
      transitionTime = this.mobileChunkProcessing ? 
        this.transitionDuration * 1.2 : this.transitionDuration * 1.5; // Faster on mobile
    } else if (this.processingStateMonitor.isHeavyProcessing) {
      transitionTime = this.mobileChunkProcessing ?
        this.transitionDuration * 1.1 : this.transitionDuration * 1.2; // Slightly faster on mobile
    }
    
    setTimeout(() => {
      this.isTransitioning = false;
    }, transitionTime);
    
    console.log(`🌊 Style transition started (${transitionTime}ms duration, mobile: ${this.mobileChunkProcessing})`);
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
      const delay = this.mobileChunkProcessing ? 1000 : 2000; // Faster retry on mobile
      setTimeout(() => this.attemptReconnection(), delay);
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

  // Start music generation with initial parameters using mobile coordination
  async startStream(interpretation) {
    // Use mobile orchestrator if available and on mobile
    if (Platform.OS !== 'web' && this.mobileOrchestrator && this.mobileOrchestrator.isLyriaConnected) {
      try {
        console.info('Starting Lyria RealTime stream via mobile orchestrator');
        
        // Set initial weighted prompts
        this.mobileOrchestrator.sendWeightedPrompts(interpretation.weightedPrompts);

        // Set initial configuration
        this.mobileOrchestrator.sendMusicGenerationConfig(interpretation.lyriaConfig);

        // Start music generation
        this.mobileOrchestrator.sendPlayCommand();
        
        // Set streaming state immediately when play() succeeds
        this.isStreaming = true;
        this.emit('onStateChange', { connected: this.isConnected, streaming: true });
        
        // Store last values for change detection
        this.lastStyle = interpretation.stylePrompt;
        this.lastConfig = { ...interpretation.lyriaConfig };
        this.lastUpdateTime = Date.now();      
        return true;
      } catch (error) {
        console.error('Failed to start mobile Lyria stream:', error);
        this.emit('onError', error);
        return false;
      }
    }

    // Fall back to web session
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

  // Update Lyria with MOBILE-OPTIMIZED INTELLIGENT batching that adapts to processing state
  async updateStream(interpretation) {
    // Use mobile orchestrator for immediate updates if available
    if (Platform.OS !== 'web' && this.mobileOrchestrator && this.mobileOrchestrator.isLyriaConnected) {
      // For mobile, use immediate updates for better responsiveness
      try {
        if (this.hasStyleChanged(interpretation)) {
          this.mobileOrchestrator.sendWeightedPrompts(interpretation.weightedPrompts);
          this.lastStyle = interpretation.stylePrompt;
        }

        if (this.hasConfigChanged(interpretation)) {
          this.mobileOrchestrator.sendMusicGenerationConfig(interpretation.lyriaConfig);
          this.lastConfig = { ...interpretation.lyriaConfig };
        }

        this.lastUpdateTime = Date.now();
        this.lastInterpretation = interpretation;
        return true;
      } catch (error) {
        console.error('Mobile immediate update failed:', error);
      }
    }

    // Fall back to batched updates for web
    if (!this.session || !this.isConnected) {
      return false;
    }

    // Add timestamp and processing state info to update
    this.updateQueue.push({
      interpretation,
      timestamp: Date.now(),
      isProcessingChunk: this.isProcessingChunk,
      isMobile: this.mobileChunkProcessing
    });

    // Limit queue size to prevent memory buildup (smaller on mobile)
    const maxQueueSize = this.mobileChunkProcessing ? 5 : 10;
    if (this.updateQueue.length > maxQueueSize) {
      this.updateQueue = this.updateQueue.slice(-Math.floor(maxQueueSize / 2)); // Keep only latest half
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

  // Attempt reconnection with mobile-optimized exponential backoff
  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const baseDelay = this.mobileChunkProcessing ? 500 : 1000; // Faster on mobile
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms (mobile: ${this.mobileChunkProcessing})`);
    
    setTimeout(async () => {
      const success = await this.connect();
      if (success && this.isStreaming) {
        // Resume streaming if it was active
        console.log('Reconnected successfully, resuming stream');
      }
    }, delay);
  }

  // Stop music generation with mobile coordination
  async stop() {
    // Use mobile orchestrator if available and on mobile
    if (Platform.OS !== 'web' && this.mobileOrchestrator && this.mobileOrchestrator.isLyriaConnected) {
      try {
        this.mobileOrchestrator.sendPauseCommand();
        this.isStreaming = false;
        this.emit('onStateChange', { connected: this.isConnected, streaming: false });
        console.log('Lyria stream stopped via mobile orchestrator');
        return true;
      } catch (error) {
        console.error('Failed to stop mobile stream:', error);
      }
    }

    // Fall back to web session
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

  // Disconnect and cleanup with mobile coordination
  async disconnect() {    
    // Stop batch processing
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Stop streaming
    await this.stop();

    // Cleanup mobile orchestrator connection
    if (Platform.OS !== 'web' && this.mobileOrchestrator) {
      this.mobileOrchestrator.cleanup();
    }

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
    this.immediateUpdateQueue = [];
    this.reconnectAttempts = 0;
    this.isProcessingImmediate = false;
    
    this.emit('onStateChange', { connected: false, streaming: false });
    console.log('Disconnected from Lyria');
  }

  // Get current connection status with mobile info
  getStatus() {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.updateQueue.length,
      immediateQueueLength: this.immediateUpdateQueue.length,
      isZeroLatencyMode: this.isZeroLatencyMode,
      isMobile: this.mobileChunkProcessing,
      sensorLatency: this.lastSensorTimestamp ? Date.now() - this.lastSensorTimestamp : 0
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
    this.mobileOrchestrator = null;
    this.webOrchestrator = null;
    this.sensorInterpreter = null;
  }
}

  // Export singleton instance
  export const lyriaOrchestrator = new LyriaOrchestrator(); 