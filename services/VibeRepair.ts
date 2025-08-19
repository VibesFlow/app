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
}

export class VibestreamRepair {
  private currentSession: Partial<BufferingPattern> = {};
  private patterns: BufferingPattern[] = [];

  constructor() {
    this.loadPatternsFromStorage();
  }

  // Start tracking a session (simplified)
  startSession(rtaId: string) {
    this.currentSession = {
      rtaId,
      chunkFailures: [],
      timestamp: Date.now(),
      userBehavior: 'continuous'
    };
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

  // End session and save pattern (simplified)
  endSession() {
    if (!this.currentSession.rtaId) return;

    const pattern: BufferingPattern = {
      rtaId: this.currentSession.rtaId,
      chunkFailures: this.currentSession.chunkFailures || [],
      sessionDuration: Date.now() - (this.currentSession.timestamp || Date.now()),
      userBehavior: this.currentSession.userBehavior || 'continuous',
      timestamp: this.currentSession.timestamp || Date.now()
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