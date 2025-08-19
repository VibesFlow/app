import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useWallet } from '../context/connector';
import { liveVibestreamsTracker, LiveVibestreamsData, LiveVibestream } from '../services/LiveTracker';
import { ProfileLoader } from '../services/ProfileLoader';

const { width, height } = Dimensions.get('window');

// Import viem for Metis contract interaction
let createWalletClient: any = null;
let custom: any = null;
let parseAbiItem: any = null;
let parseEther: any = null;

// Conditional import for web platform
if (Platform.OS === 'web') {
  try {
    const viem = require('viem');
    createWalletClient = viem.createWalletClient;
    custom = viem.custom;
    parseAbiItem = viem.parseAbiItem;
    parseEther = viem.parseEther;
  } catch (error) {
    console.warn('⚠️ Viem not available for ticket purchases');
  }
}

interface LiveVibesProps {
  onBack: () => void;
  onJoinVibestream: (vibeId: string, creator: string) => void;
}

const LiveVibes: React.FC<LiveVibesProps> = ({ onBack, onJoinVibestream }) => {
  const { account, connected, getNetworkInfo } = useWallet();
  const [liveVibestreamsData, setLiveVibestreamsData] = useState<LiveVibestreamsData>({
    liveVibestreams: [],
    totalLive: 0,
    nearLive: 0,
    metisLive: 0,
    lastUpdated: 0
  });
  const [loading, setLoading] = useState(true);
  const [purchasingTickets, setPurchasingTickets] = useState<Set<string>>(new Set());
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, any>>(new Map());
  
  const profileLoader = useRef<ProfileLoader>(new ProfileLoader());

  // Load live vibestreams on mount
  useEffect(() => {
    const startTracking = async () => {
      try {
        await liveVibestreamsTracker.startTracking((data) => {
          setLiveVibestreamsData(data);
          setLoading(false);
        });
      } catch (error) {
        console.error('Failed to start live vibestreams tracking:', error);
        setLoading(false);
      }
    };

    startTracking();

    return () => {
      liveVibestreamsTracker.stopTracking((data) => {
        setLiveVibestreamsData(data);
      });
    };
  }, []);

  // Load creator profiles when vibestreams change
  useEffect(() => {
    const loadCreatorProfiles = async () => {
      if (liveVibestreamsData.liveVibestreams.length === 0) return;
      
      const uniqueCreators = [...new Set(liveVibestreamsData.liveVibestreams.map(stream => stream.creator))];
      await profileLoader.current.preloadProfiles(uniqueCreators);
      
      // Load profiles into state
      const profileMap = new Map();
      for (const creator of uniqueCreators) {
        const profile = await profileLoader.current.loadCreatorProfile(creator);
        profileMap.set(creator, profile);
      }
      setCreatorProfiles(profileMap);
    };
    
    loadCreatorProfiles();
  }, [liveVibestreamsData.liveVibestreams]);

  // Format time helper
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'JUST NOW';
    if (diffMins < 60) return `${diffMins}M AGO`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}H AGO`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}D AGO`;
  };

  // Format currency helper
  const formatCurrency = (amount: string, network: 'near' | 'metis'): string => {
    if (!amount || amount === '0') return 'FREE';
    const currency = network === 'metis' ? 'tMETIS' : 'NEAR';
    return `${amount} ${currency}`;
  };

  // Creator display name helper
  const getDisplayName = (creator: string): string => {
    const profile = creatorProfiles.get(creator);
    return profile?.displayName || creator;
  };

  // Purchase ticket for Metis vibestream
  const purchaseTicket = async (vibestream: LiveVibestream) => {
    if (!connected || !account) {
      Alert.alert('Wallet Required', 'Please connect your wallet first');
      return;
    }

    if (vibestream.network !== 'metis') {
      Alert.alert('Not Supported', 'Ticket purchases are only supported on Metis network');
      return;
    }

    if (!createWalletClient || !custom || !parseAbiItem || !parseEther) {
      Alert.alert('Error', 'Web3 libraries not available');
      return;
    }

    // Check if we have ethereum provider
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      Alert.alert('Error', 'Ethereum provider not available');
      return;
    }

    const vibeId = vibestream.vibeId;
    setPurchasingTickets(prev => new Set([...prev, vibeId]));

    try {
      const ethProvider = (window as any).ethereum;
      
      // Create wallet client
      const walletClient = createWalletClient({
        chain: {
          id: parseInt(process.env.EXPO_PUBLIC_HYPERION_CHAIN_ID || '133717'),
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: { default: { http: [process.env.EXPO_PUBLIC_HYPERION_RPC_URL] } },
        },
        transport: custom(ethProvider)
      });

      // Get user's account
      const [userAccount] = await walletClient.getAddresses();
      
      // Calculate ticket price (convert to wei if needed)
      const ticketPriceWei = vibestream.ticketPrice && vibestream.ticketPrice !== '0' 
        ? parseEther(vibestream.ticketPrice) 
        : 0n;

      console.log(`💳 Purchasing ticket for vibe ${vibeId}, price: ${ticketPriceWei} wei`);

      // Call purchaseTicket on VibeKiosk contract
      const hash = await walletClient.writeContract({
        address: process.env.EXPO_PUBLIC_VIBE_KIOSK_ADDRESS as `0x${string}`,
        abi: [parseAbiItem('function purchaseTicket(uint256 vibeId) external payable returns (uint256 ticketId)')],
        functionName: 'purchaseTicket',
        args: [BigInt(vibeId)],
        value: ticketPriceWei,
        account: userAccount
      });

      console.log(`✅ Ticket purchase transaction submitted: ${hash}`);
      
      Alert.alert(
        'Ticket Purchased!',
        `Your ticket has been purchased! Transaction: ${hash.slice(0, 10)}...`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Join Vibestream', 
            style: 'default',
            onPress: () => onJoinVibestream(vibeId, vibestream.creator)
          }
        ]
      );

    } catch (error: any) {
      console.error('❌ Failed to purchase ticket:', error);
      
      let errorMessage = 'Failed to purchase ticket. Please try again.';
      
      if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient tMETIS balance. Please add funds to your wallet.';
      } else if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (error.message?.includes('All tickets sold')) {
        errorMessage = 'All tickets for this vibestream have been sold.';
      }
      
      Alert.alert('Purchase Failed', errorMessage);
    } finally {
      setPurchasingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(vibeId);
        return newSet;
      });
    }
  };

  // Join vibestream (for free tickets or after purchase)
  const joinVibestream = (vibestream: LiveVibestream) => {
    if (vibestream.mode === 'group' && vibestream.ticketPrice && vibestream.ticketPrice !== '0') {
      // Requires ticket purchase
      purchaseTicket(vibestream);
    } else {
      // Free to join or solo mode
      onJoinVibestream(vibestream.vibeId, vibestream.creator);
    }
  };

  // Render live vibestream card
  const renderLiveVibestreamCard = (vibestream: LiveVibestream, index: number) => {
    const displayName = getDisplayName(vibestream.creator);
    const isPurchasing = purchasingTickets.has(vibestream.vibeId);
    const ticketsRemaining = vibestream.ticketsAmount && vibestream.ticketsSold !== undefined
      ? vibestream.ticketsAmount - vibestream.ticketsSold
      : undefined;
    
    return (
      <GlitchContainer key={vibestream.vibeId} intensity="low" style={styles.cardContainer}>
        <View style={styles.card}>
          {/* Network indicator */}
          <View style={[styles.networkIndicator, { 
            backgroundColor: vibestream.network === 'metis' ? COLORS.accent : COLORS.secondary 
          }]} />
          
          {/* Live indicator */}
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          
          {/* Main content */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <GlitchText text={`VIBE ${vibestream.vibeId}`} style={styles.cardTitle} />
              <Text style={styles.creatorName}>{displayName}</Text>
            </View>
            
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>
                {vibestream.mode.toUpperCase()} • {formatTime(vibestream.startedAt)}
              </Text>
              <Text style={styles.metaText}>
                {vibestream.network.toUpperCase()} NETWORK
              </Text>
            </View>

            {/* Group mode specific info */}
            {vibestream.mode === 'group' && (
              <View style={styles.groupInfo}>
                <View style={styles.groupInfoRow}>
                  <Text style={styles.groupInfoLabel}>TICKETS:</Text>
                  <Text style={styles.groupInfoValue}>
                    {vibestream.ticketsSold || 0} / {vibestream.ticketsAmount || 0}
                    {ticketsRemaining !== undefined && (
                      <Text style={styles.remainingText}> ({ticketsRemaining} LEFT)</Text>
                    )}
                  </Text>
                </View>
                
                <View style={styles.groupInfoRow}>
                  <Text style={styles.groupInfoLabel}>PRICE:</Text>
                  <Text style={styles.groupInfoValue}>
                    {formatCurrency(vibestream.ticketPrice || '0', vibestream.network)}
                  </Text>
                </View>
                
                {vibestream.payPerStream && vibestream.streamPrice && (
                  <View style={styles.groupInfoRow}>
                    <Text style={styles.groupInfoLabel}>PER-MINUTE:</Text>
                    <Text style={styles.groupInfoValue}>
                      {formatCurrency(vibestream.streamPrice, vibestream.network)}
                    </Text>
                  </View>
                )}
                
                {vibestream.distance && (
                  <View style={styles.groupInfoRow}>
                    <Text style={styles.groupInfoLabel}>RANGE:</Text>
                    <Text style={styles.groupInfoValue}>{vibestream.distance}M</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          
          {/* Join button */}
          <TouchableOpacity
            style={[
              styles.joinButton,
              isPurchasing && styles.joinButtonDisabled,
              ticketsRemaining === 0 && styles.joinButtonSoldOut
            ]}
            onPress={() => joinVibestream(vibestream)}
            disabled={isPurchasing || ticketsRemaining === 0}
            activeOpacity={0.7}
          >
            {isPurchasing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.background} />
                <Text style={styles.joinButtonText}>BUYING...</Text>
              </View>
            ) : ticketsRemaining === 0 ? (
              <Text style={styles.joinButtonText}>SOLD OUT</Text>
            ) : (
              <Text style={styles.joinButtonText}>
                {vibestream.ticketPrice && vibestream.ticketPrice !== '0' ? 'BUY & JOIN' : 'JOIN'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </GlitchContainer>
    );
  };

  return (
    <View style={styles.container}>
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <GlitchText text="LIVE VIBES" style={styles.title} />
        <View style={styles.headerRight}>
          <View style={styles.liveStats}>
            <View style={styles.liveDot} />
            <Text style={styles.liveStatsText}>{liveVibestreamsData.totalLive} LIVE</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Loading State */}
        {loading && (
          <GlitchContainer intensity="medium" style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>SCANNING FOR LIVE VIBES...</Text>
          </GlitchContainer>
        )}

        {/* Live Vibestreams List */}
        {!loading && (
          <View style={styles.vibestreamsSection}>
            <View style={styles.sectionHeader}>
              <GlitchText text="ACTIVE FREQUENCIES" style={styles.sectionTitle} />
              <Text style={styles.vibestreamCount}>
                {liveVibestreamsData.nearLive} NEAR • {liveVibestreamsData.metisLive} METIS
              </Text>
            </View>

            {liveVibestreamsData.liveVibestreams.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="satellite-dish" size={32} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>NO LIVE VIBES DETECTED</Text>
                <Text style={styles.emptySubtext}>Check back later for live sessions</Text>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {liveVibestreamsData.liveVibestreams.map((vibestream, index) => 
                  renderLiveVibestreamCard(vibestream, index)
                )}
              </View>
            )}
          </View>
        )}

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>REAL-TIME FREQUENCIES</Text>
          <Text style={styles.brandText}>POWERED BY BLOCKCHAIN</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  backgroundGlitch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.medium,
    paddingTop: Platform.OS === 'web' ? SPACING.large : SPACING.xl,
    paddingBottom: SPACING.medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
    zIndex: 2,
  },
  backButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  title: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.large : FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headerRight: {
    alignItems: 'center',
  },
  liveStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
  },
  liveStatsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.secondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.medium,
    zIndex: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.large,
    fontWeight: 'bold',
  },
  vibestreamsSection: {
    marginVertical: SPACING.large,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  vibestreamCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  cardsList: {
    gap: SPACING.medium,
  },
  cardContainer: {
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginBottom: SPACING.small,
  },
  card: {
    backgroundColor: COLORS.backgroundLight + '60',
    padding: SPACING.medium,
    position: 'relative',
  },
  networkIndicator: {
    width: 3,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  liveIndicator: {
    position: 'absolute',
    top: SPACING.small,
    right: SPACING.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.secondary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardContent: {
    marginLeft: SPACING.small,
    marginRight: SPACING.medium,
  },
  cardHeader: {
    marginBottom: SPACING.small,
  },
  cardTitle: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  creatorName: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  cardMeta: {
    marginBottom: SPACING.small,
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  groupInfo: {
    backgroundColor: COLORS.background + '80',
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    marginBottom: SPACING.small,
  },
  groupInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupInfoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  groupInfoValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  remainingText: {
    color: COLORS.accent,
  },
  joinButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.small,
  },
  joinButtonDisabled: {
    backgroundColor: COLORS.textTertiary,
    opacity: 0.6,
  },
  joinButtonSoldOut: {
    backgroundColor: COLORS.error + '60',
  },
  joinButtonText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.background,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textSecondary,
    marginTop: SPACING.large,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
    marginTop: SPACING.small,
    letterSpacing: 1,
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary + '40',
    marginTop: SPACING.xl,
  },
  brandText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
});

export default LiveVibes;
