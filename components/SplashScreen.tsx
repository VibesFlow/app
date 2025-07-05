import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BRANDING } from '../theme';
import ConnectModal from './ConnectModal';
import VibestreamModal from './VibestreamModal';
import { useWallet } from '../context/connector';

const { width, height } = Dimensions.get('window');

// Define the type for glitch lines
type GlitchLine = {
  y: number;
  width: number;
  opacity: number;
};

// Create a random set of glitch lines for the background
const generateGlitchLines = (count: number): GlitchLine[] => {
  const lines: GlitchLine[] = [];
  for (let i = 0; i < count; i++) {
    const y = Math.random() * height;
    const lineWidth = Math.random() * 100 + 50;
    const opacity = Math.random() * 0.5 + 0.1;
    lines.push({ y, width: lineWidth, opacity });
  }
  return lines;
};

const glitchLines: GlitchLine[] = generateGlitchLines(15);

interface SplashScreenProps {
  onStart: () => void;
  onLaunchVibePlayer: () => void;
  onOpenProfile: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart, onLaunchVibePlayer, onOpenProfile }) => {
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [vibestreamModalVisible, setVibestreamModalVisible] = useState(false);
  const [showDisconnectDropdown, setShowDisconnectDropdown] = useState(false);
  const { account, connected, disconnect } = useWallet();
  
  const handleConnect = () => {
    setConnectModalVisible(true);
  };

  const handleStartVibing = () => {
    if (connected && account) {
      setVibestreamModalVisible(true);
    } else {
      setConnectModalVisible(true);
    }
  };

  const handleWalletClick = () => {
    if (connected && account) {
      setShowDisconnectDropdown(!showDisconnectDropdown);
    } else {
      handleConnect();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDisconnectDropdown(false);
  };

  const handleOpenProfile = () => {
    onOpenProfile();
    setShowDisconnectDropdown(false);
  };
  
  // Format wallet address for display
  const formatAddress = (accountId: string | null) => {
    if (!accountId || typeof accountId !== 'string') return 'CONNECT';
    if (accountId.length <= 10) return accountId.toUpperCase();
    return `${accountId.substring(0, 6)}...${accountId.substring(accountId.length - 4)}`.toUpperCase();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Dark background */}
      <View style={styles.background} />
      
      {/* Acid color gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(10,10,10,0.9)']}
        style={styles.gradientBackground}
      />
      
      {/* Glitch lines */}
      {glitchLines.map((line, index) => (
        <View 
          key={index}
          style={[
            styles.glitchLine,
            {
              top: line.y,
              width: line.width,
              opacity: line.opacity,
              backgroundColor: index % 3 === 0 ? COLORS.primary : index % 3 === 1 ? COLORS.secondary : COLORS.accent
            }
          ]}
        />
      ))}
      
      {/* Noise texture overlay */}
      <View style={styles.noiseOverlay} />
      
      {/* Connect/Wallet button - top right */}
      <View style={styles.walletContainer}>
        <TouchableOpacity 
          style={[
            styles.connectButton,
            connected && styles.connectedButton
          ]} 
          onPress={handleWalletClick}
          activeOpacity={0.6}
        >
          <Text style={[
            styles.connectText,
            connected && styles.connectedText
          ]}>
            {formatAddress(account?.accountId || null)}
          </Text>
        </TouchableOpacity>

        {/* Disconnect dropdown */}
        {showDisconnectDropdown && connected && (
          <View style={styles.disconnectDropdown}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={handleOpenProfile}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownText}>PROFILE</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={handleDisconnect}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownText}>DISCONNECT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Logo and branding */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>V</Text>
        </View>
        <Text style={styles.title}>VIBES<Text style={styles.titleAccent}>FLOW</Text></Text>
        <Text style={styles.slogan}>{BRANDING.slogan}</Text>
      </View>
      
      {/* Start vibing button - restyled */}
      <TouchableOpacity 
        style={styles.startButton}
        onPress={handleStartVibing}
        activeOpacity={0.7}
      >
        <Text style={styles.startButtonText}>START_VIBING</Text>
        <View style={styles.buttonGlow} />
      </TouchableOpacity>
      
      {/* Bottom manifesto text */}
      <Text style={styles.manifestoText}>
        {BRANDING.manifesto}
      </Text>
      
      {/* Connect Modal */}
      <ConnectModal
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
      />
      
      {/* Vibestream Modal */}
      <VibestreamModal
        visible={vibestreamModalVisible}
        onClose={() => setVibestreamModalVisible(false)}
        onLaunchVibePlayer={onLaunchVibePlayer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.backgroundLight,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.6,
  },
  glitchLine: {
    position: 'absolute',
    height: 1,
    left: Math.random() * width,
    zIndex: 2,
  },
  noiseOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    opacity: 0.08,
    zIndex: 3,
  },
  walletContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  connectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  connectedButton: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(255, 0, 160, 0.1)',
  },
  connectText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 2,
  },
  connectedText: {
    color: COLORS.secondary,
  },
  disconnectDropdown: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 4,
    minWidth: 140,
  },
  dropdownButton: {
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  dropdownText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 70,
    zIndex: 5,
  },
  logoBox: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 2,
    borderColor: COLORS.secondary,
    marginBottom: 20,
    transform: [{ rotate: '5deg' }],
  },
  logoText: {
    color: COLORS.secondary,
    fontSize: 70,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: 3,
  },
  titleAccent: {
    color: COLORS.accent,
  },
  slogan: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: 20,
  },
  startButton: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'relative',
    marginBottom: 40,
    zIndex: 5,
  },
  startButtonText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  buttonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    opacity: 0.15,
    zIndex: -1,
  },
  manifestoText: {
    position: 'absolute',
    bottom: 30,
    color: COLORS.textTertiary,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '500',
  },
});

export default SplashScreen;