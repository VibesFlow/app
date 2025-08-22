import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useFilCDN } from '../context/filcdn';
import { ProfileLoader } from '../services/ProfileLoader';
import { ContinuousAudioStreamer } from '../services/AudioStreamer';
import { useWallet } from '../context/connector';
import SubscribeModal from './SubscribeModal';

const { width, height } = Dimensions.get('window');

interface VibeMarketProps {
  onBack: () => void;
  onOpenPlayback?: (rtaId: string) => void;
}

interface FilterState {
  network: 'all' | 'metis' | 'near';
  creator: string;
  date: 'today' | 'week' | 'month' | 'all';
}

interface PreviewPlayer {
  isPlaying: boolean;
  currentRTA: string | null;
  stopPreview: (() => void) | null;
}

const VibeMarket: React.FC<VibeMarketProps> = ({ onBack, onOpenPlayback }) => {
  const { 
    vibestreams, 
    loading, 
    error, 
    isConnected,
    networkType,
    currentAddress,
    refreshVibestreams 
  } = useFilCDN();
  
  const { 
    account, 
    connected, 
    isUserSubscribed,
    getNetworkInfo 
  } = useWallet();

  const [filters, setFilters] = useState<FilterState>({
    network: 'all',
    creator: '',
    date: 'all'
  });
  
  const [player, setPlayer] = useState<PreviewPlayer>({
    isPlaying: false,
    currentRTA: null,
    stopPreview: null
  });

  // Subscription state (only for Metis users)
  const [subscribeModalVisible, setSubscribeModalVisible] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isSubscribed: boolean;
    isLoading: boolean;
    requiresSubscription: boolean;
  }>({
    isSubscribed: false,
    isLoading: false,
    requiresSubscription: false
  });

  const playerRef = useRef<PreviewPlayer>(player);
  const profileLoader = useRef<ProfileLoader>(new ProfileLoader());
  const audioStreamer = useRef<ContinuousAudioStreamer>(new ContinuousAudioStreamer());
  
  playerRef.current = player;

  // Load vibestreams when connected or on mount
  useEffect(() => {
    if (isConnected || vibestreams.length === 0) {
      refreshVibestreams();
    }
  }, [isConnected]);

  // Check subscription status for Metis users
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!connected || !account) {
        setSubscriptionStatus({
          isSubscribed: false,
          isLoading: false,
          requiresSubscription: false
        });
        return;
      }

      const networkInfo = getNetworkInfo();
      
      // Only check subscription for Metis Hyperion network
      if (networkInfo?.type === 'metis-hyperion') {
        setSubscriptionStatus(prev => ({ ...prev, isLoading: true, requiresSubscription: true }));
        
        try {
          const isSubscribed = await isUserSubscribed();
          setSubscriptionStatus({
            isSubscribed,
            isLoading: false,
            requiresSubscription: true
          });

          console.log(`🔐 Metis user subscription status: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`);
        } catch (error) {
          console.error('❌ Failed to check subscription status:', error);
          setSubscriptionStatus({
            isSubscribed: false,
            isLoading: false,
            requiresSubscription: true
          });
        }
      } else {
        // For non-Metis networks, no subscription required
        setSubscriptionStatus({
          isSubscribed: true, // Allow access
          isLoading: false,
          requiresSubscription: false
        });
      }
    };

    checkSubscriptionStatus();
  }, [connected, account, isUserSubscribed, getNetworkInfo]);

  // Preload creator profiles when vibestreams change
  useEffect(() => {
    const loadCreatorProfiles = async () => {
      if (vibestreams.length === 0) return;
      
      const uniqueCreators = [...new Set(vibestreams.map(stream => stream.creator))];
      
      // Use ProfileLoader's efficient preloading
      await profileLoader.current.preloadProfiles(uniqueCreators);
      
      // ProfileLoader handles caching internally, no need to update state
    };
    
    loadCreatorProfiles();
  }, [vibestreams]);

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (player.stopPreview) {
        player.stopPreview();
      }
      audioStreamer.current?.dispose();
    };
  }, [player.stopPreview]);

  // Simple preview playback using proper AudioStreamer service
  const togglePreview = useCallback(async (stream: any) => {
    try {
      if (player.currentRTA === stream.rta_id && player.isPlaying) {
        // Stop current preview
        if (player.stopPreview) {
          player.stopPreview();
        }
        setPlayer({
          isPlaying: false,
          currentRTA: null,
          stopPreview: null
        });
        return;
      }

      // Stop any existing preview
      if (player.stopPreview) {
        player.stopPreview();
      }

      // Get first chunk for preview
      const firstChunk = stream.chunks_detail?.[0];
      if (!firstChunk) {
        Alert.alert('No Audio', 'No chunks available for preview');
        return;
      }

      console.log('🎵 Starting preview for:', stream.rta_id);

      if (Platform.OS === 'web' && audioStreamer.current) {
        // Use FilCDN URL if available, fallback to proxy
        const audioUrl = firstChunk.filcdn_url || firstChunk.url;
        
        // Start preview using AudioStreamer service
        const stopPreview = await audioStreamer.current.playPreview(audioUrl, 0.6);

        setPlayer({
          isPlaying: true,
          currentRTA: stream.rta_id,
          stopPreview
        });

        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (playerRef.current.currentRTA === stream.rta_id && playerRef.current.isPlaying) {
            stopPreview();
            setPlayer(prev => ({
              ...prev,
              isPlaying: false,
              currentRTA: null,
              stopPreview: null
            }));
          }
        }, 30000);
      }
    } catch (error) {
      console.error('❌ Preview toggle failed:', error);
      Alert.alert('Error', 'Failed to toggle preview');
    }
  }, [player]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date helper
  const formatDate = (timestamp: number): string => {
    let date: Date;
    
    if (timestamp > 1e12) {
      date = new Date(timestamp);
    } else if (timestamp > 1e9) {
      date = new Date(timestamp * 1000);
    } else {
      date = new Date();
    }
    
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    return date.toLocaleDateString('en-US', options).toUpperCase();
  };

  // Network detection helper
  const getNetworkFromRtaId = (rtaId: string): 'metis' | 'near' => {
    const upperRtaId = rtaId.toUpperCase();
    
    if (upperRtaId.startsWith('METIS_') || upperRtaId.includes('METIS')) {
      return 'metis';
    }
    return 'near';
  };

  // Title extraction helper
  const getVibestreamTitle = (stream: any): string => {
    const rtaId = stream.rta_id;
    
    if (rtaId.toUpperCase().startsWith('METIS_VIBE_')) {
      return rtaId.substring(11);
    } else if (rtaId.toUpperCase().startsWith('METIS_')) {
      return rtaId.substring(6);
    } else if (rtaId.toUpperCase().startsWith('RTA_ID_')) {
      return rtaId.substring(7);
    } else if (rtaId.toUpperCase().startsWith('RTA_')) {
      return rtaId.substring(4);
    }
    
    return rtaId.toUpperCase();
  };

  // Creator display name helper (using ProfileLoader cache)
  const getDisplayName = useCallback((creator: string): string => {
    // ProfileLoader handles caching internally, no need for local state
    const cached = profileLoader.current.getDisplayName(creator);
    if (cached) return cached;
    
    // Fallback formatting
    if (creator.startsWith('0x')) {
      return `${creator.slice(0, 5)}...${creator.slice(-6)}`;
    }
    return creator;
  }, []);

  // Handle subscription success
  const handleSubscriptionSuccess = useCallback(() => {
    setSubscriptionStatus({
      isSubscribed: true,
      isLoading: false,
      requiresSubscription: true
    });
    setSubscribeModalVisible(false);
  }, []);

  // Handle subscription modal close
  const handleSubscribeModalClose = useCallback(() => {
    setSubscribeModalVisible(false);
  }, []);

  // Filter vibestreams
  const filteredVibestreams = vibestreams.filter(stream => {
    // Network filter
    if (filters.network !== 'all') {
      const streamNetwork = getNetworkFromRtaId(stream.rta_id);
      if (streamNetwork !== filters.network) return false;
    }

    // Creator filter
    if (filters.creator && !stream.creator.toLowerCase().includes(filters.creator.toLowerCase())) {
      return false;
    }

    // Date filter
    if (filters.date !== 'all') {
      const timestamp = stream.upload_timestamp;
      let streamDate: Date;
      
      if (timestamp > 1e12) {
        streamDate = new Date(timestamp);
      } else if (timestamp > 1e9) {
        streamDate = new Date(timestamp * 1000);
      } else {
        return true;
      }
      
      const now = new Date();
      const diffMs = now.getTime() - streamDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      switch (filters.date) {
        case 'today':
          if (diffDays > 0) return false;
          break;
        case 'week':
          if (diffDays > 7) return false;
          break;
        case 'month':
          if (diffDays > 30) return false;
          break;
      }
    }

    return true;
  });

  // Minimal vibestream card renderer
  const renderVibestreamCard = (stream: any, index: number) => {
    const isPlaying = player.currentRTA === stream.rta_id && player.isPlaying;
    const network = getNetworkFromRtaId(stream.rta_id);
    const title = getVibestreamTitle(stream);
    const displayName = getDisplayName(stream.creator);
    
    return (
      <GlitchContainer key={stream.rta_id} intensity="low" style={styles.cardContainer}>
        <TouchableOpacity 
          style={styles.card}
          onPress={() => onOpenPlayback?.(stream.rta_id)}
          activeOpacity={0.8}
        >
          {/* Network indicator */}
          <View style={[styles.networkIndicator, { 
            backgroundColor: network === 'metis' ? COLORS.accent : COLORS.secondary 
          }]} />
          
          {/* Main content */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <GlitchText text={title} style={styles.cardTitle} />
              <TouchableOpacity 
                style={styles.previewButton}
                onPress={(e) => {
                  e.stopPropagation();
                  togglePreview(stream);
                }}
              >
                <FontAwesome5 
                  name={isPlaying ? "stop" : "play"} 
                  size={12} 
                  color={COLORS.background} 
                  style={!isPlaying ? { marginLeft: 1 } : {}}
                />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.creatorName}>{displayName}</Text>
            
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{stream.chunks} CHUNKS</Text>
              <Text style={styles.metaText}>{stream.rta_duration}</Text>
              <Text style={styles.metaText}>{formatDate(stream.upload_timestamp)}</Text>
            </View>
          </View>
        </TouchableOpacity>
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
        <GlitchText text="VIBE MARKET" style={styles.title} />
        <View style={styles.headerRight}>
          {isConnected && currentAddress && (
            <View style={styles.connectionStatus}>
              <View style={[styles.connectionDot, { 
                backgroundColor: networkType === 'metis' ? COLORS.accent : COLORS.secondary 
              }]} />
              <Text style={styles.connectionText}>
                {networkType?.toUpperCase() || 'CONNECTED'}
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={refreshVibestreams} style={styles.refreshButton}>
            <FontAwesome5 name="sync-alt" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Warning */}
      {!isConnected && (
        <GlitchContainer intensity="medium" style={styles.warningContainer}>
          <FontAwesome5 name="exclamation-triangle" size={24} color={COLORS.accent} />
          <Text style={styles.warningText}>WALLET NOT CONNECTED</Text>
          <Text style={styles.warningSubtext}>
            Connect your wallet to access all features
          </Text>
        </GlitchContainer>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* Network filter */}
          <TouchableOpacity 
            style={[styles.filterChip, filters.network !== 'all' && styles.activeFilterChip]}
            onPress={() => setFilters(prev => ({
              ...prev, 
              network: prev.network === 'all' ? 'metis' : prev.network === 'metis' ? 'near' : 'all'
            }))}
          >
            <Text style={[styles.filterText, filters.network !== 'all' && styles.activeFilterText]}>
              {filters.network === 'all' ? 'ALL NETWORKS' : filters.network.toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Date filter */}
          <TouchableOpacity 
            style={[styles.filterChip, filters.date !== 'all' && styles.activeFilterChip]}
            onPress={() => setFilters(prev => ({
              ...prev,
              date: prev.date === 'all' ? 'today' : prev.date === 'today' ? 'week' : prev.date === 'week' ? 'month' : 'all'
            }))}
          >
            <Text style={[styles.filterText, filters.date !== 'all' && styles.activeFilterText]}>
              {filters.date === 'all' ? 'ALL TIME' : filters.date.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subscription Gate for Metis Users */}
        {subscriptionStatus.requiresSubscription && !subscriptionStatus.isSubscribed && !subscriptionStatus.isLoading && (
          <GlitchContainer intensity="medium" style={styles.subscriptionGate}>
            <FontAwesome5 name="lock" size={32} color={COLORS.accent} />
            <Text style={styles.gateTitle}>PREMIUM ACCESS REQUIRED</Text>
            <Text style={styles.gateSubtext}>
              Access all DJ sets ever created on Metis Hyperion for just 10 tMETIS per month!
            </Text>
            <TouchableOpacity 
              style={styles.subscribeButton}
              onPress={() => setSubscribeModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.subscribeButtonText}>SUBSCRIBE NOW</Text>
            </TouchableOpacity>
          </GlitchContainer>
        )}

        {/* Subscription Loading State */}
        {subscriptionStatus.isLoading && (
          <GlitchContainer intensity="medium" style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.loadingText}>CHECKING SUBSCRIPTION...</Text>
          </GlitchContainer>
        )}

        {/* Loading State */}
        {loading && subscriptionStatus.isSubscribed && (
          <GlitchContainer intensity="medium" style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>SCANNING FREQUENCIES...</Text>
          </GlitchContainer>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-triangle" size={32} color={COLORS.accent} />
            <Text style={styles.errorText}>CONNECTION ERROR</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            <TouchableOpacity onPress={refreshVibestreams} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Vibestreams List - Only show if subscribed or subscription not required */}
        {!loading && !error && subscriptionStatus.isSubscribed && (
          <View style={styles.vibestreamsSection}>
            <View style={styles.sectionHeader}>
              <GlitchText text="LIVE FREQUENCIES" style={styles.sectionTitle} />
              <Text style={styles.vibestreamCount}>{filteredVibestreams.length} ACTIVE</Text>
            </View>

            {filteredVibestreams.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="satellite-dish" size={32} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>NO SIGNALS DETECTED</Text>
                <Text style={styles.emptySubtext}>Adjust filters or check back later</Text>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {filteredVibestreams.map((stream, index) => renderVibestreamCard(stream, index))}
              </View>
            )}
          </View>
        )}

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>DECENTRALIZED FREQUENCIES</Text>
          <Text style={styles.brandText}>POWERED BY FILCDN</Text>
        </View>
      </ScrollView>
      
      {/* Subscribe Modal */}
      <SubscribeModal
        visible={subscribeModalVisible}
        onClose={handleSubscribeModalClose}
        onSubscriptionSuccess={handleSubscriptionSuccess}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  warningContainer: {
    margin: SPACING.medium,
    padding: SPACING.medium,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent + '60',
    zIndex: 2,
  },
  warningText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.accent,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: SPACING.small,
  },
  warningSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
    zIndex: 2,
  },
  filterChip: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginRight: SPACING.small,
    backgroundColor: COLORS.backgroundLight + '20',
  },
  activeFilterChip: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  activeFilterText: {
    color: COLORS.primary,
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  errorText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.accent,
    letterSpacing: 2,
    marginTop: SPACING.large,
    fontWeight: 'bold',
  },
  errorSubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.small,
    textAlign: 'center',
    paddingHorizontal: SPACING.large,
  },
  retryButton: {
    marginTop: SPACING.medium,
    paddingHorizontal: SPACING.large,
    paddingVertical: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryButtonText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    letterSpacing: 2,
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
    gap: SPACING.small,
  },
  cardContainer: {
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginBottom: SPACING.small,
  },
  card: {
    backgroundColor: COLORS.backgroundLight + '60',
    padding: SPACING.medium,
    flexDirection: 'row',
    alignItems: 'center',
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
  cardContent: {
    flex: 1,
    marginLeft: SPACING.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardTitle: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    flex: 1,
  },
  previewButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.small,
  },
  creatorName: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: SPACING.medium,
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
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
  subscriptionGate: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    marginVertical: SPACING.large,
    borderWidth: 1,
    borderColor: COLORS.accent + '60',
  },
  gateTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.accent,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: SPACING.large,
    textAlign: 'center',
  },
  gateSubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.small,
    textAlign: 'center',
    paddingHorizontal: SPACING.large,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    marginTop: SPACING.large,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  subscribeButtonText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.background,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

export default VibeMarket;