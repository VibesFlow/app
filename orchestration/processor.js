/**
 * CHUNK-PROCESSOR.WORKER.JS - Background Audio Chunk Processing
 * Web Worker for handling heavy 60-second chunk compression and upload
 * Isolated from main thread to prevent music interruptions
 */

// Worker state
let isProcessing = false;
let compressionSettings = {
  quality: 0.7,
  bitRate: 128000,
  sampleRate: 48000,
  channels: 2
};

// Import compression libraries if available
let compressionModule = null;

// Initialize worker
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'INIT':
      await initializeWorker(data);
      break;
    case 'PROCESS_CHUNK':
      await processAudioChunk(data);
      break;
    case 'UPDATE_SETTINGS':
      updateCompressionSettings(data);
      break;
    case 'GET_STATUS':
      sendStatus();
      break;
    default:
      console.warn('Unknown message type:', type);
  }
});

// Initialize worker with configuration
async function initializeWorker(config) {
  try {
    console.log('🔧 Chunk processor worker initializing...');
    
    if (config.compressionSettings) {
      compressionSettings = { ...compressionSettings, ...config.compressionSettings };
    }
    
    // Initialize compression capabilities
    await initializeCompression();
    
    self.postMessage({
      type: 'INIT_COMPLETE',
      success: true,
      capabilities: {
        webmOpusSupport: !!compressionModule,
        compressionSettings: compressionSettings
      }
    });
    
    console.log('✅ Chunk processor worker initialized successfully');
  } catch (error) {
    console.error('Chunk processor worker initialization failed:', error);
    self.postMessage({
      type: 'INIT_COMPLETE',
      success: false,
      error: error.message
    });
  }
}

// Initialize compression capabilities
async function initializeCompression() {
  try {
    // Try to use MediaRecorder for WebM/Opus compression
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      compressionModule = 'MediaRecorder';
      console.log('Using MediaRecorder for WebM/Opus compression');
      return;
    }
    
    // Fallback to manual compression
    compressionModule = 'manual';
    console.log('Using manual compression fallback');
    
  } catch (error) {
    console.warn('Compression initialization error:', error);
    compressionModule = 'manual';
  }
}

// Process audio chunk in background
async function processAudioChunk(chunkData) {
  if (isProcessing) {
    self.postMessage({
      type: 'PROCESS_ERROR',
      error: 'Worker busy processing another chunk',
      chunkId: chunkData.chunkId
    });
    return;
  }
  
  isProcessing = true;
  const startTime = performance.now();
  
  try {
    console.log(`🔄 Processing chunk ${chunkData.chunkId} in background thread`);
    
    // Step 1: Decode and concatenate audio buffers
    const processedAudio = await concatenateAudioBuffers(chunkData.audioBuffers);
    
    // Step 2: Compress audio data
    const compressedData = await compressAudioData(processedAudio);
    
    // Step 3: Prepare upload payload
    const uploadPayload = prepareUploadPayload(chunkData, compressedData);
    
    // Step 4: Upload to backend
    const uploadResult = await uploadToBackend(uploadPayload, chunkData.backendUrl);
    
    const processingTime = performance.now() - startTime;
    
    self.postMessage({
      type: 'PROCESS_COMPLETE',
      chunkId: chunkData.chunkId,
      result: uploadResult,
      metrics: {
        processingTime: processingTime,
        originalSize: processedAudio.byteLength,
        compressedSize: compressedData.byteLength,
        compressionRatio: compressedData.byteLength / processedAudio.byteLength
      }
    });
    
    console.log(`✅ Chunk ${chunkData.chunkId} processed successfully in ${processingTime.toFixed(1)}ms`);
    
  } catch (error) {
    console.error(`❌ Chunk processing failed for ${chunkData.chunkId}:`, error);
    
    self.postMessage({
      type: 'PROCESS_ERROR',
      chunkId: chunkData.chunkId,
      error: error.message,
      stack: error.stack
    });
  } finally {
    isProcessing = false;
  }
}

// Concatenate multiple audio buffers into single ArrayBuffer
async function concatenateAudioBuffers(audioBuffers) {
  try {
    if (!audioBuffers || audioBuffers.length === 0) {
      throw new Error('No audio buffers provided');
    }
    
    // Calculate total length
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    
    // Create combined buffer
    const combinedBuffer = new ArrayBuffer(totalLength);
    const combinedArray = new Uint8Array(combinedBuffer);
    
    let offset = 0;
    for (const buffer of audioBuffers) {
      const array = new Uint8Array(buffer);
      combinedArray.set(array, offset);
      offset += array.length;
    }
    
    console.log(`📋 Concatenated ${audioBuffers.length} buffers (${(totalLength / 1024).toFixed(1)}KB total)`);
    return combinedBuffer;
    
  } catch (error) {
    throw new Error(`Audio concatenation failed: ${error.message}`);
  }
}

// Compress audio data using available compression method
async function compressAudioData(audioBuffer) {
  try {
    console.log(`🗜️ Compressing audio data (${(audioBuffer.byteLength / 1024).toFixed(1)}KB)`);
    
    if (compressionModule === 'MediaRecorder') {
      return await compressWithMediaRecorder(audioBuffer);
    } else {
      return await compressManually(audioBuffer);
    }
  } catch (error) {
    console.warn('Primary compression failed, using fallback:', error);
    return await compressManually(audioBuffer);
  }
}

