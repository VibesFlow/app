import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useFilCDN } from '../context/filcdn';
import { ContinuousAudioStreamer } from '../services/ContinuousAudioStreamer';
import { DurationAnalyzer } from '../services/DurationAnalyzer';
import { ProfileLoader } from '../services/ProfileLoader';
import { VibestreamRepair } from '../services/VibeRepair';

const { width, height } = Dimensions.get('window');

interface PlaybackProps {
  onBack: () => void;
  rtaId: string;
}

interface ChunkData {
  chunk_id: string;
  cid: string;
    url: string;
    filcdn_url?: string;
    duration: number;
  sequence: number;
  is_final: boolean;
}

const Playback: React.FC<PlaybackProps> = ({ onBack, rtaId }) => {
  const { getVibestreamByRTA, constructFilCDNUrl } = useFilCDN();
  const [vibestream, setVibestream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    isPaused: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    currentTime: 0,
    totalDuration: 0,
    bufferHealth: 0,
    networkQuality: 'excellent' as 'excellent' | 'good' | 'poor'
  });

  const audioStreamer = useRef<ContinuousAudioStreamer | null>(null);
  const durationAnalyzer = useRef<DurationAnalyzer>(new DurationAnalyzer());
  const profileLoader = useRef<ProfileLoader>(new ProfileLoader());
  const vibeRepair = useRef<VibestreamRepair>(new VibestreamRepair());
  const waveformAnimation = useRef(new Animated.Value(0));
  
  // Creator profile state
  const [creatorProfile, setCreatorProfile] = useState<{
    displayName: string;
    profileImageUri: string | null;
    bio: string;
  }>({
    displayName: '',
    profileImageUri: null,
    bio: ''
  });

  // Initialize audio streamer
  useEffect(() => {
    audioStreamer.current = new ContinuousAudioStreamer();
    
    // Set up callbacks
    audioStreamer.current.onStateChange = (state) => {
      setPlayerState(state);
    };
    
    audioStreamer.current.onChunkTransition = (fromChunk, toChunk) => {
      console.log(`🎵 Chunk transition: ${fromChunk} → ${toChunk}`);
    };
    
    audioStreamer.current.onPlaybackComplete = () => {
      console.log('🏁 Playback completed');
    };
    
    audioStreamer.current.onError = (error) => {
      console.error('❌ Playback error:', error);
    };
    
    return () => {
      // End analytics session
      vibeRepair.current.endSession();
      
      // Dispose audio streamer
      audioStreamer.current?.dispose();
    };
  }, []);

  // Load vibestream data on mount
  useEffect(() => {
    const loadVibestream = async () => {
      try {
        const streamData = getVibestreamByRTA(rtaId);
        if (!streamData) {
          Alert.alert('Error', 'Vibestream not found');
          onBack();
          return;
        }

        setVibestream(streamData);
        
        // Analyze accurate durations using Gemini AI
        const rawChunkData = streamData.chunks_detail?.map((chunk: any) => ({
          chunk_id: chunk.chunk_id,
          cid: chunk.cid,
          url: chunk.url,
          filcdn_url: chunk.filcdn_url,
          sequence: chunk.sequence || 0,
          is_final: chunk.is_final || false
        })) || [];

        // Get accurate duration analysis
        const durationAnalysis = await durationAnalyzer.current.analyzeVibestreamDurations(rtaId, rawChunkData);
        
        // Build chunk queue with accurate durations from AI analysis
        const chunkData: ChunkData[] = rawChunkData.map(chunk => {
          const analyzedDuration = durationAnalysis.chunkDurations.find(
            d => d.chunk_id === chunk.chunk_id
          )?.actualDuration || 60;
          
          return {
            ...chunk,
            duration: analyzedDuration
          };
        });

        console.log(`🎵 Loaded vibestream with AI-analyzed duration: ${durationAnalysis.totalDuration}s (confidence: ${durationAnalysis.confidence})`);

        // Load creator profile (following UserProfile.tsx pattern)
        const profile = await profileLoader.current.loadCreatorProfile(streamData.creator);
        setCreatorProfile(profile);

        // Load chunks into the audio streamer
        audioStreamer.current?.loadVibestream(chunkData);
        
        // Start analytics session
        vibeRepair.current.startSession(rtaId);

        setLoading(false);
        
      } catch (error) {
        console.error('Failed to load vibestream:', error);
        Alert.alert('Error', 'Failed to load vibestream');
        onBack();
      }
    };

    loadVibestream();
  }, [rtaId, getVibestreamByRTA, onBack]);

  // Parse duration helper
  const parseDuration = (duration: string): number => {
    if (!duration || typeof duration !== 'string') return 0;
    
    const parts = duration.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      
      if (isNaN(minutes) || isNaN(seconds)) return 0;
      return minutes * 60 + seconds;
    }
    
    return 0;
  };

  // Toggle playback using the new ContinuousAudioStreamer
  const togglePlayback = useCallback(async () => {
    if (!audioStreamer.current) {
      console.error('❌ Audio streamer not initialized');
      return;
    }

    try {
      if (playerState.isPlaying) {
        audioStreamer.current.pause();
          } else {
        await audioStreamer.current.play();
      }
    } catch (error) {
      console.error('❌ Failed to toggle playback:', error);
      Alert.alert('Playback Error', 'Failed to control playback');
    }
  }, [playerState.isPlaying]);

    // Seek to specific time using the new ContinuousAudioStreamer
  const seekToTime = useCallback(async (targetTime: number) => {
    if (!audioStreamer.current) {
      console.error('❌ Audio streamer not initialized');
        return;
      }

    try {
      // Record seeking behavior for analytics
      vibeRepair.current.recordSeeking();
      
      await audioStreamer.current.seekTo(targetTime);
    } catch (error) {
      console.error('❌ Failed to seek:', error);
      Alert.alert('Seek Error', 'Failed to seek to the specified time');
    }
  }, []);







  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate waveform for entire vibestream
  const generateVibestreamWaveform = (): number[] => {
    const points: number[] = [];
    const segments = 100;
    
    for (let i = 0; i < segments; i++) {
      const progress = i / segments;
      
      // Simulate musical dynamics across the entire vibestream
      const baseHeight = 8;
      const musicalPattern = Math.sin(progress * Math.PI * 8) * 6;
      const intensityWave = Math.sin(progress * Math.PI * 2) * 4;
      const randomVariation = (Math.random() - 0.5) * 3;
      
      const height = baseHeight + musicalPattern + intensityWave + randomVariation;
      points.push(Math.max(3, Math.min(20, height)));
    }
    
    return points;
  };

  // Animate waveform when playing
  useEffect(() => {
    if (playerState.isPlaying) {
      const animate = () => {
        Animated.timing(waveformAnimation.current, {
          toValue: Math.random(),
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          if (playerState.isPlaying) {
            animate();
          }
        });
      };
      animate();
    }
  }, [playerState.isPlaying]);

  // Cleanup is handled by the ContinuousAudioStreamer dispose method in the useEffect

  if (loading) {
    return (
      <View style={styles.container}>
        <GlitchContainer intensity="medium" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>LOADING VIBESTREAM...</Text>
        </GlitchContainer>
      </View>
    );
  }

  const waveformData = generateVibestreamWaveform();

  return (
    <View style={styles.container}>
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <GlitchText text="CONTINUOUS PLAYBACK" style={styles.title} />
        <View style={styles.networkIndicator}>
          <View
            style={[
              styles.networkDot,
              {
                backgroundColor:
                  playerState.networkQuality === 'excellent'
                    ? COLORS.secondary
                    : playerState.networkQuality === 'good'
                    ? COLORS.accent
                    : COLORS.error,
              },
            ]}
          />
          <Text style={styles.networkText}>{playerState.networkQuality.toUpperCase()}</Text>
        </View>
      </View>

      {/* Vibestream Info */}
      <View style={styles.vibestreamInfo}>
        <View style={styles.creatorSection}>
          <View style={styles.profileImageContainer}>
            {creatorProfile.profileImageUri ? (
              <Image 
                source={{ uri: creatorProfile.profileImageUri }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <FontAwesome5 name="user-astronaut" size={20} color={COLORS.primary} />
              </View>
            )}
          </View>
          
          <View style={styles.creatorInfo}>
            <GlitchText text={vibestream.rta_id.toUpperCase()} style={styles.rtaId} />
            <Text style={styles.creatorName}>{creatorProfile.displayName}</Text>
            <Text style={styles.vibestreamMeta}>
              {vibestream.chunks} CHUNKS • {Math.floor(playerState.totalDuration / 60)}:{(playerState.totalDuration % 60).toString().padStart(2, '0')} • CONTINUOUS
            </Text>
          </View>
        </View>
      </View>

      {/* Continuous Playback Controls */}
      <View style={styles.playerSection}>
        <TouchableOpacity 
          style={[styles.playButton, playerState.isPlaying && styles.playButtonActive]}
          onPress={togglePlayback}
        >
          <FontAwesome5 
            name={playerState.isPlaying ? "pause" : "play"} 
            size={24} 
            color={COLORS.background} 
            style={!playerState.isPlaying ? { marginLeft: 2 } : {}}
          />
        </TouchableOpacity>

        <View style={styles.playbackInfo}>
          <Text style={styles.playbackText}>
            CHUNK {playerState.currentChunkIndex + 1}/{playerState.totalChunks}
          </Text>
          <View style={styles.bufferHealth}>
            <Text style={styles.bufferText}>
              BUFFER: {Math.round(playerState.bufferHealth * 100)}%
            </Text>
            <View style={styles.bufferBar}>
              <View 
                style={[
                  styles.bufferFill, 
                  { width: `${playerState.bufferHealth * 100}%` }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>

      {/* Continuous Waveform and Progress */}
      <View style={styles.waveformSection}>
        <TouchableOpacity 
          style={styles.progressContainer}
          onPress={(e) => {
            if (playerState.totalDuration > 0) {
              const { locationX } = e.nativeEvent;
              const progress = locationX / (width - SPACING.medium * 2);
              const targetTime = progress * playerState.totalDuration;
              seekToTime(targetTime);
            }
          }}
          activeOpacity={0.8}
        >
          {/* Progress Track */}
          <View style={styles.progressTrack} />
          
          {/* Progress Fill */}
          <View 
            style={[
              styles.progressFill, 
              { 
                width: playerState.totalDuration > 0 
                  ? `${Math.min(100, (playerState.currentTime / playerState.totalDuration) * 100)}%` 
                  : '0%'
              }
            ]} 
          />
          
          {/* Progress Thumb */}
          <View 
            style={[
              styles.progressThumb,
              {
                left: playerState.totalDuration > 0 
                  ? `${Math.min(95, (playerState.currentTime / playerState.totalDuration) * 100)}%`
                  : '0%'
              }
            ]}
          />
        </TouchableOpacity>

        {/* Animated Vibestream Waveform */}
        <View style={styles.waveform}>
          {waveformData.map((height, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height,
                  backgroundColor: playerState.isPlaying 
                    ? COLORS.secondary 
                    : COLORS.primary + '60',
                  opacity: playerState.isPlaying ? 1 : 0.6,
                },
              ]}
            />
          ))}
        </View>

        {/* Time Display */}
        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{formatTime(playerState.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(playerState.totalDuration)}</Text>
        </View>
      </View>

      {/* Playback Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>BUFFERED</Text>
          <Text style={styles.statValue}>{Math.round(playerState.bufferHealth * playerState.totalChunks)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>QUALITY</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  playerState.networkQuality === 'excellent'
                    ? COLORS.secondary
                    : playerState.networkQuality === 'good'
                    ? COLORS.accent
                    : COLORS.error,
              },
            ]}
          >
            {playerState.networkQuality.toUpperCase()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>NETWORK</Text>
          <Text style={styles.statValue}>HYPERION</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>STORED ON</Text>
          <Text style={styles.statValue}>FILECOIN</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.medium,
    paddingTop: Platform.OS === 'web' ? SPACING.large : SPACING.xl,
    paddingBottom: SPACING.medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
    zIndex: 2,
  },
  backButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  title: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.large : FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  networkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.large,
    fontWeight: 'bold',
  },
  vibestreamInfo: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
    zIndex: 2,
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: SPACING.medium,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 2,
  },
  profileImagePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorInfo: {
    flex: 1,
  },
  rtaId: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.secondary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  creatorName: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  vibestreamMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  playerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    zIndex: 2,
  },
  playButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.large,
    elevation: 4,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playButtonActive: {
    backgroundColor: COLORS.primary,
  },
  playbackInfo: {
    flex: 1,
  },
  playbackText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  bufferHealth: {
    flex: 1,
  },
  bufferText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  bufferBar: {
    height: 3,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 2,
  },
  bufferFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  waveformSection: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    zIndex: 2,
  },
  progressContainer: {
    height: 6,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 3,
    marginBottom: SPACING.medium,
    position: 'relative',
  },
  progressTrack: {
    height: '100%',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 3,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
    marginVertical: SPACING.medium,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.small,
  },
  timeText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
    zIndex: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default Playback;