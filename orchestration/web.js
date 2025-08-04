/**
 * WEB.JS - Web Platform Orchestration Module
 * Handles browser-specific sensor inputs and audio outputs for VibesFlow
 * Optimized for ultra-low latency real-time rave experience with robust audio buffering
 * 
 */

import { Platform } from 'react-native';
import { logSensorData, logAudioChunk, logPerformance, logInfo, logWarning, logError } from './logger';

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
    this.mouseSensitivityMultiplier = 8.0; // ULTRA-HIGH sensitivity
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
    this.lastDeviceMotion = null; // Store last device motion data for rich sensor enhancement

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
      
      logInfo('Ultra-low latency Web Audio Context initialized for server audio');
      return true;
    } catch (error) {
      logError('Web Audio initialization failed', { error: error.message, stack: error.stack });
      return false;
    }
  }

  // Robust audio buffering system for seamless server audio chunk playback
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
        if (audioBuffer && audioBuffer.duration) {
          this.playBufferedAudio(audioBuffer, this.nextStartTime);
          this.nextStartTime += audioBuffer.duration;
        } else {
          logWarning('Invalid audio buffer in queue, skipping', { queueLength: this.audioBufferQueue.length });
        }
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

  // Emit sensor data to all registered callbacks with ULTRA-LOW latency
  emitSensorData(sensorData) {
    const now = Date.now();
    this.lastMovementTime = now;
    
    // Update adaptive sensitivity
    this.updateAdaptiveSensitivity();

    // Add movement to history
    this.movementHistory.push(now);

    // ENHANCE sensor data with additional rich features for backend analysis
    const enhancedSensorData = {
      ...sensorData,
      // Ensure all backend-expected fields are present
      pressure: sensorData.pressure || 0.5,
      tiltX: sensorData.tiltX || 0,
      tiltY: sensorData.tiltY || 0,
      force: sensorData.force || 0,
      // Add device motion if available
      deviceMotion: this.lastDeviceMotion || null,
      // Rich movement context
      movementHistory: this.movementHistory.slice(-5), // Last 5 movement timestamps
      sensitivityBoost: this.currentSensitivityBoost,
      adaptiveSensitivity: this.adaptiveSensitivity
    };

    // Log rich sensor data using throttled logger
    logSensorData({
      source: enhancedSensorData.source,
      x: enhancedSensorData.x?.toFixed(3),
      y: enhancedSensorData.y?.toFixed(3), 
      z: enhancedSensorData.z?.toFixed(3),
      pressure: enhancedSensorData.pressure,
      tiltX: enhancedSensorData.tiltX,
      force: enhancedSensorData.force,
      velocity: enhancedSensorData.velocity,
      acceleration: enhancedSensorData.acceleration,
      hasFrequencyData: !!enhancedSensorData.frequencyData
    });

    // ULTRA-LOW LATENCY sensor callback emission
    this.sensorCallbacks.forEach(callback => {
      try {
        callback(enhancedSensorData);
      } catch (error) {
        logWarning('Web sensor callback error', { error: error.message, callback: callback.name });
      }
    });
  }

  // ULTRA-SENSITIVE mouse tracking for IMMEDIATE music response
  initializeMouseTracking() {
    if (Platform.OS !== 'web') return null;

    const handleMouseMove = (e) => {
      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastMouseTime;
      
      if (deltaTime > 0) {
        // Calculate ULTRA-ENHANCED velocity and acceleration with sensitivity boost
        const deltaX = (e.clientX - this.lastMouseX) * this.currentSensitivityBoost;
        const deltaY = (e.clientY - this.lastMouseY) * this.currentSensitivityBoost;
        const velocity = Math.sqrt(deltaX ** 2 + deltaY ** 2) / deltaTime;
        const normalizedVelocity = Math.min(velocity * this.mouseSensitivityMultiplier, 10);

        // Calculate MICRO-MOVEMENT detection
        const microMovement = Math.sqrt(deltaX ** 2 + deltaY ** 2);
        const isMicroMovement = microMovement > this.microMovementThreshold;

        // Exponential amplification for sensitivity
        const amplifiedVelocity = normalizedVelocity ** 1.3;

              // Enhanced sensor data
      const acceleration = velocity - this.lastVelocity || 0;
      const jerk = acceleration - this.lastAcceleration || 0;
      
      const sensorData = {
        x: deltaX * 0.08 * this.mouseSensitivityMultiplier,
        y: deltaY * 0.08 * this.mouseSensitivityMultiplier,
        z: amplifiedVelocity * 0.15,
        timestamp: currentTime,
        source: 'mouse',
        velocity: normalizedVelocity,
        acceleration: acceleration,
        jerk: jerk,
        pressure: e.pressure || 0.5, // Pointer pressure API
        tiltX: e.tiltX || 0, // Stylus tilt
        tiltY: e.tiltY || 0,
        twist: e.twist || 0, // Stylus rotation
        pointerType: e.pointerType || 'mouse',
        isMicroMovement,
        sensitivityBoost: this.currentSensitivityBoost,
        screenPosition: { x: e.screenX, y: e.screenY },
        clientPosition: { x: e.clientX, y: e.clientY }
      };
      
      this.lastVelocity = velocity;
      this.lastAcceleration = acceleration;

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.lastMouseTime = currentTime;

        this.emitSensorData(sensorData);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }

  // ENHANCED camera motion detection for immersive visual-audio feedback
  async initializeCameraMotion() {
    if (Platform.OS !== 'web') return null;

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30 }
        }
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.cameraStream;
      this.videoElement.play();

      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.ctx = this.canvas.getContext('2d');

      this.motionInterval = setInterval(() => {
        if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
          this.ctx.drawImage(this.videoElement, 0, 0, 320, 240);
          const currentImageData = this.ctx.getImageData(0, 0, 320, 240);

          if (this.previousImageData) {
            let totalDiff = 0;
            const pixels = currentImageData.data.length;

            // Enhanced motion detection algorithm
            for (let i = 0; i < pixels; i += 16) { // Sample every 4th pixel for performance
              const diff = Math.abs(currentImageData.data[i] - this.previousImageData.data[i]);
              totalDiff += diff;
            }

            const averageDiff = totalDiff / (pixels / 16);
            const motionIntensity = Math.min(averageDiff / 30, 5); // Enhanced sensitivity range

            // ULTRA-SENSITIVE camera motion with enhanced responsiveness
            const sensorData = {
              x: (Math.random() - 0.5) * motionIntensity * 0.6,
              y: (Math.random() - 0.5) * motionIntensity * 0.6,
              z: motionIntensity * 0.8, // Enhanced camera Z-axis sensitivity
              timestamp: Date.now(),
              source: 'camera',
              motionIntensity: motionIntensity,
              isSignificantMotion: motionIntensity > 0.3
            };

            this.emitSensorData(sensorData);
          }

          this.previousImageData = currentImageData;
        }
      }, 33); // ~30 FPS for responsive camera motion

      return () => {
        this.cleanupCameraMotion();
      };
    } catch (error) {
      logWarning('Camera motion initialization failed', { error: error.message });
      return null;
    }
  }

  // ULTRA-RESPONSIVE keyboard tracking for rhythmic input
  initializeKeyboardTracking() {
    if (Platform.OS !== 'web') return null;

    let activeKeys = new Set();
    let lastKeyTime = Date.now();
    let keyVelocityAccumulator = 0;

    const handleKeyEvent = (e, eventType) => {
      const currentTime = Date.now();
      const timeDelta = currentTime - lastKeyTime;
      const keyCode = e.code || e.key;

      if (eventType === 'keydown' && !activeKeys.has(keyCode)) {
        activeKeys.add(keyCode);
        keyVelocityAccumulator += 1.0;
      } else if (eventType === 'keyup') {
        activeKeys.delete(keyCode);
      }

      // ULTRA-SENSITIVE keyboard response with rhythm detection
      const keyVelocity = Math.min(keyVelocityAccumulator / Math.max(timeDelta, 1), 15);
      const rhythmDetection = activeKeys.size > 1 ? 1.5 : 1.0; // Chord detection multiplier
      
      // Decay velocity accumulator
      keyVelocityAccumulator *= 0.85;

      const sensorData = {
        x: (Math.random() - 0.5) * keyVelocity * 0.3,
        y: (activeKeys.size / 5) * 0.4, // Key combination influence
        z: keyVelocity * 0.6 * rhythmDetection, // Enhanced keyboard Z-axis with rhythm
        timestamp: currentTime,
        source: 'keyboard',
        activeKeys: activeKeys.size,
        keyVelocity: keyVelocity,
        isChord: activeKeys.size > 1,
        timeDelta: timeDelta
      };
      
      lastKeyTime = currentTime;
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
    }, 20); // Faster decay updates

    return () => {
      if (this.decayInterval) {
        clearInterval(this.decayInterval);
        this.decayInterval = null;
      }
    };
  }

  // DEVICE MOTION & ORIENTATION SENSORS
  initializeDeviceMotion() {
    if (Platform.OS !== 'web' || !window.DeviceMotionEvent) return null;

    const handleDeviceMotion = (event) => {
      const acceleration = event.acceleration || {};
      const accelerationGravity = event.accelerationIncludingGravity || {};
      const rotationRate = event.rotationRate || {};

      const sensorData = {
        x: (acceleration.x || 0) * 0.1,
        y: (acceleration.y || 0) * 0.1,
        z: (acceleration.z || 0) * 0.1,
        timestamp: Date.now(),
        source: 'deviceMotion',
        acceleration: {
          x: acceleration.x || 0,
          y: acceleration.y || 0,
          z: acceleration.z || 0
        },
        accelerationGravity: {
          x: accelerationGravity.x || 0,
          y: accelerationGravity.y || 0,
          z: accelerationGravity.z || 0
        },
        rotationRate: {
          alpha: rotationRate.alpha || 0,
          beta: rotationRate.beta || 0,
          gamma: rotationRate.gamma || 0
        },
        interval: event.interval || 16
      };

      // Store device motion data for enhanced sensor reporting
      this.lastDeviceMotion = {
        acceleration,
        accelerationGravity,
        rotationRate,
        timestamp: Date.now()
      };

      this.emitSensorData(sensorData);
    };

    window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }

  // DEVICE ORIENTATION SENSORS
  initializeDeviceOrientation() {
    if (Platform.OS !== 'web' || !window.DeviceOrientationEvent) return null;

    const handleDeviceOrientation = (event) => {
      const sensorData = {
        x: (event.gamma || 0) * 0.01, // Left-right tilt
        y: (event.beta || 0) * 0.01,  // Front-back tilt
        z: (event.alpha || 0) * 0.005, // Compass heading
        timestamp: Date.now(),
        source: 'deviceOrientation',
        alpha: event.alpha || 0, // Compass (0-360)
        beta: event.beta || 0,   // Front-back (-180 to 180)
        gamma: event.gamma || 0, // Left-right (-90 to 90)
        absolute: event.absolute || false
      };

      this.emitSensorData(sensorData);
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }

  // TOUCH PRESSURE & FORCE SENSORS
  initializeTouchSensors() {
    if (Platform.OS !== 'web') return null;

    const handleTouch = (event) => {
      Array.from(event.touches || event.changedTouches).forEach(touch => {
        const sensorData = {
          x: (touch.clientX / window.innerWidth - 0.5) * 2,
          y: (touch.clientY / window.innerHeight - 0.5) * 2,
          z: (touch.force || touch.pressure || 0.5) * 2,
          timestamp: Date.now(),
          source: 'touch',
          touchId: touch.identifier,
          force: touch.force || 0,
          pressure: touch.pressure || 0.5,
          radiusX: touch.radiusX || 0,
          radiusY: touch.radiusY || 0,
          rotationAngle: touch.rotationAngle || 0,
          touchType: touch.touchType || 'direct'
        };

        this.emitSensorData(sensorData);
      });
    };

    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('touchend', handleTouch, { passive: true });
    
    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleTouch);
    };
  }

  // AUDIO INPUT LEVEL DETECTION
  async initializeAudioSensors() {
    if (Platform.OS !== 'web') return null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      microphone.connect(analyser);

      const updateAudioData = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate audio level and frequency analysis
        const sum = dataArray.reduce((a, value) => a + value, 0);
        const average = sum / bufferLength;
        const normalized = average / 255;
        
        // Frequency band analysis
        const bass = dataArray.slice(0, 4).reduce((a, v) => a + v, 0) / 4 / 255;
        const mid = dataArray.slice(4, 32).reduce((a, v) => a + v, 0) / 28 / 255;
        const treble = dataArray.slice(32, 64).reduce((a, v) => a + v, 0) / 32 / 255;

        const sensorData = {
          x: (bass - 0.5) * 2,
          y: (mid - 0.5) * 2,
          z: normalized * 3,
          timestamp: Date.now(),
          source: 'audio',
          level: normalized,
          bass: bass,
          mid: mid,
          treble: treble,
          frequencyData: Array.from(dataArray.slice(0, 32)) // First 32 frequency bins
        };

        this.emitSensorData(sensorData);
        
        if (this.audioAnalysisActive) {
          requestAnimationFrame(updateAudioData);
        }
      };

      this.audioAnalysisActive = true;
      updateAudioData();

      return () => {
        this.audioAnalysisActive = false;
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };
    } catch (error) {
      logWarning('Audio sensor initialization failed', { error: error.message });
      return null;
    }
  }

  // SCROLL & GESTURE SENSORS
  initializeScrollSensors() {
    if (Platform.OS !== 'web') return null;

    let lastScrollTime = Date.now();
    let scrollVelocity = 0;
    let scrollAcceleration = 0;

    const handleScroll = (event) => {
      const currentTime = Date.now();
      const timeDelta = currentTime - lastScrollTime;
      const scrollDelta = Math.abs(event.deltaY || event.deltaX || 0);
      
      const currentVelocity = scrollDelta / Math.max(timeDelta, 1);
      scrollAcceleration = currentVelocity - scrollVelocity;
      scrollVelocity = currentVelocity;

      const sensorData = {
        x: (event.deltaX || 0) * 0.01,
        y: (event.deltaY || 0) * 0.01,
        z: Math.min(scrollVelocity * 0.1, 2),
        timestamp: currentTime,
        source: 'scroll',
        velocity: scrollVelocity,
        acceleration: scrollAcceleration,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      };

      this.emitSensorData(sensorData);
      lastScrollTime = currentTime;
    };

    window.addEventListener('wheel', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('wheel', handleScroll);
    };
  }

  // Initialize all web sensors including 2025 modern APIs
  async initializeSensors() {
    if (Platform.OS !== 'web') return [];

    const cleanupFunctions = [];

    try {
      // Original sensors
      const mouseCleanup = this.initializeMouseTracking();
      if (mouseCleanup) cleanupFunctions.push(mouseCleanup);

      const cameraCleanup = await this.initializeCameraMotion();
      if (cameraCleanup) cleanupFunctions.push(cameraCleanup);

      const keyboardCleanup = this.initializeKeyboardTracking();
      if (keyboardCleanup) cleanupFunctions.push(keyboardCleanup);

      const decayCleanup = this.initializeSensorDecay();
      if (decayCleanup) cleanupFunctions.push(decayCleanup);

      // 2025 Modern sensor APIs
      const deviceMotionCleanup = this.initializeDeviceMotion();
      if (deviceMotionCleanup) cleanupFunctions.push(deviceMotionCleanup);

      const deviceOrientationCleanup = this.initializeDeviceOrientation();
      if (deviceOrientationCleanup) cleanupFunctions.push(deviceOrientationCleanup);

      const touchCleanup = this.initializeTouchSensors();
      if (touchCleanup) cleanupFunctions.push(touchCleanup);

      const audioCleanup = await this.initializeAudioSensors();
      if (audioCleanup) cleanupFunctions.push(audioCleanup);

      const scrollCleanup = this.initializeScrollSensors();
      if (scrollCleanup) cleanupFunctions.push(scrollCleanup);

      logInfo('All 2025 web sensors initialized with ultra-high sensitivity', { sensorsCount: cleanupFunctions.length });
      return cleanupFunctions;
    } catch (error) {
      logWarning('Web sensor initialization error', { error: error.message });
      return cleanupFunctions;
    }
  }

  // Real-time audio chunk playback
  async playAudioChunk(audioData) {
    if (!this.isInitialized || Platform.OS !== 'web') return;

    try {
      let arrayBuffer;
      
      // Handle different audio data formats from server
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
          logWarning('Failed to decode base64 audio', { error: base64Error.message });
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
      } else if (audioData?.data) {
        // Server might wrap audio data in a data property
        const wrappedData = audioData.data;
        if (typeof wrappedData === 'string') {
          // Base64 encoded
          try {
            const binaryString = atob(wrappedData);
            arrayBuffer = new ArrayBuffer(binaryString.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            for (let i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
          } catch (base64Error) {
            logWarning('Failed to decode wrapped base64 audio', { error: base64Error.message });
            return;
          }
        } else if (wrappedData instanceof ArrayBuffer) {
          arrayBuffer = wrappedData;
        } else if (wrappedData instanceof Uint8Array) {
          arrayBuffer = wrappedData.buffer.slice(wrappedData.byteOffset, wrappedData.byteOffset + wrappedData.byteLength);
        } else {
          logWarning('Unknown wrapped audio data format', { type: typeof wrappedData, hasData: !!wrappedData });
          return;
        }
      } else {
        logWarning('Unknown audio data format from server', { type: typeof audioData, hasData: !!audioData });
        return;
      }
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        logWarning('Empty audio buffer received from server', { byteLength: arrayBuffer?.byteLength || 0 });
        return;
      }
            
      // Server sends RAW 16-bit PCM audio data, NOT encoded audio
      // Format: 48kHz, 2 channels (stereo), 16-bit signed integers
      const audioBuffer = await this.createAudioBufferFromServerData(arrayBuffer);
      
      if (audioBuffer) {
        // Add to buffering queue for seamless playback
        this.audioBufferQueue.push(audioBuffer);
        
        // Initialize nextStartTime if this is the first chunk
        if (this.nextStartTime === 0) {
          this.nextStartTime = this.audioContext.currentTime + 0.1; // 100ms initial delay
        }        
      } else {
        logWarning('Failed to create AudioBuffer from received data', { arrayBufferSize: arrayBuffer?.byteLength || 0 });
      }
      
    } catch (error) {
      logError('Server audio chunk processing failed', { error: error.message, stack: error.stack });
    }
  }

  // Create AudioBuffer from server-processed audio data
  async createAudioBufferFromServerData(serverAudioData) {
    try {
      const sampleRate = 48000;  // 48kHz - Lyria's output format
      const channels = 2;        // Stereo
      const bytesPerSample = 2;  // 16-bit = 2 bytes per sample
      
      // Calculate frame count (samples per channel)
      const frameCount = serverAudioData.byteLength / (channels * bytesPerSample);
      
      // Create AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(channels, frameCount, sampleRate);
      
      // Convert raw 16-bit PCM to Float32 format for Web Audio API
      const dataView = new DataView(serverAudioData);
      
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
      logError('Failed to create AudioBuffer from server PCM data', { error: error.message, dataSize: serverAudioData?.byteLength || 0 });
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
    logInfo('Web orchestrator cleanup starting');
    
    try {
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
      
      logInfo('Web orchestrator cleanup completed');
    } catch (error) {
      logError('Error during web cleanup', { error: error.message, stack: error.stack });
    }
  }
}

// Export singleton instance
export const webOrchestrator = new WebOrchestrator(); 