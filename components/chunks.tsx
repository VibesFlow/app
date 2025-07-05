/**
 * CHUNKS.TSX - Audio Chunk Service for Real-time Lyria Stream Processing
 * Collects 60-second audio chunks and posts to backend without device storage
 * Mobile-first, React Native Expo optimized for VibesFlow
 */

import { Platform } from 'react-native';

interface ChunkMetadata {
  rtaId: string;
  creator: string;
  startTime: number;
  chunkTimestamp: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  participantCount: number; // Number of participants active during this chunk
}

interface AudioChunkData {
  chunkId: string;
  audioBuffer: ArrayBuffer;
  metadata: ChunkMetadata;
}

class AudioChunkService {
  private isCollecting: boolean = false;
  private currentRtaId: string | null = null;
  private currentCreator: string | null = null;
  private startTime: number = 0;
  private chunkSequence: number = 0;
  private chunkDuration: number = 60000; // 60 seconds (restored from 30s)
  private backendUrl: string;
  
  // Participant tracking
  private currentParticipantCount: number = 1; // Default to 1 (creator)
  
  // Audio accumulation buffer
  private audioBuffer: ArrayBuffer[] = [];
  private bufferStartTime: number = 0;
  private chunkTimer: NodeJS.Timeout | null = null;
  
  // Processing state management
  private isProcessing: boolean = false;
  private processedChunkIds: Set<string> = new Set();
  private backgroundQueue: Array<{chunkId: string, buffer: ArrayBuffer, metadata: ChunkMetadata, isFinal: boolean}> = [];
  private isBackgroundProcessing: boolean = false;

