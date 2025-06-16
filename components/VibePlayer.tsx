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
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import * as Tone from 'tone';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [currentAmplitude, setCurrentAmplitude] = useState(0.3);
  const [currentFrequency, setCurrentFrequency] = useState(2);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentPosition, setCommentPosition] = useState(0);
  
  // Audio components
  const synthRef = useRef<any>(null);
  const filterRef = useRef<any>(null);
  const patternRef = useRef<any>(null);
  
  // Animated values
  const waveformAnimation = useRef(new Animated.Value(0)).current;

  // Sensor data
  const [sensorData, setSensorData] = useState<SensorData>({
    x: 0, y: 0, z: 0, timestamp: Date.now(),
  });

  // Initialize audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        if (Platform.OS === 'web') {
          await Tone.start();
          
          // Create filter and synth
          filterRef.current = new Tone.Filter(800, "lowpass").toDestination();
          synthRef.current = new Tone.PolySynth({
            voice: Tone.Synth,
            options: {
              oscillator: { type: "sawtooth" },
              envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1 }
            }
          }).connect(filterRef.current);
          
          setIsInitialized(true);
        } else {
          // Mobile fallback - use basic audio without Tone.js
          setIsInitialized(true);
        }
      } catch (error) {
        console.warn('Audio init failed:', error);
        setIsInitialized(true);
      }
    };

    initAudio();

    return () => {
      if (patternRef.current) {
        patternRef.current.dispose();
      }
    };
  }, []);

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
      }
    };

    startSensors();

    return () => {
      accelSubscription?.remove();
      gyroSubscription?.remove();
    };
  }, []);

  // Process sensor data
  useEffect(() => {
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const amplitude = Math.min(magnitude * 0.5 + 0.2, 1);
    const frequency = 1 + Math.abs(sensorData.x) * 3;

    setCurrentAmplitude(amplitude);
    setCurrentFrequency(frequency);

    // Update audio parameters
    if (isPlaying && Platform.OS === 'web' && filterRef.current) {
      const filterFreq = 400 + amplitude * 1000;
      filterRef.current.frequency.value = filterFreq;
      Tone.Transport.bpm.value = 120 + amplitude * 60;
    }

    // Update waveform animation
    Animated.timing(waveformAnimation, {
      toValue: amplitude,
      duration: 150,
      useNativeDriver: false,
    }).start();

  }, [sensorData, isPlaying]);

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
  }, [isPlaying]);

  const togglePlayback = () => {
    if (!isInitialized) return;

    if (Platform.OS === 'web' && synthRef.current) {
      if (!isPlaying) {
        // Start playing
        const bassNotes = ['C2', 'C2', 'F2', 'C2'];
        patternRef.current = new Tone.Sequence((time, note) => {
          synthRef.current.triggerAttackRelease(note, '8n', time, currentAmplitude * 0.8);
        }, bassNotes);
        
        patternRef.current.start(0);
        Tone.Transport.start();
      } else {
        // Stop playing
        if (patternRef.current) {
          patternRef.current.stop();
          patternRef.current.dispose();
        }
        Tone.Transport.stop();
      }
    }

    setIsPlaying(!isPlaying);
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