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
  preloadedAudios: HTMLAudioElement[];
  waveformData: number[];
  isPreloading: boolean;
  chunkDurations: number[];
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

  // Initialize unified audio player for an entire vibestream
  const initializeAudioPlayer = useCallback((stream: any): AudioPlayerState => {
    // Use CORS proxy URLs to avoid CORS issues
    const chunkUrls = stream.chunks_detail?.map((chunk: any) => {
      if (chunk.cid) {
        // Use our backend CORS proxy instead of direct FilCDN URL
        return `https://api.vibesflow.ai/api/proxy/${chunk.cid}`;
      }
      return chunk.url || '';
    }) || [];
    
    // Calculate accurate chunk durations (final chunk may be shorter)
    const chunkDurations = stream.chunks_detail?.map((chunk: any, index: number) => {
      // Use chunk's actual duration if available and valid
      if (chunk.duration && typeof chunk.duration === 'number' && chunk.duration > 0) {
        return chunk.duration;
      }
      
      // For final chunks, calculate based on RTA total duration
      if (chunk.chunk_id?.includes('_final')) {
        const totalRtaDuration = parseDuration(stream.rta_duration);
        if (totalRtaDuration > 0) {
          const numChunks = stream.chunks_detail.length;
          const fullChunks = numChunks - 1;
          const finalChunkDuration = totalRtaDuration - (fullChunks * 60);
          return Math.max(1, Math.min(60, finalChunkDuration)); // Clamp between 1-60 seconds
        }
      }
      
      // Default to 60 seconds for regular chunks
      return 60;
    }) || [];
    
    // Validate that all durations are valid numbers
    const validatedDurations = chunkDurations.map(duration => {
      if (isNaN(duration) || duration <= 0) {
        console.warn('Invalid chunk duration detected, using 60s default:', duration);
        return 60;
      }
      return duration;
    });
    
    const totalDuration = validatedDurations.reduce((sum, duration) => sum + duration, 0);
    
    // Generate unified waveform data for the entire RTA
    const waveformData = generateUnifiedWaveform(totalDuration, validatedDurations);

    // Initialize audio based on platform
    let audio: any = null;
    
    if (Platform.OS === 'web') {
      // Web Audio API
      audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = 0.8;

      // Set up event listeners for seamless playback
      audio.addEventListener('ended', () => {
        const currentState = audioStates.get(stream.rta_id);
        if (currentState) {
          playNextChunkSeamlessly(stream.rta_id);
        }
      });

      // Unified time tracking across all chunks
      audio.addEventListener('timeupdate', () => {
        const currentState = audioStates.get(stream.rta_id);
        if (currentState && currentState.isPlaying) {
          // Calculate total time elapsed across all chunks
          let totalElapsed = 0;
          for (let i = 0; i < currentState.currentChunkIndex; i++) {
            totalElapsed += currentState.chunkDurations[i] || 60;
          }
          totalElapsed += audio.currentTime;
          
          setAudioStates(prev => {
            const newMap = new Map(prev);
            const state = newMap.get(stream.rta_id);
            if (state) {
              newMap.set(stream.rta_id, { ...state, currentTime: totalElapsed });
            }
            return newMap;
          });
        }
      });

      // Enhanced error handling with fallbacks
      audio.addEventListener('error', (e) => {
        console.error(`❌ Audio error for ${stream.rta_id}:`, e);
        
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
    } else {
      // Mobile: Use Expo AV Sound API
      console.log('🎧 Initializing mobile audio for:', stream.rta_id);
      audio = {
        // Mobile audio wrapper object
        isMobile: true,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        src: '',
        paused: true,
        ended: false,
        sound: null, // Will store Expo AV Sound instance
        
        // Mobile-compatible methods
        play: async function() {
          if (!this.sound && this.src) {
            try {
              const { Audio } = require('expo-av');
              const { sound } = await Audio.Sound.createAsync(
                { uri: this.src },
                { 
                  shouldPlay: true,
                  isLooping: false,
                  volume: this.volume,
                  rate: 1.0
                }
              );
              this.sound = sound;
              this.paused = false;
              
              // Set up playback status listener for mobile
              sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.isLoaded) {
                  this.currentTime = (status.positionMillis || 0) / 1000;
                  this.duration = (status.durationMillis || 0) / 1000;
                  
                  if (status.didJustFinish) {
                    this.ended = true;
                    this.paused = true;
                    // Trigger next chunk
                    const currentState = audioStates.get(stream.rta_id);
                    if (currentState) {
                      playNextChunkSeamlessly(stream.rta_id);
                    }
                  }
                }
              });
              
              console.log('🎵 Mobile audio playing:', this.src);
            } catch (error) {
              console.error('❌ Mobile audio play error:', error);
              throw error;
            }
          } else if (this.sound) {
            await this.sound.playAsync();
            this.paused = false;
          }
        },
        
        pause: async function() {
          if (this.sound) {
            await this.sound.pauseAsync();
            this.paused = true;
          }
        },
        
        load: function() {
          // Mobile load is handled in play()
          console.log('📱 Mobile audio load triggered for:', this.src);
        },
        
        addEventListener: function(event: string, handler: any) {
          // Store event handlers for mobile
          if (!this.eventHandlers) {
            this.eventHandlers = {};
          }
          if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
          }
          this.eventHandlers[event].push(handler);
        },
        
        removeEventListener: function(event: string, handler: any) {
          // Remove event handlers
          if (this.eventHandlers && this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter((h: any) => h !== handler);
          }
        },
        
        // Cleanup
        unload: async function() {
          if (this.sound) {
            await this.sound.unloadAsync();
            this.sound = null;
          }
        }
      };
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
      preloadedAudios: [],
      waveformData,
      isPreloading: false,
      chunkDurations: validatedDurations
    };
  }, [audioStates]);

  // Seamless transition to next chunk with smart buffering
  const playNextChunkSeamlessly = useCallback((rtaId: string) => {
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

    // Use preloaded audio if available for instant transition
    let nextAudio = state.preloadedAudios[nextIndex];
    
    if (!nextAudio) {
      // Fallback: load next chunk if not preloaded
      console.log(`🔄 Loading chunk ${nextIndex + 1}/${state.chunkUrls.length} for ${rtaId}`);
      nextAudio = new Audio();
      nextAudio.crossOrigin = 'anonymous';
      nextAudio.preload = 'auto';
      nextAudio.volume = 0.8;
      nextAudio.src = state.chunkUrls[nextIndex];
    }
    
    // Apply crossfade for smooth transition
    const currentAudio = state.audio;
    const crossfadeDuration = 200; // 200ms crossfade
    
    // Fade out current audio
    const fadeOut = setInterval(() => {
      if (currentAudio.volume > 0.1) {
        currentAudio.volume = Math.max(0, currentAudio.volume - 0.1);
      } else {
        clearInterval(fadeOut);
        currentAudio.pause();
      }
    }, crossfadeDuration / 10);
    
    // Start next audio with fade in
    nextAudio.volume = 0;
    nextAudio.currentTime = 0;
    
    setAudioStates(prev => {
      const newMap = new Map(prev);
      newMap.set(rtaId, { 
        ...state, 
        currentChunkIndex: nextIndex,
        audio: nextAudio,
        isLoading: false 
      });
      return newMap;
    });

    // Play and fade in
    nextAudio.play().then(() => {
      const fadeIn = setInterval(() => {
        if (nextAudio.volume < 0.7) {
          nextAudio.volume = Math.min(0.8, nextAudio.volume + 0.1);
        } else {
          nextAudio.volume = 0.8;
          clearInterval(fadeIn);
        }
      }, crossfadeDuration / 10);
    }).catch(error => {
      console.error('❌ Failed to play next chunk:', error);
    });

  }, [audioStates]);

  // Preload all chunks for instant access and smooth transitions
  const preloadAllChunks = useCallback(async (rtaId: string) => {
    const state = audioStates.get(rtaId);
    if (!state || state.isPreloading || state.preloadedAudios.length > 0) return;

    console.log(`🔄 Preloading all ${state.chunkUrls.length} chunks for RTA: ${rtaId}`);
    
    setAudioStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(rtaId);
      if (currentState) {
        newMap.set(rtaId, { ...currentState, isPreloading: true });
      }
      return newMap;
    });

    const preloadedAudios: HTMLAudioElement[] = [];
    
    // Preload all chunks in parallel for instant switching
    const preloadPromises = state.chunkUrls.map(async (url, index) => {
      return new Promise<HTMLAudioElement>((resolve, reject) => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';
        audio.volume = 0.8;
        
        audio.addEventListener('canplaythrough', () => {
          console.log(`✅ Chunk ${index + 1}/${state.chunkUrls.length} preloaded for ${rtaId}`);
          resolve(audio);
        }, { once: true });
        
        audio.addEventListener('error', (e) => {
          console.warn(`⚠️ Failed to preload chunk ${index + 1} for ${rtaId}:`, e);
          // Return audio anyway - will try fallback URL when played
          resolve(audio);
        }, { once: true });
        
        audio.src = url;
        audio.load();
      });
    });

    try {
      const loadedAudios = await Promise.all(preloadPromises);
      
      setAudioStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(rtaId);
        if (currentState) {
          newMap.set(rtaId, { 
            ...currentState, 
            preloadedAudios: loadedAudios,
            isPreloading: false 
          });
        }
        return newMap;
      });

      console.log(`🎉 All ${loadedAudios.length} chunks preloaded for ${rtaId}`);
      
    } catch (error) {
      console.error(`❌ Failed to preload chunks for ${rtaId}:`, error);
      setAudioStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(rtaId);
        if (currentState) {
          newMap.set(rtaId, { ...currentState, isPreloading: false });
        }
        return newMap;
      });
    }
  }, [audioStates]);

  // Unified playback with preloading and seamless experience
  const togglePlayback = useCallback(async (stream: any) => {
    console.log('🎵 Toggle unified playback for:', stream.rta_id);

    // Stop any currently playing vibestream
    if (playingRTA && playingRTA !== stream.rta_id) {
      const currentState = audioStates.get(playingRTA);
      if (currentState?.audio) {
        if (Platform.OS === 'web') {
          currentState.audio.pause();
        } else {
          // Mobile pause
          await currentState.audio.pause();
        }
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
      // Initialize unified audio player for this vibestream
      state = initializeAudioPlayer(stream);
      setAudioStates(prev => new Map(prev.set(stream.rta_id, state!)));
    }

    if (!state.audio) {
      Alert.alert('Audio Error', 'Audio system not available');
      return;
    }

    if (state.isPlaying) {
      // Pause
      if (Platform.OS === 'web') {
        state.audio.pause();
      } else {
        await state.audio.pause();
      }
      setAudioStates(prev => {
        const newMap = new Map(prev);
        newMap.set(stream.rta_id, { ...state!, isPlaying: false });
        return newMap;
      });
      setPlayingRTA(null);
    } else {
      // Play - Start preloading ALL chunks immediately
      if (state.chunkUrls.length === 0) {
        Alert.alert('No Audio', 'No chunks available for this vibestream');
        return;
      }

      setPlayingRTA(stream.rta_id);
      
      // Start preloading all chunks in parallel (non-blocking) - only for web
      if (Platform.OS === 'web') {
        preloadAllChunks(stream.rta_id);
      }
      
      if (!state.audio.src) {
        // Load and play first chunk immediately
        console.log(`🚀 Starting unified playback for ${stream.rta_id} (${state.chunkUrls.length} chunks, ${formatTime(state.totalDuration)} total)`);
        
        // Use preloaded audio if available (web only), otherwise use main audio
        const firstAudio = (Platform.OS === 'web' && state.preloadedAudios[0]) ? state.preloadedAudios[0] : state.audio;
        if (firstAudio !== state.audio && Platform.OS === 'web') {
          state.audio = firstAudio;
        } else {
          state.audio.src = state.chunkUrls[0];
        }
        
        setAudioStates(prev => {
          const newMap = new Map(prev);
          newMap.set(stream.rta_id, { 
            ...state!, 
            isLoading: true, 
            currentChunkIndex: 0,
            audio: state!.audio 
          });
          return newMap;
        });

        if (Platform.OS === 'web') {
          // Web audio handling
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
              console.log(`🎶 Unified playback started for ${stream.rta_id}`);
            } catch (error) {
              console.error('❌ Failed to play audio:', error);
              Alert.alert('Playback Error', 'Failed to start audio playback');
            }
          }, { once: true });

          if (firstAudio === state.audio) {
            state.audio.load();
          }
        } else {
          // Mobile audio handling
          try {
            await state.audio.play();
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
            console.log(`🎶 Mobile unified playback started for ${stream.rta_id}`);
          } catch (error) {
            console.error('❌ Failed to play mobile audio:', error);
            Alert.alert('Playback Error', 'Failed to start mobile audio playback');
          }
        }
      } else {
        // Resume playback
        try {
          if (Platform.OS === 'web') {
            await state.audio.play();
          } else {
            await state.audio.play();
          }
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
  }, [playingRTA, audioStates, initializeAudioPlayer, preloadAllChunks]);

  // Unified seek across entire vibestream
  const seekToTime = useCallback((rtaId: string, targetTime: number) => {
    const state = audioStates.get(rtaId);
    if (!state || !state.audio || !state.chunkDurations.length) {
      console.warn('Cannot seek: invalid state', { rtaId, hasState: !!state, hasAudio: !!state?.audio, chunkCount: state?.chunkDurations.length || 0 });
      return;
    }

    // Validate target time
    if (isNaN(targetTime) || targetTime < 0 || targetTime > state.totalDuration) {
      console.warn('Invalid seek time:', { targetTime, totalDuration: state.totalDuration });
      return;
    }

    // Calculate which chunk and position within that chunk
    let remainingTime = targetTime;
    let targetChunkIndex = 0;
    
    for (let i = 0; i < state.chunkDurations.length; i++) {
      if (remainingTime <= state.chunkDurations[i]) {
        targetChunkIndex = i;
        break;
      }
      remainingTime -= state.chunkDurations[i];
    }
    
    const timeInChunk = Math.max(0, remainingTime);
    
    // Validate chunk time
    if (isNaN(timeInChunk) || timeInChunk < 0) {
      console.warn('Invalid chunk time calculated:', { timeInChunk, remainingTime, targetChunkIndex });
      return;
    }
    
    console.log(`⏭️ Seeking to ${formatTime(targetTime)} -> Chunk ${targetChunkIndex + 1} at ${formatTime(timeInChunk)}`);
    
    if (targetChunkIndex !== state.currentChunkIndex) {
      // Switch to different chunk using preloaded audio if available
      const targetAudio = state.preloadedAudios[targetChunkIndex];
      
      if (targetAudio) {
        // Use preloaded audio for instant seeking
        const currentAudio = state.audio;
        currentAudio.pause();
        
        // Validate timeInChunk before setting
        if (!isNaN(timeInChunk) && isFinite(timeInChunk)) {
          targetAudio.currentTime = timeInChunk;
          targetAudio.volume = 0.8;
          
          setAudioStates(prev => {
            const newMap = new Map(prev);
            newMap.set(rtaId, { 
              ...state, 
              currentChunkIndex: targetChunkIndex,
              audio: targetAudio,
              isLoading: false 
            });
            return newMap;
          });

          if (state.isPlaying) {
            targetAudio.play().catch(error => {
              console.error('❌ Failed to play after seek:', error);
            });
          }
        } else {
          console.error('Cannot set invalid currentTime:', timeInChunk);
        }
      } else {
        // Fallback: load chunk if not preloaded
        console.log(`🔄 Loading chunk ${targetChunkIndex + 1} for seek operation`);
        state.audio.pause();
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
          if (!isNaN(timeInChunk) && isFinite(timeInChunk)) {
            state.audio!.currentTime = timeInChunk;
            if (state.isPlaying) {
              state.audio!.play();
            }
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
      // Same chunk, just seek within current audio
      if (!isNaN(timeInChunk) && isFinite(timeInChunk)) {
        state.audio.currentTime = timeInChunk;
      } else {
        console.error('Cannot set invalid currentTime:', timeInChunk);
      }
    }
  }, [audioStates]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse duration from "MM:SS" format to seconds
  const parseDuration = (duration: string): number => {
    if (!duration || typeof duration !== 'string') {
      console.warn('Invalid duration format:', duration);
      return 0;
    }
    
    const parts = duration.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      
      if (isNaN(minutes) || isNaN(seconds)) {
        console.warn('NaN detected in duration parsing:', { duration, minutes, seconds });
        return 0;
      }
      
      return minutes * 60 + seconds;
    }
    
    console.warn('Invalid duration format:', duration);
    return 0;
  };

  // Generate unified waveform for entire RTA
  const generateUnifiedWaveform = (totalDuration: number, chunkDurations: number[]): number[] => {
    const points: number[] = [];
    const segmentsPerSecond = 2; // 2 waveform points per second for smooth visualization
    const totalSegments = Math.max(200, totalDuration * segmentsPerSecond); // Minimum 200 points
    
    for (let i = 0; i < totalSegments; i++) {
      // Create varied waveform that's denser in certain sections (simulate music dynamics)
      const progress = i / totalSegments;
      const baseHeight = 10;
      
      // Add some musical pattern simulation
      const musicalPattern = Math.sin(progress * Math.PI * 8) * 8; // Creates waves
      const randomVariation = (Math.random() - 0.5) * 6;
      const dynamicRange = 5 + Math.sin(progress * Math.PI * 2) * 8; // Simulate volume changes
      
      const height = baseHeight + musicalPattern + randomVariation + dynamicRange;
      points.push(Math.max(3, Math.min(35, height)));
    }
    
    return points;
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
    const waveformData = audioState?.waveformData || generateWaveform(stream.rta_id);
    
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

            {/* Play Button with Preloading Status */}
            <TouchableOpacity 
              style={[styles.playButton, isCurrentlyPlaying && styles.playButtonActive]}
              onPress={() => togglePlayback(stream)}
              disabled={audioState?.isLoading || audioState?.isPreloading}
            >
              {audioState?.isLoading || audioState?.isPreloading ? (
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
            
            {/* Preload Status Indicator */}
            {audioState?.isPreloading && (
              <Text style={styles.preloadingText}>Preloading...</Text>
            )}
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
  preloadingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.secondary,
    letterSpacing: 1,
    marginLeft: SPACING.small,
    textTransform: 'uppercase',
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