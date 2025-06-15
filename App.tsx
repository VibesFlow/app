import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text } from 'react-native';
import SplashScreen from './components/SplashScreen';
import { COLORS } from './theme';

export default function App() {
  const [showMain, setShowMain] = useState(false);

  const handleStart = () => {
    setShowMain(true);
  };

  if (!showMain) {
    return <SplashScreen onStart={handleStart} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContainer}>
        <Text style={styles.mainText}>Welcome to VibesFlow!</Text>
        <Text style={styles.subText}>Your emotional music creation journey begins here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mainText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 2,
  },
  subText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});