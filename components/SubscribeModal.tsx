import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchText from './ui/GlitchText';
import { useWallet } from '../context/connector';
import { createPublicClient, createWalletClient, custom, parseEther, parseAbiItem } from 'viem';

const { width } = Dimensions.get('window');

interface SubscribeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscriptionSuccess: () => void;
}

const SubscribeModal: React.FC<SubscribeModalProps> = ({ visible, onClose, onSubscriptionSuccess }) => {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    price: string;
    duration: string;
    isSubscribed: boolean;
    timeRemaining: string;
  } | null>(null);

  const { account, getNetworkInfo } = useWallet();

  // Contract addresses
  const CONTRACT_ADDRESSES = {
    METIS: {
      SUBSCRIPTIONS: process.env.SUBSCRIPTIONS_ADDRESS || process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ADDRESS || '0xC5178c585784B93bc408eAd828701155a41e4f76',
      CHAIN_ID: 133717,
      RPC_URL: 'https://hyperion-testnet.metisdevops.link'
    }
  };

  // Load subscription info when modal opens
  React.useEffect(() => {
    if (visible && account?.network === 'metis-hyperion') {
      loadSubscriptionInfo();
    }
  }, [visible, account]);

  const loadSubscriptionInfo = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum || !account) {
        return;
      }

      const ethProvider = (window as any).ethereum;
      
      // Define Metis Hyperion chain config - exact same as connector.tsx
      const metisHyperion = {
        id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
        name: 'Metis Hyperion Testnet',
        network: 'metis-hyperion',
        nativeCurrency: {
          decimals: 18,
          name: 'tMETIS',
          symbol: 'tMETIS',
        },
        rpcUrls: {
          default: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
          public: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
        },
        blockExplorers: {
          default: {
            name: 'Metis Hyperion Explorer',
            url: 'https://hyperion-testnet-explorer.metisdevops.link',
          },
        },
      };

      // Create public client for contract interaction
      const publicClient = createPublicClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      // Get subscription price
      const price = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
        abi: [parseAbiItem('function getSubscriptionPrice() external view returns (uint256)')],
        functionName: 'getSubscriptionPrice',
      }) as bigint;

      // Get subscription duration
      const duration = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
        abi: [parseAbiItem('function getSubscriptionDuration() external view returns (uint256)')],
        functionName: 'getSubscriptionDuration',
      }) as bigint;

      // Check if user is subscribed
      const isSubscribed = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
        abi: [parseAbiItem('function isSubscribed(address user) external view returns (bool)')],
        functionName: 'isSubscribed',
        args: [account.accountId as `0x${string}`]
      }) as boolean;

      // Get time remaining if subscribed
      let timeRemaining = '0';
      if (isSubscribed) {
        const remaining = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
          abi: [parseAbiItem('function getTimeRemaining(address user) external view returns (uint256)')],
          functionName: 'getTimeRemaining',
          args: [account.accountId as `0x${string}`]
        }) as bigint;
        
        const days = Math.floor(Number(remaining) / (24 * 60 * 60));
        const hours = Math.floor((Number(remaining) % (24 * 60 * 60)) / (60 * 60));
        timeRemaining = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
      }

      setSubscriptionInfo({
        price: (Number(price) / 1e18).toString(),
        duration: Math.floor(Number(duration) / (24 * 60 * 60)).toString(),
        isSubscribed,
        timeRemaining
      });

    } catch (error) {
      console.error('Failed to load subscription info:', error);
    }
  };

  const handleSubscribe = useCallback(async () => {
    if (!account || account.network !== 'metis-hyperion') {
      Alert.alert('Error', 'Please connect to Metis Hyperion network');
      return;
    }

    if (!subscriptionInfo) {
      Alert.alert('Error', 'Subscription information not loaded');
      return;
    }

    setIsSubscribing(true);

    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;
      
      // Define Metis Hyperion chain config - matching VibestreamModal pattern
      const metisHyperion = {
        id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
        name: 'Metis Hyperion Testnet',
        network: 'metis-hyperion',
        nativeCurrency: {
          decimals: 18,
          name: 'tMETIS',
          symbol: 'tMETIS',
        },
        rpcUrls: {
          default: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
        },
      };

      // Create wallet client
      const walletClient = createWalletClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      const subscriptionPrice = parseEther(subscriptionInfo.price);

      // Call subscribe function
      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
        abi: [parseAbiItem('function subscribe() external payable')],
        functionName: 'subscribe',
        account: account.accountId as `0x${string}`,
        value: subscriptionPrice,
        gas: BigInt(200000),
      });

      console.log('✅ Subscription transaction sent:', txHash);

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 60000
      });

      // Refresh subscription info
      await loadSubscriptionInfo();

      Alert.alert(
        'Subscription Successful!',
        `Welcome to Vibe Market! You now have access to all DJ sets for ${subscriptionInfo.duration} days.`,
        [{ text: 'Start Exploring!', onPress: onSubscriptionSuccess }]
      );

      onClose();

    } catch (error: any) {
      console.error('❌ Subscription failed:', error);
      
      let errorMessage = 'Subscription failed. Please try again.';
      
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient tMETIS balance for subscription.';
      } else if (error.message?.includes('already subscribed')) {
        errorMessage = 'You already have an active subscription.';
      }
      
      Alert.alert('Subscription Failed', errorMessage);
    } finally {
      setIsSubscribing(false);
    }
  }, [account, subscriptionInfo, onClose, onSubscriptionSuccess]);

  const handleRenew = useCallback(async () => {
    if (!account || account.network !== 'metis-hyperion') {
      Alert.alert('Error', 'Please connect to Metis Hyperion network');
      return;
    }

    if (!subscriptionInfo) {
      Alert.alert('Error', 'Subscription information not loaded');
      return;
    }

    setIsSubscribing(true);

    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;
      
      // Define Metis Hyperion chain config - exact same as connector.tsx
      const metisHyperion = {
        id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
        name: 'Metis Hyperion Testnet',
        network: 'metis-hyperion',
        nativeCurrency: {
          decimals: 18,
          name: 'tMETIS',
          symbol: 'tMETIS',
        },
        rpcUrls: {
          default: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
          public: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
        },
        blockExplorers: {
          default: {
            name: 'Metis Hyperion Explorer',
            url: 'https://hyperion-testnet-explorer.metisdevops.link',
          },
        },
      };

      const walletClient = createWalletClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      const subscriptionPrice = parseEther(subscriptionInfo.price);

      // Call renewSubscription function
      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
        abi: [parseAbiItem('function renewSubscription() external payable')],
        functionName: 'renewSubscription',
        account: account.accountId as `0x${string}`,
        value: subscriptionPrice,
        gas: BigInt(200000),
      });

      console.log('✅ Renewal transaction sent:', txHash);

      // Wait for confirmation
      const publicClient = createPublicClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 60000
      });

      // Refresh subscription info
      await loadSubscriptionInfo();

      Alert.alert(
        'Subscription Renewed!',
        `Your Vibe Market access has been extended for another ${subscriptionInfo.duration} days.`,
        [{ text: 'Continue Exploring!', onPress: onSubscriptionSuccess }]
      );

      onClose();

    } catch (error: any) {
      console.error('❌ Renewal failed:', error);
      
      let errorMessage = 'Renewal failed. Please try again.';
      
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient tMETIS balance for renewal.';
      }
      
      Alert.alert('Renewal Failed', errorMessage);
    } finally {
      setIsSubscribing(false);
    }
  }, [account, subscriptionInfo, onClose, onSubscriptionSuccess]);

  const renderSubscriptionContent = () => {
    if (!subscriptionInfo) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>LOADING SUBSCRIPTION INFO...</Text>
        </View>
      );
    }

    if (subscriptionInfo.isSubscribed) {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.statusContainer}>
            <FontAwesome5 name="check-circle" size={32} color={COLORS.secondary} />
            <Text style={styles.statusTitle}>SUBSCRIPTION ACTIVE</Text>
            <Text style={styles.statusSubtext}>
              {subscriptionInfo.timeRemaining} remaining
            </Text>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              You have full access to all DJ sets and vibestreams in the Vibe Market.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.renewButton]}
            onPress={handleRenew}
            disabled={isSubscribing}
            activeOpacity={0.7}
          >
            {isSubscribing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.background} />
                <Text style={styles.buttonText}>RENEWING...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                EXTEND FOR {subscriptionInfo.price} tMETIS
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.contentContainer}>
        <View style={styles.offerContainer}>
          <FontAwesome5 name="music" size={32} color={COLORS.accent} />
          <Text style={styles.offerTitle}>ACCESS ALL DJ SETS</Text>
          <Text style={styles.offerSubtitle}>EVER CREATED</Text>
          <Text style={styles.priceText}>
            FOR JUST {subscriptionInfo.price} tMETIS / MONTH!
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          <View style={styles.benefitItem}>
            <FontAwesome5 name="infinity" size={16} color={COLORS.secondary} />
            <Text style={styles.benefitText}>Unlimited access to all vibestreams</Text>
          </View>
          <View style={styles.benefitItem}>
            <FontAwesome5 name="download" size={16} color={COLORS.secondary} />
            <Text style={styles.benefitText}>Download and stream offline</Text>
          </View>
          <View style={styles.benefitItem}>
            <FontAwesome5 name="headphones" size={16} color={COLORS.secondary} />
            <Text style={styles.benefitText}>High-quality audio streaming</Text>
          </View>
          <View style={styles.benefitItem}>
            <FontAwesome5 name="users" size={16} color={COLORS.secondary} />
            <Text style={styles.benefitText}>Join exclusive group vibestreams</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.subscribeButton]}
          onPress={handleSubscribe}
          disabled={isSubscribing}
          activeOpacity={0.7}
        >
          {isSubscribing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.background} />
              <Text style={styles.buttonText}>SUBSCRIBING...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              SUBSCRIBE FOR {subscriptionInfo.price} tMETIS
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.durationText}>
          {subscriptionInfo.duration} days access • Auto-renewal available
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={[COLORS.background, '#0a0a0a']}
                style={styles.gradientBackground}
              >
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                  <FontAwesome5 name="times" size={16} color={COLORS.primary} />
                </TouchableOpacity>

                <View style={styles.header}>
                  <GlitchText text="VIBE MARKET" style={styles.modalTitle} intensity="medium" />
                  <Text style={styles.subtitle}>PREMIUM ACCESS</Text>
                </View>

                {renderSubscriptionContent()}
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  gradientBackground: {
    padding: 24,
    minHeight: 300,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  contentContainer: {
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 12,
  },
  statusSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: 4,
  },
  offerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  offerTitle: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 12,
    textAlign: 'center',
  },
  offerSubtitle: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  priceText: {
    fontSize: 18,
    color: COLORS.secondary,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
  },
  benefitsContainer: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    marginLeft: 12,
    letterSpacing: 1,
    flex: 1,
  },
  infoContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 18,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    alignSelf: 'stretch',
  },
  subscribeButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  renewButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationText: {
    fontSize: 10,
    color: COLORS.textTertiary,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 12,
  },
});

export default SubscribeModal;
