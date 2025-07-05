/**
 * BACKGROUND-CHUNK-PROCESSOR.JS - Background Chunk Processing Manager
 * Manages Web Worker for heavy audio chunk processing
 * Isolates 60-second chunk processing from main thread for smooth playback
 */

export class BackgroundChunkProcessor {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.processingQueue = [];
    this.activeProcessing = new Set();
    this.maxConcurrentProcessing = 2;
    this.onProcessComplete = null;
    this.onProcessError = null;
    this.onWorkerReady = null;
    
    // Performance metrics
    this.metrics = {
      chunksProcessed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      compressionRatio: 0,
      errors: 0
    };
    
    // Worker capabilities
    this.capabilities = {
      webmOpusSupport: false,
      initialized: false
    };
    
    console.log('🔧 Background Chunk Processor initialized');
  }

  // Initialize Web Worker
  async initialize(config = {}) {
    if (this.isInitialized) return true;

    try {
      // Create Web Worker from blob URL to avoid module import issues
      const workerBlob = await this.createWorkerBlob();
      const workerUrl = URL.createObjectURL(workerBlob);
      
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      // Set up worker message handling
      this.worker.onmessage = (event) => this.handleWorkerMessage(event);
      this.worker.onerror = (error) => this.handleWorkerError(error);
      
      // Initialize worker
      const initPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);
        
        const messageHandler = (event) => {
          if (event.data.type === 'INIT_COMPLETE') {
            clearTimeout(timeout);
            this.worker.removeEventListener('message', messageHandler);
            
            if (event.data.success) {
              this.capabilities = event.data.capabilities;
              this.isInitialized = true;
              resolve(true);
            } else {
              reject(new Error(event.data.error));
            }
          }
        };
        
        this.worker.addEventListener('message', messageHandler);
        this.worker.postMessage({
          type: 'INIT',
          data: {
            compressionSettings: config.compressionSettings
          }
        });
      });
      
      await initPromise;
      
      // Clean up worker URL
      URL.revokeObjectURL(workerUrl);
      
      console.log('✅ Background Chunk Processor initialized successfully');
      console.log('   WebM/Opus support:', this.capabilities.webmOpusSupport);
      
      if (this.onWorkerReady) {
        this.onWorkerReady(this.capabilities);
      }
      
      return true;
      
    } catch (error) {
      console.error('Background Chunk Processor initialization failed:', error);
      this.cleanup();
      return false;
    }
  }

  // Create worker blob from inline code
  async createWorkerBlob() {
    try {
      // Read the worker script file
      const workerScript = await this.getWorkerScript();
      return new Blob([workerScript], { type: 'application/javascript' });
    } catch (error) {
      console.warn('Could not load external worker script, using inline fallback');
      return this.createInlineWorkerBlob();
    }
  }

  // Get worker script content
  async getWorkerScript() {
    try {
      // In a real app, this would load from chunk-processor.worker.js
      // For now, we'll use the inline version
      throw new Error('External script loading not implemented');
    } catch (error) {
      throw error;
    }
  }

  // Create inline worker as fallback
  createInlineWorkerBlob() {
    const workerCode = `
      // Inline worker code for chunk processing
      let isProcessing = false;
      let compressionSettings = {
        quality: 0.7,
        bitRate: 128000,
        sampleRate: 48000,
        channels: 2
      };

      self.addEventListener('message', async (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'INIT':
            self.postMessage({
              type: 'INIT_COMPLETE',
              success: true,
              capabilities: {
                webmOpusSupport: false,
                compressionSettings: compressionSettings
              }
            });
            break;
            
          case 'PROCESS_CHUNK':
            await processChunk(data);
            break;
            
          default:
            console.warn('Unknown message type:', type);
        }
      });

      async function processChunk(chunkData) {
        if (isProcessing) {
          self.postMessage({
            type: 'PROCESS_ERROR',
            error: 'Worker busy',
            chunkId: chunkData.chunkId
          });
          return;
        }
        
        isProcessing = true;
        const startTime = performance.now();
        
        try {
          // Simple compression simulation
          const totalLength = chunkData.audioBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
          const combinedBuffer = new ArrayBuffer(totalLength);
          const combinedArray = new Uint8Array(combinedBuffer);
          
          let offset = 0;
          for (const buffer of chunkData.audioBuffers) {
            const array = new Uint8Array(buffer);
            combinedArray.set(array, offset);
            offset += array.length;
          }
          
          // Simple compression by reducing every other byte
          const compressedLength = Math.floor(totalLength * 0.7);
          const compressed = new Uint8Array(compressedLength);
          for (let i = 0; i < compressedLength; i++) {
            compressed[i] = combinedArray[Math.floor(i / 0.7)];
          }
          
          // Convert to base64
          const binary = String.fromCharCode(...compressed);
          const base64Data = btoa(binary);
          
          // Upload simulation
          const response = await fetch(chunkData.backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkId: chunkData.chunkId,
              rtaId: chunkData.metadata.rtaId,
              audioData: base64Data,
              metadata: chunkData.metadata
            })
          });
          
          const result = await response.json();
          const processingTime = performance.now() - startTime;
          
          self.postMessage({
            type: 'PROCESS_COMPLETE',
            chunkId: chunkData.chunkId,
            result: { success: true, response: result },
            metrics: {
              processingTime: processingTime,
              originalSize: totalLength,
              compressedSize: compressed.length,
              compressionRatio: compressed.length / totalLength
            }
          });
          
        } catch (error) {
          self.postMessage({
            type: 'PROCESS_ERROR',
            chunkId: chunkData.chunkId,
            error: error.message
          });
        } finally {
          isProcessing = false;
        }
      }
    `;
    
    return new Blob([workerCode], { type: 'application/javascript' });
  }

  // Queue chunk for background processing
  async queueChunk(chunkData) {
    if (!this.isInitialized) {
      throw new Error('Background processor not initialized');
    }

    const chunkId = chunkData.chunkId || `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const processData = {
      chunkId,
      audioBuffers: chunkData.audioBuffers,
      metadata: chunkData.metadata,
      backendUrl: chunkData.backendUrl,
      isFinalChunk: chunkData.isFinalChunk,
      originalSize: chunkData.audioBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)
    };

    // Add to queue
    this.processingQueue.push(processData);
    
    console.log(`📋 Chunk ${chunkId} queued for background processing (queue: ${this.processingQueue.length})`);
    
    // Process queue
    this.processQueue();
    
    return chunkId;
  }

  // Process queued chunks
  async processQueue() {
    if (this.activeProcessing.size >= this.maxConcurrentProcessing || this.processingQueue.length === 0) {
      return;
    }

    const chunkData = this.processingQueue.shift();
    this.activeProcessing.add(chunkData.chunkId);

    try {
      console.log(`🔄 Starting background processing for chunk ${chunkData.chunkId}`);
      
      this.worker.postMessage({
        type: 'PROCESS_CHUNK',
        data: chunkData
      });
      
    } catch (error) {
      console.error(`Failed to start processing for chunk ${chunkData.chunkId}:`, error);
      this.activeProcessing.delete(chunkData.chunkId);
      
      if (this.onProcessError) {
        this.onProcessError(chunkData.chunkId, error);
      }
    }
  }

  // Handle worker messages
  handleWorkerMessage(event) {
    const { type, chunkId, result, metrics, error } = event.data;

    switch (type) {
      case 'PROCESS_COMPLETE':
        this.handleProcessComplete(chunkId, result, metrics);
        break;
        
      case 'PROCESS_ERROR':
        this.handleProcessError(chunkId, error);
        break;
        
      case 'WORKER_ERROR':
        console.error('Worker error:', error);
        break;
        
      default:
        console.log('Worker message:', event.data);
    }
  }

  // Handle successful processing completion
  handleProcessComplete(chunkId, result, metrics) {
    console.log(`✅ Background processing completed for chunk ${chunkId}`);
    console.log(`   Processing time: ${metrics.processingTime.toFixed(1)}ms`);
    console.log(`   Compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`);
    
    // Update metrics
    this.metrics.chunksProcessed++;
    this.metrics.totalProcessingTime += metrics.processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.chunksProcessed;
    this.metrics.compressionRatio = (this.metrics.compressionRatio * (this.metrics.chunksProcessed - 1) + metrics.compressionRatio) / this.metrics.chunksProcessed;
    
    // Clean up active processing
    this.activeProcessing.delete(chunkId);
    
    // Notify completion callback
    if (this.onProcessComplete) {
      this.onProcessComplete(chunkId, result, metrics);
    }
    
    // Process next in queue
    this.processQueue();
  }

  // Handle processing error
  handleProcessError(chunkId, error) {
    console.error(`❌ Background processing failed for chunk ${chunkId}:`, error);
    
    // Update metrics
    this.metrics.errors++;
    
    // Clean up active processing
    this.activeProcessing.delete(chunkId);
    
    // Notify error callback
    if (this.onProcessError) {
      this.onProcessError(chunkId, error);
    }
    
    // Process next in queue
    this.processQueue();
  }

  // Handle worker error
  handleWorkerError(error) {
    console.error('Web Worker error:', error);
    
    // Reinitialize worker if needed
    if (this.isInitialized) {
      console.log('Attempting to reinitialize worker...');
      this.cleanup();
      setTimeout(() => this.initialize(), 1000);
    }
  }

  // Get processing status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      queueLength: this.processingQueue.length,
      activeProcessing: this.activeProcessing.size,
      maxConcurrentProcessing: this.maxConcurrentProcessing,
      capabilities: this.capabilities,
      metrics: { ...this.metrics }
    };
  }

  // Update processing settings
  updateSettings(settings) {
    if (!this.isInitialized) return;
    
    if (settings.maxConcurrentProcessing) {
      this.maxConcurrentProcessing = settings.maxConcurrentProcessing;
    }
    
    if (settings.compressionSettings) {
      this.worker.postMessage({
        type: 'UPDATE_SETTINGS',
        data: settings.compressionSettings
      });
    }
    
    console.log('🔧 Background processor settings updated');
  }

  // Cleanup resources
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isInitialized = false;
    this.processingQueue = [];
    this.activeProcessing.clear();
    
    console.log('🧹 Background Chunk Processor cleanup completed');
  }
}

// Export singleton instance
export const backgroundChunkProcessor = new BackgroundChunkProcessor(); 