/**
 * MOBILE.JS - Mobile Platform Orchestration Module
 * Handles iOS/Android-specific sensor inputs and audio playback for VibesFlow
 * Optimized for ultra-low latency real-time rave experience on mobile devices
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
    
    // Wallet integration for mobile coordination
    this.walletIntegration = null;
    this.connectedWallet = null;
    
    // Mobile Audio System using Expo AV
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
    this.lastSensorUpdate = 0;
    this.immediateUpdateThreshold = 25; // 25ms for immediate updates
    this.sensorBuffer = [];
    this.maxSensorBuffer = 3; // Keep only latest 3 sensor readings

    // Initialize audio system
    this.initializeAudioSystem();
  }

  // Coordinate with wallet system for mobile integration
  setWalletIntegration(walletIntegration, connectedWallet) {
    this.walletIntegration = walletIntegration;
    this.connectedWallet = connectedWallet;
    console.log('🔗 Mobile orchestrator coordinated with wallet system');
  }

  // Initialize Audio System using Expo AV
  async initializeAudioSystem() {
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
      console.log('🎧 Mobile Audio System initialized with Expo AV');
      return true;
    } catch (error) {
      console.error('Failed to initialize mobile audio system:', error);
      return false;
    }
  }

  // Register sensor data callback
  onSensorData(callback) {
    this.sensorCallbacks.push(callback);
  }

  // Emit sensor data to all registered callbacks with ZERO-LATENCY
  emitSensorData(sensorData) {
    const now = Date.now();
    this.lastSensorUpdate = now;
    
    // Add to sensor buffer
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
  }

  // Initialize mobile sensors with ZERO-LATENCY feedback
  async initializeSensors() {
    if (Platform.OS === 'web') return [];

    try {
      // Set MAXIMUM RESPONSIVENESS update intervals for ZERO-LATENCY
      Accelerometer.setUpdateInterval(10); // 100 FPS for ZERO-LATENCY
      Gyroscope.setUpdateInterval(10);

      const cleanupFunctions = [];

      // ZERO-LATENCY accelerometer with immediate feedback
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
        this.emitSensorData(sensorData);
      });

      // ZERO-LATENCY gyroscope with immediate feedback
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

        this.emitSensorData(combinedSensorData);
      });

      cleanupFunctions.push(() => {
        this.accelSubscription?.remove();
        this.gyroSubscription?.remove();
      });

      this.isInitialized = true;
      console.log('🚀 Mobile sensors initialized with ZERO-LATENCY feedback');
      return cleanupFunctions;

    } catch (error) {
      console.error('Mobile sensor initialization error:', error);
      return [];
    }
  }

  // Process audio chunk from server using Expo AV
  async processAudioChunk(audioChunkData) {
    if (!this.isAudioSystemInitialized) {
      await this.initializeAudioSystem();
    }

    try {
      let audioBuffer;
      
      if (typeof audioChunkData === 'string') {
        // Base64 encoded audio from server
        audioBuffer = this.base64ToArrayBuffer(audioChunkData);
      } else if (audioChunkData instanceof ArrayBuffer) {
        audioBuffer = audioChunkData;
      } else if (audioChunkData instanceof Uint8Array) {
        audioBuffer = audioChunkData.buffer.slice(audioChunkData.byteOffset, audioChunkData.byteOffset + audioChunkData.byteLength);
      } else {
        console.warn('Unknown audio chunk format on mobile');
        return;
      }

      // Convert raw PCM to WAV format for Expo AV
      const wavBuffer = this.convertPCMToWAV(audioBuffer);
      
      // Add to audio queue
      this.audioQueue.push(wavBuffer);
      
      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        this.startMobileAudioPlayback();
      }
    } catch (error) {
      console.error('Failed to process audio chunk on mobile:', error);
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

  // Start mobile audio playback using Expo AV
  async startMobileAudioPlayback() {
    if (Platform.OS === 'web' || !this.isAudioSystemInitialized) return;
    
    this.isPlayingAudio = true;
    
    const processAudioQueue = async () => {
      while (this.audioQueue.length > 0 && this.isPlayingAudio) {
        const audioData = this.audioQueue.shift();
        
        try {
          // Convert ArrayBuffer to base64 URI for Expo AV
          const base64Audio = this.arrayBufferToBase64(audioData);
          const audioUri = `data:audio/wav;base64,${base64Audio}`;
          
          // Create and play audio using Expo AV
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
          console.error('Mobile audio playback error:', error);
        }
        
        // Small delay to prevent overwhelming the audio system
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      if (this.audioQueue.length === 0) {
        this.isPlayingAudio = false;
      }
    };
    
    processAudioQueue();
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

  // Low-pass filter for noise reduction while maintaining responsiveness
  applyLowPassFilter(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
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

  // Get current mobile orchestrator state
  getState() {
    return {
      initialized: this.isInitialized,
      audioSystemInitialized: this.isAudioSystemInitialized,
      isPlayingAudio: this.isPlayingAudio,
      audioQueueLength: this.audioQueue.length,
      sensorBufferLength: this.sensorBuffer.length,
      lastSensorUpdate: this.lastSensorUpdate,
      walletConnected: !!this.connectedWallet
    };
  }

  // Cleanup all mobile resources
  cleanup() {
    console.log('🧹 Mobile orchestrator cleanup starting...');
    
    try {
      // Stop sensors
      if (this.accelSubscription) {
        this.accelSubscription.remove();
        this.accelSubscription = null;
      }

      if (this.gyroSubscription) {
        this.gyroSubscription.remove();
        this.gyroSubscription = null;
      }

      // Stop audio playback
      this.isPlayingAudio = false;
      
      if (this.currentSound) {
        this.currentSound.unloadAsync().catch(console.warn);
        this.currentSound = null;
      }

      // Clear queues
      this.audioQueue = [];
      this.sensorBuffer = [];
      this.sensorCallbacks = [];
      
      // Reset state
      this.isInitialized = false;
      this.isAudioSystemInitialized = false;
      
      console.log('✅ Mobile orchestrator cleanup completed');
    } catch (error) {
      console.error('Error during mobile cleanup:', error);
    }
  }
}

// Export singleton instance
export const mobileOrchestrator = new MobileOrchestrator(); 