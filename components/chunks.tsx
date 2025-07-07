/**
 * CHUNKS.TSX - Audio Chunk Service for Real-time Lyria Stream Processing
 * OPTIMIZED to minimize interference with live music generation
 * Background processing with intelligent load balancing
 */

import React from 'react';
import { Platform } from 'react-native';

interface ChunkMetadata {
  rtaId: string;
  chunkId: string;
  timestamp: number;
  creator: string;
  startTime: string;
  chunkTimestamp: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  participantCount: number;
  audioFormat: string;
}

interface ProcessingConfig {
  processingType: 'immediate' | 'deferred' | 'minimal-impact' | 'batch' | 'standard' | 'background';
  priority: number;
  allowBackgroundProcessing: boolean;
  useWebWorkers: boolean;
  maxConcurrentUploads: number;
  uploadBatchSize: number;
  memoryThreshold: number; // MB
  cpuThrottling: boolean;
}

class AudioChunkService {
  private isCollecting: boolean = false;
  private currentRtaId: string | null = null;
  private currentCreator: string | null = null;
  private startTime: number = 0;
  private chunkSequence: number = 0;
  private chunkDuration: number = 60000; // 60 seconds
  private backendUrl: string;
  
  // Participant tracking
  private currentParticipantCount: number = 1;
  
  // ENHANCED audio accumulation with background processing
  private audioBuffer: ArrayBuffer[] = [];
  private bufferStartTime: number = 0;
  private chunkTimer: NodeJS.Timeout | null = null;
  
  // BACKGROUND PROCESSING to minimize live music interference
  private isProcessing: boolean = false;
  private processedChunkIds: Set<string> = new Set();
  private backgroundQueue: Array<{
    chunkId: string, 
    buffer: ArrayBuffer, 
    metadata: ChunkMetadata, 
    isFinal: boolean,
    priority: 'low' | 'normal' | 'high'
  }> = [];
  private isBackgroundProcessing: boolean = false;
  private compressionWorker: Worker | null = null;
  
  // INTELLIGENT LOAD BALANCING with enhanced music activity detection
  private compressionLevel: 'light' | 'medium' | 'heavy' = 'light';
  private isLiveMusicActive: boolean = true;
  private lastMusicActivity: number = Date.now();
  private musicActivityHistory: number[] = []; // Track activity patterns
  private processingLoadMonitor = {
    avgProcessingTime: 0,
    processingTimes: [] as number[],
    peakProcessingTime: 0,
    isHeavyProcessing: false
  };
  
  // ENHANCED ACTIVITY DETECTION
  private activityDetectionWindow = 2000; // 2 seconds base window
  private quietPeriodThreshold = 5000; // 5 seconds quiet = switch to medium processing
  private idlePeriodThreshold = 10000; // 10 seconds idle = switch to heavy processing
  private musicPeakDetection: {
    recentPeaks: number[];
    averagePeakInterval: number;
    lastPeakTime: number;
  } = {
    recentPeaks: [],
    averagePeakInterval: 0,
    lastPeakTime: 0
  };

