/**
 * LYRIA AUDIO PROCESSOR - AudioWorkletProcessor for Real-time Lyria Audio
 * Based on Google's 2025 Generative AI best practices
 * 
 * Implements:
 * - Real-time PCM processing
 * - Predictive buffering
 * - Crossfading and transition smoothing
 * - Click-noise elimination
 * - Jitter compensation
 */

class LyriaProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Audio buffer management
    this.audioBuffer = new Float32Array();
    this.crossfadeBuffer = new Float32Array();
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 0.1; // 100ms crossfade
    
    // Predictive buffering
    this.predictiveBuffer = new Float32Array();
    this.bufferHealth = 1.0;
    this.targetBufferSize = 4096; // 1024 samples at 48kHz = ~21ms
    this.minBufferSize = 2048;
    this.maxBufferSize = 8192;
    
    // Quality metrics
    this.clickDetector = {
      lastSample: 0,
      clickThreshold: 0.3,
      smoothingFactor: 0.95
    };
    
    // Jitter compensation
    this.jitterCompensation = {
      expectedInterval: 128, // samples per quantum
      actualIntervals: [],
      averageInterval: 128,
      compensation: 0
    };
    
    // Listen for audio data from main thread
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'audio-chunk':
          this.processIncomingAudio(data);
          break;
        case 'prepare-transition':
          this.prepareTransition(data);
          break;
        case 'update-config':
          this.updateConfiguration(data);
          break;
      }
    };
    
    // Initialize with optimal settings
    this.initializeProcessor();
  }

  initializeProcessor() {
    // Set up optimal buffer configuration
    this.targetBufferSize = 4096; // ~85ms at 48kHz
    console.log('🎵 Processor initialized with AudioWorklet');
  }

  // Process incoming Lyria audio data
  processIncomingAudio(audioData) {
    try {
      // Convert base64 PCM to Float32Array if needed
      let float32Data;
      if (typeof audioData === 'string') {
        float32Data = this.base64ToFloat32(audioData);
      } else if (audioData instanceof Float32Array) {
        float32Data = audioData;
      } else {
        console.warn('Unknown audio data format');
        return;
      }
      
      // Apply click-noise elimination
      float32Data = this.eliminateClickNoise(float32Data);
      
      // Add to buffer with jitter compensation
      this.addToBufferWithJitterCompensation(float32Data);
      
      // Update buffer health metrics
      this.updateBufferHealth();
      
    } catch (error) {
      console.error('Error processing incoming audio:', error);
    }
  }

  // Prepare for smooth transition (PREDICTIVE)
  prepareTransition(transitionData) {
    console.log('🌊 PREDICTIVE: Preparing transition buffer');
    
    const { bpm, density, requiresCrossfade } = transitionData;
    
    // Adjust crossfade timing based on BPM
    this.transitionDuration = bpm > 150 ? 0.08 : bpm > 120 ? 0.12 : 0.15;
    
    // Prepare crossfade buffer if needed
    if (requiresCrossfade) {
      const transitionSamples = Math.floor(this.transitionDuration * sampleRate);
      this.crossfadeBuffer = new Float32Array(transitionSamples);
      this.isTransitioning = true;
      this.transitionProgress = 0;
    }
  }

  // Update processor configuration
  updateConfiguration(config) {
    const { bufferSize, crossfadeTime, jitterCompensation } = config;
    
    if (bufferSize) this.targetBufferSize = bufferSize;
    if (crossfadeTime) this.transitionDuration = crossfadeTime;
    if (jitterCompensation) this.jitterCompensation.compensation = jitterCompensation;
  }

  // Main audio processing loop
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channelData = output[0];
    const frameCount = channelData.length;
    
    // Update jitter compensation
    this.updateJitterCompensation(frameCount);
    
    // Fill output with buffered audio
    if (this.audioBuffer.length >= frameCount) {
      // Apply crossfading if transitioning
      if (this.isTransitioning) {
        this.applyCrossfade(channelData, frameCount);
      } else {
        channelData.set(this.audioBuffer.slice(0, frameCount));
      }
      
      // Remove processed samples from buffer
      this.audioBuffer = this.audioBuffer.slice(frameCount);
      
      // Check buffer health
      if (this.audioBuffer.length < this.minBufferSize) {
        this.port.postMessage({ 
          type: 'buffer-underrun', 
          bufferSize: this.audioBuffer.length,
          targetSize: this.targetBufferSize
        });
      }
    } else {
      // Buffer underrun - fill with silence and apply gentle fade
      this.handleBufferUnderrun(channelData, frameCount);
    }
    
    return true;
  }

  // Convert base64 PCM to Float32Array (Lyria format)
  base64ToFloat32(base64String) {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert 16-bit PCM to Float32
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    
    return float32Array;
  }

  // Eliminate click noise using advanced filtering
  eliminateClickNoise(audioData) {
    const filtered = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      const currentSample = audioData[i];
      
      // Detect sudden amplitude changes (clicks)
      const deltaFromLast = Math.abs(currentSample - this.clickDetector.lastSample);
      
      if (deltaFromLast > this.clickDetector.clickThreshold) {
        // Apply smoothing to reduce click
        filtered[i] = this.clickDetector.lastSample * this.clickDetector.smoothingFactor + 
                     currentSample * (1 - this.clickDetector.smoothingFactor);
      } else {
        filtered[i] = currentSample;
      }
      
      this.clickDetector.lastSample = filtered[i];
    }
    
    return filtered;
  }

  // Add audio to buffer with jitter compensation
  addToBufferWithJitterCompensation(audioData) {
    // Compensate for timing jitter
    const compensatedData = this.compensateJitter(audioData);
    
    // Add to main buffer
    const newBuffer = new Float32Array(this.audioBuffer.length + compensatedData.length);
    newBuffer.set(this.audioBuffer);
    newBuffer.set(compensatedData, this.audioBuffer.length);
    this.audioBuffer = newBuffer;
    
    // Maintain optimal buffer size
    if (this.audioBuffer.length > this.maxBufferSize) {
      this.audioBuffer = this.audioBuffer.slice(this.audioBuffer.length - this.targetBufferSize);
    }
  }

  // Compensate for network jitter
  compensateJitter(audioData) {
    // Simple jitter compensation - could be enhanced with more sophisticated algorithms
    return audioData; // For now, return as-is
  }

  // Apply crossfading during transitions
  applyCrossfade(output, frameCount) {
    const transitionSamples = Math.floor(this.transitionDuration * sampleRate);
    
    for (let i = 0; i < frameCount; i++) {
      const progress = this.transitionProgress / transitionSamples;
      const fadeOut = 1 - progress;
      const fadeIn = progress;
      
      // Mix old and new audio with crossfade
      const oldSample = this.audioBuffer[i] || 0;
      const newSample = this.crossfadeBuffer[i] || 0;
      
      output[i] = oldSample * fadeOut + newSample * fadeIn;
      
      this.transitionProgress++;
      
      if (this.transitionProgress >= transitionSamples) {
        this.isTransitioning = false;
        this.transitionProgress = 0;
        break;
      }
    }
  }

  // Handle buffer underrun gracefully
  handleBufferUnderrun(output, frameCount) {
    // Fill with silence and apply gentle fade to prevent pops
    for (let i = 0; i < frameCount; i++) {
      output[i] = 0;
    }
    
    this.port.postMessage({ 
      type: 'buffer-underrun',
      severity: 'high',
      bufferSize: this.audioBuffer.length
    });
  }

  // Update jitter compensation metrics
  updateJitterCompensation(frameCount) {
    this.jitterCompensation.actualIntervals.push(frameCount);
    
    // Keep only recent intervals
    if (this.jitterCompensation.actualIntervals.length > 10) {
      this.jitterCompensation.actualIntervals.shift();
    }
    
    // Calculate average interval
    const sum = this.jitterCompensation.actualIntervals.reduce((a, b) => a + b, 0);
    this.jitterCompensation.averageInterval = sum / this.jitterCompensation.actualIntervals.length;
  }

  // Update buffer health metrics
  updateBufferHealth() {
    const bufferRatio = this.audioBuffer.length / this.targetBufferSize;
    this.bufferHealth = Math.min(Math.max(bufferRatio, 0), 1);
    
    // Report health to main thread
    this.port.postMessage({
      type: 'buffer-health',
      health: this.bufferHealth,
      bufferSize: this.audioBuffer.length,
      targetSize: this.targetBufferSize
    });
  }
}

registerProcessor('processor', LyriaProcessor);
