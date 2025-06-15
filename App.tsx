import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SplashScreen from './components/SplashScreen';
import { COLORS } from './theme';
import { WalletProvider } from './context/HotWalletConnector';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);

  const handleStart = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onStart={handleStart} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to VibesFlow!</Text>
      <Text style={styles.subtitle}>Your emotional music creation journey begins here.</Text>
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
    padding: 20,
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});