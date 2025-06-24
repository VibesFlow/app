/**
 * MOBILE.JS - Mobile Platform Orchestration Module
 * Handles iOS/Android-specific sensor inputs and audio outputs for VibesFlow
 * Optimized for ultra-low latency real-time rave experience on mobile devices
 */

import { Platform } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';

export class MobileOrchestrator {
  constructor() {
    this.sensorCallbacks = [];
    this.accelSubscription = null;
    this.gyroSubscription = null;
    this.patternInterval = null;
    this.isInitialized = false;
    this.lastSensorData = { x: 0, y: 0, z: 0, timestamp: Date.now() };
    this.currentPattern = {
      notes: [],
      durations: [],
      velocity: [],
      instruments: []
    };
  }

  // Register sensor data callback
  onSensorData(callback) {
    this.sensorCallbacks.push(callback);
  }

  // Emit sensor data to all registered callbacks
  emitSensorData(sensorData) {
    this.sensorCallbacks.forEach(callback => {
      try {
        callback(sensorData);
      } catch (error) {
        console.warn('Mobile sensor callback error:', error);
      }
    });
  }

  // Initialize mobile sensors with ultra-low latency
  async initializeSensors() {
    if (Platform.OS === 'web') return [];

    try {
      // Set ultra-low latency update intervals for responsive rave experience
      Accelerometer.setUpdateInterval(25); // 40 FPS for maximum responsiveness
      Gyroscope.setUpdateInterval(25);

      const cleanupFunctions = [];

      // Enhanced accelerometer with noise filtering and sensitivity optimization
      this.accelSubscription = Accelerometer.addListener((result) => {
        // Apply smart filtering to reduce noise while maintaining responsiveness
        const filteredX = this.applyLowPassFilter(result.x, this.lastSensorData.x, 0.3);
        const filteredY = this.applyLowPassFilter(result.y, this.lastSensorData.y, 0.3);
        const filteredZ = this.applyLowPassFilter(result.z, this.lastSensorData.z, 0.3);

        // Calculate movement intensity for rave scaling
        const magnitude = Math.sqrt(filteredX ** 2 + filteredY ** 2 + filteredZ ** 2);
        const intensity = Math.min(magnitude * 1.5, 5); // Amplify for rave sensitivity

        const sensorData = {
          x: filteredX * 2, // Amplify for more dramatic response
          y: filteredY * 2,
          z: Math.max(intensity, 0.1), // Maintain baseline activity
          timestamp: Date.now(),
          source: 'accelerometer',
          rawMagnitude: magnitude
        };

        this.lastSensorData = sensorData;
        this.emitSensorData(sensorData);
      });

      // Enhanced gyroscope for rotational movement detection
      this.gyroSubscription = Gyroscope.addListener((result) => {
        // Combine gyro data with existing accelerometer data for richer input
        const gyroIntensity = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
        
        const combinedSensorData = {
          x: this.lastSensorData.x + result.x * 0.1, // Blend gyro with accel
          y: this.lastSensorData.y + result.y * 0.1,
          z: this.lastSensorData.z + gyroIntensity * 0.2,
          timestamp: Date.now(),
          source: 'gyroscope',
          gyroIntensity: gyroIntensity
        };

        this.emitSensorData(combinedSensorData);
      });

      // Initialize pattern generation for mobile visualization
      this.initializePatternGeneration();

      cleanupFunctions.push(() => {
        this.accelSubscription?.remove();
        this.gyroSubscription?.remove();
        if (this.patternInterval) {
          clearInterval(this.patternInterval);
        }
      });

      this.isInitialized = true;
      console.log('Mobile sensors initialized with enhanced rave responsiveness');
      return cleanupFunctions;

    } catch (error) {
      console.error('Mobile sensor initialization error:', error);
      return [];
    }
  }

  // Low-pass filter for noise reduction while maintaining responsiveness
  applyLowPassFilter(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
  }

  // Enhanced pattern generation for mobile visualization and audio feedback
  initializePatternGeneration() {
    this.patternInterval = setInterval(() => {
      this.generateMobilePattern();
    }, 100); // 10 FPS pattern updates for smooth visualization
  }