  constructor() {
    this.backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://1fssfea9c9.execute-api.us-east-1.amazonaws.com/prod';
    console.log(`🔧 Audio chunk service initialized with backend: ${this.backendUrl}`);
    
    // Handle page visibility changes for background processing
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.backgroundQueue.length > 0) {
          this.processBackgroundQueue();
        }
      });
    }
  }

  
  /**
   * Start collecting audio chunks for a vibestream
   */
  startCollecting(rtaId: string, creator: string): void {
    if (this.isCollecting) {
      console.warn('🔄 Already collecting chunks, stopping previous session');
      this.stopCollecting();
    }

    console.log(`🎵 Starting audio chunk collection for RTA: ${rtaId}, Creator: ${creator}`);
    
    this.isCollecting = true;
    this.currentRtaId = rtaId;
    this.currentCreator = creator;
    this.startTime = Date.now();
    this.chunkSequence = 0;
    this.audioBuffer = [];
    this.bufferStartTime = Date.now();
    this.currentParticipantCount = 1; // Start with creator

    // Start 60-second chunk timer
    this.startChunkTimer();
  }

  /**
   * Update participant count for the current vibestream
   */
  updateParticipantCount(count: number): void {
    if (this.isCollecting && count > 0) {
      this.currentParticipantCount = count;
      console.log(`👥 Participant count updated: ${count}`);
    }
  }

  /**
   * Stop collecting and process any remaining audio
   * UI closes immediately, but processing continues in background
   */
  async stopCollecting(): Promise<void> {
    if (!this.isCollecting) return;

    console.log(`🛑 Stopping audio chunk collection for RTA: ${this.currentRtaId}`);
    
    // Stop collecting new audio immediately
    this.isCollecting = false;
    
    // Stop chunk timer
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    // Process any remaining audio as final chunk (if >5 seconds) but don't await
    const remainingDuration = Date.now() - this.bufferStartTime;
    if (this.audioBuffer.length > 0 && remainingDuration > 5000) {
      // Process final chunk in background without blocking UI closure
      this.processAccumulatedAudio(true).catch(error => {
        console.error('❌ Final chunk processing failed:', error);
      });
    }

    // Note: We DON'T reset state here to allow background processing to continue
    // State will be reset when all processing is complete
    console.log('🎵 UI will close immediately, background processing continues...');
  }

  /**
   * Add audio data from Lyria stream (called by orchestration)
   */
  addAudioData(audioData: ArrayBuffer | string): void {
    if (!this.isCollecting || !this.currentRtaId) return;

    try {
      let buffer: ArrayBuffer;
      
      if (typeof audioData === 'string') {
        // Convert base64 to ArrayBuffer using React Native compatible method
        const binaryString = this.base64ToBinary(audioData);
        buffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(buffer);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
      } else {
        buffer = audioData;
      }

      // Add to accumulation buffer
      this.audioBuffer.push(buffer);
      
      // Log progress every 10 seconds
      const elapsed = Date.now() - this.bufferStartTime;
      if (elapsed % 10000 < 500) { // Log roughly every 10s
        console.log(`🎧 Audio buffer: ${this.audioBuffer.length} chunks, ${(elapsed / 1000).toFixed(1)}s elapsed`);
      }

    } catch (error) {
      console.error('❌ Error adding audio data:', error);
    }
  }

  /**
   * React Native compatible base64 decoder
   */
  private base64ToBinary(base64: string): string {
    try {
      if (Platform.OS === 'web' && typeof atob !== 'undefined') {
        return atob(base64);
      } else {
        // For React Native, use a simple base64 decoder
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        let i = 0;
        
        base64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
        
        while (i < base64.length) {
          const a = chars.indexOf(base64.charAt(i++));
          const b = chars.indexOf(base64.charAt(i++));
          const c = chars.indexOf(base64.charAt(i++));
          const d = chars.indexOf(base64.charAt(i++));
          
          const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
          
          result += String.fromCharCode((bitmap >> 16) & 255);
          if (c !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
          if (d !== 64) result += String.fromCharCode(bitmap & 255);
        }
        
        return result;
      }
    } catch (error) {
      console.error('Base64 decode error:', error);
      return '';
    }
  }

  /**
   * Start the 60-second chunk processing timer
   */
  private startChunkTimer(): void {
    this.chunkTimer = setInterval(async () => {
      if (this.isCollecting) {
        await this.processAccumulatedAudio(false);
      }
    }, this.chunkDuration);

          console.log(`⏰ Chunk timer started: 60-second intervals`);
  }

  /**
   * Process accumulated audio into a 60-second chunk and send to backend
   */
  private async processAccumulatedAudio(isFinalChunk: boolean): Promise<void> {
    // Prevent duplicate processing
    if (this.isProcessing || this.audioBuffer.length === 0) {
      if (this.audioBuffer.length === 0) {
        console.log('⚠️ No audio data to process');
      }
      return;
    }

    this.isProcessing = true;

    try {
      const chunkId = this.generateChunkId(isFinalChunk);
      
      // Check if this chunk was already processed
      if (this.processedChunkIds.has(chunkId)) {
        console.log(`⚠️ Chunk ${chunkId} already processed, skipping`);
        return;
      }
      
      const chunkTimestamp = this.bufferStartTime;
      
      console.log(`🔄 Processing ${isFinalChunk ? 'final ' : ''}chunk: ${chunkId}`);

      // Concatenate all audio buffers
      const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.byteLength, 0);
      const combinedBuffer = new ArrayBuffer(totalLength);
      const combinedArray = new Uint8Array(combinedBuffer);
      
      let offset = 0;
      for (const buffer of this.audioBuffer) {
        const array = new Uint8Array(buffer);
        combinedArray.set(array, offset);
        offset += array.length;
      }

      // Create chunk metadata
      const metadata: ChunkMetadata = {
        rtaId: this.currentRtaId!,
        creator: this.currentCreator!,
        startTime: this.startTime,
        chunkTimestamp,
        sampleRate: 48000, // Lyria outputs 48kHz
        channels: 2,       // Lyria outputs stereo
        bitDepth: 16,      // Lyria outputs 16-bit
        participantCount: this.currentParticipantCount, // Include current participant count
      };

      // Mark chunk as processed to prevent duplicates
      this.processedChunkIds.add(chunkId);

      // Reset buffer IMMEDIATELY to prevent reprocessing
      this.audioBuffer = [];
      this.bufferStartTime = Date.now();
      this.chunkSequence++;

      // Post chunk to backend (this continues in background even if UI closes)
      this.postChunkToBackend(chunkId, combinedBuffer, metadata, isFinalChunk);

    } catch (error) {
      console.error(`❌ Error processing audio chunk:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(isFinalChunk: boolean): string {
    const timestamp = this.bufferStartTime;
    const sequenceStr = this.chunkSequence.toString().padStart(3, '0');
    const suffix = isFinalChunk ? '_final' : '';
    return `${this.currentRtaId}_chunk_${sequenceStr}_${timestamp}${suffix}`;
  }

  /**
   * Convert ArrayBuffer to base64 (React Native compatible)
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    try {
      const uint8Array = new Uint8Array(buffer);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      
      for (let i = 0; i < uint8Array.length; i += 3) {
        const a = uint8Array[i];
        const b = uint8Array[i + 1] || 0;
        const c = uint8Array[i + 2] || 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i + 1 < uint8Array.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i + 2 < uint8Array.length ? chars.charAt(bitmap & 63) : '=';
      }
      
      return result;
    } catch (error) {
      console.error('ArrayBuffer to base64 error:', error);
      return '';
    }
  }

  /**
   * Compress raw PCM audio data using Web Audio API
   * Converts 15MB raw PCM to ~1-2MB OGG Vorbis
   */
  private async compressAudioData(rawPcmBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (typeof window === 'undefined' || !window.AudioContext) {
      console.warn('Web Audio API not available, sending raw audio');
      return rawPcmBuffer;
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = 48000;
      const channels = 2;
      
      // Convert raw PCM buffer to AudioBuffer
      const samples = rawPcmBuffer.byteLength / (2 * channels); // 16-bit = 2 bytes per sample
      const audioBuffer = audioContext.createBuffer(channels, samples, sampleRate);
      
      // Convert interleaved 16-bit PCM to float32 planar
      const dataView = new DataView(rawPcmBuffer);
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < samples; i++) {
          // Read 16-bit little-endian PCM
          const sample16 = dataView.getInt16((i * channels + channel) * 2, true);
          // Convert to float32 (-1.0 to 1.0)
          channelData[i] = sample16 / 32768;
        }
      }

      // Use MediaRecorder for compression
      const stream = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(stream);

      const mediaRecorder = new MediaRecorder(stream.stream, {
        mimeType: 'audio/webm;codecs=opus', // Opus codec in WebM container
        audioBitsPerSecond: 128000 // 128kbps for good quality
      });

      const compressedChunks: Blob[] = [];
      
      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            compressedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const compressedBlob = new Blob(compressedChunks, { type: 'audio/webm' });
          const compressedBuffer = await compressedBlob.arrayBuffer();
          
          console.log(`🗜️ Audio compression: ${(rawPcmBuffer.byteLength / 1024 / 1024).toFixed(1)}MB → ${(compressedBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
          
          resolve(compressedBuffer);
        };

        mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          reject(error);
        };

        // Start recording and play the audio
        mediaRecorder.start();
        source.start();
        
        // Stop recording after audio finishes
        source.onended = () => {
          setTimeout(() => mediaRecorder.stop(), 100);
        };
      });

    } catch (error) {
      console.error('Audio compression failed:', error);
      return rawPcmBuffer; // Fallback to raw audio
    }
  }

  /**
   * Post chunk to backend via HTTP (with compression and background processing support)
   */
  private async postChunkToBackend(
    chunkId: string, 
    audioBuffer: ArrayBuffer, 
    metadata: ChunkMetadata,
    isFinalChunk: boolean
  ): Promise<void> {
    try {
      console.log(`📡 Processing chunk for upload: ${chunkId} (${(audioBuffer.byteLength / 1024).toFixed(1)}KB raw)`);

      // Compress audio data before upload
      const compressedBuffer = await this.compressAudioData(audioBuffer);
      
      // Check compressed size (should now be ~1-2MB)
      const maxChunkSize = 10 * 1024 * 1024; // 10MB conservative limit
      if (compressedBuffer.byteLength > maxChunkSize) {
        console.warn(`⚠️ Compressed chunk ${chunkId} still too large (${(compressedBuffer.byteLength / 1024 / 1024).toFixed(1)}MB), skipping upload`);
        return;
      }

      // Convert compressed ArrayBuffer to base64
      const base64Audio = this.arrayBufferToBase64(compressedBuffer);

      const response = await fetch(`${this.backendUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chunk-Id': chunkId,
          'X-Rta-Id': metadata.rtaId,
          'X-Creator': metadata.creator,
          'X-Start-Time': metadata.startTime.toString(),
          'X-Chunk-Timestamp': metadata.chunkTimestamp.toString(),
          'X-Sample-Rate': metadata.sampleRate.toString(),
          'X-Channels': metadata.channels.toString(),
          'X-Bit-Depth': metadata.bitDepth.toString(),
          'X-Participant-Count': metadata.participantCount.toString(), // Include participant count in headers
          'X-Is-Final': isFinalChunk.toString(),
          'X-Audio-Format': 'webm-opus', // Indicate compressed format
          'X-Original-Size': audioBuffer.byteLength.toString(),
          'X-Compressed-Size': compressedBuffer.byteLength.toString()
        },
        body: JSON.stringify({
          chunkId,
          rtaId: metadata.rtaId,
          audioData: base64Audio,
          metadata: {
            ...metadata,
            audioFormat: 'webm-opus',
            originalSize: audioBuffer.byteLength,
            compressedSize: compressedBuffer.byteLength
          },
          isFinalChunk
        })
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Compressed chunk uploaded successfully: ${(compressedBuffer.byteLength / 1024).toFixed(1)}KB (${result.message || 'Success'})`);
      
      // If this was the final chunk, clean up state
      if (isFinalChunk) {
        console.log('🧹 Final chunk processed, cleaning up state...');
        setTimeout(() => this.cleanupState(), 1000); // Small delay to ensure all async operations complete
      }

    } catch (error) {
      console.error(`❌ Failed to post chunk ${chunkId} to backend:`, error);
      console.warn(`⚠️ Chunk ${chunkId} lost due to network error`);
      
      // Even on error, clean up if final chunk
      if (isFinalChunk) {
        setTimeout(() => this.cleanupState(), 1000);
      }
    }
  }

  /**
   * Get current collection status
   */
  getStatus(): {
    isCollecting: boolean;
    rtaId: string | null;
    uptime: number;
    currentChunk: number;
    bufferSize: number;
    participantCount: number;
  } {
    return {
      isCollecting: this.isCollecting,
      rtaId: this.currentRtaId,
      uptime: this.isCollecting ? Date.now() - this.startTime : 0,
      currentChunk: this.chunkSequence,
      bufferSize: this.audioBuffer.length,
      participantCount: this.currentParticipantCount,
    };
  }

  /**
   * Update backend URL (useful for development/production switching)
   */
  setBackendUrl(url: string): void {
    this.backendUrl = url;
    console.log(`🔧 Backend URL updated: ${url}`);
  }

  // New method for background processing
  private async processBackgroundQueue(): Promise<void> {
    if (this.isBackgroundProcessing) return;
    this.isBackgroundProcessing = true;

    console.log(`🔄 Processing ${this.backgroundQueue.length} chunks in background`);

    while (this.backgroundQueue.length > 0) {
      const {chunkId, buffer, metadata, isFinal} = this.backgroundQueue.shift()!;
      
      try {
        await this.postChunkToBackend(chunkId, buffer, metadata, isFinal);
      } catch (error) {
        console.error(`❌ Background chunk processing failed for ${chunkId}:`, error);
      }
    }

    this.isBackgroundProcessing = false;
    console.log('✅ Background processing queue completed');
  }

  /**
   * Clean up all state (called after all processing is done)
   */
  private cleanupState(): void {
    this.currentRtaId = null;
    this.currentCreator = null;
    this.audioBuffer = [];
    this.chunkSequence = 0;
    this.processedChunkIds.clear();
    this.backgroundQueue = [];
    this.isProcessing = false;
    this.isBackgroundProcessing = false;
    this.currentParticipantCount = 1; // Reset to default
  }
}

// Export singleton instance
export const audioChunkService = new AudioChunkService();
export default audioChunkService; 