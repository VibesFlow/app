import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { PINATA_URL } from '@env';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useFilCDN } from '../context/filcdn';

const { width, height } = Dimensions.get('window');

interface VibeMarketProps {
  onBack: () => void;
}

interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  currentChunkIndex: number;
  isLoading: boolean;
  audio: HTMLAudioElement | null;
  chunkUrls: string[];
  error: string | null;
}

const VibeMarket: React.FC<VibeMarketProps> = ({ onBack }) => {
  const { 
    vibestreams, 
    loading, 
    error, 
    refreshVibestreams, 
    downloadChunk,
    getVibestreamsByCreator 
  } = useFilCDN();

  // Track which vibestream is currently playing
  const [playingRTA, setPlayingRTA] = useState<string | null>(null);
  const [audioStates, setAudioStates] = useState<Map<string, AudioPlayerState>>(new Map());
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformAnimations = useRef<Map<string, Animated.Value>>(new Map());

  useEffect(() => {
    // Refresh vibestreams when component mounts
    refreshVibestreams();
  }, []);

  // Initialize audio player for a vibestream
  const initializeAudioPlayer = useCallback((stream: any): AudioPlayerState => {
    const chunkUrls = stream.chunks_detail?.map((chunk: any) => chunk.url) || [];
    const totalDuration = stream.chunks_detail?.reduce((sum: number, chunk: any) => 
      sum + (chunk.duration || 60), 0) || 0;

    const audio = Platform.OS === 'web' ? new Audio() : null;
    
    if (audio) {
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = 0.8;

      // Set up event listeners for continuous playback
      audio.addEventListener('ended', () => {
        const currentState = audioStates.get(stream.rta_id);
        if (currentState) {
          playNextChunk(stream.rta_id);
        }
      });

      audio.addEventListener('timeupdate', () => {
        const currentState = audioStates.get(stream.rta_id);
        if (currentState && currentState.isPlaying) {
          const chunkDuration = 60; // Most chunks are 60s
          const totalProgress = currentState.currentChunkIndex * chunkDuration + audio.currentTime;
          
          setAudioStates(prev => {
            const newMap = new Map(prev);
            const state = newMap.get(stream.rta_id);
            if (state) {
              newMap.set(stream.rta_id, { ...state, currentTime: totalProgress });
            }
            return newMap;
          });
        }
      });

      audio.addEventListener('error', (e) => {
        console.error(`❌ Audio error for ${stream.rta_id}:`, e);
        
        // Try fallback URL if available
        const currentState = audioStates.get(stream.rta_id);
        const currentChunk = stream.chunks_detail?.[currentState?.currentChunkIndex || 0];
        
        if (currentChunk?.fallback_url && !audio.src.includes('pinata')) {
          console.log(`🔄 Trying fallback URL for ${stream.rta_id}`);
          audio.src = currentChunk.fallback_url;
          audio.load();
          return;
        }
        
        setAudioStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(stream.rta_id);
          if (state) {
            newMap.set(stream.rta_id, { 
              ...state, 
              error: 'Failed to load audio - check CORS settings',
              isLoading: false 
            });
          }
          return newMap;
        });
      });
    }

    return {
      isPlaying: false,
      currentTime: 0,
      totalDuration,
      currentChunkIndex: 0,
      isLoading: false,
      audio,
      chunkUrls,
      error: null
    };
  }, [audioStates]);

  // Play next chunk seamlessly
  const playNextChunk = useCallback((rtaId: string) => {
    const state = audioStates.get(rtaId);
    if (!state || !state.audio) return;

    const nextIndex = state.currentChunkIndex + 1;
    
    if (nextIndex >= state.chunkUrls.length) {
      // End of vibestream
      console.log('🏁 Vibestream completed:', rtaId);
      setAudioStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(rtaId);
        if (currentState) {
          newMap.set(rtaId, { ...currentState, isPlaying: false });
        }
        return newMap;
      });
      setPlayingRTA(null);
      return;
    }

    // Load next chunk
    console.log(`🔄 Loading chunk ${nextIndex + 1}/${state.chunkUrls.length} for ${rtaId}`);
    state.audio.src = state.chunkUrls[nextIndex];
    
    setAudioStates(prev => {
      const newMap = new Map(prev);
      newMap.set(rtaId, { 
        ...state, 
        currentChunkIndex: nextIndex,
        isLoading: true 
      });
      return newMap;
    });

    state.audio.addEventListener('canplay', () => {
      state.audio!.play().then(() => {
        setAudioStates(prev => {
          const newMap = new Map(prev);
          const currentState = newMap.get(rtaId);
          if (currentState) {
            newMap.set(rtaId, { ...currentState, isLoading: false });
          }
          return newMap;
        });
      });
    }, { once: true });

    state.audio.load();
  }, [audioStates]);

  // Toggle play/pause for a vibestream
  const togglePlayback = useCallback(async (stream: any) => {
    console.log('🎵 Toggle playback for:', stream.rta_id);

    // Stop any currently playing vibestream
    if (playingRTA && playingRTA !== stream.rta_id) {
      const currentState = audioStates.get(playingRTA);
      if (currentState?.audio) {
        currentState.audio.pause();
        setAudioStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(playingRTA);
          if (state) {
            newMap.set(playingRTA, { ...state, isPlaying: false });
          }
          return newMap;
        });
      }
    }

    let state = audioStates.get(stream.rta_id);
    
    if (!state) {
      // Initialize audio player for this vibestream
      state = initializeAudioPlayer(stream);
      setAudioStates(prev => new Map(prev.set(stream.rta_id, state!)));
    }

    if (!state.audio) {
      Alert.alert('Browser Error', 'Audio not supported on this platform');
      return;
    }

    if (state.isPlaying) {
      // Pause
      state.audio.pause();
      setAudioStates(prev => {
        const newMap = new Map(prev);
        newMap.set(stream.rta_id, { ...state!, isPlaying: false });
        return newMap;
      });
      setPlayingRTA(null);
    } else {
      // Play
      if (state.chunkUrls.length === 0) {
        Alert.alert('No Audio', 'No chunks available for this vibestream');
        return;
      }

      setPlayingRTA(stream.rta_id);
      
      if (!state.audio.src) {
        // Load first chunk
        console.log(`🔄 Loading first chunk for ${stream.rta_id}`);
        state.audio.src = state.chunkUrls[0];
        
        setAudioStates(prev => {
          const newMap = new Map(prev);
          newMap.set(stream.rta_id, { ...state!, isLoading: true, currentChunkIndex: 0 });
          return newMap;
        });

        state.audio.addEventListener('canplay', async () => {
          try {
            await state!.audio!.play();
            setAudioStates(prev => {
              const newMap = new Map(prev);
              const currentState = newMap.get(stream.rta_id);
              if (currentState) {
                newMap.set(stream.rta_id, { 
                  ...currentState, 
                  isPlaying: true, 
                  isLoading: false 
                });
              }
              return newMap;
            });
          } catch (error) {
            console.error('❌ Failed to play audio:', error);
            Alert.alert('Playback Error', 'Failed to start audio playback');
          }
        }, { once: true });

        state.audio.load();
      } else {
        // Resume playback
        try {
          await state.audio.play();
          setAudioStates(prev => {
            const newMap = new Map(prev);
            newMap.set(stream.rta_id, { ...state!, isPlaying: true });
            return newMap;
          });
        } catch (error) {
          console.error('❌ Failed to resume audio:', error);
        }
      }
    }
  }, [playingRTA, audioStates, initializeAudioPlayer]);

  // Seek to specific time in vibestream
  const seekToTime = useCallback((rtaId: string, targetTime: number) => {
    const state = audioStates.get(rtaId);
    if (!state || !state.audio) return;

    const chunkDuration = 60;
    const targetChunkIndex = Math.floor(targetTime / chunkDuration);
    const timeInChunk = targetTime % chunkDuration;
    
    if (targetChunkIndex !== state.currentChunkIndex) {
      // Load different chunk
      if (targetChunkIndex < state.chunkUrls.length) {
        state.audio.src = state.chunkUrls[targetChunkIndex];
        
        setAudioStates(prev => {
          const newMap = new Map(prev);
          newMap.set(rtaId, { 
            ...state, 
            currentChunkIndex: targetChunkIndex,
            isLoading: true 
          });
          return newMap;
        });

        state.audio.addEventListener('canplay', () => {
          state.audio!.currentTime = timeInChunk;
          if (state.isPlaying) {
            state.audio!.play();
          }
          setAudioStates(prev => {
            const newMap = new Map(prev);
            const currentState = newMap.get(rtaId);
            if (currentState) {
              newMap.set(rtaId, { ...currentState, isLoading: false });
            }
            return newMap;
          });
        }, { once: true });

        state.audio.load();
      }
    } else {
      // Same chunk, just seek
      state.audio.currentTime = timeInChunk;
    }
  }, [audioStates]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate simple waveform for visualization
  const generateWaveform = (rtaId: string): number[] => {
    const points: number[] = [];
    const segments = 80; // Reduced for performance
    
    for (let i = 0; i < segments; i++) {
      const height = 10 + Math.sin((i * 0.1) + (Date.now() * 0.001)) * 15 + Math.random() * 10;
      points.push(Math.max(5, Math.min(30, height)));
    }
    return points;
  };

  // Progress tracking animation
  useEffect(() => {
    if (playingRTA) {
      const interval = setInterval(() => {
        const state = audioStates.get(playingRTA);
        if (state?.isPlaying) {
          // Animate waveform
          if (!waveformAnimations.current.has(playingRTA)) {
            waveformAnimations.current.set(playingRTA, new Animated.Value(0));
          }
          
          const animation = waveformAnimations.current.get(playingRTA)!;
          Animated.timing(animation, {
            toValue: Math.random(),
            duration: 100,
            useNativeDriver: false,
          }).start();
        }
      }, 100);

      return () => clearInterval(interval);
    }
    
    // Return undefined when playingRTA is falsy
    return undefined;
  }, [playingRTA, audioStates]);

  const renderVibestreamCard = (stream: any, index: number) => {
    const audioState = audioStates.get(stream.rta_id);
    const isCurrentlyPlaying = playingRTA === stream.rta_id && audioState?.isPlaying;
    const waveformData = generateWaveform(stream.rta_id);
    
    return (
      <GlitchContainer key={stream.rta_id} intensity="low" style={styles.cardContainer}>
        <View style={styles.card}>
          {/* Creator Profile Section */}
          <View style={styles.creatorSection}>
            <View style={styles.profileImageContainer}>
              {stream.user_profile_image ? (
                <AuthenticatedImage 
                  ipfsHash={stream.user_profile_image}
                  style={styles.profileImage}
                  placeholder={
                    <View style={styles.profileImagePlaceholder}>
                      <FontAwesome5 name="user-astronaut" size={20} color={COLORS.primary} />
                    </View>
                  }
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <FontAwesome5 name="user-astronaut" size={20} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.profileImageBorder} />
            </View>
            
            <View style={styles.creatorInfo}>
              <GlitchText text={stream.creator} style={styles.creatorName} />
              <Text style={styles.creatorLabel}>CREATOR</Text>
            </View>

            {/* Play Button */}
            <TouchableOpacity 
              style={[styles.playButton, isCurrentlyPlaying && styles.playButtonActive]}
              onPress={() => togglePlayback(stream)}
              disabled={audioState?.isLoading}
            >
              {audioState?.isLoading ? (
                <ActivityIndicator size={16} color={COLORS.background} />
              ) : (
                <FontAwesome5 
                  name={isCurrentlyPlaying ? "pause" : "play"} 
                  size={16} 
                  color={COLORS.background} 
                  style={!isCurrentlyPlaying ? { marginLeft: 2 } : {}}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Vibestream Info */}
          <View style={styles.streamInfo}>
            <GlitchText text={stream.rta_id.toUpperCase()} style={styles.rtaId} />
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <FontAwesome5 name="clock" size={14} color={COLORS.accent} />
                <Text style={styles.statText}>{stream.rta_duration}</Text>
              </View>
              
              <View style={styles.statItem}>
                <FontAwesome5 name="layer-group" size={14} color={COLORS.accent} />
                <Text style={styles.statText}>{stream.chunks} chunks</Text>
              </View>
              
              <View style={styles.statItem}>
                <FontAwesome5 
                  name={stream.is_complete ? "check-circle" : "hourglass-half"} 
                  size={14} 
                  color={stream.is_complete ? COLORS.secondary : COLORS.primary} 
                />
                <Text style={[
                  styles.statText,
                  { color: stream.is_complete ? COLORS.secondary : COLORS.primary }
                ]}>
                  {stream.is_complete ? "COMPLETE" : "STREAMING"}
                </Text>
              </View>
            </View>
          </View>

          {/* Inline Waveform Progress Bar - CLICKABLE */}
          <View style={styles.waveformSection}>
            <TouchableOpacity 
              style={styles.progressContainer}
              onPress={(e) => {
                if (audioState?.totalDuration && audioState.totalDuration > 0) {
                  const { locationX } = e.nativeEvent;
                  const progress = locationX / (width - SPACING.medium * 4);
                  const targetTime = progress * audioState.totalDuration;
                  seekToTime(stream.rta_id, targetTime);
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
                    width: audioState?.totalDuration && audioState.totalDuration > 0 
                      ? `${Math.min(100, (audioState.currentTime / audioState.totalDuration) * 100)}%` 
                      : '0%'
                  }
                ]} 
              />
              
              {/* Progress Thumb */}
              <View 
                style={[
                  styles.progressThumb,
                  {
                    left: audioState?.totalDuration && audioState.totalDuration > 0 
                      ? `${Math.min(95, (audioState.currentTime / audioState.totalDuration) * 100)}%`
                      : '0%'
                  }
                ]}
              />
            </TouchableOpacity>

            {/* Animated Waveform Visualization */}
            <View style={styles.waveform}>
              {waveformData.map((height, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height,
                      backgroundColor: isCurrentlyPlaying 
                        ? COLORS.secondary 
                        : COLORS.primary + '60',
                      opacity: isCurrentlyPlaying ? 1 : 0.6,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Time Display */}
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>
                {formatTime(audioState?.currentTime || 0)}
              </Text>
              <Text style={styles.timeText}>
                {formatTime(audioState?.totalDuration || 0)}
              </Text>
            </View>
          </View>

          {/* Storage Info */}
          <View style={styles.storageRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="database" size={14} color={COLORS.textTertiary} />
              <Text style={styles.statText}>{stream.total_size_mb.toFixed(1)}MB</Text>
            </View>
            
            <View style={styles.statItem}>
              <FontAwesome5 name="shield-alt" size={14} color={COLORS.textTertiary} />
              <Text style={styles.statText}>PDP #{stream.synapse_proof_set_id}</Text>
            </View>
          </View>

          {/* FilCDN Status */}
          <View style={styles.filcdnSection}>
            <FontAwesome5 name="globe" size={12} color={COLORS.textTertiary} />
            <View style={styles.filcdnIndicator} />
          </View>
        </View>
      </GlitchContainer>
    );
  };

  const handleRefresh = () => {
    console.log('🔄 Refreshing vibestreams...');
    refreshVibestreams();
  };

  return (
    <View style={styles.container}>
      {/* Glitch lines background */}
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <GlitchText text="VIBE MARKET" style={styles.title} />
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <FontAwesome5 name="sync-alt" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Market Header */}
        <View style={styles.marketHeader}>
          <GlitchText text="VIBE MARKET" style={styles.marketTitle} />
          <Text style={styles.marketSubtitle}>POWERED BY FILCDN</Text>
          <Text style={styles.networkInfo}>CONTINUOUS STREAMING • DECENTRALIZED</Text>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-triangle" size={48} color={COLORS.accent} />
            <Text style={styles.errorText}>CONNECTION ERROR</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {loading && !error && (
          <GlitchContainer intensity="medium" style={styles.loadingContainer}>
            <FontAwesome5 name="spinner" size={48} color={COLORS.primary} />
            <Text style={styles.loadingText}>SYNAPSE SDK LOADING...</Text>
          </GlitchContainer>
        )}

        {/* Vibestreams Grid */}
        {!loading && !error && (
          <View style={styles.vibestreamsSection}>
            <View style={styles.sectionHeader}>
              <GlitchText text="LIVE VIBESTREAMS" style={styles.sectionTitle} />
              <Text style={styles.vibestreamCount}>{vibestreams.length} STREAMS</Text>
            </View>

            {vibestreams.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="satellite-dish" size={48} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No vibestreams found in proof sets</Text>
                <Text style={styles.emptySubtext}>Create your first vibestream to see it here</Text>
              </View>
            ) : (
              vibestreams.map((stream, index) => renderVibestreamCard(stream, index))
            )}
          </View>
        )}

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>DECENTRALIZED FREQUENCIES</Text>
          <Text style={styles.brandText}>COLLECTIVE RESONANCE</Text>
          <Text style={styles.brandText}>POWERED BY FILCDN</Text>
        </View>
      </ScrollView>
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
  refreshButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  title: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.xl : FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.medium,
    zIndex: 2,
  },
  marketHeader: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
    paddingVertical: SPACING.large,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary + '40',
  },
  marketTitle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: SPACING.small,
  },
  marketSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
  },
  networkInfo: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.large,
  },
  vibestreamsSection: {
    marginVertical: SPACING.large,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  vibestreamCount: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  cardContainer: {
    marginBottom: SPACING.medium,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  card: {
    padding: SPACING.medium,
    backgroundColor: COLORS.backgroundLight + '60',
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.medium,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: SPACING.medium,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 2,
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageBorder: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  creatorLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  streamInfo: {
    marginBottom: SPACING.medium,
  },
  rtaId: {
    fontSize: FONT_SIZES.large,
    color: COLORS.secondary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: SPACING.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.small,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filcdnSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.small,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
  },
  filcdnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    flex: 1,
  },
  filcdnIndicator: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.secondary,
    marginLeft: SPACING.small,
  },
  playButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playButtonActive: {
    backgroundColor: COLORS.primary,
  },
  waveformSection: {
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.small,
  },
  progressContainer: {
    height: 6,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 3,
    marginBottom: SPACING.small,
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
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
    marginVertical: SPACING.small,
    paddingHorizontal: SPACING.xs,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  timeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textSecondary,
    marginTop: SPACING.large,
    letterSpacing: 2,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
    marginTop: SPACING.small,
    letterSpacing: 1,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  errorText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.accent,
    letterSpacing: 2,
    marginTop: SPACING.large,
    fontWeight: 'bold',
  },
  errorSubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.small,
    textAlign: 'center',
    paddingHorizontal: SPACING.large,
  },
  retryButton: {
    marginTop: SPACING.medium,
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryButtonText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  infoSection: {
    padding: SPACING.medium,
    backgroundColor: COLORS.backgroundLight + '40',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginVertical: SPACING.large,
  },
  infoTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: SPACING.medium,
  },
  infoText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary + '40',
    marginTop: SPACING.xl,
  },
  brandText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
});

export default VibeMarket; 