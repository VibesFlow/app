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

interface MusicPattern {
  notes: number[];
  durations: number[];
  velocity: number[];
  instruments: string[];
}

interface ParticipantData {
  count: number;
  lastUpdate: number;
}

interface MusicState {
  bpm: number;
  key: string;
  scale: number[];
  currentChord: number[];
  bassLine: number[];
  rhythm: number[];
}

const VibePlayer: React.FC<VibePlayerProps> = ({ onBack }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [currentAmplitude, setCurrentAmplitude] = useState(0.3);
  const [currentFrequency, setCurrentFrequency] = useState(2);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentPosition, setCommentPosition] = useState(0);
  const [participants, setParticipants] = useState<ParticipantData>({ count: 1, lastUpdate: Date.now() });
  const [currentPattern, setCurrentPattern] = useState<MusicPattern>({
    notes: [],
    durations: [],
    velocity: [],
    instruments: []
  });
  const [musicState, setMusicState] = useState<MusicState>({
    bpm: 128,
    key: 'C',
    scale: [0, 2, 4, 5, 7, 9, 11],
    currentChord: [0, 4, 7],
    bassLine: [0, 7, 5, 3],
    rhythm: [1, 0, 1, 0, 1, 0, 1, 0]
  });
  
  // Audio system references
  const audioContextRef = useRef<any>(null);
  const generationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const filterRef = useRef<BiquadFilterNode | null>(null);
  
  // Animated values
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const streamAnimation = useRef(new Animated.Value(0)).current;

  // Sensor data
  const [sensorData, setSensorData] = useState<SensorData>({
    x: 0, y: 0, z: 0, timestamp: Date.now(),
  });

  // Initialize advanced music generation system
  useEffect(() => {
    const initMusicSystem = async () => {
      try {
        // Initialize Web Audio API for advanced synthesis
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.AudioContext) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          // Resume audio context (required for user interaction)
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          
          // Create sophisticated filter chain
          const filter = audioContextRef.current.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 800;
          filter.Q.value = 1;
          filter.connect(audioContextRef.current.destination);
          filterRef.current = filter;
          
          console.log('Web Audio Context state:', audioContextRef.current.state);
        }

        setIsInitialized(true);
        console.log('Advanced music system initialized');
      } catch (error) {
        console.warn('Music system init failed:', error);
        setIsInitialized(true);
      }
    };

    initMusicSystem();

    return () => {
      if (generationIntervalRef.current) {
        clearInterval(generationIntervalRef.current);
      }
    };
  }, []);

  // Setup sensors
  useEffect(() => {
    let accelSubscription: any;
    let gyroSubscription: any;

    const startSensors = async () => {
      if (Platform.OS === 'web') {
        // Web mouse velocity tracking for dynamic music generation
        let lastMouseX = 0;
        let lastMouseY = 0;
        let lastMouseTime = Date.now();
        
        const handleMouseMove = (event: MouseEvent) => {
          const currentTime = Date.now();
          const deltaTime = currentTime - lastMouseTime;
          const deltaX = event.clientX - lastMouseX;
          const deltaY = event.clientY - lastMouseY;
          
          // Calculate velocity (pixels per millisecond, scaled)
          const velocityX = deltaTime > 0 ? (deltaX / deltaTime) * 10 : 0;
          const velocityY = deltaTime > 0 ? (deltaY / deltaTime) * 10 : 0;
          const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
          
          setSensorData({
            x: Math.max(-2, Math.min(2, velocityX)), // Clamp to reasonable range
            y: Math.max(-2, Math.min(2, velocityY)),
            z: Math.max(-2, Math.min(2, velocityMagnitude)),
            timestamp: currentTime,
          });
          
          lastMouseX = event.clientX;
          lastMouseY = event.clientY;
          lastMouseTime = currentTime;
        };

        // Decay mouse velocity when not moving
        const decayInterval = setInterval(() => {
          setSensorData(prev => ({
            x: prev.x * 0.95,
            y: prev.y * 0.95,
            z: prev.z * 0.9,
            timestamp: Date.now(),
          }));
        }, 50);

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
          clearInterval(decayInterval);
          window.removeEventListener('mousemove', handleMouseMove);
        };
      } else {
        // Mobile sensors with enhanced sensitivity
        try {
          Accelerometer.setUpdateInterval(50);
          Gyroscope.setUpdateInterval(50);

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
              x: prev.x + result.x * 0.05,
              y: prev.y + result.y * 0.05,
              z: prev.z + result.z * 0.05,
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

  // Continuous rave music generation with sensor enhancement
  const generateAdvancedMusic = () => {
    if (!audioContextRef.current || !isStreaming) return;
    if (audioContextRef.current.state !== 'running') return;

    try {
      const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      const normalizedMagnitude = Math.max(0.4, Math.min(magnitude || 1, 3) / 3);
      const now = audioContextRef.current.currentTime;
      
      // Always generate bass drum (4/4 kick pattern)
      const beatTime = (Date.now() / 600) % 4; // 100 BPM roughly
      if (beatTime < 0.1 || (beatTime > 2 && beatTime < 2.1)) {
        const kickOsc = audioContextRef.current.createOscillator();
        const kickGain = audioContextRef.current.createGain();
        const kickFilter = audioContextRef.current.createBiquadFilter();
        
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(60, now);
        kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        kickFilter.type = 'lowpass';
        kickFilter.frequency.value = 100;
        
        kickGain.gain.setValueAtTime(0, now);
        kickGain.gain.linearRampToValueAtTime(0.8, now + 0.01);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        kickOsc.connect(kickFilter);
        kickFilter.connect(kickGain);
        kickGain.connect(audioContextRef.current.destination);
        
        kickOsc.start(now);
        kickOsc.stop(now + 0.3);
      }
      
      // Continuous bass line with sensor modulation
      const bassFreq = 60 + (Math.abs(sensorData.x || 0.5) * 40); // 60-100Hz bass
      const bassOsc = audioContextRef.current.createOscillator();
      const bassGain = audioContextRef.current.createGain();
      const bassFilter = audioContextRef.current.createBiquadFilter();
      
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.value = bassFreq;
      bassFilter.type = 'lowpass';
      bassFilter.frequency.value = 200 + (Math.abs(sensorData.y || 0.3) * 300);
      bassFilter.Q.value = 8;
      
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.4 * normalizedMagnitude, now + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(audioContextRef.current.destination);
      
      bassOsc.start(now);
      bassOsc.stop(now + 0.6);
      
      // Acid lead with sensor-controlled filter sweep
      if (Math.random() > 0.3) { // 70% chance to play lead
        const leadOsc = audioContextRef.current.createOscillator();
        const leadGain = audioContextRef.current.createGain();
        const leadFilter = audioContextRef.current.createBiquadFilter();
        
        const leadFreq = 220 + (Math.abs(sensorData.z || 0.4) * 440);
        leadOsc.type = 'square';
        leadOsc.frequency.value = leadFreq;
        leadFilter.type = 'lowpass';
        leadFilter.frequency.setValueAtTime(500, now);
        leadFilter.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
        leadFilter.Q.value = 15;
        
        leadGain.gain.setValueAtTime(0, now);
        leadGain.gain.linearRampToValueAtTime(0.25 * normalizedMagnitude, now + 0.01);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        leadOsc.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(audioContextRef.current.destination);
        
        leadOsc.start(now);
        leadOsc.stop(now + 0.4);
      }
      
      console.log('Generated rave music - bass:', Math.round(bassFreq), 'Hz, magnitude:', normalizedMagnitude.toFixed(2));

    } catch (error) {
      console.warn('Music generation failed:', error);
    }
  };

  // Process sensor data and update music
  useEffect(() => {
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const amplitude = Math.min(magnitude * 0.5 + 0.2, 1);
    const frequency = 1 + Math.abs(sensorData.x) * 3;

    setCurrentAmplitude(amplitude);
    setCurrentFrequency(frequency);

    // Update waveform animation
    Animated.timing(waveformAnimation, {
      toValue: amplitude,
      duration: 100,
      useNativeDriver: false,
    }).start();

    // Update streaming animation
    Animated.timing(streamAnimation, {
      toValue: isStreaming ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

  }, [sensorData, isStreaming]);

  // Immediate and continuous music generation system
  useEffect(() => {
    if (!isStreaming || !isInitialized) return;

    let musicInterval: NodeJS.Timeout;
    
    if (Platform.OS === 'web' && audioContextRef.current) {
      // Generate first sound immediately
      try {
        generateAdvancedMusic();
      } catch (error) {
        console.warn('Initial music generation error:', error);
      }
      
      musicInterval = setInterval(() => {
        try {
          generateAdvancedMusic();
        } catch (error) {
          console.warn('Music generation error:', error);
        }
      }, 350); // Faster interval for continuous rave sound
    } else {
      // Mobile pattern generation
      try {
        generateMobilePattern();
      } catch (error) {
        console.warn('Initial pattern generation error:', error);
      }
      
      musicInterval = setInterval(() => {
        try {
          generateMobilePattern();
        } catch (error) {
          console.warn('Pattern generation error:', error);
        }
      }, 250);
    }

    return () => {
      if (musicInterval) clearInterval(musicInterval);
    };
  }, [isStreaming, isInitialized]);

  // Stream duration tracking
  useEffect(() => {
    if (isStreaming) {
      const durationInterval = setInterval(() => {
        setStreamDuration(Date.now() - startTimeRef.current);
      }, 1000);

      return () => clearInterval(durationInterval);
    }
  }, [isStreaming]);

  // Participant simulation
  useEffect(() => {
    if (isStreaming) {
      const participantInterval = setInterval(() => {
        setParticipants(prev => ({
          count: 1 + Math.floor(Math.random() * 5),
          lastUpdate: Date.now()
        }));
      }, 10000);

      return () => clearInterval(participantInterval);
    }
  }, [isStreaming]);

  // Mobile pattern generation for visualization
  const generateMobilePattern = () => {
    if (Platform.OS === 'web' || !isStreaming) return;

    try {
      const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      const normalizedMagnitude = Math.min(magnitude, 2) / 2;
      
      const baseFreq = 220 + normalizedMagnitude * 440;
      const duration = 500 + Math.random() * 1000;
      
      // Update music pattern for mobile visualization
      setCurrentPattern({
        notes: [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2],
        durations: [duration, duration * 0.75, duration * 0.5, duration * 1.25],
        velocity: [normalizedMagnitude, normalizedMagnitude * 0.8, normalizedMagnitude * 0.6, normalizedMagnitude * 0.9],
        instruments: ['sine', 'triangle', 'sawtooth', 'square']
      });
      
    } catch (error) {
      console.warn('Mobile pattern generation failed:', error);
    }
  };

  // Auto-start streaming when component mounts
  useEffect(() => {
    if (isInitialized && !isStreaming) {
      startTimeRef.current = Date.now();
      setStreamDuration(0);
      setIsStreaming(true);
      console.log('Starting continuous vibestream');
    }
  }, [isInitialized]);

  const closeVibestream = () => {
    setIsStreaming(false);
    console.log('Vibestream closed');
    onBack(); // Navigate to user profile
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

  // Format duration to hh:mm:ss
  const formatDuration = (duration: number): string => {
    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate advanced waveform data
  const generateWaveformData = (): number[] => {
    const points: number[] = [];
    const segments = 150;
    const time = Date.now() / 1000;
    
    for (let i = 0; i < segments; i++) {
      const baseWave = Math.sin((i / segments) * Math.PI * currentFrequency);
      const harmonic1 = Math.sin((i / segments) * Math.PI * currentFrequency * 2) * 0.5;
      const harmonic2 = Math.sin((i / segments) * Math.PI * currentFrequency * 3) * 0.25;
      const motionInfluence = Math.sin(time + i * 0.1) * currentAmplitude * 0.3;
      
      const combinedWave = baseWave + harmonic1 + harmonic2 + motionInfluence;
      const height = 20 + combinedWave * currentAmplitude * 20;
      points.push(Math.max(5, Math.min(40, height)));
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
        <Text style={styles.trackTitle}>VIBESTREAM_LIVE</Text>
        <View style={styles.participantCounter}>
          <FontAwesome5 name="user" size={14} color={COLORS.accent} />
          <Text style={styles.participantCount}>{participants.count}</Text>
        </View>
      </View>

      {/* Main waveform container */}
      <View style={styles.playerContainer}>
        <TouchableOpacity 
          style={styles.waveformContainer}
          onPress={handleWaveformClick}
          activeOpacity={0.9}
        >
          {/* Streaming indicator overlay */}
          <Animated.View 
            style={[
              styles.streamOverlay, 
              { 
                opacity: streamAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3]
                })
              }
            ]} 
          />
          
          {/* Advanced waveform bars */}
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
                      outputRange: [0.4, 1],
                    }),
                    backgroundColor: isStreaming 
                      ? COLORS.accent 
                      : COLORS.primary,
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
            style={[styles.streamButton, styles.streamButtonActive]}
            onPress={closeVibestream}
            disabled={!isInitialized}
          >
            {!isInitialized ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <FontAwesome5 
                  name="stop" 
                  size={16} 
                  color={COLORS.background} 
                />
                <Text style={[styles.streamButtonText, styles.streamButtonTextActive]}>
                  CLOSE VIBESTREAM
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.timeInfo}>
            <Text style={styles.timeText}>
              {formatDuration(streamDuration)}
            </Text>
            <Text style={styles.statusText}>
              {isStreaming ? 'STREAMING' : 'READY'}
            </Text>
          </View>
        </View>

        {/* Music state display */}
        {isStreaming && (
          <View style={styles.musicState}>
            <Text style={styles.musicStateText}>
              BPM: {Math.floor(musicState.bpm)} | KEY: {musicState.key} | 
              AMP: {(currentAmplitude * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Comments section */}
      <ScrollView style={styles.commentsSection}>
        {comments.map((comment) => (
          <View key={comment.id} style={styles.commentItem}>
            <Text style={styles.commentTimestamp}>
              {formatDuration(comment.timestamp - startTimeRef.current)}
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
              placeholder="Add a vibe comment..."
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
        <Text style={styles.statusIndicator}>
          {Platform.OS === 'web' ? 'MOTION_SIM' : 'MOTION_SENSORS'} • 
          {isStreaming ? ' GENERATING_LIVE' : ' STANDBY'}
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
  participantCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participantCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.accent,
    marginLeft: 4,
  },
  playerContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  waveformContainer: {
    height: 120,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  streamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: COLORS.accent,
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
    top: -25,
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
    marginBottom: SPACING.md,
  },
  streamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  streamButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  streamButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  streamButtonTextActive: {
    color: COLORS.background,
  },
  timeInfo: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  musicState: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 4,
    marginBottom: SPACING.md,
  },
  musicStateText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    width: 60,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  statusIndicator: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '500',
  },
});

export default VibePlayer;