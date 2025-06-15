import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS } from '../theme';
import { useWallet } from '../context/HotWalletConnector';
import { GlitchText } from './ui';

interface ConnectModalProps {
  visible: boolean;
  onClose: () => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ visible, onClose }) => {
  const [pulse] = useState(new Animated.Value(1));

  const { 
    account, 
    connecting, 
    connect, 
    error: walletError 
  } = useWallet();

  // Start pulsing animation
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [visible, pulse]);

  // Close modal when connected
  useEffect(() => {
    if (account && !connecting) {
      // Delay closing to show success screen
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  }, [account, connecting, onClose]);

  const handleConnect = () => {
    connect();
  };

  const renderInitialScreen = () => (
    <>
      <Text style={styles.modalDescription}>
        USE HOT WALLET TO CONNECT
      </Text>

      <TouchableOpacity 
        style={styles.optionButton}
        onPress={handleConnect}
        activeOpacity={0.7}
        disabled={connecting}
      >
        <LinearGradient
          colors={['rgba(0,255,65,0.15)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        />
        <View style={styles.buttonContent}>
          <FontAwesome name="fire" size={18} color={COLORS.primary} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>CONNECT WITH HOT</Text>
        </View>
      </TouchableOpacity>

      {walletError && <Text style={styles.errorText}>{walletError}</Text>}
    </>
  );

  const renderConnectingScreen = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <GlitchText text="CONNECTING..." style={styles.loadingText} intensity="medium" />
      <Text style={styles.infoText}>Approve the connection in your HOT Wallet app.</Text>
    </View>
  );

  const renderSuccessScreen = () => (
    <View style={styles.successContainer}>
      <FontAwesome name="check-circle" size={60} color={COLORS.primary} />
      <GlitchText text="CONNECTED!" style={styles.successText} intensity="high" />
    </View>
  );

  const renderContent = () => {
    if (account) {
      return renderSuccessScreen();
    }
    if (connecting) {
      return renderConnectingScreen();
    }
    return renderInitialScreen();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer, { transform: [{ scale: pulse }] }]}>
          <LinearGradient
            colors={['#1a1a1a', '#0d0d0d']}
            style={styles.modalGradient}
          />

          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <FontAwesome name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <GlitchText text="VIBESYNC" style={styles.modalTitle} intensity="low" />

          {renderContent()}

        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.3)',
    padding: 25,
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 1,
  },
  optionButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 20,
    overflow: 'hidden',
  },
  buttonGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  errorText: {
    color: COLORS.accent,
    marginTop: 15,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: COLORS.primary,
    letterSpacing: 2,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 3,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 15,
  }
});

export default ConnectModal; 