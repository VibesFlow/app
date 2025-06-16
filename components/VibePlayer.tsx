import React, { useEffect, useRef, useState, useCallback } from 'react';
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

const { width, height } = Dimensions.get('window');

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
  position: number; // Position in the track (0-1)
}

// Generate waveform data points
const generateWaveformData = (amplitude: number, frequency: number) => {
  const points = [];
  const segments = 120;
  for (let i = 0; i < segments; i++) {
    const variation = Math.sin((i / segments) * Math.PI * frequency) * amplitude;
    const height = 20 + variation * 15;
    points.push(Math.max(5, Math.min(35, height)));
  }
  return points;
};

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
  
  // Animated values for waveform
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Sensor data state
  const [sensorData, setSensorData] = useState<SensorData>({
    x: 0, y: 0, z: 0, timestamp: Date.now(),
  });

  // Web fallback for sensors
  const [useWebFallback, setUseWebFallback] = useState(Platform.OS === 'web');

  // Setup sensor listeners with web fallback
  useEffect(() => {
    let accelSubscription: any;
    let gyroSubscription: any;

    const startSensors = async () => {
      if (Platform.OS === 'web') {
        // Web fallback - use mouse movement or random data
        const handleMouseMove = (event: any) => {
          const normalizedX = (event.clientX / window.innerWidth - 0.5) * 2;
          const normalizedY = (event.clientY / window.innerHeight - 0.5) * 2;
          setSensorData({
            x: normalizedX,
            y: normalizedY,
            z: Math.sin(Date.now() / 1000) * 0.5,
            timestamp: Date.now(),
          });
        };

        // Start with random movement simulation
        const randomInterval = setInterval(() => {
          setSensorData({
            x: Math.sin(Date.now() / 2000) * 0.8,
            y: Math.cos(Date.now() / 1500) * 0.6,
            z: Math.sin(Date.now() / 1000) * 0.4,
            timestamp: Date.now(),
          });
        }, 100);

        if (typeof window !== 'undefined') {
          window.addEventListener('mousemove', handleMouseMove);
        }

        return () => {
          clearInterval(randomInterval);
          if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', handleMouseMove);
          }
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
          console.warn('Sensor setup error, using fallback:', error);
          setUseWebFallback(true);
        }
      }
    };

    startSensors();

    return () => {
      accelSubscription?.remove();
      gyroSubscription?.remove();
    };
  }, []);

  // Process sensor data and update audio parameters
  useEffect(() => {
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const amplitude = Math.min(magnitude * 0.5 + 0.2, 1);
    const frequency = 1 + Math.abs(sensorData.x) * 3;

    setCurrentAmplitude(amplitude);
    setCurrentFrequency(frequency);

    // Send to WebView for music generation
    if (isInitialized && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({
        type: 'audioUpdate',
        amplitude,
        frequency,
        tempo: 120 + amplitude * 60,
        sensors: sensorData,
      }));
    }

    // Update waveform animation
    Animated.timing(waveformAnimation, {
      toValue: amplitude,
      duration: 150,
      useNativeDriver: false,
    }).start();

  }, [sensorData, isInitialized]);

  // Track progress animation
  useEffect(() => {
    if (isPlaying) {
      const progressInterval = setInterval(() => {
        setTrackProgress(prev => {
          const newProgress = prev + 0.001; // Simulate track progress
          if (newProgress >= 1) return 0;
          return newProgress;
        });
      }, 100);

      return () => clearInterval(progressInterval);
    }
  }, [isPlaying]);

  const togglePlayback = () => {
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

  // Enhanced music generation HTML with web audio compatibility
  const musicEngineHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.min.js"></script>
</head>
<body></body>
<script>
(async function() {
  let isInitialized = false;
  let isPlaying = false;
  let synth, filter, reverb, delay;
  
  async function initializeAudio() {
    try {
      await Tone.start();
      
      // Create effects chain
      reverb = new Tone.Reverb(2).toDestination();
      delay = new Tone.FeedbackDelay("8n", 0.3).connect(reverb);
      filter = new Tone.Filter(800, "lowpass").connect(delay);
      
      // Create main synth
      synth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1 },
          filter: { Q: 2, frequency: 300 }
        }
      }).connect(filter);
      
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
  
  function generateTechnoPattern(amplitude, frequency, tempo) {
    if (!isInitialized || !isPlaying) return;
    
    Tone.Transport.bpm.value = tempo;
    filter.frequency.value = 400 + amplitude * 1000;
    
    // Generate bass pattern
    const bassNotes = ['C2', 'C2', 'F2', 'C2'];
    const bassPattern = new Tone.Sequence((time, note) => {
      synth.triggerAttackRelease(note, '8n', time, amplitude * 0.8);
    }, bassNotes);
    
    // Generate lead pattern based on sensor data
    const leadNotes = ['C4', 'D4', 'F4', 'G4'].map(note => 
      Tone.Frequency(note).transpose(Math.floor(frequency * 12))
    );
    
    const leadPattern = new Tone.Sequence((time, note) => {
      if (Math.random() < amplitude) {
        synth.triggerAttackRelease(note, '16n', time, amplitude * 0.6);
      }
    }, leadNotes);
    
    bassPattern.start(0);
    leadPattern.start(0);
    
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
    
    // Clean up after pattern
    setTimeout(() => {
      bassPattern.dispose();
      leadPattern.dispose();
    }, 4000);
  }
  
  window.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'audioUpdate':
        if (isPlaying) {
          generateTechnoPattern(data.amplitude, data.frequency, data.tempo);
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

  // Generate waveform bars
  const waveformData = generateWaveformData(currentAmplitude, currentFrequency);

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
          {useWebFallback ? 'MOUSE_INPUT' : 'MOTION_INPUT'} • {isPlaying ? 'LIVE' : 'PAUSED'}
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