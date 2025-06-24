/**
 * WEB.JS - Web Platform Orchestration Module
 * Handles browser-specific sensor inputs and audio outputs for VibesFlow
 * Optimized for ultra-low latency real-time rave experience
 */

import { Platform } from 'react-native';

export class WebOrchestrator {
  constructor() {
    this.audioContext = null;
    this.sensorCallbacks = [];
    this.audioQueue = [];
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastMouseTime = Date.now();
    this.cameraStream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.previousImageData = null;
    this.decayInterval = null;
    this.motionInterval = null;
    this.isInitialized = false;
  }

  // Initialize Web Audio Context with minimal latency
  async initializeAudioContext() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

    try {
      // Use the most optimized audio context settings
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive', // Ultra-low latency mode
        sampleRate: 48000, // Match Lyria output
      });
      
      // Resume immediately for minimal delay
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('Web Audio Context initialized:', this.audioContext.state);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('Web Audio Context init failed:', error);
      return false;
    }
  }

  // Register sensor data callback with ultra-low latency
  onSensorData(callback) {
    this.sensorCallbacks.push(callback);
  }

  // Emit sensor data to all registered callbacks
  emitSensorData(sensorData) {
    this.sensorCallbacks.forEach(callback => {
      try {
        callback(sensorData);
      } catch (error) {
        console.warn('Sensor callback error:', error);
      }
    });
  }

  // Enhanced mouse tracking with optimized sensitivity for rave responsiveness
  initializeMouseTracking() {
    if (Platform.OS !== 'web') return;

    const handleMouseMove = (event) => {
      const currentTime = Date.now();
      const deltaTime = Math.max(currentTime - this.lastMouseTime, 1);
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      // Optimized velocity calculation with rave-specific scaling
      const velocityX = (deltaX / deltaTime) * 150; // Increased sensitivity
      const velocityY = (deltaY / deltaTime) * 150;
      const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      
      // Enhanced micro-movement detection
      const baseIntensity = Math.min(velocityMagnitude * 0.2, 0.7);
      
      const sensorData = {
        x: Math.max(-5, Math.min(5, velocityX)),
        y: Math.max(-5, Math.min(5, velocityY)),
        z: Math.max(baseIntensity, Math.min(5, velocityMagnitude)),
        timestamp: currentTime,
        source: 'mouse'
      };

      this.emitSensorData(sensorData);
      
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.lastMouseTime = currentTime;
    };

    // Use passive listeners for maximum performance
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    console.log('Mouse tracking initialized with rave optimization');

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }

  // Camera motion detection with optimized performance
  async initializeCameraMotion() {
    if (Platform.OS !== 'web') return null;

    try {
      // Request optimized camera stream for motion detection
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 20, max: 30 } // Higher FPS for more responsive detection
        } 
      });
      
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.cameraStream;
      this.videoElement.muted = true; // Prevent audio feedback
      await this.videoElement.play();
      
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }); // Optimize for frequent reads
      
      const detectMotion = () => {
        if (!this.videoElement || !this.canvas || !this.ctx) return;
        
        this.ctx.drawImage(this.videoElement, 0, 0, 320, 240);
        const currentImageData = this.ctx.getImageData(0, 0, 320, 240);
        
        if (this.previousImageData) {
          let totalDiff = 0;
          const pixels = currentImageData.data;
          const prevPixels = this.previousImageData.data;
          
          // Optimized motion calculation - sample every 8th pixel for performance
          for (let i = 0; i < pixels.length; i += 32) {
            const diff = Math.abs(pixels[i] - prevPixels[i]) + 
                        Math.abs(pixels[i + 1] - prevPixels[i + 1]) + 
                        Math.abs(pixels[i + 2] - prevPixels[i + 2]);
            totalDiff += diff;
          }
          
          const motionIntensity = totalDiff / (320 * 240 * 3 / 32);
          const normalizedMotion = Math.min(motionIntensity / 40, 3); // Increased sensitivity
          
          if (normalizedMotion > 0.05) { // Lower threshold for micro-movements
            const sensorData = {
              x: normalizedMotion * 0.6,
              y: normalizedMotion * 0.4,
              z: normalizedMotion * 1.2,
              timestamp: Date.now(),
              source: 'camera'
            };
            this.emitSensorData(sensorData);
          }
        }
        
        this.previousImageData = currentImageData;
      };
      
      // Higher frequency motion detection for responsiveness
      this.motionInterval = setInterval(detectMotion, 50); // 20 FPS
      
      console.log('Camera motion detection initialized');
      return () => this.cleanupCameraMotion();
      
    } catch (error) {
      console.warn('Camera access denied or not available:', error);
      return null;
    }
  }

  // Keyboard activity detection for additional input
  initializeKeyboardTracking() {
    if (Platform.OS !== 'web') return;

    const handleKeyPress = (event) => {
      const keyIntensity = 0.7 + Math.random() * 0.8; // Increased intensity
      const sensorData = {
        x: (Math.random() - 0.5) * keyIntensity,
        y: (Math.random() - 0.5) * keyIntensity,
        z: keyIntensity,
        timestamp: Date.now(),
        source: 'keyboard'
      };
      this.emitSensorData(sensorData);
    };

    window.addEventListener('keypress', handleKeyPress, { passive: true });
    
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }

  // Optimized sensor decay for natural feel
  initializeSensorDecay() {
    this.decayInterval = setInterval(() => {
      const decayData = {
        x: 0,
        y: 0,
        z: 0.02, // Minimal baseline activity
        timestamp: Date.now(),
        source: 'decay',
        isDecay: true
      };
      this.emitSensorData(decayData);
    }, 30); // Faster decay updates for more responsive feel

    return () => {
      if (this.decayInterval) {
        clearInterval(this.decayInterval);
        this.decayInterval = null;
      }
    };
  }

  // Initialize all web sensors
  async initializeSensors() {
    if (Platform.OS !== 'web') return [];

    const cleanupFunctions = [];

    try {
      // Initialize all sensor systems
      const mouseCleanup = this.initializeMouseTracking();
      if (mouseCleanup) cleanupFunctions.push(mouseCleanup);

      const cameraCleanup = await this.initializeCameraMotion();
      if (cameraCleanup) cleanupFunctions.push(cameraCleanup);

      const keyboardCleanup = this.initializeKeyboardTracking();
      if (keyboardCleanup) cleanupFunctions.push(keyboardCleanup);

      const decayCleanup = this.initializeSensorDecay();
      if (decayCleanup) cleanupFunctions.push(decayCleanup);

      console.log('All web sensors initialized');
      return cleanupFunctions;
    } catch (error) {
      console.warn('Web sensor initialization error:', error);
      return cleanupFunctions;
    }
  }

  // Optimized WAV header creation for minimal processing overhead
  createWavHeader(dataLength, sampleRate = 48000, channels = 2) {
    const byteRate = sampleRate * channels * 2;
    const blockAlign = channels * 2;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // Pre-calculated constants for performance
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLength, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true);
    
    return new Uint8Array(header);
  }

  // Ultra-low latency audio playback
  async playAudioChunk(audioData) {
    if (!this.isInitialized || Platform.OS !== 'web') return;

    try {
      // Optimized base64 to PCM conversion
      const binaryString = atob(audioData);
      const pcmData = new Uint8Array(binaryString.length);
      
      // Use faster loop for conversion
      for (let i = 0; i < binaryString.length; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
      }
      
      // Create optimized WAV data
      const wavHeader = this.createWavHeader(pcmData.length);
      const wavData = new Uint8Array(wavHeader.length + pcmData.length);
      wavData.set(wavHeader, 0);
      wavData.set(pcmData, wavHeader.length);
      
      // Create optimized audio element
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      audio.volume = 0.85; // Optimized volume
      audio.preload = 'auto'; // Preload for faster playback
      
      // Add to queue with optimized cleanup
      this.audioQueue.push(audio);
      
      // More aggressive cleanup for memory efficiency
      if (this.audioQueue.length > 2) {
        const oldAudio = this.audioQueue.shift();
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.src = '';
          URL.revokeObjectURL(oldAudio.src);
        }
      }
      
      // Play with minimal delay
      await audio.play();
      
      console.log('Audio chunk played successfully');
      
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  }

  // Cleanup camera motion detection
  cleanupCameraMotion() {
    if (this.motionInterval) {
      clearInterval(this.motionInterval);
      this.motionInterval = null;
    }
    
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.previousImageData = null;
  }

  // Cleanup all web resources
  cleanup() {
    this.cleanupCameraMotion();
    
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }

    // Cleanup audio queue
    this.audioQueue.forEach(audio => {
      audio.pause();
      audio.src = '';
      URL.revokeObjectURL(audio.src);
    });
    this.audioQueue = [];

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.sensorCallbacks = [];
    this.isInitialized = false;
    
    console.log('Web orchestrator cleanup completed');
  }
}

// Export singleton instance
export const webOrchestrator = new WebOrchestrator(); 