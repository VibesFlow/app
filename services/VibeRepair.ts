/**
 * VibeRepair buffering analytics service
 * Focuses on essential pattern tracking for the ContinuousAudioStreamer
 */

import { Platform } from 'react-native';

interface BufferingPattern {
  rtaId: string;
  chunkFailures: number[];
  sessionDuration: number;
  userBehavior: 'seeking' | 'continuous' | 'interrupted';
  timestamp: number;
  totalChunks: number;
  completedChunks: number;
  bufferUnderflows: number;
  networkQuality: 'excellent' | 'good' | 'poor';
}

export class VibestreamRepair {
  private currentSession: Partial<BufferingPattern> = {};
  private patterns: BufferingPattern[] = [];

  constructor() {
    this.loadPatternsFromStorage();
  }

  // Start tracking a session with enhanced metrics
  startSession(rtaId: string, totalChunks: number = 0) {
    this.currentSession = {
      rtaId,
      chunkFailures: [],
      timestamp: Date.now(),
      userBehavior: 'continuous',
      totalChunks,
      completedChunks: 0,
      bufferUnderflows: 0,
      networkQuality: 'excellent'
    };
    console.log(`📊 Started analytics session for ${rtaId} (${totalChunks} chunks)`);
  }

  // Record chunk failure (simplified)
  recordChunkFailure(chunkIndex: number) {
    if (!this.currentSession.chunkFailures) this.currentSession.chunkFailures = [];
    this.currentSession.chunkFailures.push(chunkIndex);
  }

  // Record seeking behavior
  recordSeeking() {
    if (this.currentSession) {
      this.currentSession.userBehavior = 'seeking';
    }
  }

  // Record chunk completion
  recordChunkCompletion() {
    if (this.currentSession.completedChunks !== undefined) {
      this.currentSession.completedChunks++;
    }
  }

  // Record buffer underflow
  recordBufferUnderflow() {
    if (this.currentSession.bufferUnderflows !== undefined) {
      this.currentSession.bufferUnderflows++;
    }
  }

  // Update network quality
  updateNetworkQuality(quality: 'excellent' | 'good' | 'poor') {
    if (this.currentSession) {
      this.currentSession.networkQuality = quality;
    }
  }

  // End session and save pattern (simplified)
  endSession() {
    if (!this.currentSession.rtaId) return;

    const pattern: BufferingPattern = {
      rtaId: this.currentSession.rtaId,
      chunkFailures: this.currentSession.chunkFailures || [],
      sessionDuration: Date.now() - (this.currentSession.timestamp || Date.now()),
      userBehavior: this.currentSession.userBehavior || 'continuous',
      timestamp: this.currentSession.timestamp || Date.now(),
      totalChunks: this.currentSession.totalChunks || 0,
      completedChunks: this.currentSession.completedChunks || 0,
      bufferUnderflows: this.currentSession.bufferUnderflows || 0,
      networkQuality: this.currentSession.networkQuality || 'excellent'
    };

    this.patterns.push(pattern);
    this.savePatternsToStorage();
    
    // Reset session
    this.currentSession = {};
  }

  private loadPatternsFromStorage() {
    try {
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem('vibesflow_buffering_patterns');
        if (stored) {
          this.patterns = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load buffering patterns:', error);
    }
  }

  private savePatternsToStorage() {
    try {
      if (Platform.OS === 'web') {
        // Keep only last 20 patterns to prevent memory bloat
        const patternsToStore = this.patterns.slice(-20);
        localStorage.setItem('vibesflow_buffering_patterns', JSON.stringify(patternsToStore));
      }
    } catch (error) {
      console.warn('⚠️ Failed to save buffering patterns:', error);
    }
  }
}