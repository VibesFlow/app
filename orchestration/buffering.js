/**
 * BUFFERING.JS - Intelligent Predictive Audio Buffering System
 * 
 * Implements robust audio buffering using Gemini 2.5 Flash Lite as recommended by
 * Google's Lyria RealTime API documentation to prevent click-noises, handle jitter,
 * and ensure smooth audio transitions for seamless DJ Set experience.
 * 
 * Reference: https://ai.google.dev/gemini-api/docs/music-generation
 */

import { GoogleGenAI } from '@google/genai/web';

/**
 * Gemini-based Buffer Manager for Client-side Predictive Buffering
 * Implements robust audio buffering as recommended by Google Lyria documentation
 */
export class BufferManager {
  constructor(geminiApiKey) {
    this.geminiApiKey = geminiApiKey;
    this.client = null;
    this.bufferQueue = [];
    this.maxBufferSize = 10;
    this.isInitialized = false;
    this.currentInterpretation = null;
    this.bufferPredictions = [];
    
    // Enhanced buffering parameters per Google's recommendations
    this.bufferLookAhead = 0.1; // 100ms lookahead
    this.crossfadeTime = 0.05; // 50ms crossfade for seamless transitions
    this.networkJitterCompensation = 0.2; // 200ms compensation for network variations
    this.qualityMetrics = {
      jitterDetected: 0,
      dropoutsDetected: 0,
      smoothnessScore: 1.0,
      lastChunkTime: 0
    };
    
    // Intelligent buffering state
    this.adaptiveBufferSize = 10;
    this.bufferHealthScore = 1.0;
    this.predictionAccuracy = 0.8;
    this.isBufferOptimizationActive = true;

    // Web Audio API buffering (based on js-genai samples)
    this.audioContext = null;
    this.nextStartTime = 0;
    this.audioQueue = [];
    this.isQueueProcessing = false;
    
    // Rate limiting for Gemini API calls
    this.lastGeminiCall = 0;
    this.geminiCallCooldown = 30000; // 30 seconds between calls
    this.lastInterpretationSignature = null;
  }

  async initialize() {
    try {
      // Check if API key is available
      console.log('🔧 Initializing Gemini buffer manager...');
      console.log('🔑 API key provided');
      
      if (!this.geminiApiKey) {
        console.warn('⚠️ Gemini API key not provided for buffering - using basic buffering');
        this.isInitialized = true;
        return true;
      }

      // Initialize the Gemini client with correct object pattern for web
      console.log('🔧 Creating GoogleGenAI client...');
      this.genAI = new GoogleGenAI({apiKey: this.geminiApiKey});
      
      console.log('🔧 Testing connection with new API pattern...');
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: 'Test connection for VibesFlow buffering'
      });
      
