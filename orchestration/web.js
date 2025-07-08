/**
 * WEB.JS - Web Platform Orchestration Module
 * Handles browser-specific sensor inputs and audio outputs for VibesFlow
 * Optimized for ultra-low latency real-time rave experience with ROBUST AUDIO BUFFERING
 */

import { Platform } from 'react-native';


export class WebOrchestrator {
  constructor() {
    this.audioContext = null;
    this.audioBufferQueue = []; // Robust audio buffering system
    this.isPlaying = false;
    this.nextStartTime = 0;
    this.bufferLookAhead = 0.1; // 100ms lookahead for smooth playback
    this.sensorCallbacks = [];
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastMouseTime = Date.now();
    this.mouseSensitivityMultiplier = 8.0; // ULTRA-HIGH sensitivity (doubled from 4.0)
    this.cameraStream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.previousImageData = null;
    this.decayInterval = null;
    this.motionInterval = null;
    this.isInitialized = false;
    this.audioBufferNode = null;
    this.gainNode = null;
    this.masterVolume = 0.85;
    this.crossfadeTime = 0.05; // 50ms crossfade for seamless chunks
    
    // ENHANCED SENSITIVITY TRACKING
    this.microMovementThreshold = 0.002; // Ultra-low threshold for micro-movements
    this.lastMovementTime = Date.now();
    this.movementHistory = []; // Track movement patterns for dynamic sensitivity
    this.adaptiveSensitivity = true;
    this.currentSensitivityBoost = 1.0;
    this.isBuffering = false; // Control audio buffering loop

    // Initialize immediately for web platform
    if (Platform.OS === 'web') {
      this.initializeWebAudio();
    }
  }

  async initializeWebAudio() {
    try {      
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      // Create comprehensive audio processing chain
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.masterVolume;
      this.gainNode.connect(this.audioContext.destination);
      
      // Resume immediately for minimal delay
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Start the buffering system
      this.startAudioBuffering();
      
      // Mark as initialized so audio can be played
      this.isInitialized = true;
      
      console.log('🎧 Ultra-low latency Web Audio Context initialized');
      return true;
    } catch (error) {
      console.error('Web Audio initialization failed:', error);
      return false;
    }
  }

