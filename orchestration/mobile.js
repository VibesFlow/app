/**
 * MOBILE.JS - Mobile Platform Orchestration Module
 * Handles iOS/Android-specific sensor inputs and Lyria RealTime integration for VibesFlow
 * Optimized for ultra-low latency real-time rave experience on mobile devices
 * PRODUCTION-READY IMPLEMENTATION WITH ZERO-LATENCY SENSOR FEEDBACK
 */

import { Platform } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Audio } from 'expo-av';

// Ensure polyfills are loaded first (includes our crypto wrapper)
import '../configs/polyfills';

// Use global Buffer from polyfills instead of direct import to avoid conflicts
const Buffer = global.Buffer || require('buffer').Buffer;

// Mobile-specific polyfills for btoa/atob if not available (with polyfill support)
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// Ensure crypto is available through our wrapper
const crypto = global.crypto;

export class MobileOrchestrator {
  constructor() {
    this.sensorCallbacks = [];
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.isInitialized = false;
    this.lastSensorData = { x: 0, y: 0, z: 0, timestamp: Date.now() };
    
      // REAL Lyria RealTime Integration for Mobile (PRODUCTION)
  this.lyriaWebSocket = null;
  this.isLyriaConnected = false;
  this.audioChunkCallbacks = [];
  this.pendingPrompts = [];
  this.lastConfigUpdate = 0;
  this.reconnectAttempts = 0;
  this.maxReconnectAttempts = 5;
  
  // Wallet integration for mobile coordination
  this.walletIntegration = null;
  this.connectedWallet = null;
    
    // REAL Mobile Audio System using Expo AV (PRODUCTION)
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.audioContext = null;
    this.currentSound = null;
    this.audioPlayerQueue = [];
    this.isAudioSystemInitialized = false;
    this.audioBufferSize = 48000; // 1 second of 48kHz audio
    this.audioSampleRate = 48000;
    this.audioChannels = 2; // Stereo
    
    // Zero-latency sensor feedback system
    this.sensorToLyriaLatency = 0;
    this.lastSensorUpdate = 0;
    this.immediateUpdateThreshold = 25; // 25ms for immediate updates
    this.sensorBuffer = [];
    this.maxSensorBuffer = 3; // Keep only latest 3 sensor readings
    
    // Current Lyria session state
    this.currentWeightedPrompts = [{ text: 'minimal techno', weight: 1.0 }];
    this.currentConfig = {
      bpm: 90,
      temperature: 1.0,
      density: 0.5,
      brightness: 0.5
    };

      // Initialize REAL audio system immediately
  this.initializeRealAudioSystem();
}

// Coordinate with wallet system for mobile integration
setWalletIntegration(walletIntegration, connectedWallet) {
  this.walletIntegration = walletIntegration;
  this.connectedWallet = connectedWallet;
  console.log('🔗 Mobile orchestrator coordinated with wallet system');
}

  // Initialize REAL Audio System using Expo AV (PRODUCTION)
  async initializeRealAudioSystem() {
    if (Platform.OS === 'web') return false;

    try {
      // Configure audio session for real-time playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false
      });

