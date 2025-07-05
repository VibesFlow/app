/**
 * TYPES.TS - TypeScript Interface Definitions
 * Shared type definitions for VibesFlow orchestration modules
 */

// Enhanced sensor data interface with micro-movement and acceleration support
export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  source?: string;
  isDecay?: boolean;
  pattern?: MusicPattern;
  
  // Enhanced movement tracking
  velocity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
  motionType?: string;
  intensity?: number;
  responseFactor?: number;
  motionDirection?: { x: number; y: number; magnitude: number };
  
  // Movement characteristics
  isMicroMovement?: boolean;
  isAccelerating?: boolean;
  rawMagnitude?: number;
  velocityMagnitude?: number;
  accelerationMagnitude?: number;
}

// Music pattern interface for mobile visualization
export interface MusicPattern {
  notes: number[];
  durations: number[];
  velocity: number[];
  instruments: string[];
}

// Enhanced Lyria configuration interface
export interface LyriaConfig {
  bpm: number;
  density: number;
  brightness: number;
  temperature?: number;
  guidance: number;
  muteBass?: boolean;
  muteDrums?: boolean;
  onlyBassAndDrums?: boolean;
}

// Weighted prompts for smooth transitions
export interface WeightedPrompt {
  text: string;
  weight: number;
}

// Enhanced movement pattern analysis
export interface MovementPattern {
  type: string;
  direction: { x: number; y: number; z: number };
  intensity: number;
  characteristics: string[];
}

// Enhanced sensor interpretation result
export interface Interpretation {
  stylePrompt: string;
  weightedPrompts: WeightedPrompt[];
  lyriaConfig: LyriaConfig;
  magnitude: number;
  rawMagnitude: number;
  timestamp: number;
  sensorSource?: string;
  hasTransition: boolean;
  intensity: string;
  movement: MovementPattern;
  
  // Enhanced movement properties
  velocityMagnitude?: number;
  accelerationMagnitude?: number;
  isMicroMovement?: boolean;
  isAccelerating?: boolean;
}

// Rave genre definition
export interface RaveGenre {
  base: string;
  instruments: string[];
  moods: string[];
  bpmRange: [number, number];
  densityRange: [number, number];
  brightnessRange: [number, number];
}

// Enhanced orchestrator state
export interface OrchestratorState {
  connected: boolean;
  streaming: boolean;
  reconnectAttempts?: number;
  queueLength?: number;
  lastInterpretation?: Partial<Interpretation>;
}

// Audio buffer manager status
export interface AudioBufferStatus {
  isInitialized: boolean;
  bufferQueueLength: number;
  activeSourcesCount: number;
  nextStartTime: number;
  currentTime: number;
  volume: number;
  effectsEnabled: boolean;
}

// Background processor status
export interface BackgroundProcessorStatus {
  isInitialized: boolean;
  queueLength: number;
  activeProcessing: number;
  maxConcurrentProcessing: number;
  capabilities: {
    webmOpusSupport: boolean;
    initialized: boolean;
  };
  metrics: {
    chunksProcessed: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    compressionRatio: number;
    errors: number;
  };
}

// Callback function types
export type SensorCallback = (data: SensorData) => void;
export type AudioChunkCallback = (data: ArrayBuffer | Uint8Array | string) => void;
export type ErrorCallback = (error: Error) => void;
export type StateChangeCallback = (state: OrchestratorState) => void;

// Platform-specific sensor options
export interface SensorOptions {
  updateInterval?: number;
  enableAccelerometer?: boolean;
  enableGyroscope?: boolean;
  enableCamera?: boolean;
  enableMouse?: boolean;
  enableKeyboard?: boolean;
  microMovementThreshold?: number;
  accelerationThreshold?: number;
  motionSensitivity?: number;
}

console.log('VibesFlow orchestration types loaded with enhanced sensor support'); 