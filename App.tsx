import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import SplashScreen from './components/SplashScreen';
import VibePlayer from './components/VibePlayer';
import UserProfile from './components/UserProfile';
import { COLORS, FONT_SIZES, SPACING } from './theme';
import { WalletProvider, useWallet } from './context/HotWalletConnector';

type AppScreen = 'splash' | 'main' | 'vibe-player' | 'loading' | 'profile';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const { account } = useWallet();

  const handleStart = () => {
    setCurrentScreen('main');
  };

  const handleLaunchVibePlayer = () => {
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

  if (currentScreen === 'splash') {
    return <SplashScreen onStart={handleStart} onLaunchVibePlayer={handleLaunchVibePlayer} onOpenProfile={handleOpenProfile} />;
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
    return <VibePlayer onBack={handleBackFromVibePlayer} />;
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
      <AppContent />
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