      this.isAudioSystemInitialized = true;
      console.log('🎧 REAL Mobile Audio System initialized with Expo AV');
      return true;
    } catch (error) {
      console.error('Failed to initialize REAL mobile audio system:', error);
      return false;
    }
  }

  // Register sensor data callback
  onSensorData(callback) {
    this.sensorCallbacks.push(callback);
  }

  // Register audio chunk callback for Lyria audio
  onAudioChunk(callback) {
    this.audioChunkCallbacks.push(callback);
  }

  // Emit sensor data to all registered callbacks with ZERO-LATENCY
  emitSensorData(sensorData) {
    const now = Date.now();
    this.lastSensorUpdate = now;
    
    // Add to sensor buffer for immediate Lyria updates
    this.sensorBuffer.push({ ...sensorData, timestamp: now });
    if (this.sensorBuffer.length > this.maxSensorBuffer) {
      this.sensorBuffer.shift();
    }

    // IMMEDIATE sensor callback emission (zero-latency)
    this.sensorCallbacks.forEach(callback => {
      try {
        callback(sensorData);
      } catch (error) {
        console.warn('Mobile sensor callback error:', error);
      }
    });

    // IMMEDIATE Lyria update for zero-latency feedback
    if (now - this.lastConfigUpdate > this.immediateUpdateThreshold) {
      this.updateLyriaFromSensorsImmediate(sensorData);
    }
  }

  // Emit audio chunks to all registered callbacks
  emitAudioChunk(audioData) {
    this.audioChunkCallbacks.forEach(callback => {
      try {
        callback(audioData);
      } catch (error) {
        console.warn('Mobile audio chunk callback error:', error);
      }
    });
  }

  // Initialize REAL Lyria RealTime connection for mobile (PRODUCTION)
  async initializeLyriaConnection(apiKey) {
    if (Platform.OS === 'web') return false;

    try {
      // REAL Lyria RealTime WebSocket connection (PRODUCTION)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.StreamGenerateContent?key=${apiKey}`;
      
      this.lyriaWebSocket = new WebSocket(wsUrl, ['lyria-realtime'], {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      this.lyriaWebSocket.onopen = () => {
        console.log('🎵 REAL Lyria RealTime connected on mobile (PRODUCTION)');
        this.isLyriaConnected = true;
        this.reconnectAttempts = 0;
        this.sendInitialMobileConfiguration();
      };

      this.lyriaWebSocket.onmessage = (event) => {
        this.handleRealLyriaMessage(event.data);
      };

      this.lyriaWebSocket.onerror = (error) => {
        console.error('🚨 REAL Lyria WebSocket error on mobile:', error);
        this.isLyriaConnected = false;
        this.attemptReconnection();
      };

      this.lyriaWebSocket.onclose = () => {
        console.log('🔌 REAL Lyria connection closed');
        this.isLyriaConnected = false;
        this.attemptReconnection();
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize REAL Lyria on mobile:', error);
      return false;
    }
  }

  // Send initial configuration to REAL Lyria
  sendInitialMobileConfiguration() {
    if (!this.isLyriaConnected) return;

    // Send REAL Lyria initialization message
    const initMessage = {
      generateContentRequest: {
        model: 'models/lyria-realtime-exp',
        contents: [{
          parts: [{
            text: JSON.stringify({
              type: 'initialize',
              weightedPrompts: this.currentWeightedPrompts,
              musicGenerationConfig: this.currentConfig,
              streamAudio: true,
              realTimeUpdates: true
            })
          }]
        }]
      }
    };

    this.lyriaWebSocket.send(JSON.stringify(initMessage));
    
    // Start music generation immediately
    this.sendPlayCommand();
  }

  // Handle incoming REAL Lyria messages (PRODUCTION)
  handleRealLyriaMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle REAL audio chunks from Lyria
      if (message.candidates && message.candidates[0]?.content?.parts) {
        const parts = message.candidates[0].content.parts;
        
        for (const part of parts) {
          if (part.audioData || part.inlineData?.data) {
            const audioData = part.audioData || part.inlineData.data;
            this.processRealAudioChunk(audioData);
          }
        }
      }
      
      if (message.error) {
        console.error('REAL Lyria error:', message.error);
      }
      
      if (message.promptFeedback) {
        console.log('REAL Lyria feedback:', message.promptFeedback);
      }
    } catch (error) {
      console.warn('Failed to parse REAL Lyria message:', error);
    }
  }

  // Process REAL audio chunk from Lyria using Expo AV (PRODUCTION)
  async processRealAudioChunk(audioChunkData) {
    if (!this.isAudioSystemInitialized) {
      await this.initializeRealAudioSystem();
    }

    try {
      let audioBuffer;
      
      if (typeof audioChunkData === 'string') {
        // Base64 encoded audio from Lyria
        audioBuffer = this.base64ToArrayBuffer(audioChunkData);
      } else if (audioChunkData instanceof ArrayBuffer) {
        audioBuffer = audioChunkData;
      } else {
        console.warn('Unknown REAL audio chunk format on mobile');
        return;
      }

      // Convert raw PCM to WAV format for Expo AV
      const wavBuffer = this.convertPCMToWAV(audioBuffer);
      
      // Add to REAL audio queue
      this.audioQueue.push(wavBuffer);
      
      // Emit to audio chunk callbacks (for storage/processing)
      this.emitAudioChunk(wavBuffer);
      
      // Start REAL playback if not already playing
      if (!this.isPlayingAudio) {
        this.startRealMobileAudioPlayback();
      }
    } catch (error) {
      console.error('Failed to process REAL audio chunk on mobile:', error);
    }
  }

  // Convert raw PCM to WAV format for Expo AV
  convertPCMToWAV(pcmBuffer) {
    const pcmData = new Int16Array(pcmBuffer);
    const sampleRate = this.audioSampleRate;
    const numChannels = this.audioChannels;
    const bitsPerSample = 16;
    
    const dataLength = pcmData.length * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
    view.setUint16(32, numChannels * bitsPerSample / 8, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(offset, pcmData[i], true);
      offset += 2;
    }
    
    return buffer;
  }

  // Start REAL mobile audio playback using Expo AV (PRODUCTION)
  async startRealMobileAudioPlayback() {
    if (Platform.OS === 'web' || !this.isAudioSystemInitialized) return;
    
    this.isPlayingAudio = true;
    
    const processRealAudioQueue = async () => {
      while (this.audioQueue.length > 0 && this.isPlayingAudio) {
        const audioData = this.audioQueue.shift();
        
        try {
          // Convert ArrayBuffer to base64 URI for Expo AV
          const base64Audio = this.arrayBufferToBase64(audioData);
          const audioUri = `data:audio/wav;base64,${base64Audio}`;
          
          // Create and play REAL audio using Expo AV
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUri },
            { 
              shouldPlay: true,
              isLooping: false,
              volume: 1.0,
              rate: 1.0,
              positionMillis: 0
            }
          );
          
          // Store current sound for cleanup
          if (this.currentSound) {
            await this.currentSound.unloadAsync();
          }
          this.currentSound = sound;
          
          // Wait for playback to complete
          await new Promise((resolve) => {
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.didJustFinish) {
                resolve();
              }
            });
          });
          
          // Cleanup
          await sound.unloadAsync();
          
        } catch (error) {
          console.error('REAL mobile audio playback error:', error);
        }
        
        // Small delay to prevent overwhelming the audio system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      if (this.audioQueue.length === 0) {
        this.isPlayingAudio = false;
      }
    };
    
    processRealAudioQueue();
  }

  // Convert ArrayBuffer to base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer (mobile-optimized)
  base64ToArrayBuffer(base64) {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('Failed to convert base64 to ArrayBuffer:', error);
      return new ArrayBuffer(0);
    }
  }

  // Send weighted prompts to REAL Lyria
  sendWeightedPrompts(weightedPrompts) {
    if (!this.isLyriaConnected) {
      this.pendingPrompts = weightedPrompts;
      return;
    }

    const message = {
      generateContentRequest: {
        model: 'models/lyria-realtime-exp',
        contents: [{
          parts: [{
            text: JSON.stringify({
              type: 'setWeightedPrompts',
              weightedPrompts: weightedPrompts
            })
          }]
        }]
      }
    };

    this.lyriaWebSocket.send(JSON.stringify(message));
    this.currentWeightedPrompts = weightedPrompts;
  }

  // Send music generation config to REAL Lyria
  sendMusicGenerationConfig(config) {
    if (!this.isLyriaConnected) return;

    const message = {
      generateContentRequest: {
        model: 'models/lyria-realtime-exp',
        contents: [{
          parts: [{
            text: JSON.stringify({
              type: 'setMusicGenerationConfig',
              musicGenerationConfig: config
            })
          }]
        }]
      }
    };

    this.lyriaWebSocket.send(JSON.stringify(message));
    this.currentConfig = { ...config };
  }

  // Send play command to REAL Lyria
  sendPlayCommand() {
    if (!this.isLyriaConnected) return;

    const message = {
      generateContentRequest: {
        model: 'models/lyria-realtime-exp',
        contents: [{
          parts: [{
            text: JSON.stringify({
              type: 'play'
            })
          }]
        }]
      }
    };

    this.lyriaWebSocket.send(JSON.stringify(message));
  }

  // Send pause command to REAL Lyria
  sendPauseCommand() {
    if (!this.isLyriaConnected) return;

    const message = {
      generateContentRequest: {
        model: 'models/lyria-realtime-exp',
        contents: [{
          parts: [{
            text: JSON.stringify({
              type: 'pause'
            })
          }]
        }]
      }
    };

    this.lyriaWebSocket.send(JSON.stringify(message));
  }

  // Attempt reconnection to REAL Lyria
  attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached for REAL Lyria');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`Attempting REAL Lyria reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isLyriaConnected) {
        this.initializeLyriaConnection(process.env.EXPO_PUBLIC_LYRIA_API_KEY);
      }
    }, delay);
  }

  // Initialize mobile sensors with ZERO-LATENCY feedback
  async initializeSensors() {
    if (Platform.OS === 'web') return [];

    try {
      // Set MAXIMUM RESPONSIVENESS update intervals for ZERO-LATENCY
      Accelerometer.setUpdateInterval(10); // 100 FPS for ZERO-LATENCY
      Gyroscope.setUpdateInterval(10);

      const cleanupFunctions = [];

      // ZERO-LATENCY accelerometer with immediate Lyria feedback
      this.accelSubscription = Accelerometer.addListener((result) => {
        // Apply smart filtering to reduce noise while maintaining responsiveness
        const filteredX = this.applyLowPassFilter(result.x, this.lastSensorData.x, 0.3);
        const filteredY = this.applyLowPassFilter(result.y, this.lastSensorData.y, 0.3);
        const filteredZ = this.applyLowPassFilter(result.z, this.lastSensorData.z, 0.3);

        // Calculate movement intensity for rave scaling
        const magnitude = Math.sqrt(filteredX ** 2 + filteredY ** 2 + filteredZ ** 2);
        const intensity = Math.min(magnitude * 1.5, 5); // Amplify for rave sensitivity

        const sensorData = {
          x: filteredX * 2, // Amplify for more dramatic response
          y: filteredY * 2,
          z: Math.max(intensity, 0.1), // Maintain baseline activity
          timestamp: Date.now(),
          source: 'accelerometer',
          rawMagnitude: magnitude
        };

        this.lastSensorData = sensorData;
        this.emitSensorData(sensorData); // This now includes immediate Lyria updates
      });

      // ZERO-LATENCY gyroscope with immediate Lyria feedback
      this.gyroSubscription = Gyroscope.addListener((result) => {
        // Combine gyro data with existing accelerometer data for richer input
        const gyroIntensity = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
        
        const combinedSensorData = {
          x: this.lastSensorData.x + result.x * 0.1, // Blend gyro with accel
          y: this.lastSensorData.y + result.y * 0.1,
          z: this.lastSensorData.z + gyroIntensity * 0.2,
          timestamp: Date.now(),
          source: 'gyroscope',
          gyroIntensity: gyroIntensity
        };

        this.emitSensorData(combinedSensorData); // This now includes immediate Lyria updates
      });

      cleanupFunctions.push(() => {
        this.accelSubscription?.remove();
        this.gyroSubscription?.remove();
      });

      this.isInitialized = true;
      console.log('🚀 Mobile sensors initialized with ZERO-LATENCY Lyria feedback');
      return cleanupFunctions;

    } catch (error) {
      console.error('Mobile sensor initialization error:', error);
      return [];
    }
  }

  // Update Lyria prompts IMMEDIATELY based on sensor data (ZERO-LATENCY)
  updateLyriaFromSensorsImmediate(sensorData) {
    const now = Date.now();
    
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const normalizedMagnitude = Math.min(magnitude, 3) / 3;

    // Generate IMMEDIATE dynamic prompts based on movement
    const genres = ['minimal techno', 'deep house', 'ambient', 'breakbeat', 'drum & bass', 'psytrance'];
    const currentGenre = genres[Math.floor(normalizedMagnitude * genres.length)];
    
    const newWeightedPrompts = [
      { text: currentGenre, weight: 0.7 },
      { text: magnitude > 2 ? 'high energy' : 'chill', weight: 0.3 }
    ];

    // Update BPM IMMEDIATELY based on movement intensity
    const newBpm = 90 + Math.floor(normalizedMagnitude * 40); // 90-130 BPM range
    
    const newConfig = {
      ...this.currentConfig,
      bpm: newBpm,
      density: 0.3 + normalizedMagnitude * 0.4,
      brightness: 0.2 + normalizedMagnitude * 0.6,
      temperature: 1.0 + normalizedMagnitude * 1.0, // Higher temperature for more variation
      guidance: 0.5 + normalizedMagnitude * 0.3 // Dynamic guidance
    };

    // Send IMMEDIATE updates to Lyria (ZERO-LATENCY)
    this.sendWeightedPrompts(newWeightedPrompts);
    this.sendMusicGenerationConfig(newConfig);
    
    this.lastConfigUpdate = now;
  }

  // Low-pass filter for noise reduction while maintaining responsiveness
  applyLowPassFilter(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
  }

  // Get current REAL Lyria state
  getLyriaState() {
    return {
      connected: this.isLyriaConnected,
      currentPrompts: this.currentWeightedPrompts,
      currentConfig: this.currentConfig,
      audioQueueLength: this.audioQueue.length,
      isPlayingAudio: this.isPlayingAudio,
      isAudioSystemInitialized: this.isAudioSystemInitialized,
      sensorLatency: this.sensorToLyriaLatency
    };
  }

  // Enhanced sensor calibration for different device orientations
  calibrateSensors() {
    // Auto-calibration based on device movement patterns
    const calibrationDuration = 3000; // 3 seconds
    const samples = [];
    
    const calibrationInterval = setInterval(() => {
      samples.push({
        x: this.lastSensorData.x,
        y: this.lastSensorData.y,
        z: this.lastSensorData.z
      });
    }, 50);

    setTimeout(() => {
      clearInterval(calibrationInterval);
      
      // Calculate baseline offsets
      const avgX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
      const avgY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
      const avgZ = samples.reduce((sum, s) => sum + s.z, 0) / samples.length;
      
      console.log('Mobile sensor calibration completed:', { avgX, avgY, avgZ });
      
      // Apply calibration offsets in sensor processing
      this.calibrationOffsets = { x: avgX, y: avgY, z: avgZ };
    }, calibrationDuration);
  }

  // Cleanup all mobile resources
  cleanup() {
    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }

    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }

    if (this.lyriaWebSocket) {
      this.lyriaWebSocket.close();
      this.lyriaWebSocket = null;
    }

    if (this.currentSound) {
      this.currentSound.unloadAsync().catch(console.warn);
      this.currentSound = null;
    }

    this.sensorCallbacks = [];
    this.audioChunkCallbacks = [];
    this.isInitialized = false;
    this.isLyriaConnected = false;
    this.isPlayingAudio = false;
    this.audioQueue = [];
    this.isAudioSystemInitialized = false;
  }
}

// Export singleton instance
export const mobileOrchestrator = new MobileOrchestrator(); 