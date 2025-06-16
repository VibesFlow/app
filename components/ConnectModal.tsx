import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Animated,
  Linking,
  TextInput
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
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
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
    <View style={styles.modalContent}>
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
          colors={['rgba(0,255,170,0.15)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        />
        <View style={styles.buttonContent}>
          <FontAwesome name="fire" size={18} color={COLORS.primary} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>CONNECT WITH HOT</Text>
        </View>
      </TouchableOpacity>

      {walletError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{walletError}</Text>
        </View>
      )}
    </View>
  );

  const renderConnectingScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <GlitchText text="CONNECTING..." style={styles.loadingText} intensity="medium" />
        <Text style={styles.infoText}>Approve the connection in your HOT Wallet app.</Text>
      </View>
    </View>
  );

  const renderSuccessScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.successContainer}>
        <FontAwesome name="check-circle" size={60} color={COLORS.primary} />
        <GlitchText text="CONNECTED!" style={styles.successText} intensity="high" />
        {account && (
          <Text style={styles.walletAddress}>
            {account.address.substring(0, 6)}...{account.address.substring(account.address.length - 4)}
          </Text>
        )}
      </View>
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

          <View style={styles.modalHeader}>
            <GlitchText text="VIBESFLOW" style={styles.modalTitle} intensity="low" />
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <FontAwesome name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {renderContent()}

          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>POWERED BY NEAR</Text>
          </View>

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
    width: '85%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(0, 255, 170, 0.5)`,
    // Add subtle border glow
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: `rgba(0, 255, 170, 0.3)`,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    textShadowColor: COLORS.primary,
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 0 },
    letterSpacing: 4,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  optionButton: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
    position: 'relative',
  },
  secondaryOptionButton: {
    borderColor: COLORS.secondary,
  },
  accentOptionButton: {
    borderColor: COLORS.accent,
  },
  buttonGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  secondaryButtonText: {
    color: COLORS.secondary,
  },
  accentButtonText: {
    color: COLORS.accent,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.primary,
    fontSize: 14,
    letterSpacing: 2,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successText: {
    marginTop: 12,
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  walletAddress: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  modalFooter: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: `rgba(0, 255, 170, 0.3)`,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  footerText: {
    fontSize: 10,
    color: COLORS.accent,
    opacity: 0.8,
  },
});

export default ConnectModal; 