  // ROBUST AUDIO BUFFERING SYSTEM for seamless Lyria chunk playback
  startAudioBuffering() {
    if (this.isBuffering) return; // Already running
    
    this.isBuffering = true;
    
    // Schedule audio chunks for seamless playback
    const scheduleAudio = () => {
      // Check if we should continue buffering and audioContext is available
      if (!this.isBuffering || !this.audioContext) {
        return; // Stop the loop
      }
      
      const currentTime = this.audioContext.currentTime;
      
      // Process queued audio buffers
      while (this.audioBufferQueue.length > 0 && this.nextStartTime < currentTime + this.bufferLookAhead) {
        const audioBuffer = this.audioBufferQueue.shift();
        this.playBufferedAudio(audioBuffer, this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      }
      
      requestAnimationFrame(scheduleAudio);
    };
    
    scheduleAudio();
  }

  // Play buffered audio with crossfading for seamless transitions
  playBufferedAudio(audioBuffer, startTime) {
    const source = this.audioContext.createBufferSource();
    const fadeGain = this.audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(fadeGain);
    fadeGain.connect(this.gainNode);
    
    // Implement crossfading for seamless chunk transitions
    fadeGain.gain.setValueAtTime(0, startTime);
    fadeGain.gain.linearRampToValueAtTime(1, startTime + this.crossfadeTime);
    fadeGain.gain.setValueAtTime(1, startTime + audioBuffer.duration - this.crossfadeTime);
    fadeGain.gain.linearRampToValueAtTime(0, startTime + audioBuffer.duration);
    
    source.start(startTime);
    source.stop(startTime + audioBuffer.duration);
    
    // Cleanup to prevent memory leaks
    source.onended = () => {
      source.disconnect();
      fadeGain.disconnect();
    };
  }

  // ADAPTIVE SENSITIVITY SYSTEM - dynamically adjusts based on usage patterns
  updateAdaptiveSensitivity() {
    const now = Date.now();
    const timeSinceLastMovement = now - this.lastMovementTime;
    
    // Increase sensitivity if user has been inactive (encourages micro-movements)
    if (timeSinceLastMovement > 2000) {
      this.currentSensitivityBoost = Math.min(this.currentSensitivityBoost * 1.1, 3.0);
    } else {
      this.currentSensitivityBoost = Math.max(this.currentSensitivityBoost * 0.98, 1.0);
    }
    
    // Clean old movement history
    this.movementHistory = this.movementHistory.filter(time => now - time < 5000);
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

  // ULTRA-HIGH SENSITIVITY mouse tracking for maximum responsiveness
  initializeMouseTracking() {
    if (Platform.OS !== 'web') return;

    const handleMouseMove = (event) => {
      const currentTime = Date.now();
      const deltaTime = Math.max(currentTime - this.lastMouseTime, 1);
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      // Update adaptive sensitivity
      this.updateAdaptiveSensitivity();
      
      // ULTRA-HIGH sensitivity velocity calculation with adaptive boost
      const sensitivityFactor = this.mouseSensitivityMultiplier * this.currentSensitivityBoost;
      const velocityX = (deltaX / deltaTime) * 300 * sensitivityFactor; // Increased base multiplier
      const velocityY = (deltaY / deltaTime) * 300 * sensitivityFactor;
      const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      
      // MICRO-movement detection with amplified response
      const rawDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const microMovementDetected = rawDistance > this.microMovementThreshold;
      
      if (microMovementDetected) {
        this.lastMovementTime = currentTime;
        this.movementHistory.push(currentTime);
        
        // Enhanced intensity calculation for micro-movements
        const baseIntensity = Math.min(velocityMagnitude * 0.6, 2.0); // Higher response range
        const microBoost = rawDistance < 1.0 ? 2.0 : 1.0; // Boost for tiny movements
      
      const sensorData = {
          x: Math.max(-12, Math.min(12, velocityX * microBoost)), // Extended range
          y: Math.max(-12, Math.min(12, velocityY * microBoost)),
          z: Math.max(baseIntensity * 0.8, Math.min(12, velocityMagnitude * 1.5 * microBoost)),
        timestamp: currentTime,
          source: 'mouse',
          microMovement: rawDistance < 1.0,
          adaptiveBoost: this.currentSensitivityBoost
      };

      this.emitSensorData(sensorData);
      }
      
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.lastMouseTime = currentTime;
    };

    // Use passive listeners for maximum performance + higher frequency sampling
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Additional mouse events for enhanced sensitivity
    window.addEventListener('mousedown', (event) => {
      const intensity = 2.0 + Math.random() * 1.2; // Increased intensity
      this.emitSensorData({
        x: (Math.random() - 0.5) * intensity * 3,
        y: (Math.random() - 0.5) * intensity * 3,
        z: intensity * 2.0,
        timestamp: Date.now(),
        source: 'mouse_click',
        button: event.button
      });
    }, { passive: true });

    // Mouse wheel for additional input variety
    window.addEventListener('wheel', (event) => {
      const wheelIntensity = Math.abs(event.deltaY) / 100;
      this.emitSensorData({
        x: event.deltaX / 100,
        y: wheelIntensity * Math.sign(event.deltaY),
        z: wheelIntensity * 1.5,
        timestamp: Date.now(),
        source: 'mouse_wheel'
      });
    }, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', this.handleMouseDown);
      window.removeEventListener('wheel', this.handleMouseWheel);
    };
  }

  // ULTRA-SENSITIVE camera motion detection with upgraded resolution
  async initializeCameraMotion() {
    if (Platform.OS !== 'web') return null;

    try {
      // Request high-performance camera stream with enhanced settings
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, // Higher resolution for better sensitivity
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 } // Higher FPS for ultra-responsiveness
        } 
      });
      
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.cameraStream;
      this.videoElement.muted = true;
      await this.videoElement.play();
      
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      
      const detectMotion = () => {
        if (!this.videoElement || !this.canvas || !this.ctx) return;
        
        this.ctx.drawImage(this.videoElement, 0, 0, 640, 480);
        const currentImageData = this.ctx.getImageData(0, 0, 640, 480);
        
        if (this.previousImageData) {
          let totalDiff = 0;
          let maxDiff = 0;
          const pixels = currentImageData.data;
          const prevPixels = this.previousImageData.data;
          
          // Enhanced motion calculation with higher sensitivity
          for (let i = 0; i < pixels.length; i += 12) { // Increased sampling density
            const diff = Math.abs(pixels[i] - prevPixels[i]) + 
                        Math.abs(pixels[i + 1] - prevPixels[i + 1]) + 
                        Math.abs(pixels[i + 2] - prevPixels[i + 2]);
            totalDiff += diff;
            maxDiff = Math.max(maxDiff, diff);
          }
          
          const motionIntensity = totalDiff / (640 * 480 * 3 / 12);
          const normalizedMotion = Math.min(motionIntensity / 15, 8); // ULTRA-HIGH sensitivity
          const peakMotion = Math.min(maxDiff / 30, 4); // Peak motion detection
          
          // MICRO-movement detection threshold (lowered from 0.01 to 0.005)
          if (normalizedMotion > 0.005) {
            this.lastMovementTime = Date.now();
            
            const sensorData = {
              x: normalizedMotion * 1.5 * (Math.random() - 0.5),
              y: normalizedMotion * 1.2,
              z: Math.max(normalizedMotion * 3.0, peakMotion * 2.0), // Enhanced Z response
              timestamp: Date.now(),
              source: 'camera',
              motionIntensity: normalizedMotion,
              peakMotion: peakMotion
            };
            this.emitSensorData(sensorData);
          }
        }
        
        this.previousImageData = currentImageData;
      };
      
