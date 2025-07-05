/**
 * WEB.JS - Web Platform Orchestration Module
 * Handles browser-specific sensor inputs and audio outputs for VibesFlow
 * Optimized for ultra-low latency real-time rave experience
 */

import { Platform } from 'react-native';
import { audioBufferManager } from './buffer.js';

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
    
    // Enhanced sensor tracking for micro-movements
    this.mouseVelocity = { x: 0, y: 0 };
    this.mouseAcceleration = { x: 0, y: 0 };
    this.lastVelocity = { x: 0, y: 0 };
    this.motionSensitivity = 0.01; // Much lower threshold for micro-movements
    this.accelerationThreshold = 0.005;
  }

  // Initialize Web Audio Context with advanced buffer management
  async initializeAudioContext() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

    try {
      console.log('🔧 Initializing advanced audio buffer manager...');
      const success = await audioBufferManager.initialize();
      if (!success) {
        throw new Error('Advanced audio buffer manager initialization failed');
      }

      this.audioContext = audioBufferManager.audioContext;
      
      console.log('🎵 Advanced Web Audio Context initialized with buffer management');
      console.log(`   Sample Rate: ${this.audioContext.sampleRate}Hz`);
      console.log(`   Base Latency: ${(this.audioContext.baseLatency * 1000).toFixed(1)}ms`);
      console.log(`   Buffer Manager Status:`, audioBufferManager.getStatus());
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Advanced Web Audio Context init failed:', error);
      
      // Fallback to basic audio context
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'interactive',
          sampleRate: 48000,
        });
        
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        console.log('Fallback audio context initialized');
        this.isInitialized = true;
        return true;
      } catch (fallbackError) {
        console.error('All audio initialization methods failed:', fallbackError);
        return false;
      }
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

  // Enhanced mouse tracking with micro-movement and acceleration detection
  initializeMouseTracking() {
    if (Platform.OS !== 'web') return;

    const handleMouseMove = (event) => {
      const currentTime = Date.now();
      const deltaTime = Math.max(currentTime - this.lastMouseTime, 1);
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      // Calculate velocity (pixels per millisecond)
      const velocityX = deltaX / deltaTime;
      const velocityY = deltaY / deltaTime;
      
      // Calculate acceleration
      const accelX = (velocityX - this.lastVelocity.x) / deltaTime;
      const accelY = (velocityY - this.lastVelocity.y) / deltaTime;
      
      // Normalize movement relative to screen size with enhanced sensitivity
      const normalizedX = deltaX / window.innerWidth;
      const normalizedY = deltaY / window.innerHeight;
      
      // Apply micro-movement amplification
      const amplificationFactor = 5.0; // Significantly amplify subtle movements
      const amplifiedX = normalizedX * amplificationFactor;
      const amplifiedY = normalizedY * amplificationFactor;
      
      // Enhanced motion detection
      const motionMagnitude = Math.sqrt(amplifiedX ** 2 + amplifiedY ** 2);
      const accelMagnitude = Math.sqrt(accelX ** 2 + accelY ** 2);
      const isSubtleMotion = motionMagnitude > this.motionSensitivity;
      const isAccelerating = accelMagnitude > this.accelerationThreshold;
      
      // Adaptive sensitivity - more responsive for micro-movements
      const responseFactor = isSubtleMotion || isAccelerating ? 2.0 : 1.0;
      const finalX = amplifiedX * responseFactor;
      const finalY = amplifiedY * responseFactor;
      const finalZ = motionMagnitude * responseFactor;
      
      // Enhanced sensor data with motion characteristics
      const sensorData = {
        x: Math.max(-8, Math.min(8, finalX)),
        y: Math.max(-8, Math.min(8, finalY)),
        z: Math.max(0.1, Math.min(8, finalZ)),
        velocity: { x: velocityX, y: velocityY },
        acceleration: { x: accelX, y: accelY },
        timestamp: currentTime,
        source: 'mouse-enhanced',
        motionType: isAccelerating ? 'acceleration' : isSubtleMotion ? 'subtle' : 'static',
        intensity: motionMagnitude,
        responseFactor
      };

      this.emitSensorData(sensorData);
      
      // Apply real-time psychedelic effects
      if (audioBufferManager.isInitialized) {
        audioBufferManager.applyPsychedelicEffects(sensorData);
      }
      
      // Update tracking variables
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.lastMouseTime = currentTime;
      this.lastVelocity = { x: velocityX, y: velocityY };
      this.mouseVelocity = { x: velocityX, y: velocityY };
      this.mouseAcceleration = { x: accelX, y: accelY };
    };

    // Use passive listeners for maximum performance
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    console.log('🖱️ Enhanced mouse tracking initialized with micro-movement detection');
    console.log(`   Motion sensitivity: ${this.motionSensitivity}`);
    console.log(`   Acceleration threshold: ${this.accelerationThreshold}`);

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
          const normalizedMotion = Math.min(motionIntensity / 20, 5); // Doubled sensitivity
          
          if (normalizedMotion > 0.02) { // Much lower threshold for micro-movements
            // Enhanced motion data with directional analysis
            const motionVector = this.analyzeMotionDirection(currentImageData, this.previousImageData);
            
            const sensorData = {
              x: normalizedMotion * 0.8 + motionVector.x,
              y: normalizedMotion * 0.6 + motionVector.y,
              z: normalizedMotion * 1.5,
              motionDirection: motionVector,
              intensity: normalizedMotion,
              timestamp: Date.now(),
              source: 'camera-enhanced'
            };
            
            this.emitSensorData(sensorData);
            
            // Apply camera-based effects
            if (audioBufferManager.isInitialized) {
              audioBufferManager.applyPsychedelicEffects(sensorData);
            }
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

  // Ultra-low latency audio playback with advanced buffering
  async playAudioChunk(audioData) {
    if (!this.isInitialized || Platform.OS !== 'web') return false;

    try {
      // Use advanced audio buffer manager for seamless playback
      if (audioBufferManager.isInitialized) {
        const success = await audioBufferManager.queueAudioChunk(audioData);
        if (success) {
          console.log('🎵 Audio chunk queued successfully with advanced buffering');
          return true;
        }
        console.warn('Advanced buffer manager failed, falling back to basic playback');
      } else {
        console.warn('Advanced buffer manager not initialized, using fallback playback');
      }

      // Fallback to basic playback if buffer manager fails
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
          URL.revokeObjectURL(audioUrl);
        }
      }
      
      // Play with minimal delay
      await audio.play();
      
      console.log('Audio chunk played with fallback method');
      return true;
      
    } catch (error) {
      console.error('Audio playback failed:', error);
      return false;
    }
  }

  // Analyze motion direction for enhanced camera tracking
  analyzeMotionDirection(currentImageData, previousImageData) {
    try {
      const width = currentImageData.width;
      const height = currentImageData.height;
      const currentPixels = currentImageData.data;
      const prevPixels = previousImageData.data;
      
      let leftMotion = 0, rightMotion = 0, upMotion = 0, downMotion = 0;
      
      // Sample motion in different regions
      for (let y = 0; y < height; y += 8) {
        for (let x = 0; x < width; x += 8) {
          const i = (y * width + x) * 4;
          const diff = Math.abs(currentPixels[i] - prevPixels[i]) +
                      Math.abs(currentPixels[i + 1] - prevPixels[i + 1]) +
                      Math.abs(currentPixels[i + 2] - prevPixels[i + 2]);
          
          // Accumulate motion by region
          if (x < width / 2) leftMotion += diff;
          else rightMotion += diff;
          
          if (y < height / 2) upMotion += diff;
          else downMotion += diff;
        }
      }
      
      // Calculate directional bias
      const horizontalBias = (rightMotion - leftMotion) / (width * height);
      const verticalBias = (downMotion - upMotion) / (width * height);
      
      return {
        x: horizontalBias * 0.01, // Scale for subtle directional influence
        y: verticalBias * 0.01,
        magnitude: Math.sqrt(horizontalBias ** 2 + verticalBias ** 2)
      };
    } catch (error) {
      return { x: 0, y: 0, magnitude: 0 };
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