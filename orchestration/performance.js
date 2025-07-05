/**
 * PERFORMANCE.JS - Ultra-Low Latency Performance Monitor
 * Tracks and optimizes latency for real-time rave experience
 * Monitors sensor-to-music latency and provides optimization insights
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      sensorLatency: [],
      musicLatency: [],
      frameDrops: 0,
      averageLatency: 0,
      targetLatency: 50, // Target under 50ms for rave experience
      warnings: []
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.startTime = Date.now();
    this.lastSensorTime = 0;
    this.lastMusicTime = 0;
    
    // Performance optimization flags
    this.optimizations = {
      batchUpdates: true,
      skipFrames: false,
      reducedQuality: false,
      emergencyMode: false
    };
  }

  // Start performance monitoring
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startTime = Date.now();
    
    // Monitor every 100ms for real-time feedback
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkOptimizations();
    }, 100);
    
    console.log('Performance monitoring started for rave optimization');
  }

  // Stop performance monitoring
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Performance monitoring stopped');
    this.logSummary();
  }

  // Record sensor input latency
  recordSensorInput(timestamp = Date.now()) {
    if (!this.isMonitoring) return;
    
    const latency = timestamp - this.lastSensorTime;
    if (this.lastSensorTime > 0 && latency > 0 && latency < 1000) {
      this.metrics.sensorLatency.push(latency);
      
      // Keep only last 100 measurements for rolling average
      if (this.metrics.sensorLatency.length > 100) {
        this.metrics.sensorLatency.shift();
      }
    }
    
    this.lastSensorTime = timestamp;
  }

  // Record music output latency
  recordMusicOutput(timestamp = Date.now()) {
    if (!this.isMonitoring) return;
    
    const latency = timestamp - this.lastMusicTime;
    if (this.lastMusicTime > 0 && latency > 0 && latency < 1000) {
      this.metrics.musicLatency.push(latency);
      
      // Keep only last 100 measurements for rolling average
      if (this.metrics.musicLatency.length > 100) {
        this.metrics.musicLatency.shift();
      }
    }
    
    this.lastMusicTime = timestamp;
  }

  // Record end-to-end latency (sensor to music)
  recordEndToEndLatency(sensorTimestamp, musicTimestamp = Date.now()) {
    if (!this.isMonitoring) return;
    
    const latency = musicTimestamp - sensorTimestamp;
    if (latency > 0 && latency < 5000) { // Reasonable latency bounds
      // Track in overall metrics
      this.metrics.averageLatency = this.calculateRollingAverage([
        ...this.metrics.sensorLatency,
        ...this.metrics.musicLatency
      ]);
      
      // Check if latency exceeds rave-optimal thresholds
      if (latency > this.metrics.targetLatency) {
        this.metrics.warnings.push({
          timestamp: Date.now(),
          type: 'high_latency',
          value: latency,
          target: this.metrics.targetLatency
        });
      }
    }
  }

  // Record frame drops for visual performance
  recordFrameDrop() {
    if (!this.isMonitoring) return;
    
    this.metrics.frameDrops++;
    
    // Too many frame drops = emergency optimization mode
    if (this.metrics.frameDrops > 10) {
      this.activateEmergencyMode();
    }
  }

  // Update performance metrics
  updateMetrics() {
    const now = Date.now();
    const sessionDuration = now - this.startTime;
    
    // Calculate rolling averages
    this.metrics.averageLatency = this.calculateRollingAverage([
      ...this.metrics.sensorLatency,
      ...this.metrics.musicLatency
    ]);
    
    // Clear old warnings (keep only last 10)
    if (this.metrics.warnings.length > 10) {
      this.metrics.warnings = this.metrics.warnings.slice(-10);
    }
  }

  // Check if optimizations are needed
  checkOptimizations() {
    const avgLatency = this.metrics.averageLatency;
    const frameDropRate = this.metrics.frameDrops;
    
    // Automatic optimization based on performance
    if (avgLatency > this.metrics.targetLatency * 1.5) {
      this.enableOptimization('batchUpdates');
    }
    
    if (avgLatency > this.metrics.targetLatency * 2) {
      this.enableOptimization('skipFrames');
    }
    
    if (avgLatency > this.metrics.targetLatency * 3) {
      this.enableOptimization('reducedQuality');
    }
    
    if (frameDropRate > 20 || avgLatency > this.metrics.targetLatency * 4) {
      this.activateEmergencyMode();
    }
  }

  // Enable specific optimization
  enableOptimization(type) {
    if (this.optimizations[type]) return; // Already enabled
    
    this.optimizations[type] = true;
    console.log(`Performance optimization enabled: ${type}`);
    
    // Emit optimization event for orchestrators to respond
    this.emitOptimizationEvent(type, true);
  }

  // Disable specific optimization
  disableOptimization(type) {
    if (!this.optimizations[type]) return; // Already disabled
    
    this.optimizations[type] = false;
    console.log(`Performance optimization disabled: ${type}`);
    
    // Emit optimization event for orchestrators to respond
    this.emitOptimizationEvent(type, false);
  }

  // Activate emergency mode for extreme performance issues
  activateEmergencyMode() {
    if (this.optimizations.emergencyMode) return;
    
    console.warn('Activating emergency performance mode for rave optimization');
    
    // Enable all optimizations
    Object.keys(this.optimizations).forEach(opt => {
      this.optimizations[opt] = true;
    });
    
    // Reset frame drop counter
    this.metrics.frameDrops = 0;
    
    // Emit emergency mode event
    this.emitOptimizationEvent('emergencyMode', true);
  }

  // Deactivate emergency mode when performance improves
  deactivateEmergencyMode() {
    if (!this.optimizations.emergencyMode) return;
    
    console.log('Deactivating emergency performance mode');
    this.optimizations.emergencyMode = false;
    
    // Keep other optimizations but disable emergency mode
    this.emitOptimizationEvent('emergencyMode', false);
  }

  // Calculate rolling average for metrics
  calculateRollingAverage(values) {
    if (values.length === 0) return 0;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  // Emit optimization events for orchestrators to respond
  emitOptimizationEvent(type, enabled) {
    // This would typically emit to event listeners
    // For now, just log for debugging
    console.log(`Optimization event: ${type} = ${enabled}`);
  }

  // Get current performance status
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      averageLatency: this.metrics.averageLatency,
      targetLatency: this.metrics.targetLatency,
      frameDrops: this.metrics.frameDrops,
      warningsCount: this.metrics.warnings.length,
      optimizations: { ...this.optimizations },
      sessionDuration: Date.now() - this.startTime
    };
  }

  // Get detailed metrics
  getMetrics() {
    return {
      ...this.metrics,
      optimizations: { ...this.optimizations },
      sessionDuration: Date.now() - this.startTime
    };
  }

  // Log performance summary
  logSummary() {
    const summary = this.getStatus();
    
    console.log('=== VIBESFLOW PERFORMANCE SUMMARY ===');
    console.log(`Session Duration: ${(summary.sessionDuration / 1000).toFixed(1)}s`);
    console.log(`Average Latency: ${summary.averageLatency.toFixed(1)}ms (target: ${summary.targetLatency}ms)`);
    console.log(`Frame Drops: ${summary.frameDrops}`);
    console.log(`Warnings: ${summary.warningsCount}`);
    console.log(`Active Optimizations: ${Object.entries(summary.optimizations)
      .filter(([_, enabled]) => enabled)
      .map(([name, _]) => name)
      .join(', ') || 'None'}`);
    
    // Performance grade
    const grade = this.calculatePerformanceGrade();
    console.log(`Performance Grade: ${grade}`);
    console.log('=====================================');
  }

  // Calculate overall performance grade
  calculatePerformanceGrade() {
    const avgLatency = this.metrics.averageLatency;
    const frameDrops = this.metrics.frameDrops;
    const target = this.metrics.targetLatency;
    
    if (avgLatency <= target && frameDrops < 5) return 'A+ (RAVE OPTIMAL)';
    if (avgLatency <= target * 1.2 && frameDrops < 10) return 'A (EXCELLENT)';
    if (avgLatency <= target * 1.5 && frameDrops < 15) return 'B (GOOD)';
    if (avgLatency <= target * 2 && frameDrops < 25) return 'C (FAIR)';
    return 'D (NEEDS OPTIMIZATION)';
  }

  // Reset all metrics
  reset() {
    this.metrics = {
      sensorLatency: [],
      musicLatency: [],
      frameDrops: 0,
      averageLatency: 0,
      targetLatency: 50,
      warnings: []
    };
    
    this.startTime = Date.now();
    this.lastSensorTime = 0;
    this.lastMusicTime = 0;
    
    // Reset optimizations
    Object.keys(this.optimizations).forEach(opt => {
      this.optimizations[opt] = false;
    });
    this.optimizations.batchUpdates = true; // Default optimization
    
    console.log('Performance metrics reset');
  }

  // Cleanup resources
  cleanup() {
    this.stopMonitoring();
    this.reset();
    console.log('Performance monitor cleanup completed');
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor(); 