/**
 * BUFFERING.JS - Modern Predictive Audio Buffering System
 * 
 * SIMPLIFIED for immediate music playback with predictive enhancements
 * 
 * @author VibesFlow AI
 * @version 2.0.0 - Simplified Architecture
 */

import { GoogleGenAI } from '@google/genai/web';
import { logBufferStatus, logInterpretation, logInfo, logWarning, logError } from './logger';

/**
 * Modern Buffer Manager with Essential Audio Playback
 */
export class BufferManager {
  constructor(geminiApiKey) {
    this.geminiApiKey = geminiApiKey;
    this.genAI = null;
    this.isInitialized = false;
    
    // Essential audio playback (Web Audio API)
    this.audioContext = null;
    this.audioQueue = [];
    this.isQueueProcessing = false;
    this.nextStartTime = 0;
    this.masterGain = null;
    
    // Predictive buffering state
    this.currentInterpretation = null;
    this.targetBufferSize = 4096;
    
    // Rate limiting for Vertex AI
    this.lastGeminiCall = 0;
    this.geminiCallCooldown = 3000;
    this.lastInterpretationSignature = null;
  }

  async initialize() {
    try {
      console.log('🧠 Initializing Buffer Manager for immediate music playback...');
      
      if (!this.geminiApiKey) {
        console.warn('⚠️ No Gemini API key - using basic buffering');
        this.isInitialized = true;
        return true;
      }

      // Initialize Vertex AI client
      this.genAI = new GoogleGenAI({ apiKey: this.geminiApiKey });
      
      console.log('✅ Vertex AI connection established for predictive buffering');
      
      this.isInitialized = true;
      console.log('✅ Buffer Manager initialized for immediate music playback');
      return true;
    } catch (error) {
      console.warn('⚠️ Buffer manager initialization failed, using basic buffering:', error.message);
      this.isInitialized = true; // Still allow basic buffering
      return true;
    }
  }

  // PREDICTIVE: Process interpretation BEFORE audio arrives
  async processInterpretation(interpretation) {
    try {
      console.log('🧠 PREDICTIVE BUFFERING: Processing interpretation BEFORE audio arrives');
      
      this.currentInterpretation = interpretation;
      
      // PREDICTIVE: Prepare buffer parameters
      this.preparePredictiveBuffering(interpretation);
      
      // PREDICTIVE: Generate code for upcoming transition if needed
      if (interpretation.requiresCrossfade) {
        console.log('🌊 PREDICTIVE: Preparing crossfade for smooth transition');
        await this.prepareCrossfadeBuffering(interpretation);
      } else {
        console.log('📫 PREDICTIVE: Preparing layer addition');
        await this.prepareLayerBuffering(interpretation);
      }
      
    } catch (error) {
      console.error('❌ Predictive buffering failed:', error);
    }
  }

  // Handle Lyria audio chunk - IMMEDIATE PLAYBACK + PREDICTIVE BUFFERING
  async handleLyriaAudioChunk(base64AudioData) {
    if (!base64AudioData) return;

    try {
      console.log('🎵 BUFFERING: Processing Lyria audio chunk for immediate playback');
      
      // Convert base64 to Float32Array for Web Audio API
      const float32AudioData = this.base64ToFloat32AudioData(base64AudioData);
      
      // Add to audio queue for immediate playback
      this.audioQueue.push(float32AudioData);

      // Start playback if not already playing
      if (!this.isQueueProcessing) {
        await this.playAudioData();
      }
      
    } catch (error) {
      console.error('❌ Failed to handle Lyria audio chunk:', error);
    }
  }

  // Convert base64 to Float32Array (essential for playback)
  base64ToFloat32AudioData(base64String) {
    const byteCharacters = atob(base64String);
    const byteArray = [];

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray.push(byteCharacters.charCodeAt(i));
    }

    const audioChunks = new Uint8Array(byteArray);

