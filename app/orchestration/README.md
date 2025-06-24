# VibesFlow Orchestration System

## 🎛️ Ultra-Low Latency Modular Architecture

The VibesFlow Orchestration System is designed for **ultra-low latency real-time rave experiences**, providing seamless sensor-to-music translation with optimized performance across web and mobile platforms.

## 🏗️ Architecture Overview

### Core Modules

1. **`web.js`** - Web Platform Orchestrator
   - Browser-specific sensor inputs (mouse, camera, keyboard)
   - Web Audio Context optimization
   - Real-time audio chunk processing with WAV conversion
   - Target latency: <20ms

2. **`mobile.js`** - Mobile Platform Orchestrator  
   - iOS/Android sensor inputs (accelerometer, gyroscope)
   - Native mobile optimization
   - Haptic feedback integration
   - Target latency: <30ms

3. **`interpreter.js`** - Sensor Data Interpreter
   - Real-time sensor data interpretation
   - Musical parameter mapping (BPM, density, brightness)
   - Rave-optimized genre transitions
   - Smooth style transitions with weighted prompts

4. **`orchestrator.js`** - Lyria Communication Manager
   - Google Lyria RealTime API integration
   - Batched updates for performance optimization
   - Smart reconnection with exponential backoff
   - Smooth transitions without audio dropouts

5. **`performance.js`** - Performance Monitor
   - Real-time latency tracking
   - Automatic optimization trigger
   - Emergency mode for extreme performance issues
   - Performance grading (A+ = Rave Optimal)

6. **`types.ts`** - TypeScript Definitions
   - Shared interfaces and types
   - Cross-module compatibility
   - IntelliSense support

## 🚀 Performance Optimizations

### Latency Reduction Techniques

- **Sensor Batching**: Intelligent update batching to reduce API calls
- **Audio Chunking**: Real-time PCM to WAV conversion for immediate playback
- **Smart Caching**: Parameter change detection to avoid unnecessary updates
- **Connection Pooling**: Persistent WebSocket connections with smart reconnection

### Adaptive Performance

- **Automatic Quality Scaling**: Reduces quality when latency exceeds thresholds
- **Frame Skipping**: Drops non-critical updates during high load
- **Emergency Mode**: Extreme optimization when performance degrades
- **Rolling Metrics**: Continuous performance monitoring and adjustment

## 📊 Performance Targets

| Platform | Target Latency | Rave Optimal | Emergency Threshold |
|----------|----------------|--------------|-------------------|
| Web      | <20ms         | <50ms        | >200ms           |
| Mobile   | <30ms         | <50ms        | >200ms           |
| End-to-End | <50ms       | <100ms       | >300ms           |

## 🎵 Rave Experience Features

### Musical Responsiveness
- **6 Rave Genres**: Ambient, Deep House, Minimal Techno, Acid House, Drum & Bass, Hardcore
- **Intensity Mapping**: Movement magnitude to musical intensity
- **Directional Instruments**: X/Y/Z axis mapped to different instrument types
- **Smooth Transitions**: Weighted prompts prevent jarring style changes

### Real-Time Feedback
- **Visual Waveforms**: Advanced multi-harmonic visualization
- **Live Comments**: Real-time audience interaction
- **Participant Counter**: Simulated rave audience
- **Performance Metrics**: Live latency and quality monitoring

## 💻 Usage

### Basic Setup

```typescript
import { 
  webOrchestrator, 
  mobileOrchestrator, 
  sensorInterpreter, 
  lyriaOrchestrator,
  performanceMonitor 
} from './orchestration';

// Initialize for web
if (Platform.OS === 'web') {
  await webOrchestrator.initializeAudioContext();
  await webOrchestrator.initializeSensors();
} else {
  await mobileOrchestrator.initializeSensors();
}

// Start performance monitoring
performanceMonitor.startMonitoring();

// Connect to Lyria
await lyriaOrchestrator.initialize(API_KEY);
await lyriaOrchestrator.connect();
```

### Sensor Data Processing

```typescript
// Set up sensor callbacks
webOrchestrator.onSensorData((sensorData) => {
  const interpretation = sensorInterpreter.interpretSensorData(sensorData);
  lyriaOrchestrator.updateStream(interpretation);
  performanceMonitor.recordSensorInput(sensorData.timestamp);
});
```

### Audio Output Handling

```typescript
// Handle Lyria audio chunks
lyriaOrchestrator.onAudioChunk(async (audioData) => {
  await webOrchestrator.playAudioChunk(audioData);
  performanceMonitor.recordMusicOutput();
});
```

## 🔧 Configuration

### Environment Variables
```bash
EXPO_PUBLIC_LYRIA_API_KEY=your_google_ai_api_key
```

### Performance Tuning
```typescript
// Adjust target latency
performanceMonitor.metrics.targetLatency = 30; // ms

// Enable specific optimizations
performanceMonitor.enableOptimization('batchUpdates');
performanceMonitor.enableOptimization('skipFrames');
```

## 📈 Monitoring & Debugging

### Performance Metrics
```typescript
// Get real-time status
const status = performanceMonitor.getStatus();
console.log(`Average Latency: ${status.averageLatency}ms`);
console.log(`Performance Grade: ${performanceMonitor.calculatePerformanceGrade()}`);

// Get detailed metrics
const metrics = performanceMonitor.getMetrics();
```

### Debug Logging
- All modules include comprehensive console logging
- Performance events are automatically logged
- Error handling with graceful degradation

## 🛠️ Development

### Module Structure
```
orchestration/
├── index.js          # Central exports
├── web.js            # Web platform
├── mobile.js         # Mobile platform  
├── interpreter.js    # Sensor interpretation
├── orchestrator.js   # Lyria communication
├── performance.js    # Performance monitoring
├── types.ts          # TypeScript definitions
└── README.md         # This file
```

### Adding New Features
1. Extend relevant orchestrator class
2. Update TypeScript interfaces in `types.ts`
3. Export new functionality in `index.js`
4. Update VibePlayer imports if needed

## 🎯 Optimization Guidelines

### For Web Performance
- Use passive event listeners
- Minimize DOM manipulations
- Optimize audio buffer sizes
- Use Web Workers for heavy processing

### For Mobile Performance  
- Throttle sensor updates
- Use native haptic feedback
- Optimize battery usage
- Handle background/foreground transitions

### For Lyria Integration
- Batch configuration updates
- Use weighted prompts for transitions
- Implement smart reconnection
- Monitor API rate limits

## 🚨 Emergency Mode

When performance degrades significantly, the system automatically:
1. Enables all optimizations
2. Reduces update frequency
3. Skips non-critical visual updates
4. Logs performance warnings
5. Attempts to recover automatically

## 📊 Performance Grading

- **A+ (Rave Optimal)**: ≤50ms latency, <5 frame drops
- **A (Excellent)**: ≤60ms latency, <10 frame drops  
- **B (Good)**: ≤75ms latency, <15 frame drops
- **C (Fair)**: ≤100ms latency, <25 frame drops
- **D (Needs Optimization)**: >100ms latency or >25 frame drops

## 🔄 Future Enhancements

- [ ] WebRTC for peer-to-peer rave sessions
- [ ] ML-based predictive optimization
- [ ] Hardware-specific optimizations
- [ ] Advanced audio effects pipeline
- [ ] Multi-device synchronization

---

**Built for the ultimate rave experience** 🎉🎵⚡ 