/**
 * ORCHESTRATION COORDINATOR - Unified Lyria Integration with Alith AI
 * 
 * Consolidated orchestration system that combines:
 * - Direct Lyria RealTime API connection with zero-latency processing
 * - Server communication for enhanced sensor interpretation
 * - Intelligent audio buffering with Gemini predictions
 * - Platform-specific sensor management
 * - Vibestream coordination and audio chunk handling
 * 
 * This consolidates the previous integration.js and coordinator.js files
 * to eliminate duplicate code and fix server communication issues.
 */

// Ensure polyfills are loaded first - only in React Native environment
if (typeof global !== 'undefined' && global.navigator) {
  import('../configs/polyfills');
}

// Consolidated imports from both files
import { Platform } from 'react-native';
import { GoogleGenAI } from '@google/genai/web';
import { webOrchestrator } from './web';
import { createBufferManager as createGeminiBufferManager } from './buffering';
import { logServerCommunication, logInterpretation, logPerformance, logInfo, logWarning, logError } from './logger';

// Platform-specific orchestrator imports
let mobileOrchestrator = null;

if (Platform.OS !== 'web') {
  try {
    const { mobileOrchestrator: mobile } = require('./mobile');
    mobileOrchestrator = mobile;
  } catch (error) {
    console.warn('Mobile orchestrator not available:', error);
  }
}

// Use polyfilled EventEmitter
const EventEmitter = global.EventEmitter || class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
  removeListener(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
};

/**
 * UNIFIED ORCHESTRATION COORDINATOR
 * Combines functionality from OrchestrationIntegration and OrchestrationCoordinator classes
 */
export class OrchestrationCoordinator extends EventEmitter {
  constructor() {
    super();
    
    // Core state management
    this.isInitialized = false;
    this.walletIntegration = null;
    this.coordinationEnabled = false;
    this.platform = Platform.OS;
    
    // Platform orchestrators
    this.orchestrators = {
      mobile: mobileOrchestrator,
      web: webOrchestrator
    };
    this.activeOrchestrator = null;
    
    // Direct Lyria Connection (unified from both classes)
    this.lyriaSession = null;
    this.lyriaApiKey = process.env.EXPO_PUBLIC_LYRIA_API_KEY;
    this.isLyriaConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.autoReconnect = true;
    this.connectionState = 'disconnected';
    this.currentPlaylist = null;
    
    // Server Communication for Enhanced Sensor Interpretation
    this.serverConnection = null;
    this.isServerConnected = false;
    this.sensorQueue = [];
    this.isProcessingSensors = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.currentBaseline = null; // Track current baseline for crossfading
    
    // Smooth rate limiting - optimized for seamless transitions
    this.lastServerSendTime = 0;
    this.serverLatency = 250; // Increased to 250ms for stability
    this.minSendInterval = 200; // Increased to 200ms for smoother server processing
    this.maxSendInterval = 400; // Maximum 400ms if server is slow
    this.pendingResponse = false;
    this.sensorDataBuffer = null; // Buffer latest sensor data
    this.sensorSmoothingQueue = []; // Queue for sensor smoothing
    this.maxSmoothingQueue = 8; // Increased to 8 for better smoothing
    this.transitionBuffering = new Map(); // NEW: Buffer for ultra-smooth transitions
    
    // Client-side Gemini Buffer Manager
    this.geminiBufferManager = null;
    this.geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    // Vibestream tracking and audio chunk handling
    this.currentRtaId = null;
    this.audioChunkService = null;
    this.vibestreamActive = false;
    
    // Zero-latency coordination and performance tracking
    this.isZeroLatencyMode = true;
    this.lastSensorTimestamp = 0;
    this.sensorLatencyThreshold = 10; // 10ms maximum latency
    this.immediateUpdateQueue = [];
    this.isProcessingImmediate = false;
    this.lastSensorUpdate = 0;
    
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
    this.lastStyle = '';
    this.lastUpdateTime = 0;
    
    // Callback management
    this.callbacks = {
      onAudioChunk: [],
      onError: [],
      onStateChange: []
    };
    this.sensorCallbacks = [];
    this.cleanupFunctions = [];
    
    console.log('🎛️ Unified Orchestration Coordinator initialized for platform:', this.platform);
    this.initializeCoordination();
  }

  // ============================================================================
  // INITIALIZATION AND COORDINATION
  // ============================================================================

  async initializeCoordination() {
    try {
      console.log('🎛️ Initializing unified orchestration coordination');
      
      // Initialize platform orchestrator first
      await this.initializePlatformOrchestrator();
      
      this.isInitialized = true;
      console.log('✅ Unified orchestration coordination initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Orchestration coordination failed:', error);
      this.isInitialized = true; // Still mark as initialized to allow basic functionality
      return false;
    }
  }

  async initializePlatformOrchestrator() {
    try {
      if (this.platform === 'web' && webOrchestrator) {
        this.activeOrchestrator = webOrchestrator;
        console.log('✅ Web orchestrator initialized');
      } else if (this.platform !== 'web' && mobileOrchestrator) {
        this.activeOrchestrator = mobileOrchestrator;
        console.log('✅ Mobile orchestrator initialized');
    } else {
        console.warn(`No orchestrator available for platform: ${this.platform}`);
      }
    } catch (error) {
      console.error('Platform orchestrator initialization failed:', error);
    }
  }

