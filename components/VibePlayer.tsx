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
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import { useFilCDN } from '../context/filcdn';

// Import new orchestration integration
import { orchestrationIntegration } from '../orchestration/coordinator';

// Import audio chunking service
import { audioChunkService } from './chunks';

const { width, height } = Dimensions.get('window');

interface VibePlayerProps {
  onBack: () => void;
  rtaID?: string;
  config?: any;
  mode?: 'live' | 'playback'; // NEW: Support for RTA playback mode
}

interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  source?: string;
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
  accounts: string[]; // List of participant account IDs
}

// NEW: RTA Playback State
interface RTAPlaybackState {
  currentChunkIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  totalDuration: number;
  audioElement: HTMLAudioElement | null;
  chunkQueue: string[]; // Array of FilCDN URLs
}

// Google Lyria API configuration
const LYRIA_API_KEY = process.env.EXPO_PUBLIC_LYRIA_API_KEY || '';

const VibePlayer: React.FC<VibePlayerProps> = ({ onBack, rtaID, config, mode = 'live' }) => {
  // =============================================================================
  // STATE MANAGEMENT (WITH RTA PLAYBACK)
  // =============================================================================
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [currentAmplitude, setCurrentAmplitude] = useState(0.3);
  const [currentFrequency, setCurrentFrequency] = useState(2);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentPosition, setCommentPosition] = useState(0);
  const [participants, setParticipants] = useState<ParticipantData>({ 
    count: 1, 
    lastUpdate: Date.now(),
    accounts: [config?.creator || '${creator}.testnet'] // Start with creator
  });
  const [currentPattern, setCurrentPattern] = useState<MusicPattern>({
    notes: [],
    durations: [],
    velocity: [],
    instruments: []
  });

  // NEW: RTA Playback State
  const [rtaPlayback, setRtaPlayback] = useState<RTAPlaybackState>({
    currentChunkIndex: 0,
    totalChunks: 0,
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    totalDuration: 0,
    audioElement: null,
    chunkQueue: []
  });

  // NEW: FilCDN integration
  const { getVibestreamByRTA, downloadChunk } = useFilCDN();
  
  // References for timing and cleanup
  const startTimeRef = useRef<number>(Date.now());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rtaProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // =============================================================================
  // UI ANIMATIONS
  // =============================================================================
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const streamAnimation = useRef(new Animated.Value(0)).current;
  const glitchAnimation = useRef(new Animated.Value(0)).current;

  // Current sensor state
  const [sensorData, setSensorData] = useState<SensorData>({
    x: 0, y: 0, z: 0, timestamp: Date.now(),
  });

  // Pure music player state - no blockchain tracking
  
  // =============================================================================
  // STREAMLINED ORCHESTRATION INITIALIZATION
  // =============================================================================
  useEffect(() => {
    const initializeOrchestration = async () => {
      try {
        console.log('🚀 Initializing orchestration...');
        
        // Note: orchestrationIntegration should already be initialized with wallet
        // by the parent component. We just need to start the orchestration.
        
        const status = orchestrationIntegration.getStatus();
        if (!status.initialized) {
          console.warn('⚠️ Orchestration integration not initialized - sensors may not work');
        } else {
          console.log('✅ Orchestration integration ready:', status);
        }

        // ✅ Register sensor data callback to update waveforms
        orchestrationIntegration.onSensorData((data) => {
          if (!data.isDecay) {
            setSensorData(data);
            processRealTimeSensorData(data);
          } else {
            // Apply decay to current sensor data for smooth transitions
            setSensorData(prev => ({
              x: prev.x * 0.95,
              y: prev.y * 0.95, 
              z: Math.max(0.05, prev.z * 0.98),
              timestamp: Date.now(),
              source: 'decay'
            }));
          }
        });

        // Also listen for sensor data events if using EventEmitter pattern
        orchestrationIntegration.on('sensorData', (data) => {
          setSensorData(data);
          processRealTimeSensorData(data);
        });
        
        setIsInitialized(true);

      } catch (error) {
        console.error('❌ Orchestration initialization failed:', error);
        setIsInitialized(true); // Still allow UI to function
      }
    };

    initializeOrchestration();

    return () => {
      // Cleanup intervals
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      if (rtaProgressIntervalRef.current) {
        clearInterval(rtaProgressIntervalRef.current);
        rtaProgressIntervalRef.current = null;
      }
      
      // Cleanup orchestration integration
      orchestrationIntegration.cleanup();
    };
  }, []);

  // =============================================================================
  // REAL-TIME PROCESSING
  // =============================================================================
  const processRealTimeSensorData = useCallback(async (sensorData: SensorData) => {
    try {
      // Note: Sensor data is automatically sent to server by orchestrationIntegration
      // We just need to update the UI based on sensor data
      const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      setCurrentAmplitude(Math.min(magnitude * 0.8 + 0.2, 1));
      setCurrentFrequency(1 + Math.abs(sensorData.x) * 3);
      
    } catch (error) {
      console.warn('Real-time processing error:', error);
    }
  }, []);

  // =============================================================================
  // STREAMING CONTROL
  // =============================================================================
  const startVibestream = async () => {
    try {
      setIsStreaming(true);
      startTimeRef.current = Date.now();
      
      // Start audio chunk service for backend upload
      if (rtaID && config?.creator) {
        // Reload backend URL to ensure we're using latest environment variables
        audioChunkService.reloadBackendUrl();
        audioChunkService.startCollecting(rtaID, config.creator);
        console.log('🎵 Audio chunk service started for RTA:', rtaID);
        
        // Start vibestream in orchestration (enables sensor data collection)
        orchestrationIntegration.startVibestream(rtaID, audioChunkService);
      }

      // Start orchestration - this will:
      // 1. Connect directly to Lyria (client-side)
      // 2. Start sensor data collection (only now that vibestream is active)
      // 3. Begin server interpretation communication
      // NO client-side prompts - orchestration will wait for server-generated prompts
      const success = await orchestrationIntegration.startOrchestration(null);
      
      if (!success) {
        console.error('❌ Failed to start orchestration');
        setIsStreaming(false);
        return;
      }
    } catch (error) {
      setIsStreaming(false);
      console.error('❌ Failed to start vibestream:', error);
    }
  };

  const closeVibestream = async () => {
    setIsStreaming(false);
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    // Stop vibestream (this stops sensor data collection)
    orchestrationIntegration.stopVibestream();
    
    // Stop audio chunk service (will process remaining chunks)
    await audioChunkService.stopCollecting();
    console.log('🛑 Audio chunk service stopped');
    
    // Stop orchestration - this will:
    // 1. Stop Lyria session (client-side)
    // 2. Close server connection
    // 3. Cleanup sensors
    await orchestrationIntegration.stopOrchestration();
    
    console.log('✅ New orchestration architecture vibestream closed');
    onBack(); // Navigate to user profile
  };

  // VibePlayer is now pure - no blockchain/worker management needed

  // =============================================================================
  // AUTO-START OPTIMIZATION
  // =============================================================================
  useEffect(() => {
    if (isInitialized && !isStreaming) {
      // Auto-start streaming for immediate rave experience
      startVibestream();
    }
  }, [isInitialized]);

  // =============================================================================
  // UI EFFECTS AND ANIMATIONS
  // =============================================================================
  useEffect(() => {
    let animationFrame: number;
    
    const throttledUpdate = () => {
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
    };

    // Throttle updates to prevent infinite loops
    animationFrame = requestAnimationFrame(throttledUpdate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [sensorData.timestamp, isStreaming]); // Only update when timestamp changes

  // Stream duration tracking
  useEffect(() => {
    if (isStreaming) {
      const durationInterval = setInterval(() => {
        setStreamDuration(Date.now() - startTimeRef.current);
      }, 1000);

      return () => clearInterval(durationInterval);
    }
    return undefined;
  }, [isStreaming]);

  // Participant simulation
  useEffect(() => {
    if (isStreaming) {
      const participantInterval = setInterval(() => {
        setParticipants(prev => ({
          count: 1 + Math.floor(Math.random() * 5),
          lastUpdate: Date.now(),
          accounts: prev.accounts // Keep existing accounts
        }));
      }, 10000);

      return () => clearInterval(participantInterval);
    }
    return undefined;
  }, [isStreaming]);

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

  // Animations
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveformAnimation, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(waveformAnimation, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glitch animation for streaming indicator
    if (isStreaming) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glitchAnimation, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(glitchAnimation, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [waveformAnimation, glitchAnimation, isStreaming]);

  // =============================================================================
  // UI EVENT HANDLERS
  // =============================================================================
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

  // =============================================================================
  // LOADING STATE
  // =============================================================================
  if (!isInitialized) {
    return (
      <GlitchContainer intensity="high" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <GlitchText text="INITIALIZING ORCHESTRATION..." style={styles.loadingText} />
        <Text style={styles.loadingSubtext}>CONNECTING TO LYRIA AI</Text>
      </GlitchContainer>
    );
  }

  // =============================================================================
  // : MAIN UI RENDER
  // =============================================================================
  return (
    <View style={styles.container}>
      {/* Background glitch effect */}
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />

      {/* Pure VibePlayer - no blockchain integration */}

      {/* Header with worker status */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.statusContainer}>
          <Animated.View style={[
            styles.liveIndicator,
            {
              opacity: isStreaming ? glitchAnimation.interpolate({
                    inputRange: [0, 1],
                outputRange: [0.7, 1]
              }) : 1
            }
          ]}>
            <View style={[styles.liveDot, { 
              backgroundColor: isStreaming ? COLORS.primary : COLORS.muted 
            }]} />
            <GlitchText 
              text={isStreaming ? 'LIVE' : 'IDLE'} 
              style={styles.liveText}
              intensity={isStreaming ? 'medium' : 'low'}
            />
          </Animated.View>
          
          {/* Pure music status */}
          <View style={styles.workerStatus}>
            <Text style={styles.workerStatusText}>
              PURE RAVE EXPERIENCE
            </Text>
          </View>
        </View>
        
        <GlitchText text={formatDuration(streamDuration)} style={styles.durationText} />
      </View>

      {/* Main visualizer */}
      <GlitchContainer 
        intensity={isStreaming ? 'medium' : 'low'} 
        animated={isStreaming}
        style={styles.visualizerContainer}
      >
        <TouchableOpacity onPress={handleWaveformClick} activeOpacity={0.9} style={styles.waveformTouch}>
          <Animated.View style={[styles.waveform, {
            transform: [{
              scaleY: waveformAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1.05]
              })
            }]
          }]}>
            {waveformData.map((amp, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: `${Math.max(5, amp * 80)}%`,
                    backgroundColor: isStreaming ? COLORS.primary : COLORS.muted,
                    opacity: isStreaming ? 1 : 0.6,
                  },
                ]}
              />
            ))}
          </Animated.View>
          
          {/* Sensor data overlay */}
          <View style={styles.sensorOverlay}>
            <Text style={styles.sensorText}>
              X: {sensorData.x.toFixed(2)} | Y: {sensorData.y.toFixed(2)} | Z: {sensorData.z.toFixed(2)}
            </Text>
            <Text style={styles.sensorText}>
              SOURCE: {sensorData.source?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </TouchableOpacity>
      </GlitchContainer>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={closeVibestream}>
          <FontAwesome5 name="times-circle" size={Platform.OS === 'web' ? 40 : 36} color={COLORS.secondary} />
          <GlitchText text="END & ARCHIVE" style={styles.controlButtonText} />
        </TouchableOpacity>
      </View>

      {/* Comments */}
      <View style={styles.commentsSection}>
        <GlitchText text="LIVE COMMENTS" style={styles.sectionTitle} />
        <GlitchContainer intensity="low" style={styles.commentsContainer}>
          <ScrollView style={styles.commentsScrollView} showsVerticalScrollIndicator={false}>
            {comments.map(c => (
              <View key={c.id} style={styles.commentItem}>
                <Text style={styles.commentText}>{c.text}</Text>
                <Text style={styles.commentTime}>
                  {new Date(c.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={styles.noCommentsText}>NO COMMENTS YET</Text>
            )}
          </ScrollView>

          {showCommentInput && (
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="ADD A COMMENT..."
                placeholderTextColor={COLORS.textTertiary}
                value={newComment}
                onChangeText={setNewComment}
                onSubmitEditing={addComment}
                autoFocus
              />
              <TouchableOpacity onPress={addComment} style={styles.commentSubmitButton}>
                <FontAwesome5 name="paper-plane" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        </GlitchContainer>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.medium,
    position: 'relative',
  },
  backgroundGlitch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.primary,
    marginTop: SPACING.medium,
    fontSize: FONT_SIZES.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loadingSubtext: {
    color: COLORS.textTertiary,
    marginTop: SPACING.small,
    fontSize: FONT_SIZES.small,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
    zIndex: 2,
  },
  backButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 0, // Sharp corners
    marginRight: SPACING.small,
  },
  liveText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  durationText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
  },
  visualizerContainer: {
    flex: 3,
    marginVertical: SPACING.medium,
    borderWidth: 2,
    borderColor: COLORS.accent,
    zIndex: 2,
  },
  waveformTouch: {
    flex: 1,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.small,
  },
  waveformBar: {
    width: Platform.OS === 'web' ? 6 : 4,
    borderRadius: 0, // Sharp corners
    minHeight: 5,
  },
  sensorOverlay: {
    position: 'absolute',
    bottom: SPACING.small,
    left: SPACING.small,
    right: SPACING.small,
    backgroundColor: COLORS.background + 'CC',
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  sensorText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.medium,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '40',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
    zIndex: 2,
  },
  controlButton: {
    alignItems: 'center',
    padding: SPACING.medium,
  },
  controlButtonText: {
    color: COLORS.textPrimary,
    marginTop: SPACING.small,
    fontSize: FONT_SIZES.small,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  commentsSection: {
    flex: 2,
    paddingTop: SPACING.medium,
    zIndex: 2,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.large,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.medium,
    textAlign: 'center',
  },
  commentsContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.secondary + '60',
  },
  commentsScrollView: {
    flex: 1,
    padding: SPACING.small,
  },
  commentItem: {
    backgroundColor: COLORS.backgroundLight + '80',
    padding: SPACING.small,
    marginBottom: SPACING.small,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.secondary,
  },
  commentText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.medium,
    marginBottom: SPACING.xs,
  },
  commentTime: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    textTransform: 'uppercase',
  },
  noCommentsText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: SPACING.large,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '40',
    padding: SPACING.small,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
    color: COLORS.textPrimary,
    padding: SPACING.medium,
    fontSize: FONT_SIZES.medium,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
    textTransform: 'uppercase',
  },
  commentSubmitButton: {
    padding: SPACING.medium,
    marginLeft: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  statusContainer: {
    alignItems: 'center',
  },
  workerStatus: {
    marginTop: 4,
  },
  workerStatusText: {
    fontSize: 10,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});

export default VibePlayer;