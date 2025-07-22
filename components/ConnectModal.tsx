import React, { useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS } from '../theme';
import { useWallet } from '../context/connector';
import { GlitchText } from './ui';

const ConnectModal: React.FC = () => {
  const [pulse] = React.useState(new Animated.Value(1));

  const { 
    modal,
    account, 
    connecting, 
    error: walletError,
    connected,
    closeModal,
    setModalStep,
    connectAsGuest,
    connectNear,
    connectMetis
  } = useWallet();

  // Start pulsing animation
  useEffect(() => {
    if (modal.isOpen) {
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
  }, [modal.isOpen]);

  // Close modal when connected
  useEffect(() => {
    if (connected && account && !connecting) {
      // Delay closing to show success screen
      setTimeout(() => {
        closeModal();
      }, 1500);
    }
  }, [account, connecting, connected, closeModal]);

  const handleGuestConnect = async () => {
    try {
      await connectAsGuest();
    } catch (error) {
      console.error('Failed to connect as guest:', error);
    }
  };

  const handleNearConnect = async (provider: 'here' | 'mynear') => {
    try {
      console.log(`Connecting to NEAR with ${provider}...`);
      await connectNear(provider);
    } catch (error) {
      console.error(`Failed to connect to NEAR with ${provider}:`, error);
    }
  };

  // Connect to Metis Hyperion with browser wallet
  const handleMetisConnect = async () => {
    try {
      console.log('🔄 Connecting to Metis Hyperion with browser wallet...');
      
      // connectMetis already handles the modal steps
      await connectMetis();
      
    } catch (error) {
      console.error('❌ Failed to connect Metis wallet:', error);
      // connectMetis handles error state and modal steps
    }
  };

  const handleBackToSelection = () => {
    setModalStep('selection');
  };

  const renderSelectionScreen = () => (
    <View style={styles.modalContent}>
      <Text style={styles.modalDescription}>
        CHOOSE YOUR CONNECTION METHOD
      </Text>

      <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
        {/* Guest Account Option */}
        <TouchableOpacity 
          style={[styles.walletButton, styles.guestButton]}
          onPress={handleGuestConnect}
          activeOpacity={0.7}
          disabled={connecting}
        >
          <LinearGradient
            colors={['rgba(255,0,170,0.25)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          />
          <View style={styles.buttonContent}>
            <FontAwesome 
              name="user-secret" 
              size={18} 
              color={COLORS.accent} 
              style={styles.buttonIcon} 
            />
            <View style={styles.guestTextContainer}>
              <Text style={styles.guestButtonText}>Quick Start (Guest)</Text>
              <Text style={styles.guestSubText}>No wallet needed • We pay gas fees</Text>
            </View>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>ANONYMOUS</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OR CONNECT YOUR WALLET</Text>
          <View style={styles.separatorLine} />
        </View>
        {/* Metis Wallet - Direct Connection */}
        <TouchableOpacity 
          style={styles.walletButton}
          onPress={handleMetisConnect}
          activeOpacity={0.7}
          disabled={connecting || Platform.OS !== 'web'}
        >
          <LinearGradient
            colors={['rgba(0,255,170,0.15)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          />
          <View style={styles.buttonContent}>
            <FontAwesome 
              name="link" 
              size={18} 
              color={COLORS.primary} 
              style={styles.buttonIcon} 
            />
            <View style={styles.guestTextContainer}>
              <Text style={styles.buttonText}>Metis Hyperion</Text>
              <Text style={styles.guestSubText}>
                {Platform.OS === 'web' 
                  ? 'Connect with your browser wallet' 
                  : 'Web only'
                }
              </Text>
            </View>
            <View style={styles.availableIndicator} />
          </View>
        </TouchableOpacity>
        
        {/* NEAR Wallet */}
        <TouchableOpacity 
          style={styles.walletButton}
          onPress={() => setModalStep('near-options')}
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
              name="circle" 
              size={18} 
              color={COLORS.primary} 
              style={styles.buttonIcon} 
            />
            <Text style={styles.buttonText}>NEAR Testnet</Text>
            <View style={styles.availableIndicator} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {walletError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{walletError}</Text>
        </View>
      )}

      <Text style={styles.supportedWallets}>
        Connect with your preferred wallet to start vibing
      </Text>
    </View>
  );

  const renderNearOptionsScreen = () => (
    <View style={styles.modalContent}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackToSelection}
        disabled={connecting}
      >
        <FontAwesome name="chevron-left" size={12} color={COLORS.primary} />
        <Text style={styles.backText}>BACK</Text>
      </TouchableOpacity>

      <Text style={styles.modalDescription}>
        CONNECT YOUR NEAR WALLET
      </Text>

      <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
        {/* HERE Wallet */}
        <TouchableOpacity 
          style={styles.walletButton}
          onPress={() => handleNearConnect('here')}
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
              name="mobile" 
              size={18} 
              color={COLORS.primary} 
              style={styles.buttonIcon} 
            />
            <View style={styles.guestTextContainer}>
              <Text style={styles.buttonText}>HERE Wallet</Text>
              <Text style={styles.guestSubText}>Mobile & Web wallet for NEAR</Text>
            </View>
            <View style={styles.availableIndicator} />
          </View>
        </TouchableOpacity>

        {/* MyNearWallet */}
        <TouchableOpacity 
          style={styles.walletButton}
          onPress={() => handleNearConnect('mynear')}
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
              name="globe" 
              size={18} 
              color={COLORS.primary} 
              style={styles.buttonIcon} 
            />
            <View style={styles.guestTextContainer}>
              <Text style={styles.buttonText}>MyNearWallet</Text>
              <Text style={styles.guestSubText}>Web wallet for NEAR Protocol</Text>
            </View>
            <View style={styles.availableIndicator} />
          </View>
        </TouchableOpacity>
      </ScrollView>

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
        <Text style={styles.infoText}>
          {modal.step === 'connecting' 
            ? 'Please confirm the connection in your wallet.'
            : 'Setting up your connection...'
          }
        </Text>
        
        {Platform.OS === 'web' && (
          <Text style={styles.helperText}>
            If your wallet doesn't open automatically, please check for a browser extension popup.
          </Text>
        )}
      </View>
    </View>
  );

  const renderSuccessScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.successContainer}>
        <FontAwesome 
          name="check-circle" 
          size={60} 
          color={COLORS.primary} 
        />
        <GlitchText text="CONNECTED!" style={styles.successText} intensity="high" />
        {account && (
          <>
            <Text style={styles.walletAddress}>
              {account.accountId?.length > 10 ? 
                `${account.accountId.substring(0, 6)}...${account.accountId.substring(account.accountId.length - 4)}` :
                account.accountId}
            </Text>
            <Text style={styles.networkText}>
              {account.network === 'metis-hyperion' ? 'Metis Hyperion' : 
               account.network === 'near-testnet' ? 'NEAR Testnet' : 
               'Connected'}
            </Text>
            
            {/* Show network switch button if there's a network error */}
            {walletError && walletError.includes('wrong network') && account.walletType === 'metis' && (
              <TouchableOpacity 
                style={styles.switchNetworkButton}
                onPress={async () => {
                  try {
                    const ethereum = (window as any).ethereum;
                    await ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x20a55' }],
                    });
                  } catch (error) {
                    console.error('Manual network switch failed:', error);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.switchNetworkText}>SWITCH TO METIS HYPERION</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderContent = () => {
    if (connected && account) {
      return renderSuccessScreen();
    }
    if (connecting || modal.step === 'connecting') {
      return renderConnectingScreen();
    }

    // Default VibesFlow connection selection
    switch (modal.step) {
      case 'selection':
        return renderSelectionScreen();
      case 'near-options':
        return renderNearOptionsScreen();
      default:
        return renderSelectionScreen();
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modal.isOpen}
      onRequestClose={closeModal}
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
              onPress={closeModal}
            >
              <FontAwesome name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {renderContent()}

          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>POWERED BY NEAR & METIS</Text>
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
    width: '90%',
    maxWidth: 360,
    maxHeight: '85%',
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
    maxHeight: 280,
  },
  walletButton: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
    position: 'relative',
  },
  guestButton: {
    borderColor: COLORS.accent,
    marginBottom: 8,
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
  guestTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  guestButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 1,
  },
  guestSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.textSecondary,
    opacity: 0.3,
  },
  separatorText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginHorizontal: 12,
    letterSpacing: 1,
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
    textAlign: 'center',
  },
  networkText: {
    marginTop: 4,
    color: COLORS.primary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 1,
  },
  switchNetworkButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 0, 170, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
  },
  switchNetworkText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
});

export default ConnectModal; 