  // Initialize integration with wallet system and establish all connections
  async initializeWithWallet(walletIntegration) {
    try {
      console.log('🔗 Initializing unified orchestration with wallet integration...');
      
      this.walletIntegration = walletIntegration;
      
      // Initialize Lyria
      if (this.lyriaApiKey) {
        console.log('🎵 PRIORITY: Starting Lyria connection immediately...');
        await this.initializeLyriaConnection();
      }
      
      // Start background processes in parallel
      this.initializeBackgroundSystems();
      
      this.coordinationEnabled = true;
      
      console.log('✅ Unified orchestration architecture initialized (Lyria ready, background systems starting)');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize unified orchestration architecture:', error);
      return false;
    }
  }

  // Initialize background systems in parallel
  async initializeBackgroundSystems() {
    // Run these in parallel without blocking Lyria startup
    Promise.all([
      // Initialize Gemini buffer manager
      this.geminiApiKey ? this.initializeGeminiBuffering().catch(err => 
        console.warn('⚠️ Gemini buffering failed:', err.message)
      ) : Promise.resolve(),
      
      // Establish WebSocket connection to server
      this.connectToInterpretationServer().catch(err => 
        console.warn('⚠️ Server connection failed:', err.message)
      )
    ]).then(() => {
      console.log('✅ Background systems initialized');
    }).catch(error => {
      console.warn('⚠️ Some background systems failed:', error.message);
    });
  }

