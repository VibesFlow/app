import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import { GlitchText, GlitchContainer, AcidButton } from './ui';

const { width, height } = Dimensions.get('window');

interface VibePlayerProps {
  onBack: () => void;
}

interface SensorData {
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
  magnetometer: { x: number; y: number; z: number };
  timestamp: number;
}

interface VibeMetrics {
  energy: number;
  tempo: number;
  intensity: number;
  mood: 'chill' | 'energetic' | 'intense' | 'chaotic';
}

const VibePlayer: React.FC<VibePlayerProps> = ({ onBack }) => {
  const webviewRef = useRef<WebView>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVibe, setCurrentVibe] = useState<VibeMetrics>({
    energy: 0,
    tempo: 80,
    intensity: 0,
    mood: 'chill',
  });
  
  // Animated values for visual feedback
  const energyAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const glitchIntensity = useRef(new Animated.Value(0)).current;

  // Sensor data state
  const [sensorData, setSensorData] = useState<SensorData>({
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 },
    timestamp: Date.now(),
  });

  // Calculate vibe metrics from sensor data
  const calculateVibeMetrics = useCallback((data: SensorData): VibeMetrics => {
    const { accelerometer, gyroscope, magnetometer } = data;
    
    // Calculate energy from accelerometer magnitude
    const accelMagnitude = Math.sqrt(
      accelerometer.x ** 2 + accelerometer.y ** 2 + accelerometer.z ** 2
    );
    
    // Calculate rotational energy from gyroscope
    const gyroMagnitude = Math.sqrt(
      gyroscope.x ** 2 + gyroscope.y ** 2 + gyroscope.z ** 2
    );
    
    // Calculate magnetic field variance for environmental sensing
    const magMagnitude = Math.sqrt(
      magnetometer.x ** 2 + magnetometer.y ** 2 + magnetometer.z ** 2
    );
    
    // Normalize and combine sensor inputs
    const energy = Math.min((accelMagnitude - 0.9) * 2 + gyroMagnitude * 0.5, 1);
    const intensity = Math.min(gyroMagnitude * 2 + (accelMagnitude - 0.9) * 3, 1);
    
    // Map to tempo (80-180 BPM based on movement)
    const tempo = Math.max(80, Math.min(180, 80 + energy * 100));
    
    // Determine mood based on combined metrics
    let mood: VibeMetrics['mood'] = 'chill';
    if (intensity > 0.7 && energy > 0.6) mood = 'chaotic';
    else if (energy > 0.5) mood = 'energetic';
    else if (intensity > 0.4) mood = 'intense';
    
    return {
      energy: Math.max(0, energy),
      tempo,
      intensity: Math.max(0, intensity),
      mood,
    };
  }, []);

  // Setup sensor listeners
  useEffect(() => {
    let accelSubscription: any;
    let gyroSubscription: any;
    let magSubscription: any;

    const startSensors = async () => {
      try {
        // Set update intervals
        Accelerometer.setUpdateInterval(100); // 10Hz
        Gyroscope.setUpdateInterval(100);
        Magnetometer.setUpdateInterval(200); // 5Hz (less frequent)

        accelSubscription = Accelerometer.addListener((result) => {
          setSensorData(prev => ({
            ...prev,
            accelerometer: result,
            timestamp: Date.now(),
          }));
        });

        gyroSubscription = Gyroscope.addListener((result) => {
          setSensorData(prev => ({
            ...prev,
            gyroscope: result,
          }));
        });

        magSubscription = Magnetometer.addListener((result) => {
          setSensorData(prev => ({
            ...prev,
            magnetometer: result,
          }));
        });

      } catch (error) {
        console.warn('Sensor setup error:', error);
      }
    };

    startSensors();

    return () => {
      accelSubscription?.remove();
      gyroSubscription?.remove();
      magSubscription?.remove();
    };
  }, []);

  // Process sensor data and update vibe metrics
  useEffect(() => {
    const newVibe = calculateVibeMetrics(sensorData);
    setCurrentVibe(newVibe);

    // Send to WebView for music generation
    if (isInitialized && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: 'vibeUpdate',
        vibe: newVibe,
        sensors: sensorData,
      }));
    }

    // Update visual animations
    Animated.timing(energyAnimation, {
      toValue: newVibe.energy,
      duration: 200,
      useNativeDriver: false,
    }).start();

    Animated.timing(glitchIntensity, {
      toValue: newVibe.intensity,
      duration: 300,
      useNativeDriver: false,
    }).start();

  }, [sensorData, calculateVibeMetrics, isInitialized]);

  // Pulse animation for play state
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 60000 / currentVibe.tempo, // Sync with tempo
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 60000 / currentVibe.tempo,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isPlaying, currentVibe.tempo]);

  const togglePlayback = () => {
    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: isPlaying ? 'stop' : 'play',
      }));
      setIsPlaying(!isPlaying);
    }
  };

  // WebView HTML with Magenta.js and Tone.js integration
  const musicEngineHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@magenta/music@1.28.0"></script>
  <script src="https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.min.js"></script>