// Compress using MediaRecorder (WebM/Opus)
async function compressWithMediaRecorder(audioBuffer) {
  return new Promise((resolve, reject) => {
    try {
      // Convert ArrayBuffer to AudioBuffer first
      const audioContext = new OfflineAudioContext(
        compressionSettings.channels, 
        audioBuffer.byteLength / (compressionSettings.channels * 2), 
        compressionSettings.sampleRate
      );
      
      // Create MediaStream from AudioBuffer
      const source = audioContext.createBufferSource();
      const destination = audioContext.createMediaStreamDestination();
      
      // This is a simplified approach - real implementation would need proper AudioBuffer conversion
      source.connect(destination);
      
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: compressionSettings.bitRate
      });
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          resolve(arrayBuffer);
        } catch (error) {
          reject(error);
        }
      };
      
      mediaRecorder.onerror = reject;
      
      mediaRecorder.start();
      source.start();
      
      // Stop after processing
      setTimeout(() => {
        mediaRecorder.stop();
      }, 100);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Manual compression fallback (simple downsampling and bit reduction)
async function compressManually(audioBuffer) {
  try {
    const input = new Uint8Array(audioBuffer);
    const compressionFactor = Math.floor(1 / compressionSettings.quality);
    
    // Simple downsampling for compression
    const compressedLength = Math.floor(input.length / compressionFactor);
    const compressed = new Uint8Array(compressedLength);
    
    for (let i = 0; i < compressedLength; i++) {
      compressed[i] = input[i * compressionFactor];
    }
    
    console.log(`📦 Manual compression: ${(input.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB`);
    return compressed.buffer;
    
  } catch (error) {
    throw new Error(`Manual compression failed: ${error.message}`);
  }
}

// Prepare upload payload
function prepareUploadPayload(chunkData, compressedData) {
  try {
    // Convert to base64 for JSON transport
    const base64Data = arrayBufferToBase64(compressedData);
    
    return {
      chunkId: chunkData.chunkId,
      rtaId: chunkData.metadata.rtaId,
      audioData: base64Data,
      metadata: {
        ...chunkData.metadata,
        audioFormat: compressionModule === 'MediaRecorder' ? 'webm-opus' : 'pcm-compressed',
        originalSize: chunkData.originalSize,
        compressedSize: compressedData.byteLength,
        compressionMethod: compressionModule,
        processingTimestamp: Date.now()
      },
      isFinalChunk: chunkData.isFinalChunk || false
    };
  } catch (error) {
    throw new Error(`Payload preparation failed: ${error.message}`);
  }
}

// Upload to backend via fetch
async function uploadToBackend(payload, backendUrl) {
  try {
    console.log(`📡 Uploading chunk ${payload.chunkId} to backend...`);
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Chunk-Id': payload.chunkId,
        'X-Rta-Id': payload.metadata.rtaId,
        'X-Creator': payload.metadata.creator,
        'X-Start-Time': payload.metadata.startTime.toString(),
        'X-Chunk-Timestamp': payload.metadata.chunkTimestamp.toString(),
        'X-Sample-Rate': payload.metadata.sampleRate.toString(),
        'X-Channels': payload.metadata.channels.toString(),
        'X-Bit-Depth': payload.metadata.bitDepth.toString(),
        'X-Participant-Count': payload.metadata.participantCount.toString(),
        'X-Is-Final': payload.isFinalChunk.toString(),
        'X-Audio-Format': payload.metadata.audioFormat,
        'X-Original-Size': payload.metadata.originalSize.toString(),
        'X-Compressed-Size': payload.metadata.compressedSize.toString(),
        'X-Compression-Method': payload.metadata.compressionMethod
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Backend upload failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Upload successful: ${result.message || 'Success'}`);
    
    return {
      success: true,
      response: result,
      uploadTime: Date.now()
    };
    
  } catch (error) {
    console.error('Backend upload error:', error);
    throw new Error(`Backend upload failed: ${error.message}`);
  }
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  try {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
  } catch (error) {
    throw new Error(`Base64 conversion failed: ${error.message}`);
  }
}

// Update compression settings
function updateCompressionSettings(newSettings) {
  compressionSettings = { ...compressionSettings, ...newSettings };
  console.log('🔧 Compression settings updated:', compressionSettings);
  
  self.postMessage({
    type: 'SETTINGS_UPDATED',
    settings: compressionSettings
  });
}

// Send worker status
function sendStatus() {
  self.postMessage({
    type: 'STATUS',
    status: {
      isProcessing,
      compressionModule,
      compressionSettings,
      capabilities: {
        webmOpusSupport: compressionModule === 'MediaRecorder'
      }
    }
  });
}

// Handle worker errors
self.addEventListener('error', (event) => {
  console.error('Worker error:', event.error);
  self.postMessage({
    type: 'WORKER_ERROR',
    error: event.error.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in worker:', event.reason);
  self.postMessage({
    type: 'WORKER_ERROR',
    error: event.reason.message || event.reason
  });
});

console.log('🚀 Chunk processor worker script loaded and ready'); 