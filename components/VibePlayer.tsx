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
import { useWallet } from '../context/connector';

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
  participantOptions?: {
    isParticipant?: boolean;
    streamingUrl?: string;
    hlsUrl?: string;
    // PPM-related options
    isPPMEnabled?: boolean;
    streamPrice?: string;
    authorizedAllowance?: string;
  };
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

const VibePlayer: React.FC<VibePlayerProps> = ({ onBack, rtaID, config, mode = 'live', participantOptions }) => {
  const { getPPMAllowance, leavePPMVibestream } = useWallet();
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

  // PPM Allowance State (Participant Mode Only)
  const [ppmAllowance, setPpmAllowance] = useState({
    authorized: parseFloat(participantOptions?.authorizedAllowance || '0'),
    spent: 0,
    remaining: parseFloat(participantOptions?.authorizedAllowance || '0'),
    lastDeduction: Date.now(),
    streamPrice: parseFloat(participantOptions?.streamPrice || '0'),
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
  // INITIALIZATION (CREATOR vs PARTICIPANT MODE)
  // =============================================================================
  useEffect(() => {
    const initializeVibePlayer = async () => {
      try {
        if (participantOptions?.isParticipant) {
          // PARTICIPANT MODE: Only initialize basic UI and audio streaming
          console.log('👥 PARTICIPANT MODE: Initializing audio streaming only...');
          
          // Start simple waveform animation for participants (no sensor data needed)
          const participantWaveformInterval = setInterval(() => {
            const time = Date.now() / 1000;
            const simulatedSensorData = {
              x: Math.sin(time * 0.3) * 0.5,
              y: Math.cos(time * 0.4) * 0.4,
              z: 0.5 + Math.sin(time * 0.2) * 0.3,
              timestamp: Date.now(),
              source: 'participant_simulation'
            };
            setSensorData(simulatedSensorData);
            processRealTimeSensorData(simulatedSensorData);
          }, 100); // 10fps for participants - lighter processing
          
          updateIntervalRef.current = participantWaveformInterval;
          setIsInitialized(true);
          
          console.log('✅ PARTICIPANT MODE: Ready for audio streaming');
          return;
        }
        
        // CREATOR MODE: Full orchestration system
        console.log('🎛️ CREATOR MODE: Initializing full orchestration system...');
        
        // Start with basic sensor simulation for waveforms while orchestration loads
        const sensorInterval = setInterval(() => {
          // Generate realistic sensor data for waveforms
          const time = Date.now() / 1000;
          const sensorData = {
            x: Math.sin(time * 0.5) * 0.8 + Math.random() * 0.4 - 0.2,
            y: Math.cos(time * 0.7) * 0.6 + Math.random() * 0.3 - 0.15,
            z: Math.sin(time * 0.3) * 0.5 + 0.5 + Math.random() * 0.2 - 0.1,
            timestamp: Date.now(),
            source: 'simulation'
          };
          
          setSensorData(sensorData);
          processRealTimeSensorData(sensorData);
        }, 50); // 20fps sensor updates for creators
        
        updateIntervalRef.current = sensorInterval;
        
        // Try to initialize orchestration integration (CREATOR ONLY)
        const status = orchestrationIntegration.getStatus();
        if (status.initialized) {
          console.log('✅ Orchestration integration ready (CREATOR MODE):', status);
          
          // Try to get real sensor data (CREATOR ONLY)
          try {
            orchestrationIntegration.onSensorData((data) => {
              if (!data.isDecay) {
                setSensorData(data);
                processRealTimeSensorData(data);
                
                // Feed audio data to chunks service (CREATOR ONLY)
                if (typeof data.audioData === 'string' || data.audioData instanceof ArrayBuffer) {
                  audioChunkService.addAudioData(data.audioData);
                  console.log('🎵 Audio data fed to chunks service (CREATOR):', typeof data.audioData);
                }
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
          } catch (error) {
            console.warn('⚠️ Real sensor data not available, using simulation');
          }
        } else {
          console.warn('⚠️ Orchestration integration not ready, using simulation for waveforms');
        }

        setIsInitialized(true);
        console.log('✅ CREATOR MODE: Orchestration system initialized successfully');

      } catch (error) {
        console.error('❌ VibePlayer initialization failed:', error);
        setIsInitialized(true); // Still allow UI to function
      }
    };

    initializeVibePlayer();

    return () => {
      // Cleanup all intervals
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      if (rtaProgressIntervalRef.current) {
        clearInterval(rtaProgressIntervalRef.current);
        rtaProgressIntervalRef.current = null;
      }
      
      // Cleanup orchestration integration (only if creator mode)
      if (!participantOptions?.isParticipant) {
        try {
          orchestrationIntegration.cleanup();
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      }
    };
  }, [participantOptions?.isParticipant]);

  // =============================================================================
  // REAL-TIME PROCESSING
  // =============================================================================
  const processRealTimeSensorData = useCallback(async (sensorData: SensorData) => {
    try {
      // Accurate waveform representation
      const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      
      // More sensitive and responsive amplitude calculation
      const amplitudeResponse = Math.min(magnitude * 2.5 + 0.1, 1); // Increased sensitivity from 0.8 to 2.5
      setCurrentAmplitude(amplitudeResponse);
      
      // Enhanced frequency response with multiple sensor axis mapping
      const frequencyBase = 1.0;
      const xContribution = Math.abs(sensorData.x) * 4; // Increased from 3 to 4
      const yContribution = Math.abs(sensorData.y) * 2; // Added Y axis contribution
      const zContribution = Math.abs(sensorData.z) * 1.5; // Added Z axis contribution
      setCurrentFrequency(frequencyBase + xContribution + yContribution + zContribution);
      
      
    } catch (error) {
      console.warn('Real-time processing error:', error);
    }
  }, []);

  // =============================================================================
  // PARTICIPANT MODE (SRS STREAMING)
  // =============================================================================
  
  // Start participant mode - receive audio from SRS
  const startParticipantMode = async () => {
    try {
      console.log('👥 Starting participant mode - receiving from SRS');
      
      setIsStreaming(true);
      startTimeRef.current = Date.now();
      
      // Create audio element for LIVE HTTP-FLV stream
      if (participantOptions?.streamingUrl) {
        console.log(`🎵 Connecting to LIVE SRS stream: ${participantOptions.streamingUrl}`);
        
        // Create HTML5 audio element for live streaming
        const liveAudio = new Audio();
        liveAudio.crossOrigin = 'anonymous';
        liveAudio.src = participantOptions.streamingUrl;
        liveAudio.volume = 0.8;
        liveAudio.autoplay = true;
        liveAudio.controls = false;
        
        // Handle audio events
        liveAudio.onloadstart = () => console.log('🔄 Loading live stream...');
        liveAudio.oncanplay = () => console.log('✅ Live stream ready to play');
        liveAudio.onplay = () => console.log('▶️ Live stream playing');
        liveAudio.onerror = (e) => {
          console.error('❌ Live stream error:', e);
          console.log('🔄 Retrying with HLS fallback...');
          // Try HLS as fallback
          if (participantOptions?.hlsUrl) {
            liveAudio.src = participantOptions.hlsUrl;
          }
        };
        liveAudio.onstalled = () => {
          console.warn('⚠️ Live stream stalled - stream may not be active yet');
          // Try to reload after a delay
          setTimeout(() => {
            console.log('🔄 Retrying stalled stream...');
            liveAudio.load();
          }, 3000);
        };
        liveAudio.onwaiting = () => console.log('⏳ Live stream buffering...');
        
        // Start live playback
        try {
          await liveAudio.play();
          console.log('✅ Vibestream started for participant');
        } catch (playError) {
          console.error('❌ Failed to start live audio:', playError);
          throw playError;
        }
        
        // Store cleanup function for component unmount
        const cleanup = () => {
          console.log('🛑 Cleaning up participant audio stream');
          liveAudio.pause();
          liveAudio.src = '';
          liveAudio.remove();
        };
        
        // Store cleanup reference
        (updateIntervalRef as any).current = { cleanup };
        
        console.log('✅ Participant mode started - receiving creator\'s audio via SRS');
        return cleanup;
      } else {
        throw new Error('No streaming URL provided for participant mode');
      }
      
    } catch (error) {
      console.error('❌ Failed to start participant mode:', error);
      setIsStreaming(false);
      throw error;
    }
  };

  // =============================================================================
  // STREAMING CONTROL
  // =============================================================================
  const startVibestream = async () => {
    try {
      console.log('🎵 Starting vibestream with RTA:', rtaID);
      
      // Check if this is a participant joining an existing vibestream
      if (participantOptions?.isParticipant) {
        console.log(`👥 PARTICIPANT MODE: Joining existing vibestream`);
        console.log(`🎵 Stream URL: ${participantOptions.streamingUrl}`);
        console.log(`📺 HLS URL: ${participantOptions.hlsUrl}`);
        
        // PARTICIPANT-ONLY: Start audio streaming mode - receive from SRS
        await startParticipantMode();
        return;
      }
      
      // CREATOR MODE: Full vibestream creation with orchestration
      console.log('🎛️ CREATOR MODE: Creating new vibestream with full orchestration');
      
      setIsStreaming(true);
      startTimeRef.current = Date.now();
      
      // CREATOR-ONLY: Start audio chunk service for backend upload
      if (rtaID && config?.creator) {
        console.log('🎵 CREATOR: Starting audio chunk service...');
        
        // Reload backend URL to ensure we're using latest environment variables
        audioChunkService.reloadBackendUrl();
        audioChunkService.startCollecting(rtaID, config.creator);
        console.log('🎵 CREATOR: Audio chunk service started for RTA:', rtaID);
        
        // Update participant count in chunks service
        audioChunkService.updateParticipantCount(participants.count);
      }

      // CREATOR-ONLY: Start Lyria orchestration and background systems
      try {
        console.log('🎛️ CREATOR: Starting Lyria orchestration...');
        
        // 1. Initialize orchestration integration with wallet (CREATOR ONLY)
        if (config?.creator) {
          await orchestrationIntegration.initializeWithWallet({ account: { accountId: config.creator } });
        }
        
        // 2. Start orchestration (Lyria music generation) - CREATOR ONLY
        const success = await orchestrationIntegration.startOrchestration();
        
        if (!success) {
          console.error('❌ CREATOR: Failed to start Lyria orchestration');
          setIsStreaming(false);
          return;
        }
        
        console.log('🎉 CREATOR: Lyria started with baseline');
        
        // 3. Start vibestream session (sensors + chunks) - CREATOR ONLY
        if (rtaID) {
          orchestrationIntegration.startVibestreamSession(rtaID, audioChunkService).catch(error => {
            console.warn('⚠️ CREATOR: Vibestream session failed:', error.message);
          });
        }
        
      } catch (error) {
        console.error('❌ CREATOR: Failed to start orchestration:', error);
      }
      
    } catch (error) {
      setIsStreaming(false);
      console.error('❌ Failed to start vibestream:', error);
    }
  };

  const closeVibestream = async () => {
    console.log('🛑 Closing vibestream...');
    setIsStreaming(false);
    
    // Handle different cleanup for participant vs creator
    if (participantOptions?.isParticipant) {
      // PARTICIPANT MODE: PPM cleanup + audio cleanup
      console.log('🛑 PARTICIPANT: Cleaning up audio stream and PPM...');
      
      // Leave PPM vibestream if enabled
      if (participantOptions?.isPPMEnabled && rtaID) {
        try {
          const vibeId = rtaID.replace('metis_vibe_', '');
          await leavePPMVibestream(vibeId);
          console.log('✅ PARTICIPANT: Left PPM vibestream');
        } catch (error) {
          console.warn('⚠️ Failed to leave PPM vibestream:', error);
        }
      }
      
      if (updateIntervalRef.current && typeof (updateIntervalRef.current as any).cleanup === 'function') {
        (updateIntervalRef.current as any).cleanup();
      }
      updateIntervalRef.current = null;
      
      console.log('✅ PARTICIPANT: Cleanup complete');
    } else {
      // CREATOR MODE: Full orchestration cleanup
      console.log('🛑 CREATOR: Full orchestration cleanup...');
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      // Cleanup sequence for creator
      try {
        // Stop audio chunk service first (will process remaining chunks)
        await audioChunkService.stopCollecting();
        console.log('🛑 CREATOR: Audio chunk service stopped');
        
        // Stop vibestream session (this will cleanup sensors)
        orchestrationIntegration.stopVibestream();
        
        // Stop orchestration - this will:
        // 1. Stop Lyria session (client-side)
        // 2. Close server connection
        await orchestrationIntegration.stopOrchestration();
        
        console.log('✅ CREATOR: Vibestream closed successfully');
      } catch (error) {
        console.error('❌ CREATOR: Error during vibestream cleanup:', error);
      }
    }
    
    onBack(); // Navigate to user profile
  };

  // VibePlayer is now pure - no blockchain/agent management needed

  // =============================================================================
  // AUTO-START OPTIMIZATION (CREATOR-ONLY)
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

  // PPM Allowance tracking for participants - fetch real data from contract
  useEffect(() => {
    if (participantOptions?.isParticipant && participantOptions?.isPPMEnabled && isStreaming && rtaID) {
      console.log('💰 Starting real PPM allowance tracking for participant');
      
      const fetchPPMAllowance = async () => {
        try {
          const vibeId = rtaID.replace('metis_vibe_', ''); // Extract numeric vibeId
          const allowanceData = await getPPMAllowance(vibeId);
          
          const authorizedWei = allowanceData[2]; // authorizedAmount
          const spentWei = allowanceData[3]; // spentAmount
          const payPerMinuteWei = allowanceData[4]; // payPerMinute
          const isActive = allowanceData[7]; // isActive
          
          const authorized = parseFloat((authorizedWei / BigInt(10**18)).toString());
          const spent = parseFloat((spentWei / BigInt(10**18)).toString());
          const streamPrice = parseFloat((payPerMinuteWei / BigInt(10**18)).toString());
          const remaining = authorized - spent;
          
          setPpmAllowance({
            authorized,
            spent,
            remaining,
            lastDeduction: Date.now(),
            streamPrice,
          });
          
          console.log(`💰 PPM Status - Authorized: ${authorized}, Spent: ${spent}, Remaining: ${remaining}, Active: ${isActive}`);
          
          // Check if allowance is exhausted
          if (remaining <= 0 || !isActive) {
            console.log('⚠️ PPM allowance exhausted or participant inactive');
            Alert.alert(
              'Allowance Exhausted',
              'Your spending allowance has been used up. You will be disconnected from the vibestream.',
              [{ text: 'OK', onPress: () => onBack() }]
            );
          }
          
        } catch (error) {
          console.warn('⚠️ Failed to fetch PPM allowance:', error);
        }
      };
      
      // Fetch allowance immediately
      fetchPPMAllowance();
      
      // Then fetch every 10 seconds to stay updated
      const ppmInterval = setInterval(fetchPPMAllowance, 10000);
      
      return () => clearInterval(ppmInterval);
    }
    return undefined;
  }, [isStreaming, participantOptions?.isParticipant, participantOptions?.isPPMEnabled, rtaID, getPPMAllowance, onBack]);

  // Participant tracking (CREATOR-ONLY)
  useEffect(() => {
    // Skip all participant tracking for participants - they don't need to track themselves
    if (participantOptions?.isParticipant) {
      console.log('👥 PARTICIPANT: Skipping participant tracking (not needed)');
      return;
    }
    
    // CREATOR-ONLY: Track participants for group mode vibestreams
    if (isStreaming && rtaID && config?.mode === 'group') {
      console.log(`🎯 CREATOR: Group mode vibestream detected:`, rtaID);
      
      // Fallback: use creator as single participant for now
      setParticipants({
        count: 1,
        lastUpdate: Date.now(),
        accounts: [config?.creator || 'creator.testnet']
      });
      
      // Update chunk service with participant count
      audioChunkService.updateParticipantCount(1);
      
      console.log('📝 CREATOR: Real participant tracking temporarily disabled due to import issues');
    } else if (isStreaming) {
      // CREATOR-ONLY: Solo mode - just use creator
      console.log('🎯 CREATOR: Solo mode vibestream');
      setParticipants({
        count: 1,
        lastUpdate: Date.now(),
        accounts: [config?.creator || 'creator.testnet']
      });
      audioChunkService.updateParticipantCount(1);
    }
    
    return undefined;
  }, [isStreaming, rtaID, config?.mode, config?.creator, participantOptions?.isParticipant]);

  // Format duration to hh:mm:ss
  const formatDuration = (duration: number): string => {
    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate advanced waveform data (EXACT LEGACY PATTERN)
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
              {participantOptions?.isParticipant ? 'PARTICIPANT MODE - RECEIVING STREAM' : 'CREATOR MODE - GENERATING MUSIC'}
            </Text>
          </View>

          {/* PPM Allowance Display (Participant Mode Only) */}
          {participantOptions?.isParticipant && participantOptions?.isPPMEnabled && (
            <View style={styles.ppmAllowanceContainer}>
              <Text style={styles.ppmAllowanceLabel}>ALLOWANCE:</Text>
              <Text style={[
                styles.ppmAllowanceValue,
                { color: ppmAllowance.remaining <= ppmAllowance.streamPrice * 2 ? COLORS.error : COLORS.accent }
              ]}>
                {ppmAllowance.remaining.toFixed(4)} tMETIS
              </Text>
              <Text style={styles.ppmAllowanceRate}>
                -{ppmAllowance.streamPrice} tMETIS/MIN
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          <GlitchText text={formatDuration(streamDuration)} style={styles.durationText} />
        </View>
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
  headerRight: {
    alignItems: 'center',
  },
  // PPM Allowance Display Styles
  ppmAllowanceContainer: {
    marginTop: SPACING.small,
    alignItems: 'center',
    backgroundColor: COLORS.background + '80',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  ppmAllowanceLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  ppmAllowanceValue: {
    fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  ppmAllowanceRate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    marginTop: 2,
  },
});

export default VibePlayer;