  // Generate rich musical patterns based on mobile sensor data
  generateMobilePattern() {
    if (!this.isInitialized || Platform.OS === 'web') return;

    try {
      const magnitude = Math.sqrt(
        this.lastSensorData.x ** 2 + 
        this.lastSensorData.y ** 2 + 
        this.lastSensorData.z ** 2
      );
      const normalizedMagnitude = Math.min(magnitude, 3) / 3; // Extended range for mobile

      // Generate frequency-rich patterns for mobile rave experience
      const baseFreq = 110 + normalizedMagnitude * 660; // Wider frequency range
      const harmonics = [1, 1.25, 1.5, 2, 2.5, 3, 4]; // Rich harmonic series
      
      const notes = harmonics.map(harmonic => baseFreq * harmonic);
      const duration = 200 + Math.random() * 800; // Variable duration
      
      // Dynamic rhythm patterns based on movement intensity
      const rhythmComplexity = Math.floor(normalizedMagnitude * 16) + 4;
      const durations = Array.from({ length: rhythmComplexity }, (_, i) => 
        duration * (0.5 + Math.sin(i * Math.PI / 4) * 0.3)
      );
      
      // Velocity mapping with movement sensitivity
      const baseVelocity = 0.3 + normalizedMagnitude * 0.7;
      const velocity = notes.map((_, i) => 
        baseVelocity + Math.sin(i * Math.PI / 3) * 0.2
      );

      // Instrument selection based on movement characteristics
      const instruments = this.selectInstrumentsForMobile(normalizedMagnitude);

      this.currentPattern = {
        notes,
        durations,
        velocity,
        instruments,
        timestamp: Date.now(),
        magnitude: normalizedMagnitude
      };

      // Emit pattern for visualization
      this.emitSensorData({
        x: this.lastSensorData.x,
        y: this.lastSensorData.y,
        z: this.lastSensorData.z,
        timestamp: Date.now(),
        source: 'pattern',
        pattern: this.currentPattern
      });

    } catch (error) {
      console.warn('Mobile pattern generation failed:', error);
    }
  }

  // Select instruments based on mobile movement patterns
  selectInstrumentsForMobile(intensity) {
    const lowIntensityInstruments = ['sine', 'triangle'];
    const midIntensityInstruments = ['sawtooth', 'square'];
    const highIntensityInstruments = ['noise', 'pulse'];

    if (intensity < 0.3) {
      return lowIntensityInstruments;
    } else if (intensity < 0.7) {
      return [...lowIntensityInstruments, ...midIntensityInstruments];
    } else {
      return [...lowIntensityInstruments, ...midIntensityInstruments, ...highIntensityInstruments];
    }
  }

  // Get current pattern for visualization
  getCurrentPattern() {
    return this.currentPattern;
  }

  // Mobile-specific haptic feedback (if needed in future)
  triggerHapticFeedback(intensity = 1.0) {
    // Placeholder for future haptic feedback implementation
    // Could use expo-haptics for tactile response to music
    console.log('Haptic feedback triggered with intensity:', intensity);
  }

  // Enhanced sensor calibration for different device orientations
  calibrateSensors() {
    // Auto-calibration based on device movement patterns
    const calibrationDuration = 3000; // 3 seconds
    const samples = [];
    
    const calibrationInterval = setInterval(() => {
      samples.push({
        x: this.lastSensorData.x,
        y: this.lastSensorData.y,
        z: this.lastSensorData.z
      });
    }, 50);

    setTimeout(() => {
      clearInterval(calibrationInterval);
      
      // Calculate baseline offsets
      const avgX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
      const avgY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
      const avgZ = samples.reduce((sum, s) => sum + s.z, 0) / samples.length;
      
      console.log('Mobile sensor calibration completed:', { avgX, avgY, avgZ });
      
      // Apply calibration offsets in sensor processing
      this.calibrationOffsets = { x: avgX, y: avgY, z: avgZ };
    }, calibrationDuration);
  }

  // Advanced movement detection for different rave dance styles
  detectMovementStyle() {
    const recentData = []; // Would store recent sensor readings
    
    // Analyze movement patterns to detect:
    // - Jumping (high Z-axis variance)
    // - Side-to-side (high X-axis activity)
    // - Spinning (high gyroscope activity)
    // - Head banging (rapid Y-axis changes)
    
    // This could influence musical style selection
    return 'freestyle'; // Default for now
  }

  // Cleanup all mobile resources
  cleanup() {
    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }

    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }

    if (this.patternInterval) {
      clearInterval(this.patternInterval);
      this.patternInterval = null;
    }

    this.sensorCallbacks = [];
    this.isInitialized = false;
    
    console.log('Mobile orchestrator cleanup completed');
  }
}

// Export singleton instance
export const mobileOrchestrator = new MobileOrchestrator(); 