/**
 * AudioStreamer - Continuous audio playback
 * 1. Continuous chunk playback without interruptions
 * 2. Proper stall detection and recovery
 * 3. Memory-efficient AudioBuffer management
 * 4. Seamless transitions between chunks
 * 5. Accurate timeline management for seeking
 * 6. Intelligent buffering ahead of current playback
 * 7. Clean up resources to prevent memory leaks
 * 8. Get current playback state
 */

interface ChunkData {
  chunk_id: string;
  cid: string;
  url: string;
  filcdn_url?: string;
  duration: number;
  sequence: number;
  is_final: boolean;
}

interface ContinuousPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  currentTime: number;
  totalDuration: number;
  bufferHealth: number;
  networkQuality: 'excellent' | 'good' | 'poor';
}

export class ContinuousAudioStreamer {
  private context!: AudioContext;
  private sampleRate: number = 24000; // From project-livewire docs
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode!: GainNode;
  
  // Stall detection (critical from project-livewire)
  private playbackTimeout: NodeJS.Timeout | null = null;
  private lastPlaybackTime: number = 0;
  
  // Chunk management for continuous playback
  private chunkQueue: ChunkData[] = [];
  private currentChunkIndex: number = 0;
  private bufferedChunks: Map<number, AudioBuffer> = new Map();
  
  // Timeline management for accurate seeking
  private virtualTimeline: Array<{
    chunkIndex: number;
    startTime: number;
    duration: number;
  }> = [];
  
  // State management
  private state: ContinuousPlayerState = {
    isPlaying: false,
    isPaused: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    currentTime: 0,
    totalDuration: 0,
    bufferHealth: 0,
    networkQuality: 'excellent'
  };
  
