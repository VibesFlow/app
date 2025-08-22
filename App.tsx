import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import SplashScreen from './components/SplashScreen';
import VibePlayer from './components/VibePlayer';
import UserProfile from './components/UserProfile';
import VibeMarket from './components/VibeMarket';
import Playback from './components/Playback';
import LiveVibes from './components/LiveVibes';
import { COLORS, FONT_SIZES, SPACING } from './theme';
import { WalletProvider, useWallet } from './context/connector';
import { FilCDNProvider } from './context/filcdn';
import { orchestrationIntegration } from './orchestration/coordinator';
import { StatusBar } from 'expo-status-bar';

// Add ethereum error handling for browser compatibility
if (typeof window !== 'undefined') {
  // Catch and ignore ethereum property redefinition errors
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('Cannot redefine property: ethereum')) {
      // Silently ignore ethereum injection conflicts
      return;
    }
    originalError.apply(console, args);
  };
}

type AppScreen = 'splash' | 'main' | 'vibe-player' | 'loading' | 'profile' | 'vibe-market' | 'playback' | 'live-vibes';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [rtaData, setrtaData] = useState<{
    rtaId: string;
    config: any;
  } | null>(null);
  const [participantOptions, setParticipantOptions] = useState<{
    isParticipant?: boolean;
    streamingUrl?: string;
    hlsUrl?: string;
  } | undefined>(undefined);
  const { account } = useWallet();

  // Web URL routing - sync URL with state
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const updateScreenFromURL = () => {
        const path = window.location.pathname;
        if (path === '/market') {
          setCurrentScreen('vibe-market');
        } else if (path === '/live') {
          setCurrentScreen('live-vibes');
        } else if (path.startsWith('/join/')) {
          // Extract RTA ID from URL for group mode
          const rtaId = path.substring(6); // Remove '/join/' prefix
          if (rtaId) {
            // This is a live vibestream that can be joined as participant
            handleLive(rtaId);
          }
        } else if (path === '/profile') {
          setCurrentScreen('profile');
        } else if (path === '/player') {
          setCurrentScreen('vibe-player');
        } else if (path.startsWith('/vibestream/')) {
          setCurrentScreen('playback');
          // Extract RTA ID from URL
          const rtaId = path.substring(12); 
          if (rtaId) {
            setrtaData({ rtaId, config: { mode: 'playback' } });
          }
        } else if (path === '/' || path === '/splash') {
          setCurrentScreen('splash');
        }
      };

      // Update on mount
      updateScreenFromURL();

      // Listen for URL changes
      window.addEventListener('popstate', updateScreenFromURL);
      return () => window.removeEventListener('popstate', updateScreenFromURL);
    }
    return undefined;
  }, []);

  // Update URL when screen changes (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const getUrlForScreen = (screen: AppScreen) => {
        switch (screen) {
          case 'vibe-market': return '/market';
          case 'live-vibes': return '/live';
          case 'profile': return '/profile';
          case 'vibe-player': 
            // If this is group mode, use /join/ route
            return participantOptions?.isParticipant && rtaData ? `/join/${rtaData.rtaId}` : '/player';
          case 'playback': return rtaData ? `/vibestream/${rtaData.rtaId}` : '/market';
          case 'splash': return '/';
          default: return '/';
        }
      };

      const url = getUrlForScreen(currentScreen);
      if (window.location.pathname !== url) {
        window.history.pushState({}, '', url);
      }
    }
  }, [currentScreen, rtaData]);

  // NOTE: Orchestration initialization moved to VibePlayer (creator-only)
  // This prevents unnecessary initialization for participants who only need audio streaming

  const handleStart = () => {
    setCurrentScreen('main');
  };

  const handleLaunchVibePlayer = (rtaId?: string, config?: any) => {
    // Store RTA data for VibePlayer
    if (rtaId) {
      setrtaData({ rtaId, config });
    }
    
    // Show loading screen while music generation model initializes
    setCurrentScreen('loading');
    setTimeout(() => {
      setCurrentScreen('vibe-player');
    }, 2000); // 2 second loading effect
  };

  const handleBackFromVibePlayer = () => {
    // Navigate to user profile after closing vibestream
    setCurrentScreen('profile');
  };

  const handleBackToMain = () => {
    setCurrentScreen('splash');
  };

  const handleOpenProfile = () => {
    setCurrentScreen('profile');
  };

  const handleOpenVibeMarket = () => {
    setCurrentScreen('vibe-market');
  };

  const handleOpenLiveVibes = () => {
    setCurrentScreen('live-vibes');
  };

  const handleJoinVibestream = (vibeId: string, creator: string, options?: {
    isParticipant?: boolean;
    streamingUrl?: string;
    hlsUrl?: string;
  }) => {
    // Join an existing vibestream by connecting to the creator's session
    // vibeId is already in the correct format (e.g., metis_vibe_1755719598360_kjuchm)
    const rtaId = vibeId; 
    const config = {
      creator,
      mode: 'group',
      isParticipant: options?.isParticipant || true,
      originalVibeId: vibeId
    };
    
    // Store participant options for VibePlayer
    setParticipantOptions(options);
    
    console.log(`🎵 Joining vibestream ${rtaId} created by ${creator}`);
    console.log(`👥 Participant mode:`, options?.isParticipant);
    console.log(`🎵 Stream URL:`, options?.streamingUrl);
    
    handleLaunchVibePlayer(rtaId, config);
  };

  // Handle live vibestream URL routing for participants
  const handleLive = async (rtaId: string) => {
    try {
      console.log(`🎵 Joining live vibestream for RTA ID: ${rtaId}`);
      
      // Check if wallet is connected for participant tracking
      if (!account) {
        Alert.alert(
          'Wallet Required',
          'Please connect your wallet to join vibestreams.',
          [
            { text: 'Cancel', onPress: () => setCurrentScreen('live-vibes') },
            { text: 'Connect', onPress: () => setCurrentScreen('splash') }
          ]
        );
        return;
      }

      // Use participant tracking service for proper blockchain-based routing
      const { participantTrackingService } = await import('./services/participant');
      
      const result = await participantTrackingService.handleParticipantRouting(
        rtaId,
        account.accountId
        // Note: signMessage function would be added here when wallet context supports it
      );
      
      if (result.success) {
        console.log(`✅ Successfully joined vibestream ${rtaId}`);
        
        // This is a live vibestream - join as participant
        handleJoinVibestream(rtaId, 'creator', {
          isParticipant: true,
          streamingUrl: result.streamingUrl,
          hlsUrl: result.hlsUrl
        });
        
      } else {
        console.error(`❌ Failed to join vibestream: ${result.error}`);
        
        // Handle different error cases
        if (result.redirectUrl === '/live') {
        Alert.alert(
          'Vibestream Not Active', 
            result.error || 'This vibestream is not currently streaming. The creator may have ended the session.',
          [
            { text: 'View Live Vibes', onPress: () => setCurrentScreen('live-vibes') },
            { text: 'View Playback', onPress: () => {
              setrtaData({ rtaId, config: { mode: 'playback' } });
              setCurrentScreen('playback');
            }}
          ]
        );
        } else {
          Alert.alert(
            'Join Failed',
            result.error || 'Could not join the vibestream. Please try again.',
            [{ text: 'OK', onPress: () => setCurrentScreen('live-vibes') }]
          );
        }
      }
      
    } catch (error) {
      console.error(`❌ Error checking live vibestream:`, error);
      
      // Fallback to live vibes list
      Alert.alert(
        'Connection Error',
        'Could not connect to the vibestream. Please check your connection.',
        [{ text: 'OK', onPress: () => setCurrentScreen('live-vibes') }]
      );
    }
  };

  if (currentScreen === 'splash') {
    return (
      <SplashScreen 
        onStart={handleStart} 
        onLaunchVibePlayer={handleLaunchVibePlayer} 
        onOpenProfile={handleOpenProfile}
        onOpenVibeMarket={handleOpenVibeMarket}
        onOpenLiveVibes={handleOpenLiveVibes}
      />
    );
  }

  if (currentScreen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>INITIALIZING MUSIC GENERATION</Text>
        <Text style={styles.loadingSubtext}>LOADING NEURAL NETWORKS...</Text>
      </View>
    );
  }

  if (currentScreen === 'vibe-player') {
    return (
      <VibePlayer 
        onBack={handleBackFromVibePlayer} 
        rtaID={rtaData?.rtaId}
        config={rtaData?.config}
        participantOptions={participantOptions}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <UserProfile 
        accountId={account?.accountId || 'anonymous.near'}
        onCreateVibestream={handleLaunchVibePlayer}
        onBack={handleBackToMain}
      />
    );
  }

  if (currentScreen === 'vibe-market') {
    return (
      <VibeMarket 
        onBack={handleBackToMain}
        onOpenPlayback={(rtaId) => {
          setrtaData({ rtaId, config: { mode: 'playback' } });
          setCurrentScreen('playback');
        }}
      />
    );
  }

  if (currentScreen === 'live-vibes') {
    return (
      <LiveVibes 
        onBack={handleBackToMain}
        onJoinVibestream={handleJoinVibestream}
      />
    );
  }

  if (currentScreen === 'playback') {
    return (
      <Playback 
        onBack={() => setCurrentScreen('vibe-market')}
        rtaId={rtaData?.rtaId || ''}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>VibesFlow.</Text>
      <Text style={styles.subtitle}>An unstoppable rave party, always in your pocket.</Text>
    </View>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <FilCDNProvider>
        <AppContent />
        <StatusBar style="light" />
      </FilCDNProvider>
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  text: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    letterSpacing: 2,
  },
  loadingSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    letterSpacing: 1,
  },
});