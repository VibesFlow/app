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
import { useWallet } from '../context/connector';
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
    error: walletError,
    availableWallets,
    connectToWallet
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

  const handleWalletConnect = async (walletId: string) => {
    try {
      await connectToWallet(walletId);
    } catch (error) {
      console.error('Failed to connect to wallet:', error);
    }
  };

  const getWalletIcon = (walletId: string) => {
    switch (walletId) {
      case 'here-wallet':
        return 'mobile';
      case 'meteor-wallet':
        return 'globe';
      case 'nightly':
        return 'moon-o';
      case 'sender':
        return 'send';
      case 'my-near-wallet':
        return 'user-o';
      default:
        return 'credit-card';
    }
  };

  const getWalletName = (wallet: any) => {
    return wallet.metadata?.name || wallet.id || 'Unknown Wallet';
  };

  const renderInitialScreen = () => (
    <View style={styles.modalContent}>
      <Text style={styles.modalDescription}>
        SELECT YOUR NEAR WALLET
      </Text>

      <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
        {availableWallets.length > 0 ? (
          availableWallets.map((wallet) => (
            <TouchableOpacity 
              key={wallet.id}
              style={styles.walletButton}
              onPress={() => handleWalletConnect(wallet.id)}
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
                <FontAwesome 
                  name={getWalletIcon(wallet.id)} 
                  size={18} 
                  color={COLORS.primary} 
                  style={styles.buttonIcon} 
                />
                <Text style={styles.buttonText}>{getWalletName(wallet)}</Text>
                {wallet.metadata?.available && (
                  <View style={styles.availableIndicator} />
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading wallets...</Text>
          </View>
        )}
      </ScrollView>

      {walletError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{walletError}</Text>
        </View>
      )}

      <Text style={styles.supportedWallets}>
        Connect with your preferred NEAR wallet
      </Text>
    </View>
  );

  const renderConnectingScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <GlitchText text="CONNECTING..." style={styles.loadingText} intensity="medium" />
        <Text style={styles.infoText}>Please confirm the connection in your wallet.</Text>
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
            {account.accountId.length > 10 ? 
              `${account.accountId.substring(0, 6)}...${account.accountId.substring(account.accountId.length - 4)}` :
              account.accountId
            }
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
    maxWidth: 320,
    maxHeight: '80%',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
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
  walletList: {
    maxHeight: 200,
  },
  walletButton: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
    position: 'relative',
  },
  buttonGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 1,
    flex: 1,
  },
  availableIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
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
  supportedWallets: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.7,
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