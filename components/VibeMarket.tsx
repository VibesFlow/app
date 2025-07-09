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
  isPreloaded: boolean;
  preloadedChunks: Map<number, HTMLAudioElement>;
  waveformData: number[];
  chunkTimeMap: Array<{startTime: number, endTime: number, duration: number, chunkIndex: number}>;
  isFullyLoaded: boolean;
  loadingProgress: number;
  currentBuffer: HTMLAudioElement | null;
  nextBuffer: HTMLAudioElement | null;
  isTransitioning: boolean;
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

  // Initialize audio player with complete time mapping
  const initializeAudioPlayer = useCallback((stream: any): AudioPlayerState => {
    const chunkUrls = stream.chunks_detail?.map((chunk: any) => chunk.url) || [];
    
    // Create precise time mapping for each chunk
    const chunkTimeMap: Array<{startTime: number, endTime: number, duration: number, chunkIndex: number}> = [];
    let cumulativeTime = 0;
    
    stream.chunks_detail?.forEach((chunk: any, index: number) => {
      const chunkDuration = chunk.duration || 60; // Most chunks are 60s, final might be shorter
      chunkTimeMap.push({
        startTime: cumulativeTime,
        endTime: cumulativeTime + chunkDuration,
        duration: chunkDuration,
        chunkIndex: index
      });
      cumulativeTime += chunkDuration;
    });

    // Total duration from precise mapping
    const totalDuration = cumulativeTime;

    // Generate high-resolution waveform for entire vibestream
    const waveformData = generateVibestreamWaveform(stream);

    const audio = Platform.OS === 'web' ? new Audio() : null;
    
    if (audio) {
      audio.crossOrigin = 'anonymous';
      audio.preload = 'none';
      audio.volume = 0.8;
    }

    return {
      isPlaying: false,
      currentTime: 0,
      totalDuration,
      currentChunkIndex: 0,
      isLoading: false,
      audio,
      chunkUrls,
      error: null,
      isPreloaded: false,
      preloadedChunks: new Map(),
      waveformData,
      chunkTimeMap,
      isFullyLoaded: false,
      loadingProgress: 0,
      currentBuffer: null,
      nextBuffer: null,
      isTransitioning: false
    };
  }, []);

  // AGGRESSIVE: Pre-load ALL chunks instantly for complete access
  const preloadEntireVibestream = useCallback(async (stream: any, audioState: AudioPlayerState) => {
    if (audioState.isPreloaded || !audioState.chunkUrls.length) return audioState;

    console.log(`🚀 AGGRESSIVE PRE-LOADING: Loading ALL ${audioState.chunkUrls.length} chunks for ${stream.rta_id}`);
    console.time(`⏱️ Full preload time for ${stream.rta_id}`);
    
    try {
      const preloadedChunks = new Map<number, HTMLAudioElement>();
      const totalChunks = audioState.chunkUrls.length;
      
      // Create loading promises for ALL chunks simultaneously
      const loadPromises = audioState.chunkUrls.map(async (url, index) => {
        return new Promise<{index: number, audio: HTMLAudioElement}>((resolve, reject) => {
          const audio = new Audio();
          audio.crossOrigin = 'anonymous';
          audio.preload = 'auto';
          
          let resolved = false;
          
          const onCanPlay = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              
              // Update loading progress
              const progress = ((index + 1) / totalChunks) * 100;
              console.log(`✅ Chunk ${index + 1}/${totalChunks} loaded (${progress.toFixed(1)}%)`);
              
              resolve({ index, audio });
            }
          };
          
          const onError = (error: any) => {
            if (!resolved) {
              resolved = true;
              cleanup();
              console.error(`❌ Failed to load chunk ${index}:`, error);
              reject(new Error(`Chunk ${index} failed to load`));
            }
          };
          
          const cleanup = () => {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
          };
          
          audio.addEventListener('canplaythrough', onCanPlay, { once: true });
          audio.addEventListener('error', onError, { once: true });
          
          // Start loading
          audio.src = url;
          audio.load();
          
          // Timeout fallback (30 seconds per chunk)
          setTimeout(() => {
            if (!resolved && audio.readyState >= 3) {
              onCanPlay();
            }
          }, 30000);
        });
      });
      
      // Load all chunks with progress tracking
      let loadedCount = 0;
      const results = await Promise.allSettled(loadPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          preloadedChunks.set(result.value.index, result.value.audio);
          loadedCount++;
        } else {
          console.error(`❌ Chunk ${index} failed:`, result.reason);
        }
        
        // Update progress in real-time
        const progress = ((index + 1) / totalChunks) * 100;
        setAudioStates(prev => {
          const newMap = new Map(prev);
          const currentState = newMap.get(stream.rta_id);
          if (currentState) {
            newMap.set(stream.rta_id, { ...currentState, loadingProgress: progress });
          }
          return newMap;
        });
      });
      
      console.timeEnd(`⏱️ Full preload time for ${stream.rta_id}`);
      console.log(`🎉 COMPLETE: ${loadedCount}/${totalChunks} chunks loaded for ${stream.rta_id}`);
      
      // Set up first buffer
      const firstAudio = preloadedChunks.get(0);
      const secondAudio = preloadedChunks.get(1);
      
      return {
        ...audioState,
        isPreloaded: true,
        isFullyLoaded: loadedCount === totalChunks,
        loadingProgress: 100,
        preloadedChunks,
        currentBuffer: firstAudio || null,
        nextBuffer: secondAudio || null
      };
      
    } catch (error) {
      console.error(`❌ Aggressive pre-loading failed for ${stream.rta_id}:`, error);
      return { ...audioState, isPreloaded: true, error: 'Pre-loading failed' };
    }
  }, []);

  // Generate vibestream-specific waveform based on chunk characteristics
  const generateVibestreamWaveform = useCallback((stream: any): number[] => {
    const points: number[] = [];
    const segments = 120; // More segments for longer tracks
    const chunks = stream.chunks_detail || [];
    
    // Create waveform that represents the entire vibestream
    for (let i = 0; i < segments; i++) {
      // Map segment to chunk position
      const chunkPosition = (i / segments) * chunks.length;
      const chunkIndex = Math.floor(chunkPosition);
      const chunk = chunks[chunkIndex];
      
      // Vary height based on chunk characteristics
      let baseHeight = 15;
      if (chunk) {
        // Use file size and position to create realistic variations
        const sizeVariation = (chunk.size || 500000) / 1000000 * 10; // Size influence
        const positionVariation = Math.sin((chunkPosition * 0.3) + (chunk.sequence || 0)) * 8;
        baseHeight += sizeVariation + positionVariation;
      }
      
      // Add some randomness for musical feel
      const musicVariation = Math.sin(i * 0.2) * 5 + Math.random() * 8;
      const height = Math.max(5, Math.min(35, baseHeight + musicVariation));
      
      points.push(height);
    }
    
    return points;
  }, []);

  // Smart time calculation: Convert global time to chunk and local time
  const getChunkAndTimeFromGlobalTime = useCallback((globalTime: number, chunkTimeMap: any[]) => {
    for (let i = 0; i < chunkTimeMap.length; i++) {
      const chunk = chunkTimeMap[i];
      if (globalTime >= chunk.startTime && globalTime < chunk.endTime) {
        return {
          chunkIndex: i,
          localTime: globalTime - chunk.startTime,
          chunkDuration: chunk.duration
        };
      }
    }
    
    // If beyond the end, return last chunk
    const lastChunk = chunkTimeMap[chunkTimeMap.length - 1];
    return {
      chunkIndex: chunkTimeMap.length - 1,
      localTime: lastChunk.duration - 0.1, // Near the end
      chunkDuration: lastChunk.duration
    };
  }, []);

  // Instant seeking across entire vibestream
  const seekToGlobalTime = useCallback(async (rtaId: string, globalTime: number) => {
    const state = audioStates.get(rtaId);
    if (!state || !state.isFullyLoaded) {
      console.warn('⚠️ Cannot seek: vibestream not fully loaded yet');
      return;
    }

    const { chunkIndex, localTime } = getChunkAndTimeFromGlobalTime(globalTime, state.chunkTimeMap);
    
    console.log(`⚡ INSTANT SEEK: ${globalTime}s → Chunk ${chunkIndex} at ${localTime.toFixed(1)}s`);
    
    const targetAudio = state.preloadedChunks.get(chunkIndex);
    if (!targetAudio) {
      console.error(`❌ Chunk ${chunkIndex} not available`);
      return;
    }

    // Pause current audio
    if (state.currentBuffer) {
      state.currentBuffer.pause();
    }

    // Switch to target chunk instantly
    targetAudio.currentTime = localTime;
    
    // Prepare next buffer for smooth transitions
    const nextChunkAudio = state.preloadedChunks.get(chunkIndex + 1);
    
    setAudioStates(prev => {
      const newMap = new Map(prev);
      newMap.set(rtaId, {
        ...state,
        currentChunkIndex: chunkIndex,
        currentTime: globalTime,
        currentBuffer: targetAudio,
        nextBuffer: nextChunkAudio || null,
        isTransitioning: false
      });
      return newMap;
    });

    // Resume playback if it was playing
    if (state.isPlaying) {
      try {
        await targetAudio.play();
      } catch (error) {
        console.error('❌ Failed to resume after seek:', error);
      }
    }
  }, [audioStates, getChunkAndTimeFromGlobalTime]);

  // Smart transition with cross-fade buffering
  const transitionToNextChunk = useCallback(async (rtaId: string) => {
    const state = audioStates.get(rtaId);
    if (!state || !state.currentBuffer) return;

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

    const nextAudio = state.preloadedChunks.get(nextIndex);
    if (!nextAudio) {
      console.error(`❌ Next chunk ${nextIndex} not available`);
      return;
    }

    console.log(`🔄 SMART TRANSITION: Chunk ${state.currentChunkIndex} → ${nextIndex}`);

    // Set up transition state
    setAudioStates(prev => {
      const newMap = new Map(prev);
      newMap.set(rtaId, {
        ...state,
        isTransitioning: true
      });
      return newMap;
    });

    try {
      // Cross-fade transition for smooth playback
      const currentAudio = state.currentBuffer;
      const fadeOutDuration = 100; // 100ms cross-fade
      
      // Start fading out current audio
      const originalVolume = currentAudio.volume;
      let fadeOutStep = 0;
      const fadeOutInterval = setInterval(() => {
        fadeOutStep += 10;
        const newVolume = originalVolume * (1 - fadeOutStep / fadeOutDuration);
        currentAudio.volume = Math.max(0, newVolume);
        
        if (fadeOutStep >= fadeOutDuration) {
          clearInterval(fadeOutInterval);
          currentAudio.pause();
          currentAudio.volume = originalVolume; // Reset for future use
        }
      }, 10);

      // Start next audio with fade-in
      nextAudio.currentTime = 0;
      nextAudio.volume = 0;
      await nextAudio.play();
      
      let fadeInStep = 0;
      const fadeInInterval = setInterval(() => {
        fadeInStep += 10;
        const newVolume = originalVolume * (fadeInStep / fadeOutDuration);
        nextAudio.volume = Math.min(originalVolume, newVolume);
        
        if (fadeInStep >= fadeOutDuration) {
          clearInterval(fadeInInterval);
        }
      }, 10);

      // Update state to new chunk
      const nextNextAudio = state.preloadedChunks.get(nextIndex + 1);
      
      setAudioStates(prev => {
        const newMap = new Map(prev);
        newMap.set(rtaId, {
          ...state,
          currentChunkIndex: nextIndex,
          currentBuffer: nextAudio,
          nextBuffer: nextNextAudio || null,
          isTransitioning: false
        });
        return newMap;
      });

    } catch (error) {
      console.error(`❌ Transition failed for chunk ${nextIndex}:`, error);
      
      setAudioStates(prev => {
        const newMap = new Map(prev);
        newMap.set(rtaId, {
          ...state,
          isTransitioning: false
        });
        return newMap;
      });
    }
  }, [audioStates]);

  // Real-time time tracking across chunks
  const startTimeTracking = useCallback((rtaId: string) => {
    const interval = setInterval(() => {
      const state = audioStates.get(rtaId);
      if (!state || !state.isPlaying || !state.currentBuffer) {
        clearInterval(interval);
        return;
      }

      const chunkInfo = state.chunkTimeMap[state.currentChunkIndex];
      if (!chunkInfo) return;

      const globalTime = chunkInfo.startTime + state.currentBuffer.currentTime;
      
      // Check if we need to transition
      if (state.currentBuffer.currentTime >= chunkInfo.duration - 0.1 && !state.isTransitioning) {
        transitionToNextChunk(rtaId);
      }

      // Update global time
      setAudioStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(rtaId);
        if (currentState) {
          newMap.set(rtaId, { ...currentState, currentTime: globalTime });
        }
        return newMap;
      });
    }, 100); // 10fps for smooth updates

    return interval;
  }, [audioStates, transitionToNextChunk]);

  // Enhanced toggle playback with aggressive pre-loading
  const togglePlayback = useCallback(async (stream: any) => {
    console.log('🎵 Toggle playback for:', stream.rta_id);

    // Stop any currently playing vibestream
    if (playingRTA && playingRTA !== stream.rta_id) {
      const currentState = audioStates.get(playingRTA);
      if (currentState?.currentBuffer) {
        currentState.currentBuffer.pause();
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

    if (state.isPlaying) {
      // Pause
      if (state.currentBuffer) {
        state.currentBuffer.pause();
      }
      setAudioStates(prev => {
        const newMap = new Map(prev);
        newMap.set(stream.rta_id, { ...state!, isPlaying: false });
        return newMap;
      });
      setPlayingRTA(null);
    } else {
      // Play - Aggressively pre-load everything first
      if (state.chunkUrls.length === 0) {
        Alert.alert('No Audio', 'No chunks available for this vibestream');
        return;
      }

      setPlayingRTA(stream.rta_id);
      
      if (!state.isFullyLoaded) {
        console.log(`🚀 LOADING ENTIRE VIBESTREAM: ${stream.rta_id} (${state.chunkUrls.length} chunks)`);
        
        setAudioStates(prev => {
          const newMap = new Map(prev);
          newMap.set(stream.rta_id, { ...state!, isLoading: true });
          return newMap;
        });

        // Aggressively pre-load ALL chunks
        const fullyLoadedState = await preloadEntireVibestream(stream, state);
        setAudioStates(prev => new Map(prev.set(stream.rta_id, fullyLoadedState)));
        
        if (fullyLoadedState.currentBuffer && fullyLoadedState.isFullyLoaded) {
          console.log(`⚡ INSTANT PLAYBACK READY: ${stream.rta_id}`);
          
          setAudioStates(prev => {
            const newMap = new Map(prev);
            newMap.set(stream.rta_id, { 
              ...fullyLoadedState, 
              isPlaying: true, 
              isLoading: false 
            });
            return newMap;
          });
          
          await fullyLoadedState.currentBuffer.play();
          startTimeTracking(stream.rta_id);
          
        } else {
          console.error('❌ Failed to fully load vibestream');
          Alert.alert('Loading Error', 'Failed to load vibestream for instant access');
        }
      } else {
        // Resume playback
        if (state.currentBuffer) {
          setAudioStates(prev => {
            const newMap = new Map(prev);
            newMap.set(stream.rta_id, { ...state, isPlaying: true });
            return newMap;
          });
          
          await state.currentBuffer.play();
          startTimeTracking(stream.rta_id);
        }
      }
    }
  }, [playingRTA, audioStates, initializeAudioPlayer, preloadEntireVibestream, startTimeTracking]);

  // Enhanced seeking with instant access
  const seekToTime = useCallback((rtaId: string, targetTime: number) => {
    const state = audioStates.get(rtaId);
    if (!state) return;

    if (!state.isFullyLoaded) {
      console.warn('⚠️ Seeking not available: vibestream still loading');
      return;
    }

    seekToGlobalTime(rtaId, targetTime);
  }, [audioStates, seekToGlobalTime]);

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

          {/* Inline Waveform Progress Bar - INSTANT SEEK */}
          <View style={styles.waveformSection}>
            {/* Loading Progress Indicator */}
            {audioState && !audioState.isFullyLoaded && (
              <View style={styles.loadingIndicator}>
                <Text style={styles.loadingText}>
                  Loading for instant access... {audioState.loadingProgress.toFixed(0)}%
                </Text>
                <View style={styles.loadingBar}>
                  <View 
                    style={[
                      styles.loadingBarFill, 
                      { width: `${audioState.loadingProgress}%` }
                    ]} 
                  />
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={[
                styles.progressContainer,
                (!audioState?.isFullyLoaded) && styles.progressContainerDisabled
              ]}
              onPress={(e) => {
                if (audioState?.totalDuration && audioState.totalDuration > 0 && audioState.isFullyLoaded) {
                  const { locationX } = e.nativeEvent;
                  const progress = locationX / (width - SPACING.medium * 4);
                  const targetTime = progress * audioState.totalDuration;
                  seekToTime(stream.rta_id, targetTime);
                }
              }}
              activeOpacity={audioState?.isFullyLoaded ? 0.8 : 1}
              disabled={!audioState?.isFullyLoaded}
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

            {/* High-Resolution Waveform for entire vibestream */}
            <View style={styles.waveform}>
              {(audioState?.waveformData || generateVibestreamWaveform(stream)).map((height, i) => {
                const progressPercent = audioState?.totalDuration && audioState.totalDuration > 0
                  ? (audioState.currentTime / audioState.totalDuration) * 100 
                  : 0;
                const segmentProgress = (i / (audioState?.waveformData?.length || 120)) * 100;
                const isPlayed = segmentProgress <= progressPercent;
                
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveformBar,
                      {
                        height,
                        backgroundColor: isCurrentlyPlaying 
                          ? (isPlayed ? COLORS.secondary : COLORS.primary + '60')
                          : COLORS.primary + '60',
                        opacity: isCurrentlyPlaying ? (isPlayed ? 1 : 0.6) : 0.6,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Precise Time Display */}
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>
                {formatTime(audioState?.currentTime || 0)}
              </Text>
              <Text style={styles.timeText}>
                {stream.rta_duration || formatTime(audioState?.totalDuration || 0)}
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
  loadingIndicator: {
    alignItems: 'center',
    marginBottom: SPACING.small,
  },
  loadingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  loadingBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 3,
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
  },
  progressContainerDisabled: {
    opacity: 0.5,
  },
});

export default VibeMarket; 