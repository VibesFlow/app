import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { WebView } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';

const { width } = Dimensions.get('window');

interface VibePlayerProps {
  onBack: () => void;
}

interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

interface Comment {
  id: string;
  text: string;
  timestamp: number;
  position: number;
}

const VibePlayer: React.FC<VibePlayerProps> = ({ onBack }) => {
  const webviewRef = useRef<WebView>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [currentAmplitude, setCurrentAmplitude] = useState(0.3);
  const [currentFrequency, setCurrentFrequency] = useState(2);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentPosition, setCommentPosition] = useState(0);
  
  // Animated values
  const waveformAnimation = useRef(new Animated.Value(0)).current;

  // Sensor data
  const [sensorData, setSensorData] = useState<SensorData>({
    x: 0, y: 0, z: 0, timestamp: Date.now(),
  });

  // WebView music engine with full Tone.js and Magenta.js
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
  let drumSynth, bassSynth, leadSynth;
  let drumRNN, melodyRNN;
  let currentPattern = null;
  
  async function initializeAudio() {
    try {
      await Tone.start();
      
      // Create drum synth
      drumSynth = new Tone.PolySynth({
        voice: Tone.MembraneSynth,
        options: {
          envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
          oscillator: { type: 'sine' }
        }
      }).toDestination();
      
      // Create bass synth
      bassSynth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.5 },
        filter: { Q: 2, frequency: 300 }
      }).toDestination();
      
      // Create lead synth
      leadSynth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }
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
  
  async function generateMusicFromSensors(sensorData) {
    if (!isInitialized || !isPlaying) return;
    
    const { x, y, z } = sensorData;
    const magnitude = Math.sqrt(x*x + y*y + z*z);
    const amplitude = Math.min(magnitude * 0.5 + 0.3, 1);
    const tempo = Math.max(100, Math.min(180, 120 + amplitude * 60));
    const temperature = Math.min(Math.max(amplitude * 1.5, 0.2), 1.5);
    
    Tone.Transport.bpm.value = tempo;
    
    try {
      // Create seeds based on sensor data
      const drumSeed = {
        quantizationInfo: { stepsPerQuarter: 4 },
        totalQuantizedSteps: 16,
        notes: [
          { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 }, // kick
          { pitch: 38, quantizedStartStep: 8, quantizedEndStep: 9 }, // snare
          { pitch: 42, quantizedStartStep: 4, quantizedEndStep: 5 }, // hihat
          { pitch: 42, quantizedStartStep: 12, quantizedEndStep: 13 }
        ]
      };
      
      const baseNote = 36 + Math.floor(Math.abs(x) * 12);
      const melodySeed = {
        quantizationInfo: { stepsPerQuarter: 4 },
        totalQuantizedSteps: 8,
        notes: [
          { pitch: baseNote, quantizedStartStep: 0, quantizedEndStep: 2 },
          { pitch: baseNote + 4, quantizedStartStep: 4, quantizedEndStep: 6 }
        ]
      };
      
      // Generate patterns
      const drumContinuation = await drumRNN.continueSequence(drumSeed, 16, temperature);
      const melodyContinuation = await melodyRNN.continueSequence(melodySeed, 16, temperature);
      
      // Clear previous patterns
      Tone.Transport.cancel();
      
      // Schedule drums
      drumContinuation.notes.forEach(note => {
        const time = (note.quantizedStartStep / 4) + 'm';
        const duration = ((note.quantizedEndStep - note.quantizedStartStep) / 4) + 'm';
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
        drumSynth.triggerAttackRelease(freq, duration, '+' + time);
      });
      
      // Schedule melody
      melodyContinuation.notes.forEach(note => {
        const time = (note.quantizedStartStep / 4) + 'm';
        const duration = ((note.quantizedEndStep - note.quantizedStartStep) / 4) + 'm';
        const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
        leadSynth.triggerAttackRelease(freq, duration, '+' + time);
      });
      
      // Add bass based on motion
      if (amplitude > 0.4) {
        const bassNote = 36 + Math.floor(Math.abs(y) * 8);
        bassSynth.triggerAttackRelease(
          Tone.Frequency(bassNote, 'midi').toFrequency(), 
          '1m', 
          '+0m'
        );
      }
      
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
      
    } catch (error) {
      console.error('Music generation error:', error);
    }
  }
  
  window.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'sensorUpdate':
        if (isPlaying) {
          await generateMusicFromSensors(data.sensors);
        }
        break;
        
      case 'play':
        isPlaying = true;
        break;
        
      case 'stop':
        isPlaying = false;
        Tone.Transport.stop();
        Tone.Transport.cancel();
        break;
    }
  });
  
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

  // Setup sensors
  useEffect(() => {
    let accelSubscription: any;
    let gyroSubscription: any;

    const startSensors = async () => {
      if (Platform.OS === 'web') {
        // Web fallback with mouse movement
        const handleMouseMove = (event: MouseEvent) => {
          const normalizedX = (event.clientX / window.innerWidth - 0.5) * 2;
          const normalizedY = (event.clientY / window.innerHeight - 0.5) * 2;
          setSensorData({
            x: normalizedX,
            y: normalizedY,
            z: Math.sin(Date.now() / 1000) * 0.5,
            timestamp: Date.now(),
          });
        };

        // Random movement simulation
        const randomInterval = setInterval(() => {
          setSensorData({
            x: Math.sin(Date.now() / 2000) * 0.8,
            y: Math.cos(Date.now() / 1500) * 0.6,
            z: Math.sin(Date.now() / 1000) * 0.4,
            timestamp: Date.now(),
          });
        }, 100);

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
          clearInterval(randomInterval);
          window.removeEventListener('mousemove', handleMouseMove);
        };
      } else {
        // Mobile sensors
        try {
          Accelerometer.setUpdateInterval(100);
          Gyroscope.setUpdateInterval(100);

          accelSubscription = Accelerometer.addListener((result) => {
            setSensorData({
              x: result.x,
              y: result.y,
              z: result.z,
              timestamp: Date.now(),
            });
          });

          gyroSubscription = Gyroscope.addListener((result) => {
            setSensorData(prev => ({
              ...prev,
              x: prev.x + result.x * 0.1,
              y: prev.y + result.y * 0.1,
              z: prev.z + result.z * 0.1,
            }));
          });

        } catch (error) {
          console.warn('Sensor setup error:', error);
        }
        
        return () => {
          // Cleanup for mobile
        };
      }
    };

    startSensors();

    return () => {
      accelSubscription?.remove();
      gyroSubscription?.remove();
    };
  }, []);

  // Process sensor data and send to music engine
  useEffect(() => {
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const amplitude = Math.min(magnitude * 0.5 + 0.2, 1);
    const frequency = 1 + Math.abs(sensorData.x) * 3;

    setCurrentAmplitude(amplitude);
    setCurrentFrequency(frequency);

    // Send sensor data to WebView for music generation
    if (isInitialized && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: 'sensorUpdate',
        sensors: sensorData,
        amplitude,
        frequency,
        tempo: 120 + amplitude * 60,
      }));
    }

    // Update waveform animation
    Animated.timing(waveformAnimation, {
      toValue: amplitude,
      duration: 150,
      useNativeDriver: false,
    }).start();

  }, [sensorData, isInitialized]);

  // Track progress
  useEffect(() => {
    if (isPlaying) {
      const progressInterval = setInterval(() => {
        setTrackProgress(prev => {
          const newProgress = prev + 0.001;
          if (newProgress >= 1) return 0;
          return newProgress;
        });
      }, 100);

      return () => clearInterval(progressInterval);
    }
    
    return () => {
      // Cleanup when not playing
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    if (!isInitialized) return;

    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: isPlaying ? 'stop' : 'play',
      }));
      setIsPlaying(!isPlaying);
    }
  };

  const handleWaveformClick = (event: any) => {
    const { locationX } = event.nativeEvent;
    const position = locationX / (width - 40);
    setCommentPosition(position);
    setShowCommentInput(true);
  };

  const addComment = () => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        text: newComment,
        timestamp: Date.now(),
        position: commentPosition,
      };
      setComments(prev => [...prev, comment]);
      setNewComment('');
      setShowCommentInput(false);
    }
  };

  // Generate waveform bars
  const generateWaveformData = (): number[] => {
    const points: number[] = [];
    const segments = 120;
    for (let i = 0; i < segments; i++) {
      const variation = Math.sin((i / segments) * Math.PI * currentFrequency) * currentAmplitude;
      const height = 20 + variation * 15;
      points.push(Math.max(5, Math.min(35, height)));
    }
    return points;
  };

  const waveformData = generateWaveformData();

  return (
    <View style={styles.container}>
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.trackTitle}>LIVE_SESSION</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Main waveform container */}
      <View style={styles.playerContainer}>
        <TouchableOpacity 
          style={styles.waveformContainer}
          onPress={handleWaveformClick}
          activeOpacity={0.9}
        >
          {/* Progress overlay */}
          <View 
            style={[
              styles.progressOverlay, 
              { width: `${trackProgress * 100}%` }
            ]} 
          />
          
          {/* Waveform bars */}
          <View style={styles.waveform}>
            {waveformData.map((height, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: height,
                    opacity: waveformAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ]}
              />
            ))}
          </View>

          {/* Comments overlay */}
          {comments.map((comment) => (
            <View
              key={comment.id}
              style={[
                styles.commentMarker,
                { left: `${comment.position * 100}%` },
              ]}
            >
              <View style={styles.commentDot} />
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))}
        </TouchableOpacity>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
            disabled={!isInitialized}
          >
            {!isInitialized ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <FontAwesome5 
                name={isPlaying ? "pause" : "play"} 
                size={16} 
                color={COLORS.primary} 
              />
            )}
          </TouchableOpacity>

          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              {Math.floor(trackProgress * 180)}s / 180s
            </Text>
          </View>
        </View>
      </View>

      {/* Comments section */}
      <ScrollView style={styles.commentsSection}>
        {comments.map((comment) => (
          <View key={comment.id} style={styles.commentItem}>
            <Text style={styles.commentTimestamp}>
              {Math.floor(comment.position * 180)}s
            </Text>
            <Text style={styles.commentContent}>{comment.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Comment input modal */}
      {showCommentInput && (
        <View style={styles.commentModal}>
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
            <TouchableOpacity style={styles.commentSubmit} onPress={addComment}>
              <FontAwesome5 name="paper-plane" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.commentCancel} 
              onPress={() => setShowCommentInput(false)}
            >
              <FontAwesome5 name="times" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status indicator */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {Platform.OS === 'web' ? 'MOUSE_INPUT' : 'MOTION_INPUT'} • {isPlaying ? 'LIVE' : 'PAUSED'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
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
  },
  trackTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 1,
  },
  placeholder: {
    width: 40,
  },
  playerContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  waveformContainer: {
    height: 100,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: COLORS.primary + '20',
    zIndex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 4,
  },
  waveformBar: {
    width: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  commentMarker: {
    position: 'absolute',
    top: -20,
    zIndex: 2,
  },
  commentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 10,
    color: COLORS.text,
    backgroundColor: COLORS.background + 'CC',
    padding: 4,
    borderRadius: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  timeInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  commentsSection: {
    maxHeight: 150,
    paddingHorizontal: SPACING.lg,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundSecondary,
  },
  commentTimestamp: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    width: 40,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  commentModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.lg,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    padding: SPACING.md,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  commentSubmit: {
    padding: SPACING.md,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  commentCancel: {
    padding: SPACING.md,
  },
  statusBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

export default VibePlayer;