import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import SplashScreen from './components/SplashScreen';
import VibePlayer from './components/VibePlayer';
import UserProfile from './components/UserProfile';
import VibeMarket from './components/VibeMarket';
import { COLORS, FONT_SIZES, SPACING } from './theme';
import { WalletProvider, HotWalletProvider, useWallet } from './context/connector';
import { FilCDNProvider } from './context/filcdn';
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

type AppScreen = 'splash' | 'main' | 'vibe-player' | 'loading' | 'profile' | 'vibe-market';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [rtaData, setrtaData] = useState<{
    rtaId: string;
    config: any;
  } | null>(null);
  const { account } = useWallet();

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
      <HotWalletProvider>
        <FilCDNProvider>
          <AppContent />
          <StatusBar style="light" />
        </FilCDNProvider>
      </HotWalletProvider>
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