</head>
<body></body>
<script>
(async function() {
  let isInitialized = false;
  let isPlaying = false;
  let currentSequence = null;
  let drumSynth, bassSynth, leadSynth, padSynth;
  let drumRNN, melodyRNN;
  
  // Initialize audio context and instruments
  async function initializeAudio() {
    try {
      await Tone.start();
      
      // Create synths for different parts
      drumSynth = new Tone.PolySynth({
        voice: Tone.MembraneSynth,
        options: {
          envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
          oscillator: { type: 'sine' }
        }
      }).toDestination();
      
      bassSynth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.5 },
        filter: { Q: 2, frequency: 300 }
      }).toDestination();
      
      leadSynth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }
        }
      }).toDestination();
      
      padSynth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2 }
        }
      }).toDestination();
      
      // Load AI models
      drumRNN = new mm.MusicRNN(
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn'
      );
      await drumRNN.initialize();
      
      melodyRNN = new mm.MusicRNN(
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn'
      );
      await melodyRNN.initialize();
      
      isInitialized = true;
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'initialized' }));
      
    } catch (error) {
      console.error('Audio initialization failed:', error);
      window.ReactNativeWebView?.postMessage(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  }
  
  // Generate music based on vibe data
  async function generateMusic(vibeData) {
    if (!isInitialized) return;
    
    const { energy, tempo, intensity, mood } = vibeData.vibe;
    const { accelerometer, gyroscope } = vibeData.sensors;
    
    try {
      Tone.Transport.bpm.value = tempo;
      
      // Create seed based on mood and sensor data
      let drumSeed, melodySeed;
      
      switch (mood) {
        case 'chaotic':
          drumSeed = createChaoticDrumSeed(energy, intensity);
          melodySeed = createChaoticMelodySeed(accelerometer, gyroscope);
          break;
        case 'energetic':
          drumSeed = createEnergeticDrumSeed(energy);
          melodySeed = createEnergeticMelodySeed(accelerometer);
          break;
        case 'intense':
          drumSeed = createIntenseDrumSeed(intensity);
          melodySeed = createIntenseMelodySeed(gyroscope);
          break;
        default:
          drumSeed = createChillDrumSeed();
          melodySeed = createChillMelodySeed();
      }
      
      // Generate drum pattern
      const drumContinuation = await drumRNN.continueSequence(
        drumSeed, 
        16, 
        Math.max(0.2, energy * 1.5)
      );
      
      // Generate melody
      const melodyContinuation = await melodyRNN.continueSequence(
        melodySeed, 
        16, 
        Math.max(0.5, intensity * 1.2)
      );
      
      // Schedule and play
      if (isPlaying) {
        playSequence(drumContinuation, melodyContinuation, vibeData);
      }
      
    } catch (error) {
      console.error('Music generation error:', error);
    }
  }
  
  function createChaoticDrumSeed(energy, intensity) {
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 16,
      notes: [
        { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 }, // kick
        { pitch: 38, quantizedStartStep: 4, quantizedEndStep: 5 }, // snare
        { pitch: 42, quantizedStartStep: 2, quantizedEndStep: 3 }, // hihat
        { pitch: 36, quantizedStartStep: 8, quantizedEndStep: 9 },
        { pitch: 38, quantizedStartStep: 12, quantizedEndStep: 13 },
        { pitch: 42, quantizedStartStep: 6, quantizedEndStep: 7 },
        { pitch: 42, quantizedStartStep: 10, quantizedEndStep: 11 },
        { pitch: 42, quantizedStartStep: 14, quantizedEndStep: 15 }
      ]
    };
  }
  
  function createEnergeticDrumSeed(energy) {
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 16,
      notes: [
        { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 },
        { pitch: 38, quantizedStartStep: 8, quantizedEndStep: 9 },
        { pitch: 42, quantizedStartStep: 4, quantizedEndStep: 5 },
        { pitch: 42, quantizedStartStep: 12, quantizedEndStep: 13 }
      ]
    };
  }
  
  function createIntenseDrumSeed(intensity) {
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 8,
      notes: [
        { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 },
        { pitch: 38, quantizedStartStep: 4, quantizedEndStep: 5 }
      ]
    };
  }
  
  function createChillDrumSeed() {
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 8,
      notes: [
        { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 },
        { pitch: 38, quantizedStartStep: 6, quantizedEndStep: 7 }
      ]
    };
  }
  
  function createChaoticMelodySeed(accel, gyro) {
    const baseNote = 60 + Math.floor(accel.x * 12);
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 8,
      notes: [
        { pitch: baseNote, quantizedStartStep: 0, quantizedEndStep: 2 },
        { pitch: baseNote + 4, quantizedStartStep: 4, quantizedEndStep: 6 }
      ]
    };
  }
  
  function createEnergeticMelodySeed(accel) {
    const baseNote = 60 + Math.floor(Math.abs(accel.y) * 8);
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 8,
      notes: [
        { pitch: baseNote, quantizedStartStep: 0, quantizedEndStep: 3 }
      ]
    };
  }
  
  function createIntenseMelodySeed(gyro) {
    const baseNote = 48 + Math.floor(Math.abs(gyro.z) * 16);
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 4,
      notes: [
        { pitch: baseNote, quantizedStartStep: 0, quantizedEndStep: 2 }
      ]
    };
  }
  
  function createChillMelodySeed() {
    return {
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 8,
      notes: [
        { pitch: 60, quantizedStartStep: 0, quantizedEndStep: 4 }
      ]
    };
  }
  
  function playSequence(drums, melody, vibeData) {
    Tone.Transport.cancel();
    
    // Play drums
    drums.notes.forEach(note => {
      const time = (note.quantizedStartStep / 4) + 'm';
      const duration = ((note.quantizedEndStep - note.quantizedStartStep) / 4) + 'm';
      const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
      
      drumSynth.triggerAttackRelease(freq, duration, '+' + time);
    });
    
    // Play melody
    melody.notes.forEach(note => {
      const time = (note.quantizedStartStep / 4) + 'm';
      const duration = ((note.quantizedEndStep - note.quantizedStartStep) / 4) + 'm';
      const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
      
      leadSynth.triggerAttackRelease(freq, duration, '+' + time);
    });
    
    // Add bass line based on energy
    if (vibeData.vibe.energy > 0.3) {
      const bassNote = 36 + Math.floor(vibeData.vibe.energy * 12);
      bassSynth.triggerAttackRelease(Tone.Frequency(bassNote, 'midi').toFrequency(), '1m', '+0m');
    }
    
    if (!Tone.Transport.state === 'started') {
      Tone.Transport.start();
    }
  }
  
  // Message handler
  window.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'vibeUpdate':
        if (isPlaying) {
          await generateMusic(data);
        }
        break;
        
      case 'play':
        isPlaying = true;
        Tone.Transport.start();
        break;
        
      case 'stop':
        isPlaying = false;
        Tone.Transport.stop();
        Tone.Transport.cancel();
        break;
    }
  });
  
  // Initialize everything
  await initializeAudio();
})();
</script>
</html>
`;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'initialized':
          setIsInitialized(true);
          break;
        case 'error':
          console.error('WebView error:', data.message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'chaotic': return COLORS.error;
      case 'energetic': return COLORS.primary;
      case 'intense': return COLORS.accent;
      default: return COLORS.success;
    }
  };

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case 'chaotic': return '🌪️';
      case 'energetic': return '⚡';
      case 'intense': return '🔥';
      default: return '🌊';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, '#0a0a0a', COLORS.background]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <GlitchText 
            text="VIBE_PLAYER" 
            style={styles.title} 
            intensity="medium" 
          />
        </View>

        {/* Hidden WebView for music generation */}
        <WebView
          ref={webviewRef}
          source={{ html: musicEngineHTML }}
          style={styles.hiddenWebView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          originWhitelist={['*']}
        />

        {/* Main vibe visualization */}
        <GlitchContainer 
          style={styles.vibeContainer}
          intensity={currentVibe.intensity > 0.5 ? 'high' : currentVibe.intensity > 0.2 ? 'medium' : 'low'}
          animated={isPlaying}
        >
          <Animated.View 
            style={[
              styles.vibeCircle,
              {
                transform: [{ scale: pulseAnimation }],
                backgroundColor: energyAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [COLORS.secondary, getMoodColor(currentVibe.mood)],
                }),
              },
            ]}
          >
            <Text style={styles.moodEmoji}>{getMoodEmoji(currentVibe.mood)}</Text>
            <Text style={styles.moodText}>{currentVibe.mood.toUpperCase()}</Text>
          </Animated.View>
        </GlitchContainer>

        {/* Vibe metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>ENERGY</Text>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill,
                  {
                    width: energyAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>{Math.round(currentVibe.energy * 100)}%</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>TEMPO</Text>
            <Text style={styles.metricValue}>{Math.round(currentVibe.tempo)} BPM</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricLabel}>INTENSITY</Text>
            <Text style={styles.metricValue}>{Math.round(currentVibe.intensity * 100)}%</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isInitialized ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>INITIALIZING_AUDIO_ENGINE...</Text>
            </View>
          ) : (
            <AcidButton
              text={isPlaying ? "STOP_VIBE" : "START_VIBE"}
              onPress={togglePlayback}
              type="primary"
              size="large"
              glitchIntensity={currentVibe.intensity > 0.3 ? 'medium' : 'low'}
              icon={
                <FontAwesome5 
                  name={isPlaying ? "stop" : "play"} 
                  size={20} 
                  color={COLORS.background} 
                />
              }
              pulsate={isPlaying}
            />
          )}
        </View>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Move your device to generate unique rave music based on your vibes
        </Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  vibeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.xl,
    height: 250,
  },
  vibeCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  moodEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  moodText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
    letterSpacing: 1,
  },
  metricsContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  metricLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    width: 80,
    letterSpacing: 1,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  metricValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'right',
    letterSpacing: 1,
  },
  controls: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    letterSpacing: 1,
  },
  instructions: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
});

export default VibePlayer;