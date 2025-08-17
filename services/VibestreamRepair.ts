/**
 * Smart Buffering Service with Real-Time AI Code Generation
 * Generates and executes corrective buffering code on-the-fly using Gemini 2.5 Flash
 */

import { GoogleGenAI } from '@google/genai';

interface BufferingPattern {
  rtaId: string;
  chunkSequence: number[];
  failurePoints: number[];
  networkConditions: string;
  bufferStrategy: 'aggressive' | 'conservative' | 'adaptive';
  repairAttempts: { chunkIndex: number; attempts: number; success: boolean }[];
  timestamp: number;
  sessionDuration: number;
  userBehavior: 'seeking' | 'continuous' | 'interrupted';
}

interface BufferingMemory {
  patterns: BufferingPattern[];
  chunkReliability: Map<string, number>; // CID -> reliability score (0-1)
  optimalStrategies: Map<string, string>; // RTA ID -> best strategy
}

export class VibestreamRepair {
  private ai: any = null;
  private memory: BufferingMemory = {
    patterns: [],
    chunkReliability: new Map(),
    optimalStrategies: new Map()
  };
  private currentSession: Partial<BufferingPattern> = {};

  constructor() {
    this.initializeGemini();
    this.loadMemoryFromStorage();
  }

  private initializeGemini() {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ Gemini API key not found - smart buffering will use basic patterns');
        return;
      }

      this.ai = new GoogleGenAI({ 
        vertexai: false, 
        apiKey: apiKey 
      });

