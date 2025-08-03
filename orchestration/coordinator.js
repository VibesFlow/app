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
    
    // Client-side Gemini Buffer Manager
    this.geminiBufferManager = null;
    this.geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    console.log('🔑 Gemini API key availability:', this.geminiApiKey ? 'AVAILABLE' : 'MISSING');
    console.log('🔑 Gemini API key length:', this.geminiApiKey?.length || 0);
    if (this.geminiApiKey) {
      console.log('🔑 Gemini API key prefix:', this.geminiApiKey.substring(0, 8) + '...');
    }
    
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
      
      // 1. Initialize direct Lyria connection (client-side)
      if (this.lyriaApiKey) {
        await this.initializeLyriaConnection();
      }
      
      // 2. Initialize Gemini buffer manager (client-side)
      if (this.geminiApiKey) {
        await this.initializeGeminiBuffering();
      }
      
      // 3. Establish WebSocket connection to server for sensor interpretation
      await this.connectToInterpretationServer();
      
      // 4. Initialize platform-specific sensor systems
      if (Platform.OS === 'web' && this.orchestrators.web) {
        await this.initializeWebSensors();
      } else if (Platform.OS !== 'web' && this.orchestrators.mobile) {
        await this.initializeMobileSensors();
      }

      this.coordinationEnabled = true;
      
      console.log('✅ Unified orchestration architecture initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize unified orchestration architecture:', error);
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
      
      this.geminiBufferManager = createGeminiBufferManager(this.geminiApiKey);
      const initialized = await this.geminiBufferManager.initialize();
      
      if (initialized) {
        console.log('✅ Gemini buffering system initialized');
        return true;
      } else {
        console.warn('⚠️ Gemini buffering initialization failed - API key may be missing');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Gemini buffering:', error.message);
      return false;
    }
  }

  // ============================================================================
  // SERVER COMMUNICATION (FIXED TO USE CORRECT MESSAGE FORMAT)
  // ============================================================================

  // Connect to server for enhanced sensor interpretation
  async connectToInterpretationServer() {
    try {
      console.log('🔌 Connecting to interpretation server...');
      
      const serverUrl = process.env.EXPO_PUBLIC_STREAM_URL?.replace('https://', 'wss://') || 'wss://stream.vibesflow.ai';
      const wsUrl = `${serverUrl}`;
      
      this.serverConnection = new WebSocket(wsUrl);
      
      this.serverConnection.onopen = () => {
        this.isServerConnected = true;
        this.reconnectAttempts = 0;
        console.log('✅ Connected to interpretation server - enhanced AI processing enabled');
        this.processQueuedSensorData();
      };
      
      this.serverConnection.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          this.handleServerInterpretation(response);
    } catch (error) {
          console.warn('Failed to parse server response:', error);
        }
      };
      
      this.serverConnection.onclose = () => {
        this.isServerConnected = false;
        console.log('🔌 Server connection closed');
        this.handleServerReconnect();
      };
      
      this.serverConnection.onerror = (error) => {
        console.warn('⚠️ Server unavailable - continuing with client-side processing');
        this.isServerConnected = false;
      };
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to interpretation server:', error);
      return false;
    }
  }

  // Process queued sensor data when server becomes available
  processQueuedSensorData() {
    if (this.sensorQueue.length > 0) {
      console.log(`📡 Processing ${this.sensorQueue.length} queued sensor messages`);
      const queue = [...this.sensorQueue];
      this.sensorQueue = [];
      
      queue.forEach(queuedData => {
        this.sendSensorDataToServer(queuedData.data);
      });
    }
  }

  // Send sensor data to server for interpretation
  sendSensorDataToServer(sensorData) {
    // Only send sensor data when vibestream is active
    if (!this.vibestreamActive) {
      return; // Ignore sensor data when no vibestream is running
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
      // Log detailed sensor data being sent (throttled)
      if (Math.random() < 0.05) { // Log 5% of sensor data for debugging
        console.log('📡 Sending detailed sensor data to server:', {
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
      }

      // FIXED: Use correct message format that backend expects
      const message = {
        type: 'sensor-data', // Backend expects 'sensor-data' not 'sensor_data'
        sensorData: sensorData,
        timestamp: Date.now(),
        sessionId: this.walletIntegration?.account?.accountId || 'anonymous'
      };

      this.serverConnection.send(JSON.stringify(message));
    } catch (error) {
      console.warn('Failed to send sensor data to server:', error);
    }
  }

    // Handle interpretation response from server
  handleServerInterpretation(response) {
    if (!response || response.type !== 'interpretation') {
      console.log('⚠️ Received non-interpretation message from server:', response?.type || 'undefined');
      return;
    }

    try {
      const { data: interpretation } = response;
      
      console.log('🎼 Received server interpretation:', {
        prompts: interpretation.weightedPrompts?.length,
        bpm: interpretation.lyriaConfig?.bpm,
        density: interpretation.lyriaConfig?.density,
        reasoning: interpretation.reasoning?.substring(0, 100) + '...',
        fallback: interpretation.fallback,
        source: response.source,
        hasMemory: response.hasMemory,
        hasKnowledge: response.hasKnowledge,
        usedPoetry: response.usedPoetry,
        usedSensorExpertise: response.usedSensorExpertise
      });

      // Check if this is a fallback response (indicates Alith agent failed)
      if (interpretation.fallback) {
        console.warn('⚠️ Received fallback interpretation - Alith agent may have failed:', response.error);
      } else {
        console.log('✅ Received full Alith agent interpretation with:', {
          memory: response.hasMemory,
          knowledge: response.hasKnowledge,
          poetry: response.usedPoetry,
          sensorExpertise: response.usedSensorExpertise
        });
      }
      
      // Apply interpretation to Lyria directly
      this.applyInterpretationToLyria(interpretation);
      
      // Apply to Gemini buffer manager for predictive buffering
      if (this.geminiBufferManager) {
        this.geminiBufferManager.processInterpretation(interpretation);
      }
      
      // Emit for UI updates
      this.emit('interpretation', interpretation);
      
    } catch (error) {
      console.error('Failed to handle server interpretation:', error);
    }
  }

  // Apply server interpretation to Lyria session
  async applyInterpretationToLyria(interpretation) {
    if (!this.isLyriaConnected || !this.lyriaSession) {
      console.warn('⚠️ Cannot apply interpretation - Lyria not connected');
      return;
  }

  try {
      console.log('🎵 Applying interpretation to Lyria...');
    
      // Apply weighted prompts
      if (interpretation.weightedPrompts) {
        await this.lyriaSession.setWeightedPrompts({
      weightedPrompts: interpretation.weightedPrompts
    });
        console.log('📝 Updated Lyria prompts:', interpretation.weightedPrompts);
      }

      // Apply configuration
      if (interpretation.lyriaConfig) {
        await this.lyriaSession.setMusicGenerationConfig({
      musicGenerationConfig: interpretation.lyriaConfig
    });
        console.log('⚙️ Updated Lyria config:', interpretation.lyriaConfig);
      }

      console.log('✅ Interpretation applied to Lyria successfully');

  } catch (error) {
      console.error('❌ Failed to apply interpretation to Lyria:', error);
    }
  }

  // Handle server reconnection
  handleServerReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`🔄 Attempting to reconnect to server (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        this.connectToInterpretationServer();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
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
        // Initialize web sensors
        await this.orchestrators.web.initializeSensors();
        
        // Register callback to send sensor data to server
        this.orchestrators.web.onSensorData((sensorData) => {
          this.handleSensorData(sensorData);
        });
        
        console.log('✅ Web sensors initialized');
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
        await this.orchestrators.mobile.initializeSensors();
        
        // Register callback to send sensor data to server
        this.orchestrators.mobile.onSensorData((sensorData) => {
          this.handleSensorData(sensorData);
        });
        
        console.log('✅ Mobile sensors initialized');
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
          console.warn('Sensor callback error:', error);
        }
      });
      
    } catch (error) {
      console.error('Error processing sensor data:', error);
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
      
      // Debug logging
      if (!audioData && message.serverContent) {
        console.log('🔍 No audio data found. ServerContent structure:', Object.keys(message.serverContent));
        if (message.serverContent.audioChunks) {
          console.log('🔍 AudioChunks structure:', message.serverContent.audioChunks);
        }
      }

      if (audioData) {
        console.log('🎵 Audio chunk received, processing...');
        
        // Send to Gemini buffer manager for seamless playback with predictive buffering
        if (this.geminiBufferManager) {
          this.geminiBufferManager.handleLyriaAudioChunk(audioData);
          this.geminiBufferManager.bufferAudioChunk(audioData);
        }
        
        // Send to audio chunk service for vibestream
        if (this.currentRtaId && this.audioChunkService) {
          this.audioChunkService.addAudioData(audioData);
        }

        // Send to appropriate platform orchestrator for additional processing
        if (Platform.OS === 'web' && this.orchestrators.web) {
          this.orchestrators.web.playAudioChunk(audioData);
        } else if (Platform.OS !== 'web' && this.orchestrators.mobile) {
          this.orchestrators.mobile.processAudioChunk(audioData);
        }

        // Call registered audio chunk callbacks
        this.callbacks.onAudioChunk.forEach(callback => {
          try {
            callback(audioData);
          } catch (error) {
            console.warn('Audio chunk callback error:', error);
          }
        });
      }

      // Handle other message types
      if (message.serverContent?.status) {
        console.info('Lyria status:', message.serverContent.status);
        this.emit('status', message.serverContent.status);
      }
      
    } catch (error) {
      console.error('Failed to handle Lyria message:', error);
      this.callbacks.onError.forEach(callback => callback(error));
    }
  }

  // Handle Lyria errors
  handleLyriaError(error) {
    console.error('Lyria connection error:', error);
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
    console.log('Lyria connection closed');
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

  // Start orchestration with initial prompts
  async startOrchestration(initialPrompts = null) {
    console.log('🎵 Starting orchestration...');
    
    if (!this.isInitialized) {
      console.error('❌ Orchestration not initialized');
      return false;
    }

    try {
      if (!this.lyriaSession) {
        console.log('🔗 Initializing Lyria connection...');
        const connected = await this.initializeLyriaConnection();
        if (!connected) {
          console.error('❌ Failed to connect to Lyria');
          return false;
        }
      }

      console.log('🎹 Starting music stream...');
      
      // Start Lyria session - prompts will come from server via sensor interpretations
      await this.lyriaSession.setMusicGenerationConfig({
        musicGenerationConfig: {
          bpm: 120,
          density: 0.5,
          brightness: 0.6,
          guidance: 1.0,
          temperature: 2.0
        }
      });
      
      // Set minimal initial prompt to start the stream
      const prompts = initialPrompts || [{ text: 'electronic music', weight: 1.0 }];
      await this.lyriaSession.setWeightedPrompts({
        weightedPrompts: prompts
      });
      
      // Start playback
      await this.lyriaSession.play();
      
      console.log('📡 Server will send enhanced prompts via sensor data interpretation');
      console.log('✅ Orchestration started successfully - music should be playing!');
      
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
  
  // Start vibestream - this initializes sensors and chunk service
  startVibestream(rtaId, audioChunkService) {
    this.currentRtaId = rtaId;
    this.audioChunkService = audioChunkService;
    this.vibestreamActive = true;
    
    console.log('🎯 Vibestream started:', rtaId);
    console.log('📡 Sensors will now send data for active vibestream');
    
    this.emit('vibestreamStarted', rtaId);
  }
  
  // Stop vibestream - this stops sensors and chunk service
  stopVibestream() {
    this.currentRtaId = null;
    this.audioChunkService = null;
    this.vibestreamActive = false;
    
    console.log('🛑 Vibestream stopped - sensor data will no longer be processed');
    this.emit('vibestreamStopped', true);
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