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
  Alert,
  Slider,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import { useFilCDN } from '../context/filcdn';

const { width, height } = Dimensions.get('window');

interface RTAPlayerProps {
  rtaId: string;
  onBack: () => void;
  onError?: (error: string) => void;
}

interface RTAPlaybackState {
  currentChunkIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  totalDuration: number;
  audioElement: HTMLAudioElement | null;
  chunkUrls: string[];
  volume: number;
  isLoading: boolean;
}

interface ChunkTransition {
  fromChunk: number;
  toChunk: number;
  progress: number;
}

const RTAPlayer: React.FC<RTAPlayerProps> = ({ rtaId, onBack, onError }) => {
  // =============================================================================
  // SECTION: RTA PLAYBACK STATE
  // =============================================================================
  const [rtaData, setRtaData] = useState<any>(null);
  const [playbackState, setPlaybackState] = useState<RTAPlaybackState>({
    currentChunkIndex: 0,
    totalChunks: 0,
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    totalDuration: 0,
    audioElement: null,
    chunkUrls: [],
    volume: 0.8,
    isLoading: true
  });

  const [chunkTransition, setChunkTransition] = useState<ChunkTransition | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // FilCDN integration
  const { getVibestreamByRTA, downloadChunk } = useFilCDN();

  // Animation references
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const playingAnimation = useRef(new Animated.Value(0)).current;
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // SECTION: RTA DATA LOADING
  // =============================================================================
  useEffect(() => {
    const loadRTAData = async () => {
      try {
        console.log(`🎵 Loading RTA data for: ${rtaId}`);
        setPlaybackState(prev => ({ ...prev, isLoading: true }));

        // Get RTA metadata from FilCDN context
        const rtaMetadata = getVibestreamByRTA(rtaId);
        
        if (!rtaMetadata) {
          throw new Error(`RTA ${rtaId} not found`);
        }

        if (!rtaMetadata.chunks_detail || rtaMetadata.chunks_detail.length === 0) {
          throw new Error(`No chunks found for RTA ${rtaId}`);
        }

        console.log(`✅ Found RTA with ${rtaMetadata.chunks_detail.length} chunks`);
        
        // Extract FilCDN URLs and sort by sequence
        const sortedChunks = [...rtaMetadata.chunks_detail].sort((a, b) => 
          (a.sequence || 0) - (b.sequence || 0)
        );
        
        const chunkUrls = sortedChunks.map(chunk => chunk.url);
        const totalDuration = sortedChunks.reduce((sum, chunk) => sum + (chunk.duration || 60), 0);

        setRtaData(rtaMetadata);
        setPlaybackState(prev => ({
          ...prev,
          totalChunks: sortedChunks.length,
          chunkUrls,
          totalDuration,
          isLoading: false
        }));

        setIsInitialized(true);
        console.log(`🎼 RTA player initialized: ${sortedChunks.length} chunks, ${totalDuration}s total`);

      } catch (error) {
        console.error('❌ Failed to load RTA data:', error);
        setPlaybackState(prev => ({ ...prev, isLoading: false }));
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to load RTA';
        onError?.(errorMessage);
        
        Alert.alert(
          'Playback Error',
          errorMessage,
          [{ text: 'OK', onPress: onBack }]
        );
      }
    };

    loadRTAData();
  }, [rtaId]);

  // =============================================================================
  // SECTION: AUDIO PLAYBACK CONTROL
  // =============================================================================
  const createAudioElement = useCallback(() => {
    if (Platform.OS !== 'web') {
      console.warn('RTA playback only supported on web platform');
      return null;
    }

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = playbackState.volume;

    // Audio event listeners
    audio.addEventListener('loadstart', () => {
      console.log('🔄 Loading chunk audio...');
    });

    audio.addEventListener('canplay', () => {
      console.log('▶️ Chunk ready to play');
    });

    audio.addEventListener('playing', () => {
      setPlaybackState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    });

    audio.addEventListener('pause', () => {
      setPlaybackState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    });

    audio.addEventListener('ended', () => {
      console.log('🏁 Chunk ended, moving to next...');
      playNextChunk();
    });

    audio.addEventListener('timeupdate', () => {
      const chunkDuration = rtaData?.chunks_detail?.[playbackState.currentChunkIndex]?.duration || 60;
      const chunkProgress = (audio.currentTime / chunkDuration) * 100;
      const totalProgress = playbackState.currentChunkIndex * 60 + audio.currentTime;
      
      setPlaybackState(prev => ({ ...prev, currentTime: totalProgress }));
    });

    audio.addEventListener('error', (e) => {
      console.error('❌ Audio playback error:', e);
      const errorMessage = 'Failed to play audio chunk';
      onError?.(errorMessage);
    });

    return audio;
  }, [playbackState.volume, playbackState.currentChunkIndex]);

  const loadChunk = async (chunkIndex: number) => {
    if (!playbackState.chunkUrls[chunkIndex] || !playbackState.audioElement) {
      return false;
    }

    try {
      const chunkUrl = playbackState.chunkUrls[chunkIndex];
      console.log(`🔄 Loading chunk ${chunkIndex + 1}/${playbackState.totalChunks}: ${chunkUrl}`);

      setChunkTransition({ fromChunk: playbackState.currentChunkIndex, toChunk: chunkIndex, progress: 0 });

      playbackState.audioElement.src = chunkUrl;
      playbackState.audioElement.load();

      return new Promise<boolean>((resolve) => {
        const onCanPlay = () => {
          playbackState.audioElement!.removeEventListener('canplay', onCanPlay);
          setPlaybackState(prev => ({ ...prev, currentChunkIndex: chunkIndex }));
          setChunkTransition(null);
          resolve(true);
        };

        const onError = () => {
          playbackState.audioElement!.removeEventListener('error', onError);
          console.error(`❌ Failed to load chunk ${chunkIndex + 1}`);
          resolve(false);
        };

        playbackState.audioElement!.addEventListener('canplay', onCanPlay);
        playbackState.audioElement!.addEventListener('error', onError);
      });

    } catch (error) {
      console.error('❌ Chunk loading error:', error);
      setChunkTransition(null);
      return false;
    }
  };

  const playRTA = async () => {
    if (!isInitialized || playbackState.isLoading) return;

    try {
      // Create audio element if not exists
      if (!playbackState.audioElement) {
        const audioElement = createAudioElement();
        if (!audioElement) return;
        
        setPlaybackState(prev => ({ ...prev, audioElement }));
        
        // Load first chunk
        const success = await loadChunk(0);
        if (!success) return;
      }

      // Play current chunk
      await playbackState.audioElement?.play();
      
      // Start progress tracking
      startProgressTracking();

    } catch (error) {
      console.error('❌ Failed to start RTA playback:', error);
      onError?.('Failed to start playback');
    }
  };

  const pauseRTA = () => {
    playbackState.audioElement?.pause();
    stopProgressTracking();
  };

  const stopRTA = () => {
    playbackState.audioElement?.pause();
    playbackState.audioElement!.currentTime = 0;
    setPlaybackState(prev => ({ 
      ...prev, 
      currentChunkIndex: 0, 
      currentTime: 0, 
      isPlaying: false, 
      isPaused: false 
    }));
    stopProgressTracking();
  };

  const playNextChunk = async () => {
    const nextIndex = playbackState.currentChunkIndex + 1;
    
    if (nextIndex >= playbackState.totalChunks) {
      console.log('🏁 RTA playback completed');
      stopRTA();
      return;
    }

    const success = await loadChunk(nextIndex);
    if (success && playbackState.isPlaying) {
      playbackState.audioElement?.play();
    }
  };

  const playPreviousChunk = async () => {
    const prevIndex = Math.max(0, playbackState.currentChunkIndex - 1);
    const success = await loadChunk(prevIndex);
    if (success && playbackState.isPlaying) {
      playbackState.audioElement?.play();
    }
  };

  const seekToChunk = async (chunkIndex: number) => {
    if (chunkIndex >= 0 && chunkIndex < playbackState.totalChunks) {
      const wasPlaying = playbackState.isPlaying;
      const success = await loadChunk(chunkIndex);
      
      if (success && wasPlaying) {
        playbackState.audioElement?.play();
      }
    }
  };

  // =============================================================================
  // SECTION: PROGRESS TRACKING
  // =============================================================================
  const startProgressTracking = () => {
    stopProgressTracking(); // Clear any existing interval
    
    progressIntervalRef.current = setInterval(() => {
      if (playbackState.audioElement && playbackState.isPlaying) {
        const chunkDuration = rtaData?.chunks_detail?.[playbackState.currentChunkIndex]?.duration || 60;
        const totalProgress = playbackState.currentChunkIndex * 60 + playbackState.audioElement.currentTime;
        
        setPlaybackState(prev => ({ ...prev, currentTime: totalProgress }));
        
        // Update waveform animation based on audio
        const amplitude = Math.min(1, Math.random() * 0.8 + 0.2); // Simulate audio amplitude
        Animated.timing(waveformAnimation, {
          toValue: amplitude,
          duration: 100,
          useNativeDriver: false,
        }).start();
      }
    }, 100);
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // =============================================================================
  // SECTION: UI EFFECTS
  // =============================================================================
  useEffect(() => {
    // Playing animation
    Animated.timing(playingAnimation, {
      toValue: playbackState.isPlaying ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [playbackState.isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressTracking();
      if (playbackState.audioElement) {
        playbackState.audioElement.pause();
        playbackState.audioElement.src = '';
      }
    };
  }, []);

  // =============================================================================
  // SECTION: UI HELPER FUNCTIONS
  // =============================================================================
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateChunkWaveform = (chunkIndex: number): number[] => {
    const points: number[] = [];
    const segments = 60;
    
    for (let i = 0; i < segments; i++) {
      const height = 10 + Math.sin((chunkIndex * 10 + i) * 0.1) * 15 + Math.random() * 10;
      points.push(Math.max(5, Math.min(35, height)));
    }
    return points;
  };

  // =============================================================================
  // SECTION: LOADING STATE
  // =============================================================================
  if (!isInitialized || playbackState.isLoading) {
    return (
      <GlitchContainer intensity="medium" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <GlitchText text="LOADING RTA FROM FILCDN..." style={styles.loadingText} />
        <Text style={styles.loadingSubtext}>SYNAPSE SDK • PROOF SET #{rtaData?.synapse_proof_set_id || '...'}</Text>
      </GlitchContainer>
    );
  }

  // =============================================================================
  // SECTION: MAIN UI RENDER
  // =============================================================================
  return (
    <View style={styles.container}>
      {/* Background glitch effect */}
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <GlitchText text="RTA PLAYBACK" style={styles.headerTitle} />
          <Text style={styles.headerSubtitle}>FILCDN • SYNAPSE SDK</Text>
        </View>

        <TouchableOpacity style={styles.infoButton}>
          <FontAwesome5 name="info-circle" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* RTA Info */}
      <View style={styles.rtaInfo}>
        <GlitchText text={rtaData?.rta_id?.toUpperCase() || 'UNKNOWN RTA'} style={styles.rtaId} />
        <Text style={styles.creatorText}>BY {rtaData?.creator?.toUpperCase() || 'UNKNOWN'}</Text>
        
        <View style={styles.rtaStats}>
          <View style={styles.statItem}>
            <FontAwesome5 name="layer-group" size={12} color={COLORS.accent} />
            <Text style={styles.statText}>{playbackState.totalChunks} chunks</Text>
          </View>
          
          <View style={styles.statItem}>
            <FontAwesome5 name="clock" size={12} color={COLORS.accent} />
            <Text style={styles.statText}>{formatTime(playbackState.totalDuration)}</Text>
          </View>
          
          <View style={styles.statItem}>
            <FontAwesome5 name="shield-alt" size={12} color={COLORS.accent} />
            <Text style={styles.statText}>PDP #{rtaData?.synapse_proof_set_id}</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <Text style={styles.timeText}>
          {formatTime(playbackState.currentTime)} / {formatTime(playbackState.totalDuration)}
        </Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(playbackState.currentTime / playbackState.totalDuration) * 100}%` 
                }
              ]} 
            />
          </View>
          
          {/* Chunk markers */}
          <View style={styles.chunkMarkers}>
            {Array.from({ length: playbackState.totalChunks }, (_, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.chunkMarker,
                  i === playbackState.currentChunkIndex && styles.chunkMarkerActive
                ]}
                onPress={() => seekToChunk(i)}
              >
                <Text style={styles.chunkMarkerText}>{i + 1}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Waveform Visualization */}
      <View style={styles.waveformContainer}>
        <Text style={styles.waveformTitle}>
          CHUNK {playbackState.currentChunkIndex + 1}/{playbackState.totalChunks}
        </Text>
        
        <View style={styles.waveform}>
          {generateChunkWaveform(playbackState.currentChunkIndex).map((height, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height,
                  backgroundColor: playbackState.isPlaying 
                    ? COLORS.secondary 
                    : COLORS.primary + '60',
                  opacity: waveformAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsContainer}>
        {/* Transport Controls */}
        <View style={styles.transportControls}>
          <TouchableOpacity 
            onPress={playPreviousChunk} 
            style={[styles.controlButton, styles.transportButton]}
            disabled={playbackState.currentChunkIndex === 0}
          >
            <FontAwesome5 
              name="step-backward" 
              size={20} 
              color={playbackState.currentChunkIndex === 0 ? COLORS.textTertiary : COLORS.textPrimary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={playbackState.isPlaying ? pauseRTA : playRTA} 
            style={[styles.controlButton, styles.playButton]}
          >
            <FontAwesome5 
              name={playbackState.isPlaying ? "pause" : "play"} 
              size={24} 
              color={COLORS.background} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={stopRTA} 
            style={[styles.controlButton, styles.transportButton]}
          >
            <FontAwesome5 name="stop" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={playNextChunk} 
            style={[styles.controlButton, styles.transportButton]}
            disabled={playbackState.currentChunkIndex === playbackState.totalChunks - 1}
          >
            <FontAwesome5 
              name="step-forward" 
              size={20} 
              color={playbackState.currentChunkIndex === playbackState.totalChunks - 1 ? COLORS.textTertiary : COLORS.textPrimary} 
            />
          </TouchableOpacity>
        </View>

        {/* Volume Control */}
        <View style={styles.volumeContainer}>
          <FontAwesome5 name="volume-down" size={16} color={COLORS.textSecondary} />
          <Slider
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={1}
            value={playbackState.volume}
            onValueChange={(value) => {
              setPlaybackState(prev => ({ ...prev, volume: value }));
              if (playbackState.audioElement) {
                playbackState.audioElement.volume = value;
              }
            }}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.textTertiary}
            thumbStyle={{ backgroundColor: COLORS.secondary }}
          />
          <FontAwesome5 name="volume-up" size={16} color={COLORS.textSecondary} />
        </View>
      </View>

      {/* Chunk Transition Indicator */}
      {chunkTransition && (
        <View style={styles.transitionOverlay}>
          <GlitchContainer intensity="high" style={styles.transitionContainer}>
            <FontAwesome5 name="exchange-alt" size={24} color={COLORS.primary} />
            <Text style={styles.transitionText}>
              CHUNK {chunkTransition.fromChunk + 1} → {chunkTransition.toChunk + 1}
            </Text>
          </GlitchContainer>
        </View>
      )}

      {/* FilCDN Status */}
      <View style={styles.filcdnStatus}>
        <FontAwesome5 name="globe" size={12} color={COLORS.secondary} />
        <Text style={styles.filcdnText}>FILCDN CALIBRATION NETWORK</Text>
        <View style={styles.filcdnIndicator} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.large,
  },
  loadingText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.large,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.small,
    textAlign: 'center',
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    marginTop: 2,
  },
  infoButton: {
    padding: SPACING.small,
  },
  rtaInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.large,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
    zIndex: 2,
  },
  rtaId: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.secondary,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: SPACING.small,
    textAlign: 'center',
  },
  creatorText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: SPACING.medium,
  },
  rtaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: SPACING.large,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressSection: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    zIndex: 2,
  },
  timeText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.medium,
    letterSpacing: 1,
  },
  progressBarContainer: {
    position: 'relative',
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  chunkMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.small,
  },
  chunkMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chunkMarkerActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  chunkMarkerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  waveformContainer: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    zIndex: 2,
  },
  waveformTitle: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: SPACING.medium,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: SPACING.small,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  controlsContainer: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.large,
    zIndex: 2,
  },
  transportControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.large,
  },
  controlButton: {
    padding: SPACING.medium,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
    marginHorizontal: SPACING.small,
  },
  playButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.large,
  },
  transportButton: {
    borderRadius: 4,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeSlider: {
    width: 120,
    height: 40,
    marginHorizontal: SPACING.medium,
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  transitionContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  transitionText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.medium,
    fontWeight: 'bold',
  },
  filcdnStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.medium,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
    zIndex: 2,
  },
  filcdnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  filcdnIndicator: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
    marginLeft: SPACING.small,
  },
});

export default RTAPlayer; 