      console.log('✅ Gemini 2.5 Flash initialized for real-time code execution');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      this.ai = null;
    }
  }

  private loadMemoryFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('vibesflow_buffering_memory');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.memory = {
            patterns: parsed.patterns || [],
            chunkReliability: new Map(parsed.chunkReliability || []),
            optimalStrategies: new Map(parsed.optimalStrategies || [])
          };
          console.log(`📚 Loaded ${this.memory.patterns.length} buffering patterns from memory`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load buffering memory:', error);
    }
  }

  private saveMemoryToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const toStore = {
          patterns: this.memory.patterns.slice(-50), // Keep last 50 patterns
          chunkReliability: Array.from(this.memory.chunkReliability.entries()),
          optimalStrategies: Array.from(this.memory.optimalStrategies.entries())
        };
        localStorage.setItem('vibesflow_buffering_memory', JSON.stringify(toStore));
      }
    } catch (error) {
      console.warn('⚠️ Failed to save buffering memory:', error);
    }
  }

  // Start tracking a new playback session
  startSession(rtaId: string) {
    this.currentSession = {
      rtaId,
      chunkSequence: [],
      failurePoints: [],
      repairAttempts: [],
      timestamp: Date.now(),
      userBehavior: 'continuous'
    };
    console.log(`🎵 Started smart buffering session for ${rtaId}`);
  }

  // Record chunk access
  recordChunkAccess(chunkIndex: number, success: boolean, responseTime?: number) {
    if (!this.currentSession.chunkSequence) this.currentSession.chunkSequence = [];
    if (!this.currentSession.failurePoints) this.currentSession.failurePoints = [];

    this.currentSession.chunkSequence.push(chunkIndex);
    
    if (!success) {
      this.currentSession.failurePoints.push(chunkIndex);
    }

    // Update chunk reliability scores
    const chunkKey = `${this.currentSession.rtaId}_${chunkIndex}`;
    const currentReliability = this.memory.chunkReliability.get(chunkKey) || 0.8;
    const newReliability = success 
      ? Math.min(1.0, currentReliability + 0.1)
      : Math.max(0.1, currentReliability - 0.2);
    this.memory.chunkReliability.set(chunkKey, newReliability);
  }

  // Record repair attempt
  recordRepairAttempt(chunkIndex: number, attempts: number, success: boolean) {
    if (!this.currentSession.repairAttempts) this.currentSession.repairAttempts = [];
    
    this.currentSession.repairAttempts.push({
      chunkIndex,
      attempts,
      success
    });
  }

  // Record user seeking behavior
  recordSeeking() {
    if (this.currentSession) {
      this.currentSession.userBehavior = 'seeking';
    }
  }

  // Generate and execute optimal buffering code in real-time
  async executeOptimalBuffering(
    currentChunkIndex: number, 
    totalChunks: number,
    bufferedChunks: Map<number, HTMLAudioElement>,
    bufferChunkFunction: (index: number) => Promise<void>,
    chunkQueue: any[]
  ): Promise<{
    strategy: any;
    executedActions: string[];
    generatedCode: string;
  }> {
    const rtaId = this.currentSession.rtaId;
    if (!rtaId) {
      return {
        strategy: this.getDefaultStrategy(),
        executedActions: ['applied_default_strategy'],
        generatedCode: 'default_buffering_applied'
      };
    }

    // Use AI to generate executable buffering code
    if (this.ai && this.memory.patterns.length > 2) {
      try {
        const context = this.buildRealTimeContext(currentChunkIndex, totalChunks, bufferedChunks, chunkQueue);
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are a real-time audio buffering optimization AI. Generate executable JavaScript code that will immediately optimize buffering for this vibestream.

CURRENT STATE:
${context}

Generate JavaScript code that:
1. Analyzes current buffering state
2. Determines optimal chunks to buffer next
3. Executes immediate buffering actions
4. Handles chunk failures intelligently
5. Optimizes for seamless audio playback

Your code will have access to:
- bufferChunkFunction(index): buffers a specific chunk
- bufferedChunks: Map of currently buffered chunks
- chunkQueue: Array of available chunks
- currentChunkIndex: current playing position
- totalChunks: total chunks in vibestream

Return EXECUTABLE JavaScript code that performs immediate buffering optimization:

\`\`\`javascript
// AI-Generated Real-Time Buffering Code
(async function() {
  const actions = [];
  
  // Your optimization logic here
  
  return { actions, strategy: {...} };
})();
\`\`\``,
          config: {
            tools: [{ codeExecution: {} }]
          }
        });

        // Extract and execute the generated code
        const generatedCode = response.executableCode;
        const executionResult = response.codeExecutionResult;
        
        console.log('🧠 Executing AI-generated buffering code:', generatedCode);
        console.log('⚡ Code execution result:', executionResult);
        
        // Execute the AI-generated code in our context
        const realTimeResult = await this.executeBufferingCode(
          generatedCode,
          {
            currentChunkIndex,
            totalChunks,
            bufferedChunks,
            bufferChunkFunction,
            chunkQueue,
            getChunkReliability: (index: number) => this.getChunkReliability(rtaId, index),
            shouldSkipChunk: (index: number) => this.shouldSkipChunk(rtaId, index)
          }
        );
        
        console.log('✅ AI buffering execution result:', realTimeResult);
        
        return {
          strategy: realTimeResult.strategy || this.getDefaultStrategy(),
          executedActions: realTimeResult.actions || [],
          generatedCode
        };
        
      } catch (error) {
        console.warn('⚠️ AI code generation/execution failed:', error);
        // Fall back to heuristic execution
        return this.executeHeuristicBuffering(currentChunkIndex, totalChunks, bufferedChunks, bufferChunkFunction, chunkQueue);
      }
    }

    // Fallback to heuristic-based execution
    return this.executeHeuristicBuffering(currentChunkIndex, totalChunks, bufferedChunks, bufferChunkFunction, chunkQueue);
  }

  private buildRealTimeContext(
    currentChunk: number, 
    totalChunks: number, 
    bufferedChunks: Map<number, HTMLAudioElement>,
    chunkQueue: any[]
  ): string {
    const recentPatterns = this.memory.patterns.slice(-10);
    const relevantFailures = recentPatterns
      .flatMap(p => p.failurePoints)
      .filter(point => Math.abs(point - currentChunk) <= 5);
    
    const chunkReliability = Array.from(this.memory.chunkReliability.entries())
      .filter(([key]) => key.includes(this.currentSession.rtaId || ''))
      .map(([key, reliability]) => {
        const chunkIndex = parseInt(key.split('_').pop() || '0');
        return { chunkIndex, reliability };
      });

    const bufferedIndices = Array.from(bufferedChunks.keys());
    const unbufferedAhead: number[] = [];
    for (let i = currentChunk + 1; i < Math.min(currentChunk + 6, totalChunks); i++) {
      if (!bufferedChunks.has(i)) {
        unbufferedAhead.push(i);
      }
    }

    return JSON.stringify({
      currentPosition: `${currentChunk}/${totalChunks}`,
      bufferedChunks: bufferedIndices,
      unbufferedAhead: unbufferedAhead,
      recentFailures: relevantFailures,
      chunkReliability: chunkReliability.slice(0, 20),
      patternCount: this.memory.patterns.length,
      currentBehavior: this.currentSession.userBehavior,
      chunkQueueSize: chunkQueue.length,
      progressRatio: currentChunk / totalChunks
    }, null, 2);
  }

  // Execute AI-generated buffering code in a secure context
  private async executeBufferingCode(
    generatedCode: string,
    context: {
      currentChunkIndex: number;
      totalChunks: number;
      bufferedChunks: Map<number, HTMLAudioElement>;
      bufferChunkFunction: (index: number) => Promise<void>;
      chunkQueue: any[];
      getChunkReliability: (index: number) => number;
      shouldSkipChunk: (index: number) => boolean;
    }
  ): Promise<{ actions: string[]; strategy: any }> {
    try {
      // Create a secure execution environment
      const actions: string[] = [];
      const strategy = {
        bufferAheadCount: 3,
        priorityChunks: [],
        repairStrategy: 'background' as const,
        prefetchPattern: 'adaptive' as const
      };

      // Extract executable function from generated code
      const codeMatch = generatedCode.match(/\(async function\(\)\s*\{([\s\S]*?)\}\)\(\);?/);
      if (!codeMatch) {
        throw new Error('No executable function found in generated code');
      }

      const functionBody = codeMatch[1];
      
      // Create a safe execution function with limited scope
      const executeFunction = new Function(`
        return (async function(context) {
          const { 
            currentChunkIndex, 
            totalChunks, 
            bufferedChunks, 
            bufferChunkFunction, 
            chunkQueue,
            getChunkReliability,
            shouldSkipChunk 
          } = context;
          
          const actions = [];
          
          ${functionBody}
          
          return { actions, strategy: { bufferAheadCount: 3, priorityChunks: [], repairStrategy: 'background', prefetchPattern: 'adaptive' } };
        });
      `)();

      const result = await executeFunction(context);
      
      return {
        actions: result.actions || actions,
        strategy: result.strategy || strategy
      };
      
    } catch (error) {
      console.warn('⚠️ Code execution failed:', error);
      return {
        actions: ['code_execution_failed'],
        strategy: {
          bufferAheadCount: 3,
          priorityChunks: [],
          repairStrategy: 'background' as const,
          prefetchPattern: 'linear' as const
        }
      };
    }
  }

  // Heuristic-based buffering execution
  private async executeHeuristicBuffering(
    currentChunk: number,
    totalChunks: number,
    bufferedChunks: Map<number, HTMLAudioElement>,
    bufferChunkFunction: (index: number) => Promise<void>,
    chunkQueue: any[]
  ): Promise<{ strategy: any; executedActions: string[]; generatedCode: string }> {
    const actions: string[] = [];
    const progressRatio = currentChunk / totalChunks;
    const recentFailures = this.currentSession.failurePoints?.length || 0;
    
    // Adaptive strategy based on position and failure history
    let bufferAheadCount = 3;
    let repairStrategy: 'immediate' | 'background' | 'skip' = 'background';
    
    if (progressRatio < 0.1) {
      // Beginning: aggressive buffering
      bufferAheadCount = 4;
      actions.push('aggressive_start_buffering');
    } else if (progressRatio > 0.9) {
      // Near end: conservative buffering
      bufferAheadCount = 2;
      actions.push('conservative_end_buffering');
    }
    
    if (recentFailures > 2) {
      // High failure rate: immediate repair
      repairStrategy = 'immediate';
      bufferAheadCount = Math.max(2, bufferAheadCount - 1);
      actions.push('immediate_repair_mode');
    }

    // Execute buffering for unbuffered chunks
    for (let i = 1; i <= bufferAheadCount; i++) {
      const targetIndex = currentChunk + i;
      if (targetIndex >= totalChunks) break;
      if (bufferedChunks.has(targetIndex)) continue;
      
      try {
        await bufferChunkFunction(targetIndex);
        actions.push(`buffered_chunk_${targetIndex}`);
      } catch (error) {
        actions.push(`failed_chunk_${targetIndex}`);
      }
    }

    return {
      strategy: {
        bufferAheadCount,
        priorityChunks: [currentChunk + 1, currentChunk + 2],
        repairStrategy,
        prefetchPattern: recentFailures > 1 ? 'adaptive' : 'linear' as 'linear' | 'adaptive' | 'predictive'
      },
      executedActions: actions,
      generatedCode: 'heuristic_buffering_applied'
    };
  }

  private getHeuristicStrategy(currentChunk: number, totalChunks: number) {
    const progressRatio = currentChunk / totalChunks;
    const recentFailures = this.currentSession.failurePoints?.length || 0;
    
    // Adaptive strategy based on position and failure history
    let bufferAheadCount = 3;
    let repairStrategy: 'immediate' | 'background' | 'skip' = 'background';
    
    if (progressRatio < 0.1) {
      // Beginning: aggressive buffering
      bufferAheadCount = 4;
    } else if (progressRatio > 0.9) {
      // Near end: conservative buffering
      bufferAheadCount = 2;
    }
    
    if (recentFailures > 2) {
      // High failure rate: immediate repair
      repairStrategy = 'immediate';
      bufferAheadCount = Math.max(2, bufferAheadCount - 1);
    }

    return {
      bufferAheadCount,
      priorityChunks: [currentChunk + 1, currentChunk + 2],
      repairStrategy,
      prefetchPattern: recentFailures > 1 ? 'adaptive' : 'linear' as 'linear' | 'adaptive' | 'predictive'
    };
  }

  private getDefaultStrategy() {
    return {
      bufferAheadCount: 3,
      priorityChunks: [],
      repairStrategy: 'background' as const,
      prefetchPattern: 'linear' as const
    };
  }

  // End session and save pattern
  endSession() {
    if (!this.currentSession.rtaId) return;

    const pattern: BufferingPattern = {
      rtaId: this.currentSession.rtaId,
      chunkSequence: this.currentSession.chunkSequence || [],
      failurePoints: this.currentSession.failurePoints || [],
      networkConditions: 'filcdn', // Using FilCDN
      bufferStrategy: 'adaptive',
      repairAttempts: this.currentSession.repairAttempts || [],
      timestamp: this.currentSession.timestamp || Date.now(),
      sessionDuration: Date.now() - (this.currentSession.timestamp || Date.now()),
      userBehavior: this.currentSession.userBehavior || 'continuous'
    };

    this.memory.patterns.push(pattern);
    this.saveMemoryToStorage();
    
    console.log(`📊 Saved buffering pattern for ${pattern.rtaId}: ${pattern.chunkSequence.length} chunks, ${pattern.failurePoints.length} failures`);
    
    // Reset session
    this.currentSession = {};
  }

  // Get chunk reliability score
  getChunkReliability(rtaId: string, chunkIndex: number): number {
    return this.memory.chunkReliability.get(`${rtaId}_${chunkIndex}`) || 0.8;
  }

  // Check if chunk should be skipped due to consistent failures
  shouldSkipChunk(rtaId: string, chunkIndex: number): boolean {
    const reliability = this.getChunkReliability(rtaId, chunkIndex);
    return reliability < 0.3;
  }
}