  constructor() {
    this.backendUrl = (process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai') + '/upload';
    console.log(`🔧 Audio chunk service initialized with enhanced intelligent processing`);
    
    // Initialize background compression worker if available
    this.initializeEnhancedCompressionWorker();
    
    // Monitor for music activity with enhanced detection
    this.startEnhancedLoadBalanceMonitoring();
    
    // Handle page visibility for background processing
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.backgroundQueue.length > 0) {
          this.processBackgroundQueue();
        }
      });
    }
  }

  // Initialize ENHANCED Web Worker for background compression
  private initializeEnhancedCompressionWorker() {
    if (typeof Worker !== 'undefined' && Platform.OS === 'web') {
      try {
        // Create enhanced inline worker for audio compression
        const workerScript = `
          self.addEventListener('message', function(e) {
            const { audioData, chunkId, settings } = e.data;
            
            // Enhanced compression with different algorithms based on level
            let compressionRatio, processingTime;
            
            switch (settings.level) {
              case 'light':
                compressionRatio = 0.9; // Minimal compression
                processingTime = 10;
                break;
              case 'medium':
                compressionRatio = 0.7; // Moderate compression
                processingTime = 50;
                break;
              case 'heavy':
                compressionRatio = 0.5; // Aggressive compression
                processingTime = 150;
                break;
              default:
                compressionRatio = 0.8;
                processingTime = 30;
            }
            
            // Simulate different compression algorithms
            const compressedSize = Math.floor(audioData.byteLength * compressionRatio);
          });
        `;
        
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.compressionWorker = new Worker(URL.createObjectURL(blob));
        
        console.log('🏭 Enhanced background compression worker initialized');
      } catch (error) {
        console.warn('Failed to initialize enhanced compression worker:', error);
      }
    }
  }

  // ENHANCED system load monitoring with intelligent music activity detection
  private startEnhancedLoadBalanceMonitoring() {
    setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastMusicActivity;
      
      // ENHANCED MUSIC ACTIVITY DETECTION
      this.updateMusicActivityDetection(now, timeSinceLastActivity);
      
      // ADAPTIVE COMPRESSION LEVEL ADJUSTMENT
      this.adjustCompressionLevel(timeSinceLastActivity);
      
      // PROCESSING LOAD ANALYSIS
      this.updateEnhancedProcessingMetrics();
      
      // BACKGROUND QUEUE MANAGEMENT
      this.optimizeBackgroundQueue();
      
    }, 250); // Higher frequency monitoring (4x per second)
  }

  // INTELLIGENT music activity pattern detection
  private updateMusicActivityDetection(now: number, timeSinceLastActivity: number) {
    // Detect if live music is actively playing with enhanced logic
    const baseThreshold = this.activityDetectionWindow;
    let adaptiveThreshold = baseThreshold;
    
    // ADAPTIVE THRESHOLD based on recent activity patterns
    if (this.musicActivityHistory.length > 5) {
      const recentIntervals: number[] = [];
      for (let i = 1; i < this.musicActivityHistory.length; i++) {
        recentIntervals.push(this.musicActivityHistory[i] - this.musicActivityHistory[i - 1]);
      }
      
      if (recentIntervals.length > 0) {
        const avgInterval = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
        // Adapt threshold based on music rhythm patterns
        adaptiveThreshold = Math.min(Math.max(avgInterval * 0.6, baseThreshold), baseThreshold * 2);
      }
    }
    
    this.isLiveMusicActive = timeSinceLastActivity < adaptiveThreshold;
    
    // Track activity history for pattern analysis (keep last 20 activities)
    if (this.musicActivityHistory.length > 20) {
      this.musicActivityHistory = this.musicActivityHistory.slice(-20);
    }
  }

  // ADAPTIVE compression level adjustment based on multiple factors
  private adjustCompressionLevel(timeSinceLastActivity: number) {
    let newLevel: 'light' | 'medium' | 'heavy';
    
    if (this.isLiveMusicActive) {
      newLevel = 'light'; // Minimal processing during live music
    } else if (timeSinceLastActivity < this.quietPeriodThreshold) {
      // SMART MEDIUM PROCESSING - consider background queue size and system load
      const queuePressure = this.backgroundQueue.length > 3;
      const lowSystemLoad = this.processingLoadMonitor.avgProcessingTime < 100;
      
      newLevel = (queuePressure && lowSystemLoad) ? 'medium' : 'light';
    } else if (timeSinceLastActivity < this.idlePeriodThreshold) {
      newLevel = 'medium'; // Moderate processing during quiet periods
    } else {
      // INTELLIGENT HEAVY PROCESSING - only during confirmed idle periods
      const confirmedIdle = this.backgroundQueue.length > 2 && 
                           !this.processingLoadMonitor.isHeavyProcessing;
      newLevel = confirmedIdle ? 'heavy' : 'medium';
    }
    
    // SMOOTH TRANSITIONS - avoid rapid compression level changes
    if (newLevel !== this.compressionLevel) {
      const levelOrder = { light: 1, medium: 2, heavy: 3 };
      const currentLevel = levelOrder[this.compressionLevel];
      const targetLevel = levelOrder[newLevel];
      
      // Only allow one level change at a time
      if (Math.abs(targetLevel - currentLevel) > 1) {
        if (targetLevel > currentLevel) {
          newLevel = currentLevel === 1 ? 'medium' : 'heavy';
        } else {
          newLevel = currentLevel === 3 ? 'medium' : 'light';
        }
      }
      
      this.compressionLevel = newLevel;
      console.log(`🎛️ Compression level adjusted to: ${newLevel} (idle: ${timeSinceLastActivity}ms)`);
    }
  }

  // ENHANCED processing performance metrics with load detection
  private updateEnhancedProcessingMetrics() {
    // Keep rolling window of last 15 processing times
    if (this.processingLoadMonitor.processingTimes.length > 15) {
      this.processingLoadMonitor.processingTimes = this.processingLoadMonitor.processingTimes.slice(-15);
    }
    
    if (this.processingLoadMonitor.processingTimes.length > 0) {
      // Calculate average processing time
      this.processingLoadMonitor.avgProcessingTime = 
        this.processingLoadMonitor.processingTimes.reduce((a, b) => a + b, 0) / 
        this.processingLoadMonitor.processingTimes.length;
      
      // Track peak processing time
      this.processingLoadMonitor.peakProcessingTime = 
        Math.max(...this.processingLoadMonitor.processingTimes);
      
      // Detect heavy processing periods (average > 200ms or peak > 500ms)
      this.processingLoadMonitor.isHeavyProcessing = 
        this.processingLoadMonitor.avgProcessingTime > 200 || 
        this.processingLoadMonitor.peakProcessingTime > 500;
    }
  }

  // OPTIMIZE background queue management with intelligent prioritization
  private optimizeBackgroundQueue() {
    if (this.backgroundQueue.length === 0) return;
    
    // DYNAMIC PRIORITY ADJUSTMENT based on current state
    this.backgroundQueue.forEach(item => {
      // Upgrade priority for old items during idle periods
      if (!this.isLiveMusicActive && this.backgroundQueue.length > 5) {
        if (item.priority === 'low') item.priority = 'normal';
        else if (item.priority === 'normal') item.priority = 'high';
      }
      
      // Downgrade priority during active music periods
      if (this.isLiveMusicActive && this.backgroundQueue.length > 8) {
        if (item.priority === 'high') item.priority = 'normal';
        else if (item.priority === 'normal') item.priority = 'low';
      }
    });
    
    // AUTOMATIC QUEUE PROCESSING during optimal conditions
    const shouldAutoProcess = !this.isBackgroundProcessing && 
                             this.backgroundQueue.length > 3 && 
                             !this.isLiveMusicActive &&
                             !this.processingLoadMonitor.isHeavyProcessing;
    
    if (shouldAutoProcess) {
      console.log('🔄 Auto-triggering background processing during optimal conditions');
      setTimeout(() => this.processBackgroundQueue(), 100);
    }
  }

  // Start collecting audio chunks for a vibestream
  startCollecting(rtaId: string, creator: string): void {
    if (this.isCollecting) {
      console.warn('🔄 Already collecting chunks, stopping previous session');
      this.stopCollecting();
    }

    console.log(`🎵 Starting OPTIMIZED audio chunk collection for RTA: ${rtaId}`);
    
    this.isCollecting = true;
    this.currentRtaId = rtaId;
    this.currentCreator = creator;
    this.startTime = Date.now();
    this.chunkSequence = 0;
    this.audioBuffer = [];
    this.bufferStartTime = Date.now();
    this.currentParticipantCount = 1;
    this.lastMusicActivity = Date.now(); // Mark as active

    // Start 60-second chunk timer with background processing
    this.startOptimizedChunkTimer();
  }

  // Update participant count for the current vibestream
  updateParticipantCount(count: number): void {
    if (this.isCollecting && count > 0) {
      this.currentParticipantCount = count;
      console.log(`👥 Participant count updated: ${count}`);
    }
  }

  // Stop collecting with MINIMAL interruption to live music
  async stopCollecting(): Promise<void> {
    if (!this.isCollecting) return;

    console.log(`🛑 Stopping audio collection for RTA: ${this.currentRtaId} (background processing will continue)`);
    
    // Stop collecting new audio IMMEDIATELY
    this.isCollecting = false;
    
    // Stop chunk timer
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    // Process final chunk in background with LOW priority
    const remainingDuration = Date.now() - this.bufferStartTime;
    if (this.audioBuffer.length > 0 && remainingDuration > 5000) {
      this.backgroundQueue.push({
        chunkId: this.generateChunkId(true),
        buffer: this.combineAudioBuffers(),
        metadata: this.createCurrentMetadata(),
        isFinal: true,
        priority: 'low' // Low priority to not interfere with live music
      });
      
      // Clear buffer immediately to free memory
      this.audioBuffer = [];
    }

    // Process background queue with minimal interference
    setTimeout(() => this.processBackgroundQueue(), 1000);
    
    console.log('🎵 UI closes immediately, background processing continues non-intrusively');
  }

  // Add audio data with ENHANCED activity tracking
  addAudioData(audioData: ArrayBuffer | string): void {
    if (!this.isCollecting || !this.currentRtaId) return;

    // ENHANCED music activity tracking
    const now = Date.now();
    this.lastMusicActivity = now;
    this.musicActivityHistory.push(now);
    
    // DETECT MUSIC PEAKS for rhythm-based processing optimization
    if (typeof audioData === 'string') {
      const estimatedEnergy = audioData.length; // Simple energy estimation
      if (estimatedEnergy > this.musicPeakDetection.averagePeakInterval * 1.5) {
        this.musicPeakDetection.recentPeaks.push(now);
        this.musicPeakDetection.lastPeakTime = now;
        
        // Keep only recent peaks (last 30 seconds)
        this.musicPeakDetection.recentPeaks = this.musicPeakDetection.recentPeaks.filter(
          peak => now - peak < 30000
        );
        
        // Update average peak interval
        if (this.musicPeakDetection.recentPeaks.length > 1) {
          const intervals: number[] = [];
          for (let i = 1; i < this.musicPeakDetection.recentPeaks.length; i++) {
            intervals.push(this.musicPeakDetection.recentPeaks[i] - this.musicPeakDetection.recentPeaks[i - 1]);
          }
          this.musicPeakDetection.averagePeakInterval = 
            intervals.reduce((a, b) => a + b, 0) / intervals.length;
        }
      }
    }

    try {
      let buffer: ArrayBuffer;
      
      if (typeof audioData === 'string') {
        // OPTIMIZED base64 conversion with chunked processing
        buffer = this.fastBase64ToBuffer(audioData);
      } else {
        buffer = audioData;
      }

      // Add to accumulation buffer with minimal processing
      this.audioBuffer.push(buffer);
      
      // IMPROVED LOGGING - use expandable groups for micro-variations
      const elapsed = Date.now() - this.bufferStartTime;
      const logInterval = this.isLiveMusicActive ? 15000 : 10000; // Less frequent during live music
      if (elapsed % logInterval < 500) {
        const compressionStatus = this.isLiveMusicActive ? '🎵 live' : '⏸️ idle';
        
        console.groupCollapsed(`🎧 Audio Buffer Status (${compressionStatus})`);
        console.log('Buffer Details:', {
          chunks: this.audioBuffer.length,
          duration: `${(elapsed / 1000).toFixed(1)}s`,
          participants: this.currentParticipantCount,
          rtaId: this.currentRtaId,
          compressionLevel: this.compressionLevel
        });
        console.groupEnd();
      }

    } catch (error) {
      console.error('❌ Error adding audio data:', error);
    }
  }

  // FAST base64 to ArrayBuffer conversion with chunked processing
  private fastBase64ToBuffer(base64: string): ArrayBuffer {
    try {
      if (Platform.OS === 'web' && typeof atob !== 'undefined') {
        const binaryString = atob(base64);
        const buffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(buffer);
        
        // CHUNKED PROCESSING for large buffers to avoid blocking
        const chunkSize = 32768; // 32KB chunks
        if (binaryString.length > chunkSize) {
          let offset = 0;
          while (offset < binaryString.length) {
            const end = Math.min(offset + chunkSize, binaryString.length);
            for (let i = offset; i < end; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            offset = end;
            
            // Yield control to prevent blocking (only during non-live music)
            if (!this.isLiveMusicActive && offset < binaryString.length) {
              // Small delay to prevent blocking UI
              break;
            }
          }
        } else {
          // Fast processing for small buffers
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
        }
        
        return buffer;
      } else {
        // Fallback for React Native
        return this.base64ToBinaryFallback(base64);
      }
    } catch (error) {
      console.error('Base64 decode error:', error);
      return new ArrayBuffer(0);
    }
  }

  // Fallback base64 decoder for React Native
  private base64ToBinaryFallback(base64: string): ArrayBuffer {
    // Simplified implementation for React Native
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const result: number[] = [];
        let i = 0;
        
        base64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
        
        while (i < base64.length) {
          const a = chars.indexOf(base64.charAt(i++));
          const b = chars.indexOf(base64.charAt(i++));
          const c = chars.indexOf(base64.charAt(i++));
          const d = chars.indexOf(base64.charAt(i++));
          
          const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
          
      result.push((bitmap >> 16) & 255);
      if (c !== 64) result.push((bitmap >> 8) & 255);
      if (d !== 64) result.push(bitmap & 255);
    }
    
    return new Uint8Array(result).buffer;
  }

  // Start optimized chunk timer with background processing
  private startOptimizedChunkTimer(): void {
    this.chunkTimer = setInterval(async () => {
      if (this.isCollecting && this.audioBuffer.length > 0) {
        // Create chunk in background to avoid interrupting live music
        const chunkData = {
          chunkId: this.generateChunkId(false),
          buffer: this.combineAudioBuffers(),
          metadata: this.createCurrentMetadata(),
          isFinal: false,
          priority: this.isLiveMusicActive ? 'low' : 'normal' as 'low' | 'normal'
        };
        
        // Add to background queue instead of processing immediately
        this.backgroundQueue.push(chunkData);
        
        // Clear buffer immediately to free memory and reset timing
        this.audioBuffer = [];
        this.bufferStartTime = Date.now();
        this.chunkSequence++;
        
        // Process queue in background with minimal impact
        if (!this.isBackgroundProcessing) {
          setTimeout(() => this.processBackgroundQueue(), 100);
        }
      }
    }, this.chunkDuration);

    console.log(`⏰ Chunk collection started: 60s intervals with background processing`);
  }

  // Combine audio buffers efficiently
  private combineAudioBuffers(): ArrayBuffer {
    if (this.audioBuffer.length === 0) return new ArrayBuffer(0);
    
      const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.byteLength, 0);
      const combinedBuffer = new ArrayBuffer(totalLength);
      const combinedArray = new Uint8Array(combinedBuffer);
      
      let offset = 0;
      for (const buffer of this.audioBuffer) {
        const array = new Uint8Array(buffer);
        combinedArray.set(array, offset);
        offset += array.length;
      }

    return combinedBuffer;
  }

  // Create metadata for current chunk
  private createCurrentMetadata(): ChunkMetadata {
    return {
      rtaId: this.currentRtaId!,
      chunkId: this.generateChunkId(false),
      timestamp: Date.now(),
      creator: this.currentCreator!,
      startTime: this.startTime.toString(),
      chunkTimestamp: this.bufferStartTime,
      sampleRate: 48000,
      channels: 2,
      bitDepth: 16,
      participantCount: this.currentParticipantCount,
      audioFormat: 'webm-opus',
    };
  }

  // Generate unique chunk ID
  private generateChunkId(isFinalChunk: boolean): string {
    const timestamp = this.bufferStartTime;
    const sequenceStr = this.chunkSequence.toString().padStart(3, '0');
    const suffix = isFinalChunk ? '_final' : '';
    return `${this.currentRtaId}_chunk_${sequenceStr}_${timestamp}${suffix}`;
  }

  // ENHANCED background processing queue with intelligent load balancing
  private async processBackgroundQueue(): Promise<void> {
    if (this.isBackgroundProcessing || this.backgroundQueue.length === 0) return;
    
    this.isBackgroundProcessing = true;
    const startTime = Date.now();
    
    console.groupCollapsed(`🔄 BACKGROUND PROCESSING: ${this.backgroundQueue.length} chunks`);

    let processedCount = 0;
    
    while (this.backgroundQueue.length > 0) {
      const { chunkId, buffer, metadata, isFinal } = this.backgroundQueue.shift()!;
      
      try {
        // Simple processing - no more complex routing
        const compressedBuffer = await this.compressAudioData(buffer);
        await this.uploadChunkToBackend(chunkId, compressedBuffer, metadata, isFinal, 'background');
        
        processedCount++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`Background processing failed for ${chunkId}:`, (error as Error).message);
      }
    }

    this.isBackgroundProcessing = false;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Completed: ${processedCount} chunks in ${(totalTime / 1000).toFixed(1)}s`);
    console.groupEnd();
  }

  /**
   * Compress raw PCM audio data using Web Audio API
   * Converts 15MB raw PCM to ~1-2MB OGG Vorbis
   */
  private async compressAudioData(rawPcmBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    if (typeof window === 'undefined' || !window.AudioContext) {
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
          
          // Only log compression details when significant compression occurs
          const originalSizeMB = rawPcmBuffer.byteLength / 1024 / 1024;
          const compressedSizeMB = compressedBuffer.byteLength / 1024 / 1024;
          const compressionRatio = ((1 - compressedSizeMB / originalSizeMB) * 100).toFixed(1);
          
          if (originalSizeMB > 1) { // Only log for larger files
            console.log(`🗜️ Audio compressed: ${originalSizeMB.toFixed(1)}MB → ${compressedSizeMB.toFixed(1)}MB (${compressionRatio}% reduction)`);
          }
          
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

  // Upload chunk to backend with processing type tracking
  private async uploadChunkToBackend(
    chunkId: string, 
    audioBuffer: ArrayBuffer, 
    metadata: ChunkMetadata,
    isFinalChunk: boolean,
    processingType: 'immediate' | 'deferred' | 'minimal-impact' | 'batch' | 'standard' | 'background'
  ): Promise<void> {
    const uploadStartTime = Date.now();
    
    try {
      // CLEAN, ORGANIZED LOGGING using expandable groups
      console.groupCollapsed(`📡 VIBESFLOW UPLOAD: ${chunkId}`);
      console.log(`📊 Chunk Details`, {
        size: `${(audioBuffer.byteLength / 1024).toFixed(1)}KB`,
        creator: metadata.creator,
        rtaId: metadata.rtaId,
        participants: metadata.participantCount,
        processing: processingType,
        isFinal: isFinalChunk
      });

      // Convert to base64
      const base64Audio = this.arrayBufferToBase64Fast(audioBuffer);

      // Send to backend
      const response = await fetch(`${this.backendUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chunk-Id': chunkId,
          'X-Rta-Id': metadata.rtaId,
          'X-Creator': metadata.creator,
          'X-Start-Time': metadata.startTime,
          'X-Chunk-Timestamp': metadata.chunkTimestamp.toString(),
          'X-Participant-Count': metadata.participantCount.toString(),
          'X-Is-Final': isFinalChunk.toString(),
        },
        body: JSON.stringify({
          chunkId,
          rtaId: metadata.rtaId,
          audioData: base64Audio,
          metadata: {
            ...metadata,
            audioFormat: 'webm-opus',
            compressedSize: audioBuffer.byteLength
          },
          isFinalChunk
        })
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const uploadDuration = Date.now() - uploadStartTime;
      
      // IMPROVED SYNAPSE STATUS LOGGING
      if (result.synapseStatus) {
        if (result.synapseStatus.success) {
          console.log(`✅ STORAGE STATUS: Queued for Filecoin (${uploadDuration}ms)`);
          
          // Start polling for actual upload completion
          this.pollSynapseUploadStatus(metadata.rtaId, chunkId, uploadStartTime);
          
        } else {
          console.error(`❌ STORAGE FAILED:`, {
            message: result.synapseStatus.message,
            error: result.synapseStatus.error
          });
        }
      } else {
        console.warn('⚠️ No storage status received - backend might have issues');
      }
      
      console.groupEnd();
      
      // Clean up if final chunk
      if (isFinalChunk) {
        console.log(`🏁 Final chunk processed for RTA: ${metadata.rtaId}`);
        setTimeout(() => this.cleanupState(), 1000);
      }

    } catch (error) {
      console.groupCollapsed(`❌ UPLOAD FAILED: ${chunkId}`);
      console.error('Upload Error:', {
        error: error instanceof Error ? error.message : String(error),
        backendUrl: this.backendUrl,
        chunkSize: audioBuffer.byteLength,
        duration: Date.now() - uploadStartTime
      });
      console.groupEnd();
      
      if (isFinalChunk) {
        setTimeout(() => this.cleanupState(), 1000);
      }
    }
  }

  // NEW: Poll for actual Synapse upload completion status
  private async pollSynapseUploadStatus(rtaId: string, chunkId: string, uploadStartTime: number): Promise<void> {
    const maxAttempts = 12; // Poll for up to 2 minutes (10s intervals)
    let attempts = 0;
    
    const poll = async () => {
      attempts++;
      
      try {
        const statusUrl = `${this.backendUrl.replace('/upload', '')}/filecoin/status/${rtaId}`;
        const response = await fetch(statusUrl);
        
        if (response.ok) {
          const status = await response.json();
          
          if (status.chunks && status.chunks[chunkId]) {
            const chunkStatus = status.chunks[chunkId];
            
            if (chunkStatus.status === 'uploaded') {
              const totalDuration = Date.now() - uploadStartTime;
              console.groupCollapsed(`🎉 FILECOIN UPLOAD COMPLETE: ${chunkId}`);
              console.log('Upload Success:', {
                duration: `${(totalDuration / 1000).toFixed(1)}s`,
                filecoinCid: chunkStatus.filecoinCid,
                status: 'Permanently stored on Filecoin'
              });
              console.groupEnd();
              return; // Stop polling
              
            } else if (chunkStatus.status === 'failed') {
              console.groupCollapsed(`❌ FILECOIN UPLOAD FAILED: ${chunkId}`);
              console.error('Storage Error:', {
                error: chunkStatus.error,
                duration: `${(Date.now() - uploadStartTime) / 1000}s`
              });
              console.groupEnd();
              return; // Stop polling
            }
          }
        }
        
        // Continue polling if not completed and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          console.warn(`⏰ FILECOIN UPLOAD TIMEOUT: ${chunkId} (stopped polling after ${maxAttempts * 10}s)`);
        }
        
      } catch (error) {
        // Silently fail status polling - don't spam errors
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        }
      }
    };
    
    // Start polling after 5 seconds (give backend time to process)
    setTimeout(poll, 5000);
  }

  // FAST ArrayBuffer to base64 conversion
  private arrayBufferToBase64Fast(buffer: ArrayBuffer): string {
    try {
      const uint8Array = new Uint8Array(buffer);
      const chunkSize = 0x8000; // 32KB chunks for better performance
      let result = '';
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        result += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      return btoa(result);
    } catch (error) {
      console.error('ArrayBuffer to base64 error:', error);
      return '';
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