  // Start vibestream session when user creates new vibestream
  async startVibestreamSession(rtaId, audioChunkService) {
    try {
      console.log('🎯 Starting new vibestream session:', rtaId);
      
      // Set vibestream active to enable sensor data flow
      this.vibestreamActive = true;
      this.currentRtaId = rtaId;
      this.audioChunkService = audioChunkService;
      
      console.log('🔧 Vibestream active status set to:', this.vibestreamActive, 'RTA:', rtaId);
      
      // Start sensor collection
      if (Platform.OS === 'web' && this.orchestrators.web) {
        console.log('📡 Starting sensor collection...');
        // Don't await - run in parallel
        this.orchestrators.web.startSensorCollection(rtaId).catch(error => {
          console.warn('⚠️ Web sensor collection failed:', error.message);
        });
      } else if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        console.log('📱 Starting mobile sensor collection...');
        // Don't await - run in parallel
        this.orchestrators.mobile.startSensorCollection(rtaId).catch(error => {
          console.warn('⚠️ Mobile sensor collection failed:', error.message);
        });
      }
      
      // Send session-start message to server
      this.sendSessionStartToServer(rtaId);
      
      console.log('✅ Vibestream session started immediately (sensors starting in parallel)');
      this.emit('vibestreamStarted', rtaId);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start vibestream session:', error);
      return false;
    }
  }

  // ============================================================================
  // LYRIA CONNECTION MANAGEMENT
  // ============================================================================

  // Initialize direct Lyria connection on client
  async initializeLyriaConnection() {
    try {
      console.log('🎵 Initializing direct Lyria RealTime connection...');
      
      if (!this.lyriaApiKey) {
        throw new Error('Lyria API key not available');
      }
      
      const genAI = new GoogleGenAI({
        apiKey: this.lyriaApiKey,
        apiVersion: 'v1alpha',
      });

      console.log('📡 Creating Lyria session...');
      this.lyriaSession = await genAI.live.music.connect({
        model: 'models/lyria-realtime-exp',
        callbacks: {
          onmessage: (message) => this.handleLyriaMessage(message),
          onerror: (error) => this.handleLyriaError(error),
          onclose: () => this.handleLyriaClose()
        }
      });

      this.isLyriaConnected = true;
      this.connectionState = 'connected';
      console.log('✅ Direct Lyria connection established successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Lyria:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      this.connectionState = 'failed';
      return false;
    }
  }

  // ============================================================================
  // GEMINI BUFFER MANAGEMENT
  // ============================================================================

  // Initialize Gemini-based client-side buffering
  async initializeGeminiBuffering() {
    try {
      console.log('🧠 Initializing Gemini predictive buffering...');
      
      if (!this.geminiApiKey) {
        console.warn('⚠️ No Gemini API key - buffering will use basic fallback');
        return false;
      }
      
      this.geminiBufferManager = createGeminiBufferManager(this.geminiApiKey);
      const initialized = await this.geminiBufferManager.initialize();
      
      if (initialized) {
        console.log('✅ Gemini buffering system initialized and running continuously');
        return true;
      } else {
        console.warn('⚠️ Gemini buffering initialization failed - using basic buffering');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Gemini buffering - using basic buffering:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SERVER COMMUNICATION (FIXED TO USE CORRECT MESSAGE FORMAT)
  // ============================================================================

  // Connect to server for enhanced sensor interpretation
  async connectToInterpretationServer() {
    try {
      const serverUrl = process.env.EXPO_PUBLIC_ORCHESTRATOR_URL?.replace('https://', 'wss://') || 'wss://alith.vibesflow.ai/orchestrator';
      const wsUrl = `${serverUrl}`;
      
      logServerCommunication({ action: 'connecting-to-server', url: wsUrl });
      
      this.serverConnection = new WebSocket(wsUrl);
      
      this.serverConnection.onopen = () => {
        this.isServerConnected = true;
        this.reconnectAttempts = 0;
        logServerCommunication({ action: 'connected-to-server', status: 'enhanced-ai-processing-enabled' });
        this.processQueuedSensorData();
      };
      
      this.serverConnection.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          this.handleServerInterpretation(response);
    } catch (error) {
          logWarning('Failed to parse server response', { error: error.message });
        }
      };
      
      this.serverConnection.onclose = () => {
        this.isServerConnected = false;
        logServerCommunication({ action: 'server-connection-closed' });
        this.handleServerReconnect();
      };
      
      this.serverConnection.onerror = (error) => {
        logWarning('Server unavailable - continuing with client-side processing', { error: error.type || 'connection_error' });
        this.isServerConnected = false;
      };
      
      return true;
    } catch (error) {
      logError('Failed to connect to interpretation server', { error: error.message, stack: error.stack });
      return false;
    }
  }

  // Process queued sensor data when server becomes available
  processQueuedSensorData() {
    if (this.sensorQueue.length > 0) {
      logServerCommunication({
        action: 'processing-queued-sensor-messages',
        queueLength: this.sensorQueue.length
      });
      const queue = [...this.sensorQueue];
      this.sensorQueue = [];
      
      queue.forEach(queuedData => {
        this.sendSensorDataToServer(queuedData.data);
      });
    }
  }



  // Send sensor data to server for interpretation with ULTRA-RESPONSIVE RATE LIMITING
  sendSensorDataToServer(sensorData) {
    // Only send sensor data when vibestream is active
    if (!this.vibestreamActive) {
      console.log('⏸️ Sensor data ignored - vibestream not active:', {
        vibestreamActive: this.vibestreamActive,
        serverConnected: this.isServerConnected,
        currentRtaId: this.currentRtaId
      });
      return; // Ignore sensor data when no vibestream is running
    }
    
    // DEBUGGING: Log when sensor data is actually sent
    console.log('📡 SENDING SENSOR DATA TO SERVER:', {
      vibestreamActive: this.vibestreamActive,
      serverConnected: this.isServerConnected,
      magnitude: Math.sqrt(sensorData.x**2 + sensorData.y**2 + sensorData.z**2).toFixed(3),
      source: sensorData.source
    });

    // Ultra-responsive rate limiting - optimized for sensory feedback
    const now = Date.now();
    const timeSinceLastSend = now - this.lastServerSendTime;
    
    // Add to sensor smoothing queue for natural transitions
    this.sensorSmoothingQueue.push({
      ...sensorData,
      timestamp: now
    });
    
    // Keep smoothing queue manageable
    if (this.sensorSmoothingQueue.length > this.maxSmoothingQueue) {
      this.sensorSmoothingQueue.shift();
    }
    
    // Calculate smoothed sensor data for ultra-responsive yet smooth transitions
    // Use sensor data directly - web.js already handles smoothing
    const smoothedSensorData = sensorData;
    
    // Smooth adaptive interval (increased to 1.2x for stability)
    const adaptiveInterval = Math.max(this.minSendInterval, Math.min(this.serverLatency * 1.2, this.maxSendInterval));
    
    // Buffer the latest smoothed sensor data
    this.sensorDataBuffer = smoothedSensorData;
    
    // More permissive sending conditions for ultra-responsiveness
    if (timeSinceLastSend < adaptiveInterval && this.pendingResponse) {
      // Only skip if BOTH conditions are restrictive
      logPerformance({
        action: 'ultra-responsive-rate-limiting',
        timeSinceLastSend: Math.round(timeSinceLastSend),
        adaptiveInterval: Math.round(adaptiveInterval),
        serverLatency: Math.round(this.serverLatency),
        pendingResponse: this.pendingResponse,
        smoothingQueueSize: this.sensorSmoothingQueue.length
      });
      return;
    }

    if (!this.isServerConnected || !this.serverConnection) {
      // Queue sensor data if server is not connected
      this.sensorQueue.push({
        data: sensorData,
        timestamp: Date.now()
      });
            
      // Keep queue size manageable
      if (this.sensorQueue.length > 100) {
        this.sensorQueue.shift();
      }
      return;
    }

    try {
      // Log detailed sensor data being sent using throttled logger
      logServerCommunication({
        action: 'sending-sensor-data',
        x: sensorData.x?.toFixed(3),
        y: sensorData.y?.toFixed(3),
        z: sensorData.z?.toFixed(3),
        source: sensorData.source,
        pressure: sensorData.pressure,
        tiltX: sensorData.tiltX,
        velocity: sensorData.velocity,
        acceleration: sensorData.acceleration,
        serverConnected: this.isServerConnected,
        vibestreamActive: this.vibestreamActive
      });

      // Use correct message format that backend expects
      const message = {
        type: 'sensor-data',
        sensorData: sensorData,
        timestamp: Date.now(),
        sessionId: this.walletIntegration?.account?.accountId || 'anonymous'
      };

      // Track send time and mark response as pending for adaptive rate limiting
      this.lastServerSendTime = now;
      this.pendingResponse = true;
      this.serverRequestStart = now; // For latency calculation

      this.serverConnection.send(JSON.stringify(message));
      
      logServerCommunication({
        action: 'sent-sensor-data',
        interval: Math.round(adaptiveInterval),
        latency: Math.round(this.serverLatency)
      });
    } catch (error) {
      logWarning('Failed to send sensor data to server', { error: error.message });
        }
  }

  // Calculate smoothed sensor data for natural, ultra-responsive transitions
  calculateSmoothedSensorData(currentSensorData) {
    if (this.sensorSmoothingQueue.length === 0) {
      return currentSensorData;
    }

    // Calculate weighted average with emphasis on recent data
    let totalWeight = 0;
    let smoothedX = 0, smoothedY = 0, smoothedZ = 0;
    
    this.sensorSmoothingQueue.forEach((sensor, index) => {
      // Exponential weighting - recent data has more influence
      const weight = Math.pow(1.5, index); // Recent data weighted more heavily
      totalWeight += weight;
      
      smoothedX += sensor.x * weight;
      smoothedY += sensor.y * weight;
      smoothedZ += sensor.z * weight;
    });
    
    // Apply smoothing with natural motion characteristics
    const smoothed = {
      ...currentSensorData,
      x: smoothedX / totalWeight,
      y: smoothedY / totalWeight,
      z: smoothedZ / totalWeight,
      // Add velocity calculation for enhanced responsiveness
      velocity: this.calculateSensorVelocity(),
      // Add micro-movement detection
      microMovement: this.detectMicroMovements(currentSensorData)
    };
    
    return smoothed;
  }

  // Calculate sensor velocity for enhanced music responsiveness
  calculateSensorVelocity() {
    if (this.sensorSmoothingQueue.length < 2) return 0;
    
    const recent = this.sensorSmoothingQueue.slice(-2);
    const deltaTime = (recent[1].timestamp - recent[0].timestamp) / 1000; // Convert to seconds
    
    if (deltaTime === 0) return 0;
    
    const deltaX = recent[1].x - recent[0].x;
    const deltaY = recent[1].y - recent[0].y;
    const deltaZ = recent[1].z - recent[0].z;
    
    const velocity = Math.sqrt(deltaX**2 + deltaY**2 + deltaZ**2) / deltaTime;
    return Math.min(velocity, 10); // Cap velocity for reasonable values
  }

  // Detect micro-movements for ultra-sensitive music response
  detectMicroMovements(currentSensorData) {
    if (this.sensorSmoothingQueue.length === 0) return 0;
    
    const lastSensor = this.sensorSmoothingQueue[this.sensorSmoothingQueue.length - 1];
    const microDeltaX = Math.abs(currentSensorData.x - lastSensor.x);
    const microDeltaY = Math.abs(currentSensorData.y - lastSensor.y);
    const microDeltaZ = Math.abs(currentSensorData.z - lastSensor.z);
    
    // Sum of micro-movements normalized
    return (microDeltaX + microDeltaY + microDeltaZ) / 3;
  }

  // Handle interpretation response from server
  handleServerInterpretation(response) {
    // Adaptive Rate Limit - calculate server latency and prompts queue
    if (this.pendingResponse && this.serverRequestStart) {
      const responseTime = Date.now() - this.serverRequestStart;
      // Exponential moving average for smoother latency tracking
      this.serverLatency = this.serverLatency * 0.7 + responseTime * 0.3;
      this.pendingResponse = false;
      
      logPerformance({
        action: 'server-latency-update',
        responseTime: Math.round(responseTime),
        avgLatency: Math.round(this.serverLatency),
        nextInterval: Math.round(Math.max(this.minSendInterval, Math.min(this.serverLatency * 1.2, this.maxSendInterval)))
      });
    }
    
    if (!response || response.type !== 'interpretation') {
      logWarning('Received non-interpretation message from server', { type: response?.type || 'undefined' });
      return;
    }

    try {
      const { data: interpretation } = response;
      
      logInterpretation({
        action: 'received-interpretation',
        singleCoherentPrompt: interpretation.singleCoherentPrompt?.substring(0, 50) + '...',
        prompts: interpretation.weightedPrompts?.length, // Legacy support
        bpm: interpretation.lyriaConfig?.bpm,
        density: interpretation.lyriaConfig?.density,
        reasoning: interpretation.reasoning?.substring(0, 100) + '...',
        fallback: interpretation.fallback,
        source: response.source,
        hasMemory: response.hasMemory,
        hasKnowledge: response.hasKnowledge,
        usedPoetry: response.usedPoetry,
        usedSensorExpertise: response.usedSensorExpertise,
        // NEW: Baseline-driven metadata
        baselineDriven: response.baselineDriven,
        requiresCrossfade: interpretation.requiresCrossfade,
        baselineEstablished: response.sessionInfo?.baselineEstablished
      });

      // Check if this is a fallback response (indicates Alith agent failed)
      if (interpretation.fallback) {
        logWarning('Received fallback interpretation - Alith agent may have failed', { error: response.error });
      } else {
        logInterpretation({
          action: 'full-alith-interpretation',
          memory: response.hasMemory,
          knowledge: response.hasKnowledge,
          poetry: response.usedPoetry,
          sensorExpertise: response.usedSensorExpertise
        });
      }
      
      // Apply orchestrator server prompts to Lyria
      console.log('🎯 Applying server prompts to Lyria:', {
        prompt: interpretation.singleCoherentPrompt?.substring(0, 60) + '...',
        bpm: interpretation.lyriaConfig?.bpm,
        requiresCrossfade: interpretation.requiresCrossfade
      });
      this.applyInterpretationToLyria(interpretation, response.sessionInfo);
      
      // Send to buffering.js for predictive processing
      if (this.geminiBufferManager) {
        console.log('🧠 Predictive buffering pre-processing the chunk');
        // Process to prepare for incoming audio
        this.geminiBufferManager.processInterpretation(interpretation);
      } else {
        console.warn('⚠️ No buffer manager available - audio will have clicks/gaps');
      }
      
      // Emit for UI updates
      this.emit('interpretation', interpretation);
      
    } catch (error) {
      logError('Failed to handle server interpretation', { error: error.message, stack: error.stack });
    }
  }

  // Apply server interpretation to Lyria session with enhanced transitions
  async applyInterpretationToLyria(interpretation, sessionInfo) {
    if (!this.isLyriaConnected || !this.lyriaSession) {
      logWarning('Cannot apply interpretation - Lyria not connected', { isConnected: this.isLyriaConnected });
      return;
  }

  try {
      logInterpretation({
      action: 'applying-to-lyria-enhanced',
      singleCoherentPrompt: interpretation.singleCoherentPrompt?.substring(0, 50) + '...',
      promptCount: interpretation.weightedPrompts?.length, // Legacy support
      hasBpmConfig: !!interpretation.lyriaConfig?.bpm,
      hasDensityConfig: !!interpretation.lyriaConfig?.density,
      requiresCrossfade: interpretation.requiresCrossfade,
      baselineEstablished: sessionInfo?.baselineEstablished
    });
    
      // Enhanced transition handling based on baseline decisions
      if (interpretation.singleCoherentPrompt) {
        if (interpretation.requiresCrossfade && this.currentBaseline) {
          // Implement Lyria's recommended crossfading for smooth transitions
          await this.applyCrossfadeTransition(interpretation.singleCoherentPrompt);
        } else {
          // Direct application for layer additions or baseline establishment
          await this.lyriaSession.setWeightedPrompts({
            weightedPrompts: [{ text: interpretation.singleCoherentPrompt, weight: 1.0 }]
          });
          
          // Update current baseline for future crossfading
          this.currentBaseline = interpretation.singleCoherentPrompt;
        }
        
        logInterpretation({
          action: interpretation.requiresCrossfade ? 'applied-crossfade-transition' : 'updated-lyria-coherent-prompt',
          singleCoherentPrompt: interpretation.singleCoherentPrompt.substring(0, 50) + '...',
          transitionType: interpretation.requiresCrossfade ? 'crossfade' : 'direct'
        });
      } else if (interpretation.weightedPrompts) {
        // Fallback to legacy weighted prompts
        await this.lyriaSession.setWeightedPrompts({
          weightedPrompts: interpretation.weightedPrompts
        });
        logInterpretation({
          action: 'updated-lyria-weighted-prompts',
          promptCount: interpretation.weightedPrompts.length,
          prompts: interpretation.weightedPrompts.map(p => p.text?.substring(0, 30) + '...')
        });
      }

      // Apply configuration
      if (interpretation.lyriaConfig) {
        await this.lyriaSession.setMusicGenerationConfig({
          musicGenerationConfig: interpretation.lyriaConfig
        });
        logInterpretation({
          action: 'updated-lyria-config',
          config: interpretation.lyriaConfig
        });
      }

      // Staggered parameter updates to prevent audio clicks
      if (interpretation.lyriaConfig) {
        // Apply parameters with 50ms delay between updates for smooth transitions
        setTimeout(async () => {
          try {
            await this.lyriaSession.setMusicGenerationConfig({
              musicGenerationConfig: interpretation.lyriaConfig
            });
            
            logInterpretation({
              action: 'updated-lyria-config-staggered',
              config: interpretation.lyriaConfig
            });
          } catch (error) {
            logWarning('Staggered config update failed', { error: error.message });
          }
        }, 50); // 50ms delay for smoother application
      }

    } catch (error) {
      logError('Failed to apply interpretation to Lyria', { error: error.message });
    }
  }

  // NEW: Lyria-optimized crossfading implementation
  async applyCrossfadeTransition(newPrompt) {
    try {
      console.log('🌊 Applying Lyria crossfade transition...');
      
      // Phase 1: Introduce new prompt at low weight (30%)
      await this.lyriaSession.setWeightedPrompts({
        weightedPrompts: [
          { text: this.currentBaseline, weight: 0.7 },
          { text: newPrompt, weight: 0.3 }
        ]
      });
      
      logInterpretation({
        action: 'crossfade-phase-1',
        oldBaseline: this.currentBaseline.substring(0, 30) + '...',
        newPrompt: newPrompt.substring(0, 30) + '...',
        weights: '70/30'
      });
      
      // Phase 2: Balance the weights (50/50) after 1.5 seconds
      setTimeout(async () => {
        try {
          await this.lyriaSession.setWeightedPrompts({
            weightedPrompts: [
              { text: this.currentBaseline, weight: 0.5 },
              { text: newPrompt, weight: 0.5 }
            ]
          });
          console.log('🌊 Crossfade phase 2: balanced weights');
          logInterpretation({
            action: 'crossfade-phase-2',
            weights: '50/50'
          });
        } catch (error) {
          logError('Crossfade phase 2 failed', { error: error.message });
        }
      }, 1500);
      
      // Phase 3: Complete transition to new prompt after 3 seconds
      setTimeout(async () => {
        try {
          await this.lyriaSession.setWeightedPrompts({
            weightedPrompts: [{ text: newPrompt, weight: 1.0 }]
          });
          this.currentBaseline = newPrompt;
          console.log('🌊 Crossfade completed: new baseline established');
          logInterpretation({
            action: 'crossfade-phase-3',
            newBaseline: newPrompt.substring(0, 30) + '...',
            weights: '100'
          });
        } catch (error) {
          logError('Crossfade phase 3 failed', { error: error.message });
        }
      }, 3000);
      
    } catch (error) {
      logError('Crossfade transition failed', { error: error.message });
      // Fallback to direct transition
      await this.lyriaSession.setWeightedPrompts({
        weightedPrompts: [{ text: newPrompt, weight: 1.0 }]
      });
      this.currentBaseline = newPrompt;
    }
  }

  // Handle server reconnection
  handleServerReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      logServerCommunication({
        action: 'attempting-reconnect',
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        delayMs: delay
      });
      
      setTimeout(() => {
        this.connectToInterpretationServer();
      }, delay);
    } else {
      logError('Max reconnection attempts reached', { attempts: this.maxReconnectAttempts });
    }
  }

  // ============================================================================
  // SENSOR MANAGEMENT
  // ============================================================================

  // Initialize sensors for the active platform (DEPRECATED - use initializeWithWallet instead)
  async initializeSensors() {
    console.warn('⚠️ initializeSensors() is deprecated - sensors should be initialized via initializeWithWallet()');
    
    // Check if sensors are already initialized
    if (this.coordinationEnabled) {
      console.log('✅ Sensors already initialized via initializeWithWallet()');
      return this.cleanupFunctions;
    }

    if (!this.isInitialized) {
      console.log('🔄 Waiting for orchestration coordination to complete...');
      let attempts = 0;
      while (!this.isInitialized && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!this.isInitialized) {
        console.warn('Orchestration not initialized, cannot start sensors');
        return [];
      }
    }

    if (!this.activeOrchestrator) {
      console.warn('No active orchestrator available for sensors');
      return [];
    }

    try {
      const cleanupFunctions = await this.activeOrchestrator.initializeSensors();
      this.cleanupFunctions.push(...cleanupFunctions);
      
      // Register sensor data callback to send to server
      this.activeOrchestrator.onSensorData((sensorData) => {
        this.handleSensorData(sensorData);
      });
      
      console.log(`🎯 ${this.platform} sensors initialized`);
      return cleanupFunctions;
    } catch (error) {
      console.error(`Sensor initialization failed on ${this.platform}:`, error);
      return [];
    }
  }

  // Initialize web sensors
  async initializeWebSensors() {
    try {
      console.log('🌐 Initializing web sensors...');
      
      if (this.orchestrators.web) {
        // Register callback to send sensor data to server
        this.orchestrators.web.onSensorData((sensorData) => {
          this.handleSensorData(sensorData);
        });
        
        console.log('✅ Web sensors initialized (awaiting vibestream session)');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize web sensors:', error);
      return false;
    }
  }

  // Initialize mobile sensors
  async initializeMobileSensors() {
    try {
      console.log('📱 Initializing mobile sensors...'); 
      
      if (this.orchestrators.mobile) {
        // Register callback to send sensor data to server (when collection starts)
        this.orchestrators.mobile.onSensorData((sensorData) => {
          this.handleSensorData(sensorData);
        });
        
        console.log('✅ Mobile sensors initialized (awaiting vibestream session)');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize mobile sensors:', error);
      return false;
    }
  }

  // Handle sensor data (unified method)
  handleSensorData(sensorData) {
    try {
      this.lastSensorUpdate = Date.now();
      
      // Send to server for enhanced interpretation
      this.sendSensorDataToServer(sensorData);
      
      // Emit sensor data for UI updates (maintaining real-time responsiveness)
      this.emit('sensorData', sensorData);
      
      // Legacy callback support
      this.sensorCallbacks.forEach(callback => {
        try {
          callback(sensorData);
        } catch (error) {
          logWarning('Sensor callback error', { error: error.message });
        }
      });
      
    } catch (error) {
      logError('Error processing sensor data', { error: error.message, stack: error.stack });
    }
  }

  // ============================================================================
  // LYRIA AUDIO CHUNK HANDLING
  // ============================================================================

  // Handle Lyria audio messages
  handleLyriaMessage(message) {
    try {
      // Extract audio data from different possible locations
      let audioData = null;
      
      if (message.serverContent?.audioChunks?.length > 0) {
        const audioChunk = message.serverContent.audioChunks[0];
        if (audioChunk.audioChunk) {
          audioData = audioChunk.audioChunk;
        } else if (audioChunk.data) {
          audioData = audioChunk.data;
        }
      } else if (message.serverContent?.audioChunk) {
        audioData = message.serverContent.audioChunk;
      }

      if (audioData) {
        console.log('🎵 Processing Lyria audio');
        
        // 1. Send to buffering.js for predictive processing
        if (this.geminiBufferManager) {
          this.geminiBufferManager.handleLyriaAudioChunk(audioData);
        }
        
        // 2. Send to chunks service for 60-second collection
        if (this.currentRtaId && this.audioChunkService) {
          this.audioChunkService.addAudioData(audioData);
        }

        // 3. Send to platform orchestrator for playback
        if (Platform.OS === 'web' && this.orchestrators.web) {
          this.orchestrators.web.playAudioChunk(audioData);
        } else if (Platform.OS !== 'web' && this.orchestrators.mobile) {
          this.orchestrators.mobile.processAudioChunk(audioData);
        }

        // 4. Emit to UI callbacks
        this.sensorCallbacks.forEach(callback => {
          try {
            callback({ 
              x: 0, y: 0, z: 0, 
              timestamp: Date.now(), 
              audioData: audioData,
              source: 'lyria_audio'
            });
          } catch (error) {
            logWarning('Sensor callback with audio error', { error: error.message });
          }
        });
      }

      // Handle other message types
      if (message.serverContent?.status) {
        logInfo('Lyria status update', { status: message.serverContent.status });
        this.emit('status', message.serverContent.status);
      }
      
    } catch (error) {
      logError('Failed to handle Lyria message', { error: error.message, stack: error.stack });
      this.callbacks.onError.forEach(callback => callback(error));
    }
  }

  // Handle Lyria errors
  handleLyriaError(error) {
    logError('Lyria connection error', { error: error.message || error, stack: error.stack });
    this.isLyriaConnected = false;
    this.connectionState = 'error';
    
    this.callbacks.onError.forEach(callback => callback(error));
    this.emit('error', error);
    
    // Attempt to reconnect
    if (this.autoReconnect) {
      setTimeout(() => {
        if (!this.isLyriaConnected) {
          this.initializeLyriaConnection();
        }
      }, 5000);
    }
  }

  // Handle Lyria connection close
  handleLyriaClose() {
    logInfo('Lyria connection closed');
    this.isLyriaConnected = false;
    this.connectionState = 'closed';
    
    this.callbacks.onStateChange.forEach(callback => callback('closed'));
    this.emit('stateChange', 'closed');
    
    // Attempt to reconnect
    if (this.autoReconnect) {
      setTimeout(() => {
        if (!this.isLyriaConnected) {
          this.initializeLyriaConnection();
        }
      }, 3000);
    }
  }

  // ============================================================================
  // ORCHESTRATION CONTROL
  // ============================================================================

  // Start orchestration with initial prompts - IMMEDIATE LYRIA START
  async startOrchestration(initialPrompts = null) {
    console.log('🎵 Starting orchestration with IMMEDIATE Lyria startup...');
    
    try {
      // CRITICAL: If Lyria isn't connected yet, connect immediately
      if (!this.lyriaSession) {
        console.log('🚀 IMMEDIATE: Connecting to Lyria for instant music...');
        const connected = await this.initializeLyriaConnection();
        if (!connected) {
          console.error('❌ Failed to connect to Lyria');
          return false;
        }
      }

      console.log('🎹 IMMEDIATE: Starting music stream with baseline techno...');
      
      // IMMEDIATE: Set rave configuration for instant music
      await this.lyriaSession.setMusicGenerationConfig({
        musicGenerationConfig: {
          bpm: 140,  // Rave baseline
          density: 0.6,
          brightness: 0.7,
          guidance: 1.0,
          temperature: 1.8
        }
      });
      
      // IMMEDIATE: Set baseline techno prompt (part A of A+B+C format)
      const baselinePrompt = initialPrompts || [{ text: 'driving acid techno', weight: 1.0 }];
      await this.lyriaSession.setWeightedPrompts({
        weightedPrompts: baselinePrompt
      });
      
      // IMMEDIATE: Start playback NOW
      await this.lyriaSession.play();
      
      console.log('🎉 IMMEDIATE: Lyria music generation started with baseline techno!');
      console.log('📡 Server will enhance with A+B+C format: baseline + layer + poetry');
      
      // IMMEDIATE: Send baseline to buffering.js for predictive preparation
      if (this.geminiBufferManager) {
        const baselineInterpretation = {
          singleCoherentPrompt: baselinePrompt[0].text,
          lyriaConfig: {
            bpm: 140,
            density: 0.6,
            brightness: 0.7
          },
          requiresCrossfade: false
        };
        await this.geminiBufferManager.processInterpretation(baselineInterpretation);
        console.log('🧠 IMMEDIATE: Buffering.js prepared for baseline techno');
      }
      
      this.emit('orchestrationStarted', true);
      return true;
    } catch (error) {
      console.error('❌ Failed to start orchestration:', error);
      console.error('Error details:', error.message);
      this.emit('orchestrationStarted', false);
      return false;
    }
  }

  // Stop orchestration
  async stopOrchestration() {
    try {
      // Stop Lyria session
      if (this.lyriaSession && this.isLyriaConnected) {
        await this.lyriaSession.stop();
      }

      // Close server connection
      if (this.serverConnection) {
        this.serverConnection.close();
      }

      // Cleanup platform orchestrators
      if (Platform.OS === 'web' && this.orchestrators.web) {
        this.orchestrators.web.cleanup();
      } else if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        this.orchestrators.mobile.cleanup();
      }

      console.log('✅ Orchestration stopped');
      this.emit('orchestrationStopped', true);
      return true;
    } catch (error) {
      console.error('❌ Failed to stop orchestration:', error);
      this.emit('orchestrationStopped', false);
      return false;
    }
  }

  // ============================================================================
  // VIBESTREAM CONTROL
  // ============================================================================
  
  // Stop vibestream - this stops sensors and chunk service
  stopVibestream() {
    const endingRtaId = this.currentRtaId; // Store before clearing
    
    // Send session-end message to server for user pattern saving
    if (endingRtaId) {
      this.sendSessionEndToServer(endingRtaId, 'user_closed');
    }
    
    // Stop sensor collection on the active orchestrator
    if (this.activeOrchestrator && this.activeOrchestrator.stopSensorCollection) {
      this.activeOrchestrator.stopSensorCollection();
    } else {
      console.warn('⚠️ Active orchestrator does not support sensor collection cleanup');
    }
    
    this.currentRtaId = null;
    this.audioChunkService = null;
    this.vibestreamActive = false;
    
    console.log('🛑 Vibestream stopped - sensor collection stopped and resources cleaned up');
    this.emit('vibestreamStopped', true);
  }

  // ============================================================================
  // SESSION BOUNDARY MESSAGING
  // ============================================================================
  
  // Send session-start message to server for user pattern loading
  sendSessionStartToServer(rtaId) {
    if (!this.isServerConnected || !this.serverConnection) {
      console.warn('⚠️ Cannot send session-start - server not connected');
      return;
    }
    
    try {
      const walletAddress = this.walletIntegration?.account?.accountId || 'anonymous';
      const message = {
        type: 'session-start',
        walletAddress,
        vibeId: rtaId,
        config: {
          platform: this.platform,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };
      
      this.serverConnection.send(JSON.stringify(message));
      
      logServerCommunication({
        action: 'session-start-sent',
        walletAddress: walletAddress.substring(0, 8) + '...',
        vibeId: rtaId,
        platform: this.platform
      });
      
    } catch (error) {
      logWarning('Failed to send session-start message', { error: error.message });
    }
  }
  
  // Send session-end message to server for user pattern saving
  sendSessionEndToServer(rtaId, reason) {
    if (!this.isServerConnected || !this.serverConnection) {
      console.warn('⚠️ Cannot send session-end - server not connected');
      return;
    }
    
    try {
      const walletAddress = this.walletIntegration?.account?.accountId || 'anonymous';
      const message = {
        type: 'session-end',
        walletAddress,
        vibeId: rtaId,
        reason: reason || 'unknown',
        timestamp: Date.now()
      };
      
      this.serverConnection.send(JSON.stringify(message));
      
      logServerCommunication({
        action: 'session-end-sent',
        walletAddress: walletAddress.substring(0, 8) + '...',
        vibeId: rtaId,
        reason,
        platform: this.platform
      });
      
    } catch (error) {
      logWarning('Failed to send session-end message', { error: error.message });
    }
  }

  // ============================================================================
  // CALLBACK MANAGEMENT
  // ============================================================================

  // Register sensor data callback
  onSensorData(callback) {
    this.sensorCallbacks.push(callback);
  }

  // Register audio chunk callback
  onAudioChunk(callback) {
    this.callbacks.onAudioChunk.push(callback);
  }

  // Register error callback
  onError(callback) {
    this.callbacks.onError.push(callback);
  }

  // Register state change callback
  onStateChange(callback) {
    this.callbacks.onStateChange.push(callback);
  }

  // ============================================================================
  // STATUS AND UTILITIES
  // ============================================================================

  // Get orchestration status
  getStatus() {
    return {
      initialized: this.isInitialized,
      coordinationEnabled: this.coordinationEnabled,
      platform: this.platform,
      walletConnected: !!this.walletIntegration?.account,
      lyriaConnected: this.isLyriaConnected,
      serverConnected: this.isServerConnected,
      geminiBuffering: !!this.geminiBufferManager,
      vibestreamActive: this.vibestreamActive,
      connectionState: this.connectionState
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  // Cleanup integration
  cleanup() {
    try {
      // Stop orchestration
      this.stopOrchestration();

      // Stop vibestream if active
      this.stopVibestream();

      // Cleanup Gemini buffer manager
      if (this.geminiBufferManager) {
        this.geminiBufferManager.cleanup();
        this.geminiBufferManager = null;
      }

      // Cleanup sensor functions
      this.cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Cleanup function error:', error);
        }
      });
      this.cleanupFunctions = [];

      // Reset state
      this.isInitialized = false;
      this.coordinationEnabled = false;
      this.walletIntegration = null;
      this.lyriaSession = null;
      this.isLyriaConnected = false;
      this.serverConnection = null;
      this.isServerConnected = false;
      this.connectionState = 'disconnected';

      // Clear callbacks
      this.callbacks = {
        onAudioChunk: [],
        onError: [],
        onStateChange: []
      };
      this.sensorCallbacks = [];

      console.log('✅ Unified orchestration coordinator cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup orchestration coordinator:', error);
    }
  }
}