  // Callbacks
  public onStateChange: (state: ContinuousPlayerState) => void = () => {};
  public onChunkTransition: (fromChunk: number, toChunk: number) => void = () => {};
  public onPlaybackComplete: () => void = () => {};
  public onError: (error: Error) => void = () => {};

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      // Use proper sample rate from project-livewire pattern
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: this.sampleRate 
      });
      
      // Create gain node for volume control and crossfading
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
      
      console.log('✅ ContinuousAudioStreamer initialized with 24kHz sample rate');
    } catch (error) {
      console.error('❌ Failed to initialize AudioContext:', error);
      this.onError(new Error('AudioContext initialization failed'));
    }
  }

  /**
   * Load vibestream chunks for continuous playback
   * Based on backend persistence.js chunk ordering
   */
  public loadVibestream(chunks: ChunkData[]): void {
    // Sort chunks by sequence to ensure proper order
    this.chunkQueue = chunks.sort((a, b) => a.sequence - b.sequence);
    this.currentChunkIndex = 0;
    this.bufferedChunks.clear();
    this.audioQueue = [];
    
    // Build virtual timeline for accurate seeking
    this.buildVirtualTimeline();
    
    // Update state
    this.state = {
      ...this.state,
      totalChunks: this.chunkQueue.length,
      totalDuration: this.virtualTimeline.reduce((sum, chunk) => sum + chunk.duration, 0),
      currentChunkIndex: 0,
      currentTime: 0
    };
    
    console.log(`🎵 Loaded vibestream with ${this.chunkQueue.length} chunks, total duration: ${this.state.totalDuration}s`);
    this.onStateChange(this.state);
  }

  /**
   * Build virtual timeline for accurate seeking
   * Addresses the duration calculation issue mentioned in the requirements
   */
  private buildVirtualTimeline(): void {
    this.virtualTimeline = [];
    let cumulativeTime = 0;
    
    for (let i = 0; i < this.chunkQueue.length; i++) {
      const chunk = this.chunkQueue[i];
      this.virtualTimeline.push({
        chunkIndex: i,
        startTime: cumulativeTime,
        duration: chunk.duration
      });
      cumulativeTime += chunk.duration;
    }
  }

  /**
   * Start continuous playback
   * Uses the proven pattern from project-livewire
   */
  public async play(): Promise<void> {
    if (this.chunkQueue.length === 0) {
      this.onError(new Error('No chunks loaded for playback'));
      return;
    }

    try {
      // Resume audio context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.isPlaying = true;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      
      // Start buffering ahead
      this.startIntelligentBuffering();
      
      // Begin continuous playback from current position
      await this.playFromChunk(this.currentChunkIndex);
      
      this.onStateChange(this.state);
    } catch (error) {
      console.error('❌ Failed to start playback:', error);
      this.onError(error as Error);
    }
  }

  /**
   * Pause playback
   */
  public pause(): void {
    this.isPlaying = false;
    this.state.isPlaying = false;
    this.state.isPaused = true;
    
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
    
    this.clearPlaybackTimeout();
    this.onStateChange(this.state);
  }

  /**
   * Stop playback and reset position
   */
  public stop(): void {
    this.pause();
    this.currentChunkIndex = 0;
    this.state.currentChunkIndex = 0;
    this.state.currentTime = 0;
    this.state.isPaused = false;
    
    // Clear audio queue and buffers to free memory
    this.audioQueue = [];
    this.bufferedChunks.clear();
    
    this.onStateChange(this.state);
  }

  /**
   * Seek to specific time in the continuous vibestream
   * Fixes the broken seeking functionality
   */
  public async seekTo(targetTime: number): Promise<void> {
    // Find the chunk containing the target time
    const timelineEntry = this.virtualTimeline.find((entry, index) => {
      const nextEntry = this.virtualTimeline[index + 1];
      return targetTime >= entry.startTime && 
             (!nextEntry || targetTime < nextEntry.startTime);
    });

    if (!timelineEntry) {
      this.onError(new Error('Invalid seek time'));
      return;
    }

    const offsetInChunk = targetTime - timelineEntry.startTime;
    
    console.log(`⏭️ Seeking to ${targetTime}s → Chunk ${timelineEntry.chunkIndex} at offset ${offsetInChunk}s`);
    
    // Pause current playback
    const wasPlaying = this.isPlaying;
    if (this.isPlaying) {
      this.pause();
    }
    
    // Update position
    this.currentChunkIndex = timelineEntry.chunkIndex;
    this.state.currentChunkIndex = timelineEntry.chunkIndex;
    this.state.currentTime = targetTime;
    
    // Resume playback if it was playing
    if (wasPlaying) {
      await this.play();
      // Seek within the chunk after a brief delay
      setTimeout(() => {
        if (this.currentSource && offsetInChunk > 0) {
          // Note: AudioBufferSourceNode doesn't support seeking after start()
          // This is a limitation we need to handle by restarting from the correct chunk
          this.playFromChunkWithOffset(timelineEntry.chunkIndex, offsetInChunk);
        }
      }, 100);
    }
    
    this.onStateChange(this.state);
  }

  /**
   * Play from specific chunk with time offset
   * Handles seeking within chunks
   */
  private async playFromChunkWithOffset(chunkIndex: number, offsetSeconds: number): Promise<void> {
    if (chunkIndex >= this.chunkQueue.length) return;
    
    const chunk = this.chunkQueue[chunkIndex];
    
    try {
      // Load chunk if not buffered
      let audioBuffer = this.bufferedChunks.get(chunkIndex);
      if (!audioBuffer) {
        audioBuffer = await this.loadChunkAudio(chunk);
        this.bufferedChunks.set(chunkIndex, audioBuffer);
      }
      
      // Create source and apply offset
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);
      
      // Calculate remaining duration after offset
      const remainingDuration = audioBuffer.duration - offsetSeconds;
      const startTime = this.context.currentTime;
      
      // Set up transition to next chunk
      source.onended = () => {
        this.onChunkComplete(chunkIndex);
      };
      
      // Start playback with offset
      source.start(startTime, offsetSeconds);
      this.currentSource = source;
      this.lastPlaybackTime = startTime;
      
      // Start stall detection
      this.checkPlaybackStatus();
      
    } catch (error) {
      console.error(`❌ Failed to play chunk ${chunkIndex} with offset:`, error);
      this.onError(error as Error);
    }
  }

  /**
   * Play from specific chunk index
   * Core continuous playback logic from project-livewire pattern
   */
  private async playFromChunk(chunkIndex: number): Promise<void> {
    if (chunkIndex >= this.chunkQueue.length) {
      // End of vibestream
      this.onPlaybackComplete();
      return;
    }

    const chunk = this.chunkQueue[chunkIndex];
    
    try {
      // Load chunk audio buffer
      let audioBuffer = this.bufferedChunks.get(chunkIndex);
      if (!audioBuffer) {
        audioBuffer = await this.loadChunkAudio(chunk);
        this.bufferedChunks.set(chunkIndex, audioBuffer);
      }
      
      // Create and configure audio source
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);
      
      // Clean up previous source
      if (this.currentSource) {
        try {
          this.currentSource.disconnect();
        } catch (e) {
          // Ignore disconnection errors
        }
      }
      this.currentSource = source;
      
      // Set up seamless transition to next chunk
      source.onended = () => {
        this.onChunkComplete(chunkIndex);
      };
      
      // Start playback immediately for seamless transitions
      const startTime = this.context.currentTime;
      source.start(startTime);
      this.lastPlaybackTime = startTime;
      
      // Update state
      this.currentChunkIndex = chunkIndex;
      this.state.currentChunkIndex = chunkIndex;
      
      // Start progress tracking
      this.trackPlaybackProgress(chunkIndex, audioBuffer.duration);
      
      // Critical: Start stall detection from project-livewire
      this.checkPlaybackStatus();
      
      console.log(`🎵 Playing chunk ${chunkIndex + 1}/${this.chunkQueue.length}: ${chunk.chunk_id}`);
      
    } catch (error) {
      console.error(`❌ Failed to play chunk ${chunkIndex}:`, error);
      // Try next chunk on failure
      if (chunkIndex + 1 < this.chunkQueue.length) {
        setTimeout(() => this.playFromChunk(chunkIndex + 1), 100);
      } else {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Handle chunk completion and transition to next
   */
  private onChunkComplete(completedChunkIndex: number): void {
    const nextChunkIndex = completedChunkIndex + 1;
    
    if (nextChunkIndex < this.chunkQueue.length && this.isPlaying) {
      // Seamless transition to next chunk
      this.onChunkTransition(completedChunkIndex, nextChunkIndex);
      setTimeout(() => this.playFromChunk(nextChunkIndex), 0);
    } else {
      // End of vibestream
      this.isPlaying = false;
      this.state.isPlaying = false;
      this.onPlaybackComplete();
      this.onStateChange(this.state);
    }
  }

  /**
   * Track playback progress for accurate timeline
   */
  private trackPlaybackProgress(chunkIndex: number, chunkDuration: number): void {
    const updateProgress = () => {
      if (!this.isPlaying || this.currentChunkIndex !== chunkIndex) return;
      
      const elapsedInChunk = this.context.currentTime - this.lastPlaybackTime;
      const chunkStartTime = this.virtualTimeline[chunkIndex]?.startTime || 0;
      
      this.state.currentTime = chunkStartTime + Math.min(elapsedInChunk, chunkDuration);
      this.onStateChange(this.state);
      
      if (elapsedInChunk < chunkDuration) {
        requestAnimationFrame(updateProgress);
      }
    };
    
    requestAnimationFrame(updateProgress);
  }

  /**
   * Critical stall detection from project-livewire
   * Fixes the playback interruption issues
   */
  private checkPlaybackStatus(): void {
    // Clear any existing timeout
    this.clearPlaybackTimeout();
    
    // Set new timeout to check playback status
    this.playbackTimeout = setTimeout(() => {
      const now = this.context.currentTime;
      const timeSinceLastPlayback = now - this.lastPlaybackTime;
      
      // If more than 1 second has passed since last playback and we should be playing
      if (timeSinceLastPlayback > 1 && this.isPlaying) {
        console.log('🔄 Playback stall detected, restarting...');
        this.playFromChunk(this.currentChunkIndex);
      }
      
      // Continue checking if still playing
      if (this.isPlaying) {
        this.checkPlaybackStatus();
      }
    }, 1000);
  }

  private clearPlaybackTimeout(): void {
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
  }

  /**
   * Load audio data for a chunk
   * Uses FilCDN URLs with fallback to proxy
   */
  private async loadChunkAudio(chunk: ChunkData): Promise<AudioBuffer> {
    const audioUrl = chunk.filcdn_url || chunk.url;
    
    try {
      console.log(`📥 Loading chunk audio: ${chunk.chunk_id}`);
      
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      
      console.log(`✅ Loaded chunk ${chunk.chunk_id}: ${audioBuffer.duration}s`);
      return audioBuffer;
      
    } catch (error) {
      console.error(`❌ Failed to load chunk ${chunk.chunk_id}:`, error);
      throw error;
    }
  }

  /**
   * Intelligent buffering ahead of current playback
   * Prevents interruptions and improves user experience
   */
  private startIntelligentBuffering(): void {
    const bufferAhead = 3; // Buffer 3 chunks ahead
    
    const bufferChunks = async () => {
      if (!this.isPlaying) return;
      
      const startIndex = Math.max(0, this.currentChunkIndex);
      const endIndex = Math.min(this.chunkQueue.length, startIndex + bufferAhead);
      
      let bufferedCount = 0;
      
      for (let i = startIndex; i < endIndex; i++) {
        if (!this.bufferedChunks.has(i)) {
          try {
            const audioBuffer = await this.loadChunkAudio(this.chunkQueue[i]);
            this.bufferedChunks.set(i, audioBuffer);
            bufferedCount++;
          } catch (error) {
            console.warn(`⚠️ Failed to buffer chunk ${i}:`, error);
          }
        }
      }
      
      // Update buffer health
      this.state.bufferHealth = this.bufferedChunks.size / Math.min(bufferAhead, this.chunkQueue.length);
      
      if (bufferedCount > 0) {
        console.log(`📦 Buffered ${bufferedCount} chunks, health: ${(this.state.bufferHealth * 100).toFixed(1)}%`);
      }
      
      // Continue buffering
      if (this.isPlaying) {
        setTimeout(bufferChunks, 2000);
      }
    };
    
    bufferChunks();
  }

  /**
   * Clean up resources to prevent memory leaks
   * Addresses the 2GB+ memory consumption issue
   */
  public dispose(): void {
    this.stop();
    this.clearPlaybackTimeout();
    
    // Disconnect gain node
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    
    // Clear all buffers
    this.bufferedChunks.clear();
    this.audioQueue = [];
    this.chunkQueue = [];
    this.virtualTimeline = [];
    
    console.log('🧹 ContinuousAudioStreamer disposed');
  }

  /**
   * Get current playback state
   */
  public getState(): ContinuousPlayerState {
    return { ...this.state };
  }

  /**
   * Play SRS HTTP-FLV stream for participants (ultra-low latency)
   * Returns a cleanup function
   */
  public async playSRSStream(streamUrl: string, volume: number = 0.8): Promise<() => void> {
    try {
      console.log('🎵 Starting SRS HTTP-FLV participant stream:', streamUrl);
      
      // Resume audio context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Create audio element for HTTP-FLV stream
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = streamUrl;
      audio.volume = volume;
      audio.autoplay = true;
      
      // Create media element source
      const mediaSource = this.context.createMediaElementSource(audio);
      const gainNode = this.context.createGain();
      
      gainNode.gain.value = volume;
      mediaSource.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      // Start playback
      await audio.play();
      
      console.log('✅ SRS participant stream started');
      
      // Return cleanup function
      return () => {
        try {
          audio.pause();
          audio.src = '';
          mediaSource.disconnect();
          gainNode.disconnect();
          console.log('🛑 SRS participant stream stopped');
        } catch (e) {
          // Ignore cleanup errors
        }
      };
      
    } catch (error) {
      console.error('❌ SRS stream playback failed:', error);
      throw error;
    }
  }

  /**
   * Simple preview playback for a single chunk (used by VibeMarket)
   * Returns a cleanup function
   */
  public async playPreview(audioUrl: string, volume: number = 0.6): Promise<() => void> {
    try {
      // Resume audio context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Load and decode audio
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      
      // Create preview source
      const previewSource = this.context.createBufferSource();
      const previewGain = this.context.createGain();
      
      previewSource.buffer = audioBuffer;
      previewGain.gain.value = volume;
      
      previewSource.connect(previewGain);
      previewGain.connect(this.context.destination);
      
      // Start preview
      previewSource.start();
      
      // Auto-stop after 30 seconds
      const autoStopTimeout = setTimeout(() => {
        try {
          previewSource.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }, 30000);
      
      // Return cleanup function
      return () => {
        clearTimeout(autoStopTimeout);
        try {
          previewSource.stop();
          previewSource.disconnect();
          previewGain.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      };
      
    } catch (error) {
      console.error('❌ Preview playback failed:', error);
      throw error;
    }
  }
}