      // HIGHER FREQUENCY motion detection (increased from 33ms to 25ms)
      this.motionInterval = setInterval(detectMotion, 25); // 40 FPS
      
      return () => this.cleanupCameraMotion();
      
    } catch (error) {
      console.warn('Camera access denied or not available:', error);
      return null;
    }
  }

  // ULTRA-SENSITIVE keyboard activity detection with enhanced key mapping
  initializeKeyboardTracking() {
    if (Platform.OS !== 'web') return;

    const handleKeyEvent = (event, eventType) => {
      // Map different key types to different intensities and patterns
      let keyIntensity = 1.0;
      let xVariation = 0;
      let yVariation = 0;
      let keyType = 'other';
      
      // Enhanced key type mapping with specific musical responses
      if (event.code.startsWith('Key')) {
        // Letter keys - harmonic response with vowel/consonant distinction
        keyType = 'letter';
        const char = event.code.slice(3);
        const isVowel = ['A', 'E', 'I', 'O', 'U'].includes(char);
        keyIntensity = isVowel ? 1.5 + Math.random() * 1.2 : 1.0 + Math.random() * 0.8;
        xVariation = (event.code.charCodeAt(3) - 65) / 26 * 6 - 3; // A-Z mapped to -3 to +3
        yVariation = isVowel ? 0.5 + Math.random() * 0.8 : Math.random() * 0.4;
      } else if (event.code.startsWith('Digit')) {
        // Number keys - rhythmic response with mathematical harmonics
        keyType = 'number';
        const digit = parseInt(event.code.slice(-1));
        keyIntensity = 1.8 + Math.random() * 1.0;
        xVariation = Math.sin(digit * Math.PI / 5) * 3; // Harmonic mapping
        yVariation = digit / 10 * 5 - 2.5; // 0-9 mapped to -2.5 to +2.5
      } else if (event.code === 'Space') {
        // Spacebar - massive energy burst with chaos
        keyType = 'space';
        keyIntensity = 3.5 + Math.random() * 1.5;
        xVariation = (Math.random() - 0.5) * 8;
        yVariation = (Math.random() - 0.5) * 8;
      } else if (event.code.startsWith('Arrow')) {
        // Arrow keys - directional mapping
        keyType = 'arrow';
        keyIntensity = 1.4 + Math.random() * 0.8;
        switch (event.code) {
          case 'ArrowUp': yVariation = 2.5; break;
          case 'ArrowDown': yVariation = -2.5; break;
          case 'ArrowLeft': xVariation = -2.5; break;
          case 'ArrowRight': xVariation = 2.5; break;
        }
      } else if (['Enter', 'Tab', 'Escape', 'Backspace'].includes(event.code)) {
        // Special keys - punctuation in music
        keyType = 'special';
        keyIntensity = 2.0 + Math.random() * 1.0;
        xVariation = (Math.random() - 0.5) * 4;
        yVariation = (Math.random() - 0.5) * 4;
      } else {
        // Other keys - moderate response
        keyType = 'other';
        keyIntensity = 1.0 + Math.random() * 0.8;
        xVariation = (Math.random() - 0.5) * 3;
        yVariation = (Math.random() - 0.5) * 3;
      }
      
      // Increase intensity for key down vs key up
      if (eventType === 'keydown') {
        keyIntensity *= 1.6; // Increased from 1.4
      }
      
      const sensorData = {
        x: xVariation,
        y: yVariation,
        z: keyIntensity,
        timestamp: Date.now(),
        source: 'keyboard',
        keyCode: event.code,
        keyType: keyType,
        eventType: eventType
      };
      this.emitSensorData(sensorData);
    };

    window.addEventListener('keydown', (e) => handleKeyEvent(e, 'keydown'), { passive: true });
    window.addEventListener('keyup', (e) => handleKeyEvent(e, 'keyup'), { passive: true });
        
    return () => {
      window.removeEventListener('keydown', handleKeyEvent);
      window.removeEventListener('keyup', handleKeyEvent);
    };
  }

  // ENHANCED sensor decay with variable energy and micro-variations
  initializeSensorDecay() {
    this.decayInterval = setInterval(() => {
      // More varied decay patterns to prevent monotony
      const time = Date.now();
      const decayVariation = Math.sin(time / 1800) * 0.03 + Math.cos(time / 2200) * 0.02;
      const microVariation = Math.sin(time / 500) * 0.005; // High-frequency micro-variations
      
      const decayData = {
        x: decayVariation * (Math.random() - 0.5) + microVariation,
        y: decayVariation * (Math.random() - 0.5) + microVariation,
        z: 0.04 + Math.abs(decayVariation) + Math.abs(microVariation), // Variable baseline activity
        timestamp: time,
        source: 'decay',
        isDecay: true,
        decayPattern: 'enhanced'
      };
      this.emitSensorData(decayData);
    }, 20); // Faster decay updates (was 25ms)

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

      console.log('🚀 All web sensors initialized with ultra-high sensitivity');
      return cleanupFunctions;
    } catch (error) {
      console.warn('Web sensor initialization error:', error);
      return cleanupFunctions;
    }
  }

  // OPTIMIZED real-time audio chunk playback with robust buffering
  async playAudioChunk(audioData) {
    if (!this.isInitialized || Platform.OS !== 'web') return;

    try {
      let arrayBuffer;
      
      // Handle different audio data formats from Lyria
      if (typeof audioData === 'string') {
        // Base64 encoded audio data
        try {
          const binaryString = atob(audioData);
          arrayBuffer = new ArrayBuffer(binaryString.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          
      for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
        } catch (base64Error) {
          console.warn('Failed to decode base64 audio:', base64Error);
          return;
        }
      } else if (audioData instanceof ArrayBuffer) {
        // Already an ArrayBuffer
        arrayBuffer = audioData;
      } else if (audioData instanceof Uint8Array) {
        // Uint8Array - convert to ArrayBuffer
        arrayBuffer = audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength);
      } else if (audioData?.buffer instanceof ArrayBuffer) {
        // Has buffer property (like DataView)
        arrayBuffer = audioData.buffer;
      } else {
        console.warn('Unknown audio data format:', typeof audioData, audioData);
        return;
      }
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.warn('Empty audio buffer received');
        return;
      }
            
      // Lyria sends RAW 16-bit PCM audio data, NOT encoded audio
      // Format: 48kHz, 2 channels (stereo), 16-bit signed integers
      const audioBuffer = this.createAudioBufferFromPCM(arrayBuffer);
      
      if (audioBuffer) {
        // Add to buffering queue for seamless playback
        this.audioBufferQueue.push(audioBuffer);
        
        // Initialize nextStartTime if this is the first chunk
        if (this.nextStartTime === 0) {
          this.nextStartTime = this.audioContext.currentTime + 0.1; // 100ms initial delay
        }        
      }
      
    } catch (error) {
      console.error('Audio chunk processing failed:', error);
    }
  }

  // Create AudioBuffer from Lyria's raw 16-bit PCM data
  createAudioBufferFromPCM(rawPCMData) {
    try {
      const sampleRate = 48000;  // 48kHz - Lyria's output format
      const channels = 2;        // Stereo
      const bytesPerSample = 2;  // 16-bit = 2 bytes per sample
      
      // Calculate frame count (samples per channel)
      const frameCount = rawPCMData.byteLength / (channels * bytesPerSample);
      
      // Create AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
      
      // Convert raw 16-bit PCM to Float32 format for Web Audio API
      const dataView = new DataView(rawPCMData);
      
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        
        for (let i = 0; i < frameCount; i++) {
          // Read 16-bit signed integer (little endian)
          const offset = (i * channels + channel) * bytesPerSample;
          const sample16 = dataView.getInt16(offset, true); // true = little endian
          
          // Convert to Float32 range [-1, 1]
          channelData[i] = sample16 / 32768.0;
        }
      }
      
      return audioBuffer;
    } catch (error) {
      console.error('Failed to create AudioBuffer from raw PCM:', error);
      return null;
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

    // Stop audio buffering loop
    this.isBuffering = false;

    // Cleanup audio queue
    this.audioBufferQueue.forEach(audioBuffer => {
      if (audioBuffer && typeof audioBuffer.disconnect === 'function') {
        audioBuffer.disconnect();
      }
    });
    this.audioBufferQueue = [];

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.sensorCallbacks = [];
    this.isInitialized = false;    
  }
}

// Export singleton instance
export const webOrchestrator = new WebOrchestrator(); 