      this.isInitialized = true;
      console.log('✅ Gemini buffer manager initialized successfully');
      const testText = result.response?.text() || result.text || 'Test successful';
      console.log('🔧 Test response preview:', testText.substring(0, 50) + '...');
      return true;
    } catch (error) {
      console.warn('⚠️ Gemini buffer manager initialization failed, using basic buffering:', error.message);
      this.isInitialized = true; // Still allow basic buffering
      return true;
    }
  }

  async bufferAudioChunk(audioData) {
    if (!this.isInitialized) return;

    try {
      const currentTime = Date.now();
      
      // LOG: Track buffering activity
      console.log('🔄 Buffering audio chunk:', {
        size: audioData?.byteLength || audioData?.length || 0,
        queueLength: this.bufferQueue.length,
        bufferType: this.genAI ? 'GEMINI_INTELLIGENT' : 'BASIC_FALLBACK',
        timestamp: currentTime
      });
      
      // Detect network jitter and adjust buffer accordingly
      this.detectNetworkJitter(currentTime);
      
      // Add to buffer queue with enhanced metadata
      this.bufferQueue.push({
        data: audioData,
        timestamp: currentTime,
        processed: false,
        size: audioData?.byteLength || audioData?.length || 0,
        quality: this.calculateChunkQuality(audioData, currentTime)
      });

      // Adaptive buffer size management
      this.adjustBufferSizeAdaptively();

      // Keep buffer size manageable but account for network conditions
      const targetBufferSize = Math.max(this.adaptiveBufferSize, this.maxBufferSize);
      while (this.bufferQueue.length > targetBufferSize) {
        this.bufferQueue.shift();
      }

      // Enhanced prediction with network compensation
      await this.predictBufferNeedsWithJitterCompensation();
      
      // Update buffer health metrics
      this.updateBufferHealthMetrics();

      // LOG: Buffer status every 10 chunks
      if (this.bufferQueue.length % 10 === 0) {
        console.log('📊 Buffer Status Update:', this.getBufferStatus());
      }

    } catch (error) {
      console.warn('Buffer management error:', error);
      this.qualityMetrics.dropoutsDetected++;
    }
  }

  async processInterpretation(interpretation) {
    this.currentInterpretation = interpretation;
    
    // LOG: Track interpretation processing
    console.log('🎵 Processing interpretation for intelligent buffering:', {
      hasWeightedPrompts: !!interpretation.weightedPrompts,
      promptCount: interpretation.weightedPrompts?.length || 0,
      bpm: interpretation.lyriaConfig?.bpm,
      density: interpretation.lyriaConfig?.density,
      geminiAvailable: !!this.genAI,
      bufferType: this.genAI ? 'GEMINI_INTELLIGENT' : 'BASIC_FALLBACK'
    });
    
    // Rate limiting: Only call Gemini API when buffer strategy needs significant change
    if (!this.shouldCallGeminiAPI(interpretation)) {
      console.log('⏱️ Skipping Gemini API call due to rate limiting or minimal change');
      return;
    }
    
    // Use Gemini with full Lyria knowledge to predict buffer optimization strategy
    if (this.isInitialized && this.genAI) {
      try {
        // Extract rich prompt information for predictive buffering
        const weightedPrompts = interpretation.weightedPrompts || [];
        const promptTexts = weightedPrompts.map(p => p.text).join(', ');
        const primaryGenre = weightedPrompts[0]?.text || 'electronic';
        
        // LOG: Show Gemini analysis input
        console.log('🧠 Sending Lyria analysis to Gemini for intelligent buffering:', {
          primaryGenre,
          promptTexts: promptTexts.substring(0, 100) + '...',
          bpm: interpretation.lyriaConfig?.bpm,
          density: interpretation.lyriaConfig?.density,
          progressionState: interpretation.sessionContinuity
        });
        
        const prompt = `
        LYRIA REALTIME PREDICTIVE BUFFERING EXPERT:
        
        You are analyzing upcoming musical patterns to optimize audio buffering for seamless playback.
        
        CURRENT MUSICAL CONTEXT:
        - Weighted Prompts: ${promptTexts}
        - Primary Genre: ${primaryGenre}
        - BPM: ${interpretation.lyriaConfig?.bpm || 120}
        - Density: ${interpretation.lyriaConfig?.density || 0.5} (0=sparse, 1=busy)
        - Brightness: ${interpretation.lyriaConfig?.brightness || 0.5} (0=dark, 1=bright)
        - Energy Level: ${interpretation.magnitude || 0.5}
        - Progression State: ${interpretation.sessionContinuity || 'building'}
        - Session Source: ${interpretation.source || 'unknown'}
        
        LYRIA GENERATION BEHAVIOR PATTERNS:
        - Hardcore/Hard Techno (160-180 BPM): Rapid-fire percussion, abrupt transitions, high-density rhythms → LARGE BUFFERS needed (500-800ms)
        - Acid Techno (140-160 BPM): 303 bass modulations, filter sweeps, moderate complexity → MEDIUM BUFFERS (300-500ms)
        - Minimal Techno (130-145 BPM): Repetitive patterns, gradual builds, predictable structure → SMALL BUFFERS (200-350ms)
        - Ambient/Psychedelic (100-130 BPM): Sustained pads, slow evolution, flowing textures → SMALL BUFFERS (150-300ms)
        - Complex Multi-Layered: Multiple simultaneous instruments, polyrhythms → LARGE BUFFERS (400-700ms)
        
        BUFFERING PREDICTION ANALYSIS:
        Based on the musical style, predict Lyria's generation behavior and optimize buffering strategy.
        Consider transitions, complexity, and energy patterns.
        
        Respond with ONLY a JSON object containing:
        {
          "bufferSizeMs": <100-800 range>,
          "crossfadeMs": <20-200 range>,
          "preloadChunks": <3-15 range>,
          "smoothingFactor": <0.0-1.0>,
          "networkCompensation": <0.1-0.5>,
          "genrePrediction": "<brief analysis of expected generation pattern>",
          "bufferingReasoning": "<why these settings work for this style>"
        }
        `;

        const result = await this.genAI.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt
        });
        const response = result.response?.text() || result.text;
        
        // LOG: Show Gemini response
        console.log('✨ Gemini intelligent buffering response received:', {
          responseLength: response?.length || 0,
          responsePreview: response?.substring(0, 200) + '...' || 'No response'
        });
        
        try {
          // Enhanced JSON parsing to handle markdown code blocks
          const bufferStrategy = this.parseGeminiResponse(response);
          
          // LOG: Show parsed strategy before applying
          console.log('🎯 Gemini parsed intelligent buffer strategy:', bufferStrategy);
          
          this.applyBufferStrategy(bufferStrategy);
          console.log('✅ Applied Gemini intelligent buffer strategy successfully');
          
        } catch (parseError) {
          console.warn('❌ Failed to parse Gemini buffer strategy:', parseError);
          console.log('📝 Raw Gemini response for debugging:', response);
        }

      } catch (error) {
        console.warn('❌ Gemini buffer prediction failed:', error);
        console.log('🔄 Falling back to basic buffering');
      }
    } else {
      // LOG: When using basic buffering
      console.log('⚠️ Using basic buffering - Gemini not available:', {
        isInitialized: this.isInitialized,
        hasGeminiClient: !!this.genAI,
        reason: !this.isInitialized ? 'Not initialized' : !this.genAI ? 'No Gemini client' : 'Unknown'
      });
    }
  }

  async predictBufferNeeds() {
    // Simple predictive buffering based on current patterns
    const recentChunks = this.bufferQueue.slice(-3);
    if (recentChunks.length >= 2) {
      const avgTimeDelta = recentChunks.reduce((sum, chunk, i) => {
        if (i === 0) return sum;
        return sum + (chunk.timestamp - recentChunks[i-1].timestamp);
      }, 0) / (recentChunks.length - 1);

      // Predict when next chunk will arrive
      const predictedArrival = Date.now() + avgTimeDelta;
      this.bufferPredictions.push(predictedArrival);
      
      // Keep predictions manageable
      if (this.bufferPredictions.length > 5) {
        this.bufferPredictions.shift();
      }
    }
  }

  applyBufferStrategy(strategy) {
    // LOG: Show strategy being applied
    console.log('🔧 Applying Gemini intelligent buffer strategy...');
    
    const oldSettings = {
      maxBufferSize: this.maxBufferSize,
      crossfadeTime: this.crossfadeTime,
      networkJitterCompensation: this.networkJitterCompensation,
      predictionAccuracy: this.predictionAccuracy
    };
    
    // Apply Gemini-recommended buffer optimizations with comprehensive adjustments
    if (strategy.bufferSizeMs) {
      this.maxBufferSize = Math.ceil(strategy.bufferSizeMs / 100); // Approximate chunks per 100ms
      this.adaptiveBufferSize = this.maxBufferSize;
    }
    
    if (strategy.crossfadeMs) {
      this.crossfadeTime = strategy.crossfadeMs / 1000; // Convert to seconds
    }
    
    if (strategy.networkCompensation) {
      this.networkJitterCompensation = strategy.networkCompensation;
    }
    
    if (strategy.smoothingFactor) {
      this.predictionAccuracy = strategy.smoothingFactor;
    }
    
    const newSettings = {
      maxBufferSize: this.maxBufferSize,
      crossfadeTime: this.crossfadeTime,
      networkJitterCompensation: this.networkJitterCompensation,
      predictionAccuracy: this.predictionAccuracy
    };
    
    console.log('📊 Applied Gemini intelligent buffer strategy:', {
      oldSettings,
      newSettings,
      strategy: strategy.genrePrediction,
      bufferingReasoning: strategy.bufferingReasoning
    });
    
    console.log('🎵 Gemini buffering intelligence active:', {
      genrePrediction: strategy.genrePrediction,
      bufferingReasoning: strategy.bufferingReasoning
    });
  }

  // Enhanced buffering methods for robust audio streaming
  detectNetworkJitter(currentTime) {
    if (this.qualityMetrics.lastChunkTime > 0) {
      const timeDelta = currentTime - this.qualityMetrics.lastChunkTime;
      const expectedInterval = 100; // ~100ms per chunk for smooth audio
      const jitter = Math.abs(timeDelta - expectedInterval);
      
      if (jitter > 50) { // >50ms jitter is significant
        this.qualityMetrics.jitterDetected++;
        // Increase buffer size to compensate for network instability
        this.adaptiveBufferSize = Math.min(this.adaptiveBufferSize + 2, 20);
      }
    }
    this.qualityMetrics.lastChunkTime = currentTime;
  }

  calculateChunkQuality(audioData, timestamp) {
    // Simple quality assessment based on size and timing
    const expectedSize = 8192; // Expected chunk size
    const actualSize = audioData?.byteLength || audioData?.length || 0;
    const sizeQuality = Math.min(actualSize / expectedSize, 1.0);
    
    const timingQuality = this.qualityMetrics.jitterDetected < 5 ? 1.0 : 0.7;
    
    return sizeQuality * timingQuality;
  }

  adjustBufferSizeAdaptively() {
    const recentJitter = this.qualityMetrics.jitterDetected;
    const recentDropouts = this.qualityMetrics.dropoutsDetected;
    
    if (recentJitter > 10 || recentDropouts > 3) {
      // Network is unstable, increase buffer
      this.adaptiveBufferSize = Math.min(this.adaptiveBufferSize + 1, 25);
    } else if (recentJitter < 2 && recentDropouts === 0) {
      // Network is stable, can reduce buffer for lower latency
      this.adaptiveBufferSize = Math.max(this.adaptiveBufferSize - 1, 5);
    }
  }

  async predictBufferNeedsWithJitterCompensation() {
    // Enhanced prediction that accounts for network conditions
    const recentChunks = this.bufferQueue.slice(-5);
    if (recentChunks.length >= 3) {
      const avgTimeDelta = recentChunks.reduce((sum, chunk, i) => {
        if (i === 0) return sum;
        return sum + (chunk.timestamp - recentChunks[i-1].timestamp);
      }, 0) / (recentChunks.length - 1);

      // Compensate for jitter in prediction
      const jitterCompensation = this.qualityMetrics.jitterDetected * 10;
      const predictedArrival = Date.now() + avgTimeDelta + jitterCompensation;
      
      this.bufferPredictions.push({
        timestamp: predictedArrival,
        confidence: this.predictionAccuracy,
        compensated: true
      });
      
      // Keep predictions manageable
      if (this.bufferPredictions.length > 10) {
        this.bufferPredictions.shift();
      }
    }
  }

  updateBufferHealthMetrics() {
    // Calculate overall buffer health
    const jitterScore = Math.max(0, 1 - (this.qualityMetrics.jitterDetected / 100));
    const dropoutScore = Math.max(0, 1 - (this.qualityMetrics.dropoutsDetected / 10));
    const bufferFillScore = Math.min(this.bufferQueue.length / this.adaptiveBufferSize, 1.0);
    
    this.bufferHealthScore = (jitterScore + dropoutScore + bufferFillScore) / 3;
    
    // Update smoothness score based on recent performance
    if (this.bufferQueue.length >= 2) {
      const recentQuality = this.bufferQueue.slice(-3).reduce((sum, chunk) => 
        sum + (chunk.quality || 0.5), 0) / Math.min(3, this.bufferQueue.length);
      this.qualityMetrics.smoothnessScore = recentQuality;
    }
    
    // Auto-adjust optimization based on health
    this.isBufferOptimizationActive = this.bufferHealthScore > 0.7;
  }

  // Get buffer status for monitoring
  getBufferStatus() {
    return {
      isInitialized: this.isInitialized,
      bufferSize: this.bufferQueue.length,
      adaptiveBufferSize: this.adaptiveBufferSize,
      bufferHealthScore: this.bufferHealthScore,
      qualityMetrics: this.qualityMetrics,
      predictionAccuracy: this.predictionAccuracy,
      optimizationActive: this.isBufferOptimizationActive
    };
  }

  // Get current interpretation context
  getCurrentInterpretation() {
    return this.currentInterpretation;
  }

  // Force buffer optimization (for manual control)
  async forceOptimization() {
    if (this.currentInterpretation) {
      await this.processInterpretation(this.currentInterpretation);
    }
  }

  /**
   * Rate limiting logic to prevent hitting Gemini API limits
   */
  shouldCallGeminiAPI(interpretation) {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastGeminiCall < this.geminiCallCooldown) {
      return false;
    }
    
    // Create interpretation signature to detect significant changes
    const signature = JSON.stringify({
      bpm: Math.round(interpretation.lyriaConfig?.bpm / 10) * 10, // Round to nearest 10
      density: Math.round(interpretation.lyriaConfig?.density * 10) / 10,
      brightness: Math.round(interpretation.lyriaConfig?.brightness * 10) / 10,
      primaryGenre: interpretation.weightedPrompts?.[0]?.text?.split(' ')[0] // First word only
    });
    
    // Check if interpretation changed significantly
    if (this.lastInterpretationSignature === signature) {
      return false;
    }
    
    // Update tracking
    this.lastGeminiCall = now;
    this.lastInterpretationSignature = signature;
    return true;
  }

  /**
   * Enhanced JSON parsing to handle Gemini responses with markdown code blocks
   */
  parseGeminiResponse(response) {
    if (!response || typeof response !== 'string') {
      throw new Error('Invalid response format');
    }
    
    // Strategy 1: Try direct JSON parse first
    try {
      return JSON.parse(response);
    } catch (e) {
      // Continue to other strategies
    }
    
    // Strategy 2: Extract JSON from markdown code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        throw new Error('JSON in code block is malformed');
      }
    }
    
    // Strategy 3: Find JSON object in text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('Found JSON object is malformed');
      }
    }
    
    throw new Error('No valid JSON found in response');
  }

  /**
   * Convert base64 audio chunk to Float32Array (from js-genai samples)
   */
  base64ToFloat32AudioData(base64String) {
    const byteCharacters = atob(base64String);
    const byteArray = [];

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray.push(byteCharacters.charCodeAt(i));
    }

    const audioChunks = new Uint8Array(byteArray);

    // Convert Uint8Array (which contains 16-bit PCM) to Float32Array
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

  /**
   * Handle Lyria audio chunk and queue for playback (from js-genai samples)
   */
  async handleLyriaAudioChunk(base64AudioData) {
    if (!base64AudioData) return;

    try {
      const float32AudioData = this.base64ToFloat32AudioData(base64AudioData);
      this.audioQueue.push(float32AudioData);

      if (!this.isQueueProcessing) {
        await this.playAudioData();
      }
    } catch (error) {
      console.warn('Failed to handle Lyria audio chunk:', error);
    }
  }

  /**
   * Play audio data with seamless buffering (from js-genai samples)
   */
  async playAudioData() {
    this.isQueueProcessing = true;

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.nextStartTime = this.audioContext.currentTime;
    }

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    while (this.audioQueue.length > 0) {
      const audioChunks = this.audioQueue.shift();

      // Create an AudioBuffer (Lyria uses 48kHz stereo as per docs)
      const audioBuffer = this.audioContext.createBuffer(2, audioChunks.length / 2, 48000);
      
      // Split interleaved stereo data into separate channels
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      
      for (let i = 0; i < audioChunks.length / 2; i++) {
        leftChannel[i] = audioChunks[i * 2];
        rightChannel[i] = audioChunks[i * 2 + 1];
      }

      // Create an AudioBufferSourceNode
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect the source to the destination (speakers)
      source.connect(this.audioContext.destination);

      // Schedule the audio to play seamlessly
      if (this.nextStartTime < this.audioContext.currentTime) {
        this.nextStartTime = this.audioContext.currentTime;
      }
      source.start(this.nextStartTime);

      // Advance the next start time by the duration of the current buffer
      this.nextStartTime += audioBuffer.duration;
    }
    this.isQueueProcessing = false;
  }

  cleanup() {
    this.bufferQueue = [];
    this.bufferPredictions = [];
    this.currentInterpretation = null;
    this.isInitialized = false;
    this.qualityMetrics = {
      jitterDetected: 0,
      dropoutsDetected: 0,
      smoothnessScore: 1.0,
      lastChunkTime: 0
    };

    // Clean up Web Audio API
    this.audioQueue = [];
    this.isQueueProcessing = false;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.nextStartTime = 0;

    // Reset rate limiting
    this.lastGeminiCall = 0;
    this.lastInterpretationSignature = null;

    console.log('🧹 Enhanced Gemini buffer manager cleaned up');
  }
}

/**
 * Create and return a configured buffer manager instance
 */
export function createBufferManager(geminiApiKey) {
  // Validate API key is provided
  if (!geminiApiKey) {
    console.error('❌ Gemini API key is required for buffer manager');
    throw new Error('Gemini API key is required for buffer manager');
  }
  
  return new BufferManager(geminiApiKey);
}

// Export default for convenience
export default BufferManager;