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
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useFilCDN } from '../context/filcdn';
import { VibestreamRepair } from '../services/VibestreamRepair';

const { width, height } = Dimensions.get('window');

interface PlaybackProps {
  onBack: () => void;
  rtaId: string;
}

interface ContinuousPlayer {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  currentTime: number;
  totalDuration: number;
  chunkQueue: Array<{
    url: string;
    filcdn_url?: string;
    duration: number;
    cid: string;
  }>;
  bufferedChunks: Map<number, HTMLAudioElement>;
  mainAudio: HTMLAudioElement | null;
  networkQuality: 'excellent' | 'good' | 'poor';
  bufferHealth: number;
  isBuffering: boolean;
}

const Playback: React.FC<PlaybackProps> = ({ onBack, rtaId }) => {
  const { getVibestreamByRTA, constructFilCDNUrl } = useFilCDN();
  const [vibestream, setVibestream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<ContinuousPlayer>({
    isPlaying: false,
    isPaused: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    currentTime: 0,
    totalDuration: 0,
    chunkQueue: [],
    bufferedChunks: new Map(),
    mainAudio: null,
    networkQuality: 'excellent',
    bufferHealth: 0,
    isBuffering: false,
  });

  const playerRef = useRef<ContinuousPlayer>(player);
  const bufferIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformAnimation = useRef(new Animated.Value(0));
  const vibeRepair = useRef<VibestreamRepair>(new VibestreamRepair());

  // Update player ref on state changes
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

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
        
        // Build continuous chunk queue using actual backend-calculated durations
        const chunkQueue = streamData.chunks_detail?.map((chunk: any) => {
          // Use the accurate duration calculated by the backend persistence layer
          const actualDuration = chunk.duration || 60; // Backend already calculates proper durations
          
          return {
            url: chunk.url,
            filcdn_url: chunk.filcdn_url,
            duration: actualDuration,
            cid: chunk.cid,
            chunk_id: chunk.chunk_id,
            sequence: chunk.sequence || 0,
          };
        }) || [];
        
        const totalDuration = chunkQueue.reduce((sum, chunk) => sum + chunk.duration, 0);

        setPlayer(prev => ({
          ...prev,
          totalChunks: chunkQueue.length,
          totalDuration,
          chunkQueue,
        }));

        setLoading(false);
        
        // Initialize smart buffering session
        vibeRepair.current.startSession(rtaId);
        
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

  // Smart buffering system with FilCDN optimization and Filecoin reliability awareness
  const startSmartBuffering = useCallback(() => {
    if (bufferIntervalRef.current || player.chunkQueue.length === 0) return;

    console.log('🎵 Starting smart continuous buffering system');
    
    bufferIntervalRef.current = setInterval(async () => {
      const currentPlayer = playerRef.current;
      
      // Execute AI-generated buffering code in real-time
      const executionResult = await vibeRepair.current.executeOptimalBuffering(
        currentPlayer.currentChunkIndex,
        currentPlayer.totalChunks,
        currentPlayer.bufferedChunks,
        bufferChunk,
        currentPlayer.chunkQueue
      );
      
      console.log('🧠 AI-generated buffering code executed:', executionResult.generatedCode);
      console.log('⚡ Executed actions:', executionResult.executedActions);
      console.log('📊 Optimized strategy:', executionResult.strategy);
      
      // Assess network quality based on AI execution results and Filecoin CDN performance
      let networkQuality: 'excellent' | 'good' | 'poor' = 'excellent';
      const bufferSize = currentPlayer.bufferedChunks.size;
      const targetBufferSize = executionResult.strategy.bufferAheadCount;
      
      // Quality based on buffer success rate and CDN responsiveness
      if (bufferSize >= targetBufferSize) {
        networkQuality = 'excellent'; // FilCDN working optimally
      } else if (bufferSize >= Math.floor(targetBufferSize * 0.66)) {
        networkQuality = 'good'; // Minor buffering delays
      } else {
        networkQuality = 'poor'; // Only if serious CDN issues
      }

      // The AI has already executed the optimal buffering strategy
      // Calculate buffer health based on AI execution results
      let bufferedCount = 0;
      const bufferAheadCount = executionResult.strategy.bufferAheadCount;
      for (let i = 1; i <= bufferAheadCount; i++) {
        const targetIndex = currentPlayer.currentChunkIndex + i;
        if (targetIndex >= currentPlayer.chunkQueue.length) break;
        if (currentPlayer.bufferedChunks.has(targetIndex)) bufferedCount++;
      }
      const bufferHealth = bufferedCount / Math.min(bufferAheadCount, currentPlayer.chunkQueue.length - currentPlayer.currentChunkIndex - 1);

      setPlayer(prev => ({
        ...prev,
        bufferHealth: Math.max(0, bufferHealth),
        networkQuality
      }));

    }, 2000); // Check every 2 seconds for AI execution
  }, [player]);

  // Buffer individual chunk with FilCDN fallback
  const bufferChunk = useCallback(async (chunkIndex: number) => {
    const currentPlayer = playerRef.current;
    
    if (chunkIndex >= currentPlayer.chunkQueue.length) return;
    if (currentPlayer.bufferedChunks.has(chunkIndex)) return;

    const chunkData = currentPlayer.chunkQueue[chunkIndex];

    try {
      console.log(`🔄 Buffering chunk ${chunkIndex + 1}/${currentPlayer.totalChunks}`);
      
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = 0; // Silent during buffering

      // Try FilCDN first, fallback to proxy
      let audioUrl = chunkData.filcdn_url || chunkData.url;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Buffer timeout'));
        }, 10000);

        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          
          setPlayer(prev => {
            const newBufferedChunks = new Map(prev.bufferedChunks);
            newBufferedChunks.set(chunkIndex, audio);
            return {
              ...prev,
              bufferedChunks: newBufferedChunks
            };
          });
          
          // Record successful chunk access with smart buffering
          vibeRepair.current.recordChunkAccess(chunkIndex, true);
          
          console.log(`✅ Chunk ${chunkIndex + 1} buffered successfully`);
          resolve();
        }, { once: true });

        audio.addEventListener('error', () => {
          clearTimeout(timeout);
          
          // Record failed chunk access
          vibeRepair.current.recordChunkAccess(chunkIndex, false);
          
          // Try fallback URL if FilCDN failed
          if (audioUrl === chunkData.filcdn_url && chunkData.url !== chunkData.filcdn_url) {
            console.warn(`⚠️ FilCDN failed for chunk ${chunkIndex + 1}, trying proxy`);
            
            // Record repair attempt
            vibeRepair.current.recordRepairAttempt(chunkIndex, 1, false);
            
            audio.src = chunkData.url;
            audio.load();
          } else {
            reject(new Error(`Chunk ${chunkIndex + 1} failed to load`));
          }
        }, { once: true });

        audio.src = audioUrl;
        audio.load();
      });

    } catch (error) {
      console.warn(`⚠️ Chunk ${chunkIndex + 1} buffering failed:`, error);
    }
  }, []);

  // Seamless continuous playback
  const togglePlayback = useCallback(async () => {
    if (player.isPlaying) {
      // Pause
      if (player.mainAudio) {
        player.mainAudio.pause();
      }
      setPlayer(prev => ({ ...prev, isPlaying: false, isPaused: true }));
      
      // Stop buffering
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
        bufferIntervalRef.current = null;
      }
    } else {
      // Play
      if (player.chunkQueue.length === 0) {
        Alert.alert('No Audio', 'No chunks available for this vibestream');
        return;
      }

      setPlayer(prev => ({ ...prev, isPlaying: true, isPaused: false }));
      
      // Start smart buffering
      startSmartBuffering();
      
      // Start continuous playback
      playFromChunk(player.currentChunkIndex);
    }
  }, [player, startSmartBuffering]);

  // Play from specific chunk with seamless transitions
  const playFromChunk = useCallback((chunkIndex: number) => {
    const currentPlayer = playerRef.current;
    
    if (chunkIndex >= currentPlayer.chunkQueue.length) return;

    const chunkData = currentPlayer.chunkQueue[chunkIndex];

    // Use buffered audio if available, otherwise create new one
    let audio = currentPlayer.bufferedChunks.get(chunkIndex);
    
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      
      // Try FilCDN first, fallback to proxy
      let audioUrl = chunkData.filcdn_url || chunkData.url;
      audio.src = audioUrl;
    }

    audio.volume = 0.8;
    
    // Set up seamless transition to next chunk
    const handleEnded = () => {
      const nextIndex = chunkIndex + 1;
      if (nextIndex < currentPlayer.chunkQueue.length && currentPlayer.isPlaying) {
        console.log(`🎵 Seamless transition: chunk ${chunkIndex + 1} → ${nextIndex + 1}`);
        setPlayer(prev => ({ ...prev, currentChunkIndex: nextIndex }));
        playFromChunk(nextIndex);
      } else {
        // End of vibestream
        console.log('🏁 Vibestream playback completed');
        setPlayer(prev => ({ ...prev, isPlaying: false, isPaused: false }));
        if (bufferIntervalRef.current) {
          clearInterval(bufferIntervalRef.current);
          bufferIntervalRef.current = null;
        }
      }
    };

    // Remove any existing event listeners
    audio.removeEventListener('ended', handleEnded);
    audio.addEventListener('ended', handleEnded, { once: true });

    // Update progress tracking using accurate chunk durations
    const handleTimeUpdate = () => {
      if (currentPlayer.isPlaying) {
        // Calculate total elapsed time across all chunks using actual durations
        let totalElapsed = 0;
        for (let i = 0; i < chunkIndex; i++) {
          const actualDuration = currentPlayer.chunkQueue[i]?.duration || 60;
          totalElapsed += actualDuration;
        }
        totalElapsed += audio!.currentTime;

        setPlayer(prev => ({ ...prev, currentTime: totalElapsed }));
      }
    };

    audio.removeEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    setPlayer(prev => ({ ...prev, mainAudio: audio, currentChunkIndex: chunkIndex }));
    
    audio.play().catch(error => {
      console.error('❌ Failed to play chunk:', error);
      // Try next chunk on failure
      if (chunkIndex + 1 < currentPlayer.chunkQueue.length) {
        playFromChunk(chunkIndex + 1);
      }
    });
  }, []);

  // Seek through the continuous vibestream using accurate chunk durations
  const seekToTime = useCallback((targetTime: number) => {
    // Record seeking behavior for AI learning
    vibeRepair.current.recordSeeking();
    
    let remainingTime = targetTime;
    let targetChunkIndex = 0;
    
    // Find which chunk contains the target time using actual durations from backend
    for (let i = 0; i < player.chunkQueue.length; i++) {
      const chunkDuration = player.chunkQueue[i]?.duration || 60;
      if (remainingTime <= chunkDuration) {
        targetChunkIndex = i;
        break;
      }
      remainingTime -= chunkDuration;
    }
    
    const timeInChunk = Math.max(0, remainingTime);
    
    console.log(`⏭️ Seeking to ${formatTime(targetTime)} → Chunk ${targetChunkIndex + 1} at ${formatTime(timeInChunk)}`);
    console.log(`📊 Using actual chunk duration: ${player.chunkQueue[targetChunkIndex]?.duration}s`);
    
    // Pause current audio
    if (player.mainAudio) {
      player.mainAudio.pause();
    }
    
    // Update chunk index
    setPlayer(prev => ({ ...prev, currentChunkIndex: targetChunkIndex }));
    
    if (player.isPlaying) {
      setTimeout(() => {
        playFromChunk(targetChunkIndex);
        // Set time within chunk after a brief delay
        setTimeout(() => {
          if (playerRef.current.mainAudio && !isNaN(timeInChunk)) {
            playerRef.current.mainAudio.currentTime = timeInChunk;
          }
        }, 100);
      }, 50);
    }
  }, [player, playFromChunk]);

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
    if (player.isPlaying) {
      const animate = () => {
        Animated.timing(waveformAnimation.current, {
          toValue: Math.random(),
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          if (playerRef.current.isPlaying) {
            animate();
          }
        });
      };
      animate();
    }
  }, [player.isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bufferIntervalRef.current) {
        clearInterval(bufferIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (player.mainAudio) {
        player.mainAudio.pause();
      }
      // Cleanup buffered chunks
      player.bufferedChunks.forEach(audio => {
        audio.pause();
      });
      
      // End smart buffering session and save learned patterns
      vibeRepair.current.endSession();
    };
  }, []);

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
                  player.networkQuality === 'excellent'
                    ? COLORS.secondary
                    : player.networkQuality === 'good'
                    ? COLORS.accent
                    : COLORS.error,
              },
            ]}
          />
          <Text style={styles.networkText}>{player.networkQuality.toUpperCase()}</Text>
        </View>
      </View>

      {/* Vibestream Info */}
      <View style={styles.vibestreamInfo}>
        <View style={styles.creatorSection}>
          <View style={styles.profileImageContainer}>
            {vibestream.user_profile_image ? (
              <AuthenticatedImage 
                ipfsHash={vibestream.user_profile_image}
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
          </View>
          
          <View style={styles.creatorInfo}>
            <GlitchText text={vibestream.rta_id.toUpperCase()} style={styles.rtaId} />
            <Text style={styles.creatorName}>{vibestream.creator}</Text>
            <Text style={styles.vibestreamMeta}>
              {vibestream.chunks} CHUNKS • {vibestream.rta_duration} • CONTINUOUS
            </Text>
          </View>
        </View>
      </View>

      {/* Continuous Playback Controls */}
      <View style={styles.playerSection}>
        <TouchableOpacity 
          style={[styles.playButton, player.isPlaying && styles.playButtonActive]}
          onPress={togglePlayback}
        >
          <FontAwesome5 
            name={player.isPlaying ? "pause" : "play"} 
            size={24} 
            color={COLORS.background} 
            style={!player.isPlaying ? { marginLeft: 2 } : {}}
          />
        </TouchableOpacity>

        <View style={styles.playbackInfo}>
          <Text style={styles.playbackText}>
            CHUNK {player.currentChunkIndex + 1}/{player.totalChunks}
          </Text>
          <View style={styles.bufferHealth}>
            <Text style={styles.bufferText}>
              BUFFER: {Math.round(player.bufferHealth * 100)}%
            </Text>
            <View style={styles.bufferBar}>
              <View 
                style={[
                  styles.bufferFill, 
                  { width: `${player.bufferHealth * 100}%` }
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
            if (player.totalDuration > 0) {
              const { locationX } = e.nativeEvent;
              const progress = locationX / (width - SPACING.medium * 2);
              const targetTime = progress * player.totalDuration;
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
                width: player.totalDuration > 0 
                  ? `${Math.min(100, (player.currentTime / player.totalDuration) * 100)}%` 
                  : '0%'
              }
            ]} 
          />
          
          {/* Progress Thumb */}
          <View 
            style={[
              styles.progressThumb,
              {
                left: player.totalDuration > 0 
                  ? `${Math.min(95, (player.currentTime / player.totalDuration) * 100)}%`
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
                  backgroundColor: player.isPlaying 
                    ? COLORS.secondary 
                    : COLORS.primary + '60',
                  opacity: player.isPlaying ? 1 : 0.6,
                },
              ]}
            />
          ))}
        </View>

        {/* Time Display */}
        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{formatTime(player.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(player.totalDuration)}</Text>
        </View>
      </View>

      {/* Playback Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>BUFFERED</Text>
          <Text style={styles.statValue}>{player.bufferedChunks.size}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>QUALITY</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  player.networkQuality === 'excellent'
                    ? COLORS.secondary
                    : player.networkQuality === 'good'
                    ? COLORS.accent
                    : COLORS.error,
              },
            ]}
          >
            {player.networkQuality.toUpperCase()}
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