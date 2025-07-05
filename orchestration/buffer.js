/**
 * AUDIO-BUFFER-MANAGER.JS - Advanced Web Audio Buffer Management
 * Implements seamless audio playback with cross-fading and buffer optimization
 * Eliminates micro-interruptions for ultra-smooth rave experience
 */

export class AudioBufferManager {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.crossfadeGainNode = null;
    this.bufferQueue = [];
    this.activeSourceNodes = [];
    this.nextStartTime = 0;
    this.bufferSize = 4096;
    this.crossfadeDuration = 0.1; // 100ms crossfade
    this.maxBufferCount = 8; // Keep up to 8 buffers for smooth playback
    this.isInitialized = false;
    this.currentVolume = 0.85;
    this.sampleRate = 48000;
    this.channels = 2;
    
    // Performance optimizations
    this.enableCrossfading = true;
    this.enablePreloading = true;
    this.bufferLookahead = 0.1; // 100ms lookahead
    
    // Audio processing effects
    this.enableEffects = true;
    this.effectsChain = {
      compressor: null,
      filter: null,
      delay: null,
      reverb: null
    };
    
    console.log('🎵 Advanced Audio Buffer Manager initialized');
  }

  // Initialize Web Audio Context with optimal settings
  async initialize() {
    if (this.isInitialized || typeof window === 'undefined') return false;

    try {
      // Create optimized AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: this.sampleRate,
      });

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create main gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.currentVolume;

      // Create crossfade gain node for smooth transitions
      this.crossfadeGainNode = this.audioContext.createGain();
      this.crossfadeGainNode.gain.value = 1.0;

      // Initialize effects chain
      if (this.enableEffects) {
        this.initializeEffectsChain();
      }

      // Connect audio graph
      this.connectAudioGraph();

      this.isInitialized = true;
      this.nextStartTime = this.audioContext.currentTime;

      console.log('🎵 Audio Buffer Manager initialized successfully');
      console.log(`   Sample Rate: ${this.audioContext.sampleRate}Hz`);
      console.log(`   Latency: ${(this.audioContext.baseLatency * 1000).toFixed(1)}ms`);
      
      return true;
    } catch (error) {
      console.error('Audio Buffer Manager initialization failed:', error);
      return false;
    }
  }

  // Initialize advanced effects chain for psychedelic sounds
  initializeEffectsChain() {
    try {
      // Dynamic range compressor for consistent levels
      this.effectsChain.compressor = this.audioContext.createDynamicsCompressor();
      this.effectsChain.compressor.threshold.value = -24;
      this.effectsChain.compressor.knee.value = 30;
      this.effectsChain.compressor.ratio.value = 12;
      this.effectsChain.compressor.attack.value = 0.003;
      this.effectsChain.compressor.release.value = 0.25;

      // Multi-stage filtering for complex frequency shaping
      this.effectsChain.lowPass = this.audioContext.createBiquadFilter();
      this.effectsChain.lowPass.type = 'lowpass';
      this.effectsChain.lowPass.frequency.value = 20000;
      this.effectsChain.lowPass.Q.value = 1;

      this.effectsChain.highPass = this.audioContext.createBiquadFilter();
      this.effectsChain.highPass.type = 'highpass';
      this.effectsChain.highPass.frequency.value = 20;
      this.effectsChain.highPass.Q.value = 0.7;

      this.effectsChain.bandPass = this.audioContext.createBiquadFilter();
      this.effectsChain.bandPass.type = 'bandpass';
      this.effectsChain.bandPass.frequency.value = 1000;
      this.effectsChain.bandPass.Q.value = 5;

      // Multi-tap delay for psychedelic echoes
      this.effectsChain.delay1 = this.audioContext.createDelay(1.0);
      this.effectsChain.delay1.delayTime.value = 0.125; // 1/8 note at 120 BPM

      this.effectsChain.delay2 = this.audioContext.createDelay(1.0);
      this.effectsChain.delay2.delayTime.value = 0.25; // 1/4 note at 120 BPM

      this.effectsChain.delay3 = this.audioContext.createDelay(1.0);
      this.effectsChain.delay3.delayTime.value = 0.375; // 3/8 note at 120 BPM

      // Delay feedback controls
      this.effectsChain.delayFeedback1 = this.audioContext.createGain();
      this.effectsChain.delayFeedback1.gain.value = 0.3;

      this.effectsChain.delayFeedback2 = this.audioContext.createGain();
      this.effectsChain.delayFeedback2.gain.value = 0.2;

      this.effectsChain.delayFeedback3 = this.audioContext.createGain();
      this.effectsChain.delayFeedback3.gain.value = 0.15;

      // Modulation sources for psychedelic movement
      this.effectsChain.lfo1 = this.audioContext.createOscillator();
      this.effectsChain.lfo1.type = 'sine';
      this.effectsChain.lfo1.frequency.value = 0.5; // 0.5 Hz modulation

      this.effectsChain.lfo2 = this.audioContext.createOscillator();
      this.effectsChain.lfo2.type = 'triangle';
      this.effectsChain.lfo2.frequency.value = 0.3; // 0.3 Hz modulation

      this.effectsChain.lfoGain1 = this.audioContext.createGain();
      this.effectsChain.lfoGain1.gain.value = 500; // Modulation depth for filter

      this.effectsChain.lfoGain2 = this.audioContext.createGain();
      this.effectsChain.lfoGain2.gain.value = 0.1; // Modulation depth for delay

      // Granular-style effects
      this.effectsChain.granularDelay = this.audioContext.createDelay(0.1);
      this.effectsChain.granularDelay.delayTime.value = 0.01; // 10ms for granular effect

      this.effectsChain.granularGain = this.audioContext.createGain();
      this.effectsChain.granularGain.gain.value = 0.0; // Start disabled

      // Convolver for spatial reverb
      this.effectsChain.reverb = this.audioContext.createConvolver();
      this.createAdvancedReverbImpulse();

      // Distortion/saturation using waveshaper
      this.effectsChain.distortion = this.audioContext.createWaveShaper();
      this.createDistortionCurve();

      // Mix controls for effects
      this.effectsChain.dryGain = this.audioContext.createGain();
      this.effectsChain.dryGain.gain.value = 0.7; // 70% dry signal

      this.effectsChain.wetGain = this.audioContext.createGain();
      this.effectsChain.wetGain.gain.value = 0.3; // 30% wet signal

      // Start LFOs
      this.effectsChain.lfo1.start();
      this.effectsChain.lfo2.start();

      console.log('🎛️ Advanced psychedelic effects chain initialized');
    } catch (error) {
      console.warn('Advanced effects chain initialization failed:', error);
      this.enableEffects = false;
    }
  }

  // Create advanced reverb impulse response with psychedelic characteristics
  createAdvancedReverbImpulse() {
    try {
      const length = this.sampleRate * 4; // 4 seconds of reverb
      const impulse = this.audioContext.createBuffer(2, length, this.sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          // Complex decay curve with multiple reflections
          const time = i / this.sampleRate;
          const earlyDecay = Math.pow(1 - time / 1, 3); // Early reflections
          const lateDecay = Math.pow(1 - time / 4, 2); // Late reverberation
          
          // Add some modulation for psychedelic character
          const modulation = 1 + 0.1 * Math.sin(time * 2 * Math.PI * 0.3);
          
          // Generate filtered noise with psychedelic characteristics
          let sample = (Math.random() * 2 - 1) * earlyDecay * 0.3;
          sample += (Math.random() * 2 - 1) * lateDecay * 0.1 * modulation;
          
          // Add some harmonic content
          sample += Math.sin(time * 2 * Math.PI * 200) * earlyDecay * 0.05;
          sample += Math.sin(time * 2 * Math.PI * 400) * earlyDecay * 0.03;
          
          channelData[i] = sample;
        }
      }
      
      this.effectsChain.reverb.buffer = impulse;
      console.log('🌌 Advanced reverb impulse created with psychedelic characteristics');
    } catch (error) {
      console.warn('Advanced reverb impulse creation failed:', error);
    }
  }

  // Create distortion curve for clean/crunchy distortion
  createDistortionCurve() {
    try {
      const samples = 44100;
      const curve = new Float32Array(samples);
      const deg = Math.PI / 180;
      
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        
        // Soft clipping with harmonic enhancement
        const softClip = (3 + 2) * x * 20 * deg / (Math.PI + 2 * Math.abs(x));
        
        // Add some asymmetry for character
        const asymmetry = x > 0 ? 1.0 : 0.9;
        
        curve[i] = softClip * asymmetry;
      }
      
      this.effectsChain.distortion.curve = curve;
      this.effectsChain.distortion.oversample = '2x';
      
      console.log('🔥 Clean distortion curve created');
    } catch (error) {
      console.warn('Distortion curve creation failed:', error);
    }
  }

  // Connect the advanced audio processing graph
  connectAudioGraph() {
    if (!this.enableEffects) {
      // Simple connection without effects
      this.crossfadeGainNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      return;
    }

    // Connect advanced effects chain
    // Input -> Compressor -> Filters -> Distortion -> Delays -> Reverb -> Output
    
    // Main signal path
    this.crossfadeGainNode.connect(this.effectsChain.compressor);
    this.effectsChain.compressor.connect(this.effectsChain.highPass);
    this.effectsChain.highPass.connect(this.effectsChain.lowPass);
    this.effectsChain.lowPass.connect(this.effectsChain.bandPass);
    
    // Split for dry/wet processing
    this.effectsChain.bandPass.connect(this.effectsChain.dryGain);
    this.effectsChain.bandPass.connect(this.effectsChain.distortion);
    
    // Distortion path
    this.effectsChain.distortion.connect(this.effectsChain.wetGain);
    
    // Multi-tap delay network
    this.effectsChain.wetGain.connect(this.effectsChain.delay1);
    this.effectsChain.wetGain.connect(this.effectsChain.delay2);
    this.effectsChain.wetGain.connect(this.effectsChain.delay3);
    
    // Delay feedback loops
    this.effectsChain.delay1.connect(this.effectsChain.delayFeedback1);
    this.effectsChain.delayFeedback1.connect(this.effectsChain.delay1);
    
    this.effectsChain.delay2.connect(this.effectsChain.delayFeedback2);
    this.effectsChain.delayFeedback2.connect(this.effectsChain.delay2);
    
    this.effectsChain.delay3.connect(this.effectsChain.delayFeedback3);
    this.effectsChain.delayFeedback3.connect(this.effectsChain.delay3);
    
    // Granular effect
    this.effectsChain.wetGain.connect(this.effectsChain.granularDelay);
    this.effectsChain.granularDelay.connect(this.effectsChain.granularGain);
    
    // Connect delays and granular to reverb
    this.effectsChain.delay1.connect(this.effectsChain.reverb);
    this.effectsChain.delay2.connect(this.effectsChain.reverb);
    this.effectsChain.delay3.connect(this.effectsChain.reverb);
    this.effectsChain.granularGain.connect(this.effectsChain.reverb);
    
    // LFO modulation connections
    this.effectsChain.lfo1.connect(this.effectsChain.lfoGain1);
    this.effectsChain.lfoGain1.connect(this.effectsChain.bandPass.frequency);
    
    this.effectsChain.lfo2.connect(this.effectsChain.lfoGain2);
    this.effectsChain.lfoGain2.connect(this.effectsChain.delay1.delayTime);
    
    // Final output mix
    this.effectsChain.dryGain.connect(this.gainNode);
    this.effectsChain.reverb.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    console.log('🎛️ Advanced psychedelic audio graph connected');
  }

  // Process and queue audio chunk for seamless playback
  async queueAudioChunk(audioData) {
    if (!this.isInitialized) {
      console.warn('Audio Buffer Manager not initialized');
      return false;
    }

    try {
      // Convert base64 to AudioBuffer
      const audioBuffer = await this.decodeAudioData(audioData);
      if (!audioBuffer) return false;

      // Add to buffer queue
      this.bufferQueue.push({
        buffer: audioBuffer,
        timestamp: this.audioContext.currentTime,
        duration: audioBuffer.duration
      });

      // Limit queue size for memory management
      if (this.bufferQueue.length > this.maxBufferCount) {
        this.bufferQueue.shift();
      }

      // Start playback if needed
      this.scheduleNextBuffer();

      return true;
    } catch (error) {
      console.error('Audio chunk queueing failed:', error);
      return false;
    }
  }

  // Decode audio data to AudioBuffer
  async decodeAudioData(audioData) {
    try {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(audioData);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Create WAV header if needed (Lyria should provide proper format)
      let audioArrayBuffer = arrayBuffer;
      if (!this.isValidAudioFormat(arrayBuffer)) {
        audioArrayBuffer = this.createWavFromPCM(uint8Array);
      }

      // Decode to AudioBuffer
      const audioBuffer = await this.audioContext.decodeAudioData(audioArrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Audio decoding failed:', error);
      return null;
    }
  }

  // Check if data is valid audio format
  isValidAudioFormat(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);
    // Check for WAV header
    return (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && 
            uint8Array[2] === 0x46 && uint8Array[3] === 0x46);
  }

  // Create WAV file from PCM data
  createWavFromPCM(pcmData) {
    const length = pcmData.length;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, this.channels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * this.channels * 2, true);
    view.setUint16(32, this.channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Copy PCM data
    const wavData = new Uint8Array(buffer, 44);
    wavData.set(pcmData);
    
    return buffer;
  }

  // Schedule next buffer for seamless playback
  scheduleNextBuffer() {
    if (this.bufferQueue.length === 0) return;

    const currentTime = this.audioContext.currentTime;
    
    // Process all available buffers
    while (this.bufferQueue.length > 0 && this.nextStartTime <= currentTime + this.bufferLookahead) {
      const bufferInfo = this.bufferQueue.shift();
      this.playBufferAtTime(bufferInfo.buffer, this.nextStartTime);
      this.nextStartTime += bufferInfo.duration;
    }
  }

  // Play buffer at specific time with crossfading
  playBufferAtTime(audioBuffer, startTime) {
    try {
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;

      if (this.enableCrossfading && this.activeSourceNodes.length > 0) {
        // Apply crossfade for smooth transition
        const fadeGain = this.audioContext.createGain();
        fadeGain.gain.setValueAtTime(0, startTime);
        fadeGain.gain.linearRampToValueAtTime(1, startTime + this.crossfadeDuration);
        
        sourceNode.connect(fadeGain);
        fadeGain.connect(this.crossfadeGainNode);
        
        // Fade out previous buffer
        const lastSource = this.activeSourceNodes[this.activeSourceNodes.length - 1];
        if (lastSource && lastSource.fadeGain) {
          lastSource.fadeGain.gain.linearRampToValueAtTime(0, startTime + this.crossfadeDuration);
        }
        
        sourceNode.fadeGain = fadeGain;
      } else {
        sourceNode.connect(this.crossfadeGainNode);
      }

      // Schedule playback
      sourceNode.start(startTime);
      sourceNode.stop(startTime + audioBuffer.duration + this.crossfadeDuration);

      // Clean up when finished
      sourceNode.onended = () => {
        this.cleanupSourceNode(sourceNode);
      };

      // Track active source
      this.activeSourceNodes.push(sourceNode);
      
      // Limit active sources for memory management
      if (this.activeSourceNodes.length > this.maxBufferCount) {
        const oldSource = this.activeSourceNodes.shift();
        this.cleanupSourceNode(oldSource);
      }

      console.log(`🎵 Buffer scheduled at ${startTime.toFixed(3)}s (duration: ${audioBuffer.duration.toFixed(3)}s)`);
    } catch (error) {
      console.error('Buffer playback failed:', error);
    }
  }

  // Clean up source node resources
  cleanupSourceNode(sourceNode) {
    try {
      if (sourceNode) {
        sourceNode.disconnect();
        if (sourceNode.fadeGain) {
          sourceNode.fadeGain.disconnect();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Helper function to ensure safe exponential ramp values
  ensureSafeExponentialValue(value, min = 0.001, max = 22050) {
    if (value <= 0 || !isFinite(value) || isNaN(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  // Apply enhanced psychedelic effects based on sensor data
  applyPsychedelicEffects(sensorData) {
    if (!this.enableEffects || !this.effectsChain.lowPass) return;

    try {
      const currentTime = this.audioContext.currentTime;
      const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      const normalizedMagnitude = Math.min(magnitude, 3) / 3;
      
      // Enhanced filter modulation based on movement
      const baseFilterFreq = 200 + normalizedMagnitude * 8000; // 200Hz to 8.2kHz
      
      // Multi-filter control for complex frequency shaping
      this.effectsChain.lowPass.frequency.exponentialRampToValueAtTime(
        this.ensureSafeExponentialValue(baseFilterFreq * 2, 50, 22050), currentTime + 0.1
      );
      
      this.effectsChain.bandPass.frequency.exponentialRampToValueAtTime(
        this.ensureSafeExponentialValue(baseFilterFreq, 50, 22050), currentTime + 0.1
      );
      
      // Dynamic Q control for "acid" resonance effects
      const resonance = 1 + normalizedMagnitude * 20; // Q factor 1-21
      this.effectsChain.bandPass.Q.exponentialRampToValueAtTime(
        this.ensureSafeExponentialValue(resonance, 0.1, 30), currentTime + 0.1
      );
      
      // Psychedelic delay modulation with range clamping
      if (sensorData.velocity) {
        const velocityMagnitude = Math.sqrt(sensorData.velocity.x ** 2 + sensorData.velocity.y ** 2);
        const delayMod = 0.05 + velocityMagnitude * 0.3; // 50ms to 350ms
        
        // Clamp delay values to valid range [0.001, 1.0] for Web Audio API
        const clampedDelay1 = Math.max(0.001, Math.min(1.0, delayMod));
        const clampedDelay2 = Math.max(0.001, Math.min(1.0, delayMod * 1.5));
        
        this.effectsChain.delay1.delayTime.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(clampedDelay1, 0.001, 1.0), currentTime + 0.1
        );
        
        this.effectsChain.delay2.delayTime.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(clampedDelay2, 0.001, 1.0), currentTime + 0.1
        );
      }
      
      // Acceleration-based granular effects with safe values
      if (sensorData.acceleration && sensorData.isAccelerating) {
        const accelMagnitude = Math.sqrt(sensorData.acceleration.x ** 2 + sensorData.acceleration.y ** 2);
        const granularGain = Math.max(0.001, accelMagnitude * 0.5); // Ensure non-zero value
        this.effectsChain.granularGain.gain.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(granularGain, 0.001, 1.0), currentTime + 0.05
        );
      } else {
        // Use linearRampToValueAtTime for zero/near-zero values
        this.effectsChain.granularGain.gain.linearRampToValueAtTime(
          0.001, currentTime + 0.2 // Use small positive value instead of 0
        );
      }
      
      // Micro-movement distortion control with safe range
      if (sensorData.isMicroMovement) {
        // Enable subtle distortion for micro-movements
        const wetGainValue = Math.max(0.001, 0.1 + normalizedMagnitude * 0.2);
        this.effectsChain.wetGain.gain.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(wetGainValue, 0.001, 1.0), currentTime + 0.1
        );
      } else {
        // Clean signal for larger movements
        const wetGainValue = Math.max(0.001, normalizedMagnitude * 0.4);
        this.effectsChain.wetGain.gain.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(wetGainValue, 0.001, 1.0), currentTime + 0.1
        );
      }
      
      // LFO speed modulation based on intensity with safe values
      if (this.effectsChain.lfo1 && this.effectsChain.lfo2) {
        const lfo1Freq = Math.max(0.01, 0.1 + normalizedMagnitude * 2);
        const lfo2Freq = Math.max(0.01, 0.05 + normalizedMagnitude * 1.5);
        
        this.effectsChain.lfo1.frequency.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(lfo1Freq, 0.01, 20), currentTime + 0.1
        );
        
        this.effectsChain.lfo2.frequency.exponentialRampToValueAtTime(
          this.ensureSafeExponentialValue(lfo2Freq, 0.01, 20), currentTime + 0.1
        );
      }
      
      // Camera motion influence on stereo effects
      if (sensorData.source === 'camera-enhanced' && sensorData.motionDirection) {
        const panPosition = sensorData.motionDirection.x * 0.5; // -0.5 to 0.5
        // This would require a stereo panner node for full implementation
      }
      
      console.log(`🎨 Psychedelic effects applied: filter=${baseFilterFreq.toFixed(0)}Hz, Q=${resonance.toFixed(1)}, intensity=${normalizedMagnitude.toFixed(2)}`);

    } catch (error) {
      console.warn('Psychedelic effects application failed:', error);
    }
  }

  // Set master volume
  setVolume(volume) {
    if (!this.gainNode) return;
    
    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.exponentialRampToValueAtTime(
      this.currentVolume, this.audioContext.currentTime + 0.1
    );
  }

  // Get current playback status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      bufferQueueLength: this.bufferQueue.length,
      activeSourcesCount: this.activeSourceNodes.length,
      nextStartTime: this.nextStartTime,
      currentTime: this.audioContext ? this.audioContext.currentTime : 0,
      volume: this.currentVolume,
      effectsEnabled: this.enableEffects
    };
  }

  // Cleanup resources
  cleanup() {
    try {
      // Stop all active sources
      this.activeSourceNodes.forEach(source => this.cleanupSourceNode(source));
      this.activeSourceNodes = [];
      
      // Clear buffer queue
      this.bufferQueue = [];
      
      // Disconnect audio nodes
      if (this.gainNode) this.gainNode.disconnect();
      if (this.crossfadeGainNode) this.crossfadeGainNode.disconnect();
      
      // Cleanup effects
      Object.values(this.effectsChain).forEach(node => {
        if (node) node.disconnect();
      });
      
      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      
      this.isInitialized = false;
      console.log('🎵 Audio Buffer Manager cleanup completed');
    } catch (error) {
      console.error('Audio cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const audioBufferManager = new AudioBufferManager(); 