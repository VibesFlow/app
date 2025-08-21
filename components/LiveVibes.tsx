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
  Modal,
  TextInput,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useWallet } from '../context/connector';
import { liveVibestreamsTracker, LiveVibestreamsData, LiveVibestream } from '../services/LiveTracker';
import { ProfileLoader } from '../services/ProfileLoader';
import { participantTrackingService } from '../services/participant';

const { width, height } = Dimensions.get('window');



interface LiveVibesProps {
  onBack: () => void;
  onJoinVibestream: (vibeId: string, creator: string, options?: {
    isParticipant?: boolean;
    streamingUrl?: string;
    hlsUrl?: string;
    isPPMEnabled?: boolean;
    streamPrice?: string;
    authorizedAllowance?: string;
  }) => void;
}

const LiveVibes: React.FC<LiveVibesProps> = ({ onBack, onJoinVibestream }) => {
  const { account, connected, getNetworkInfo, signMessage, authorizePPMSpending, joinPPMVibestream } = useWallet();
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
  
  // PPM Allowance Modal State
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [selectedVibestream, setSelectedVibestream] = useState<LiveVibestream | null>(null);
  const [allowanceAmount, setAllowanceAmount] = useState('10');
  const [approvingAllowance, setApprovingAllowance] = useState(false);
  
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

  // Join vibestream with wallet signature (required for tracking)
  const joinVibestreamWithSignature = async (vibestream: LiveVibestream, ppmAllowanceAmount?: string) => {
    if (!connected || !account) {
      Alert.alert('Wallet Required', 'Please connect your wallet to join vibestreams');
      return;
    }

    const vibeId = vibestream.vibeId;
    const rtaIdToJoin = vibestream.rtaId || vibeId;
    
    try {
      console.log(`🎵 Joining vibestream ${rtaIdToJoin} with wallet signature for tracking`);
      
      // For paid vibestreams, purchase ticket first
      if (vibestream.mode === 'group' && vibestream.ticketPrice && vibestream.ticketPrice !== '0') {
        // Use connector's network-aware transaction methods
        const networkInfo = getNetworkInfo();
        if (!networkInfo || networkInfo.type !== 'metis-hyperion') {
          Alert.alert('Network Error', 'Please switch to Metis Hyperion network for paid vibestreams');
          return;
        }
        
        setPurchasingTickets(prev => new Set([...prev, vibeId]));
        
        // TODO: Implement ticket purchase using connector's transaction methods
        Alert.alert('Feature Coming Soon', 'Paid vibestreams will be available soon');
        setPurchasingTickets(prev => {
          const newSet = new Set(prev);
          newSet.delete(vibeId);
          return newSet;
        });
        return;
      }
      
      // Join the vibestream using the participant service
      const result = await participantTrackingService.joinVibestreamAsParticipant(
        rtaIdToJoin,
        account.accountId,
        account.accountId,
        signMessage
      );
      
      if (result.success) {
        console.log(`✅ Joined vibestream ${rtaIdToJoin} as participant`);
        console.log(`🎵 Stream URL: ${result.streamingUrl}`);
        console.log(`📺 HLS URL: ${result.hlsUrl}`);
      
        // Validate streaming URLs before proceeding
        if (!result.streamingUrl && !result.hlsUrl) {
          Alert.alert('Join Failed', 'No streaming URLs provided');
          return;
        }
        
        // Navigate to participant view with streaming URLs and PPM info
        onJoinVibestream(rtaIdToJoin, vibestream.creator, {
          isParticipant: true,
          streamingUrl: result.streamingUrl,
          hlsUrl: result.hlsUrl,
          isPPMEnabled: !!(vibestream.payPerStream && vibestream.streamPrice && vibestream.streamPrice !== '0'),
          streamPrice: vibestream.streamPrice,
          authorizedAllowance: ppmAllowanceAmount || '0' // Pass the authorized amount
        });
      } else {
        Alert.alert('Join Failed', result.error || 'Could not join vibestream');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to join vibestream:', error);
      Alert.alert('Join Failed', 'Could not join vibestream. Please try again.');
    }
  };

  // Handle PPM allowance for pay-per-stream vibestreams
  const handlePPMAllowance = async (vibestream: LiveVibestream) => {
    if (!connected || !account) {
      Alert.alert('Wallet Required', 'Please connect your wallet to join vibestreams');
      return;
    }

    // Check if this is a group mode vibestream with pay-per-stream
    if (vibestream.mode === 'group' && vibestream.payPerStream && vibestream.streamPrice && vibestream.streamPrice !== '0') {
      // Show allowance modal for PPM vibestreams
      setSelectedVibestream(vibestream);
      setAllowanceAmount('10'); // Reset to default
      setShowAllowanceModal(true);
    } else {
      // Regular join flow for free vibestreams
      await joinVibestreamWithSignature(vibestream);
    }
  };

  // Approve PPM spending allowance
  const approvePPMAllowance = async () => {
    if (!selectedVibestream || !connected || !account) return;

    const networkInfo = getNetworkInfo();
    if (!networkInfo || networkInfo.type !== 'metis-hyperion') {
      Alert.alert('Network Error', 'Please switch to Metis Hyperion network for pay-per-stream vibestreams');
      return;
    }

    setApprovingAllowance(true);

    try {
      console.log(`💰 Approving PPM allowance: ${allowanceAmount} tMETIS for vibe ${selectedVibestream.vibeId}`);

      // Step 1: Authorize PPM spending
      const authTxHash = await authorizePPMSpending(selectedVibestream.vibeId, allowanceAmount);
      console.log('✅ PPM allowance authorized:', authTxHash);

      // Step 2: Join PPM vibestream
      const joinTxHash = await joinPPMVibestream(selectedVibestream.vibeId);
      console.log('✅ Joined PPM vibestream:', joinTxHash);

      setShowAllowanceModal(false);
      setApprovingAllowance(false);

      // Store the allowance amount for passing to VibePlayer
      const currentAllowanceAmount = allowanceAmount;
      
      // Join the vibestream after PPM setup
      await joinVibestreamWithSignature(selectedVibestream, currentAllowanceAmount);
      
    } catch (error: any) {
      console.error('❌ Failed to approve PPM allowance:', error);
      Alert.alert('Approval Failed', 'Could not approve spending allowance. Please try again.');
    } finally {
      setApprovingAllowance(false);
    }
  };

  // Free-Wibestreams joining also require wallet signature for proper tracking
  const joinVibestream = async (vibestream: LiveVibestream) => {
    await handlePPMAllowance(vibestream);
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

      {/* PPM Allowance Modal */}
      <Modal
        visible={showAllowanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAllowanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlitchContainer intensity="medium" style={styles.allowanceModal}>
            <View style={styles.modalHeader}>
              <GlitchText text="SPENDING ALLOWANCE" style={styles.modalTitle} />
              <TouchableOpacity 
                onPress={() => setShowAllowanceModal(false)}
                style={styles.modalCloseButton}
              >
                <FontAwesome5 name="times" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                This vibestream charges {selectedVibestream?.streamPrice} tMETIS per minute.
                Set your spending allowance:
              </Text>

              <View style={styles.allowanceInputContainer}>
                <TextInput
                  style={styles.allowanceInput}
                  value={allowanceAmount}
                  onChangeText={setAllowanceAmount}
                  placeholder="10"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="numeric"
                />
                <Text style={styles.allowanceCurrency}>tMETIS</Text>
              </View>

              <View style={styles.allowanceInfo}>
                <Text style={styles.allowanceInfoText}>
                  ≈ {Math.floor(parseFloat(allowanceAmount || '0') / parseFloat(selectedVibestream?.streamPrice || '1'))} MINUTES
                </Text>
                <Text style={styles.allowanceWarning}>
                  This amount will be authorized for spending on this vibestream only.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowAllowanceModal(false)}
                >
                  <Text style={styles.modalCancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalApproveButton, approvingAllowance && styles.modalButtonDisabled]}
                  onPress={approvePPMAllowance}
                  disabled={approvingAllowance}
                >
                  {approvingAllowance ? (
                    <View style={styles.modalLoadingContainer}>
                      <ActivityIndicator size="small" color={COLORS.background} />
                      <Text style={styles.modalApproveText}>APPROVING...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalApproveText}>APPROVE & JOIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </GlitchContainer>
        </View>
      </Modal>
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
  // PPM Allowance Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.large,
  },
  allowanceModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '40',
  },
  modalTitle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  modalContent: {
    padding: SPACING.large,
  },
  modalDescription: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.large,
    textAlign: 'center',
    letterSpacing: 1,
  },
  allowanceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.medium,
  },
  allowanceInput: {
    flex: 1,
    padding: SPACING.medium,
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  allowanceCurrency: {
    padding: SPACING.medium,
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    fontWeight: 'bold',
    letterSpacing: 1,
    backgroundColor: COLORS.primary + '20',
  },
  allowanceInfo: {
    alignItems: 'center',
    marginBottom: SPACING.large,
  },
  allowanceInfoText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.accent,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: SPACING.small,
  },
  allowanceWarning: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.medium,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.medium,
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textTertiary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalApproveButton: {
    flex: 2,
    paddingVertical: SPACING.medium,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
  },
  modalApproveText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.background,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
  },
});

export default LiveVibes;