// ============================================================================
// LEGACY LYRIA ORCHESTRATOR CLASS (for compatibility)
// ============================================================================

export class LyriaOrchestrator extends EventEmitter {
  constructor() {
    super();
    
    // For backward compatibility, delegate to main coordinator
    this.coordinator = new OrchestrationCoordinator();
    
    // Proxy common methods
    this.session = null;
    this.isConnected = false;
    this.connectionState = 'disconnected';
  }

  async initialize(apiKey) {
    this.coordinator.lyriaApiKey = apiKey;
    const result = await this.coordinator.initializeLyriaConnection();
    this.session = this.coordinator.lyriaSession;
    this.isConnected = this.coordinator.isLyriaConnected;
    this.connectionState = this.coordinator.connectionState;
    return result;
  }

  async connect() {
    return this.initialize(this.coordinator.lyriaApiKey);
  }

  onAudioChunk(callback) {
    this.coordinator.onAudioChunk(callback);
  }

  onError(callback) {
    this.coordinator.onError(callback);
  }

  onStateChange(callback) {
    this.coordinator.onStateChange(callback);
  }

  async cleanup() {
    // Don't cleanup the main coordinator, just reset our proxies
    this.session = null;
    this.isConnected = false;
    this.connectionState = 'disconnected';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create singleton instances
export const orchestrationCoordinator = new OrchestrationCoordinator();
export const lyriaOrchestrator = new LyriaOrchestrator();

// Export the main coordinator as the default integration for compatibility
export const orchestrationIntegration = orchestrationCoordinator;

// Export default
export default orchestrationCoordinator;