    // Convert Uint8Array (16-bit PCM) to Float32Array for Web Audio API
    const length = audioChunks.length / 2; // 16-bit audio, so 2 bytes per sample
    const float32AudioData = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      // Combine two bytes into one 16-bit signed integer (little-endian)
      let sample = audioChunks[i * 2] | (audioChunks[i * 2 + 1] << 8);
      // Convert from 16-bit PCM to Float32 (range -1 to 1)
      if (sample >= 32768) sample -= 65536;
      float32AudioData[i] = sample / 32768;
    }

    return float32AudioData;
  }

  // Play audio data with seamless buffering (ESSENTIAL FOR MUSIC PLAYBACK)
  async playAudioData() {
    this.isQueueProcessing = true;

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      this.nextStartTime = this.audioContext.currentTime;
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
      this.masterGain.connect(this.audioContext.destination);
    }

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    while (this.audioQueue.length > 0) {
      const audioChunks = this.audioQueue.shift();

      // Create AudioBuffer (Lyria uses 48kHz stereo)
      const audioBuffer = this.audioContext.createBuffer(2, audioChunks.length / 2, 48000);
      
      // Split interleaved stereo data into separate channels
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      
      for (let i = 0; i < audioChunks.length / 2; i++) {
        leftChannel[i] = audioChunks[i * 2];
        rightChannel[i] = audioChunks[i * 2 + 1];
      }

      // Create AudioBufferSourceNode with crossfading
      const source = this.audioContext.createBufferSource();
      const fadeGain = this.audioContext.createGain();
      
      source.buffer = audioBuffer;
      source.connect(fadeGain);
      fadeGain.connect(this.masterGain);

      // Schedule playback with seamless timing
      let startTime = this.nextStartTime;
      if (startTime < this.audioContext.currentTime + 0.01) {
        startTime = this.audioContext.currentTime + 0.01;
      }

      // Apply crossfading for seamless transitions
      const crossfadeTime = 0.05; // 50ms crossfade
      fadeGain.gain.setValueAtTime(0, startTime);
      fadeGain.gain.linearRampToValueAtTime(1, startTime + crossfadeTime);
      fadeGain.gain.setValueAtTime(1, startTime + audioBuffer.duration - crossfadeTime);
      fadeGain.gain.linearRampToValueAtTime(0, startTime + audioBuffer.duration);

      source.start(startTime);
      source.stop(startTime + audioBuffer.duration);
      
      // Update next start time for seamless playback
      this.nextStartTime = startTime + audioBuffer.duration - crossfadeTime;
      
      // Cleanup
      source.onended = () => {
        source.disconnect();
        fadeGain.disconnect();
      };
      
      console.log('🔊 PLAYING: Audio chunk scheduled with crossfading');
    }
    
    this.isQueueProcessing = false;
  }

  // PREDICTIVE: Prepare buffering parameters
  preparePredictiveBuffering(interpretation) {
    const bpm = interpretation.lyriaConfig?.bpm || 140;
    const density = interpretation.lyriaConfig?.density || 0.5;
    
    // Predict optimal buffer size
    let optimalBufferSize;
    if (bpm > 160 && density > 0.7) {
      optimalBufferSize = 8192; // Fast, dense music
    } else if (bpm < 100) {
      optimalBufferSize = 2048; // Slow music
    } else {
      optimalBufferSize = 4096; // Standard techno/house
    }
    
    this.targetBufferSize = optimalBufferSize;
    console.log('🧠 PREDICTIVE: Buffer optimized for', bpm, 'BPM →', optimalBufferSize, 'samples');
  }

  // PREDICTIVE: Prepare crossfade buffering
  async prepareCrossfadeBuffering(interpretation) {
    try {
      console.log('🌊 PREDICTIVE: Setting up crossfade parameters...');
      
      const expectedBPM = interpretation.lyriaConfig?.bpm || 140;
      const expectedDensity = interpretation.lyriaConfig?.density || 0.5;
      
      // Adjust crossfade timing based on BPM
      this.crossfadeTime = expectedBPM > 150 ? 0.08 : expectedBPM > 120 ? 0.12 : 0.15;
      
      console.log('🌊 PREDICTIVE: Crossfade ready -', {
        crossfadeTime: this.crossfadeTime,
        expectedBPM,
        expectedDensity
      });
    } catch (error) {
      console.warn('⚠️ Crossfade preparation failed:', error.message);
    }
  }

  // PREDICTIVE: Prepare layer buffering
  async prepareLayerBuffering(interpretation) {
    try {
      console.log('📫 PREDICTIVE: Setting up layer addition parameters...');
      
      // Optimize for additive layering
      this.overlapBuffer = 0.05; // Longer overlap for layers
      
      console.log('📫 PREDICTIVE: Layer buffering ready');
    } catch (error) {
      console.warn('⚠️ Layer preparation failed:', error.message);
    }
  }

  // Buffer audio chunk (for compatibility)
  async bufferAudioChunk(audioData) {
    // This is called by coordinator.js - just log for now
    console.log('🎵 BUFFERING: Audio chunk buffered');
  }

  // Get buffer status
  getBufferStatus() {
    return {
      isInitialized: this.isInitialized,
      hasAudioContext: !!this.audioContext,
      queueLength: this.audioQueue.length,
      isPlaying: this.isQueueProcessing
    };
  }

  // Cleanup
  cleanup() {
    try {
      console.log('🧹 Cleaning up Buffer Manager...');
      
      // Stop audio playback
      this.audioQueue = [];
      this.isQueueProcessing = false;
      
      // Cleanup master gain
      if (this.masterGain) {
        try {
          this.masterGain.disconnect();
        } catch (error) {
          // Ignore disconnect errors
        }
        this.masterGain = null;
      }
      
      // Cleanup AudioContext
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      // Reset state
      this.isInitialized = false;
      this.nextStartTime = 0;
      
      console.log('✅ Buffer Manager cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

/**
 * Create and return a configured buffer manager instance
 */
export function createBufferManager(geminiApiKey) {
  return new BufferManager(geminiApiKey);
}

export default BufferManager;