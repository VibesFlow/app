/**
 * TYPES.TS - TypeScript Interface Definitions
 * Shared type definitions for VibesFlow orchestration modules
 */

// Sensor data interface
export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  source?: string;
  isDecay?: boolean;
  pattern?: MusicPattern;
}

// Music pattern interface for mobile visualization
export interface MusicPattern {
  notes: number[];
  durations: number[];
  velocity: number[];
  instruments: string[];
}

// Lyria configuration interface
export interface LyriaConfig {
  bpm: number;
  density: number;
  brightness: number;
  temperature: number;
  guidance: number;
  muteBass: boolean;
  muteDrums: boolean;
  onlyBassAndDrums: boolean;
}

// Weighted prompts for smooth transitions
export interface WeightedPrompt {
  text: string;
  weight: number;
}

// Sensor interpretation result
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
  movement: string;
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

// Orchestrator state
export interface OrchestratorState {
  connected: boolean;
  streaming: boolean;
  reconnectAttempts?: number;
  queueLength?: number;
}

// Callback function types
export type SensorCallback = (data: SensorData) => void;
export type AudioChunkCallback = (data: ArrayBuffer | Uint8Array) => void;
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
}

console.log('VibesFlow orchestration types loaded'); 