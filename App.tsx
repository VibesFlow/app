import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import SplashScreen from './components/SplashScreen';
import VibePlayer from './components/VibePlayer';
import UserProfile from './components/UserProfile';
import VibeMarket from './components/VibeMarket';
import Playback from './components/Playback';
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

type AppScreen = 'splash' | 'main' | 'vibe-player' | 'loading' | 'profile' | 'vibe-market' | 'playback';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [rtaData, setrtaData] = useState<{
    rtaId: string;
    config: any;
  } | null>(null);
  const { account } = useWallet();

  // Web URL routing - sync URL with state
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const updateScreenFromURL = () => {
        const path = window.location.pathname;
        if (path === '/market') {
          setCurrentScreen('vibe-market');
        } else if (path === '/profile') {
          setCurrentScreen('profile');
        } else if (path === '/player') {
          setCurrentScreen('vibe-player');
        } else if (path.startsWith('/vibestream/')) {
          setCurrentScreen('playback');
          // Extract RTA ID from URL
          const rtaId = path.substring(12); // Remove '/vibestream/' prefix
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
          case 'profile': return '/profile';
          case 'vibe-player': return '/player';
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
  }, [currentScreen]);

  // Initialize orchestration integration with wallet
  useEffect(() => {
    const initializeOrchestration = async () => {
      try {
        console.log('🔗 Initializing orchestration integration with wallet...');
        
        // Get wallet integration context
        const walletIntegration = { account };
        
        // Initialize orchestration with wallet
        const success = await orchestrationIntegration.initializeWithWallet(walletIntegration);
        
        if (success) {
          console.log('✅ Orchestration integration initialized with wallet');
        } else {
          console.warn('⚠️ Orchestration integration initialization failed');
        }
      } catch (error) {
        console.error('❌ Failed to initialize orchestration:', error);
      }
    };

    // Initialize when wallet is available
    if (account) {
      initializeOrchestration();
    }
  }, [account]);

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

  if (currentScreen === 'splash') {
    return (
      <SplashScreen 
        onStart={handleStart} 
        onLaunchVibePlayer={handleLaunchVibePlayer} 
        onOpenProfile={handleOpenProfile}
        onOpenVibeMarket={handleOpenVibeMarket}
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