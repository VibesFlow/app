import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { PINATA_URL } from '@env';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import AuthenticatedImage from './ui/ProfilePic';
import { useFilCDN } from '../context/filcdn';
import RTAPlayer from './RTAPlayer';

const { width, height } = Dimensions.get('window');

interface VibeMarketProps {
  onBack: () => void;
}

const VibeMarket: React.FC<VibeMarketProps> = ({ onBack }) => {
  const { 
    vibestreams, 
    loading, 
    error, 
    refreshVibestreams, 
    downloadChunk,
    getVibestreamsByCreator 
  } = useFilCDN();

  // RTA Player state
  const [selectedRTA, setSelectedRTA] = useState<string | null>(null);
  const [showRTAPlayer, setShowRTAPlayer] = useState(false);

  useEffect(() => {
    // Refresh vibestreams when component mounts
    refreshVibestreams();
  }, []);

  const renderVibestreamCard = (stream: any, index: number) => (
    <GlitchContainer key={stream.rta_id} intensity="low" style={styles.cardContainer}>
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleStreamSelect(stream)}
        activeOpacity={0.8}
      >
        {/* Creator Profile Section */}
        <View style={styles.creatorSection}>
          <View style={styles.profileImageContainer}>
            {stream.user_profile_image ? (
              <AuthenticatedImage 
                ipfsHash={stream.user_profile_image}
                style={styles.profileImage}
                placeholder={
                  <View style={styles.profileImagePlaceholder}>
                    <FontAwesome5 name="user-astronaut" size={20} color={COLORS.primary} />
                  </View>
                }
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <FontAwesome5 name="user-astronaut" size={20} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.profileImageBorder} />
          </View>
          
          <View style={styles.creatorInfo}>
            <GlitchText text={stream.creator} style={styles.creatorName} />
            <Text style={styles.creatorLabel}>CREATOR</Text>
          </View>
        </View>

        {/* Vibestream Info */}
        <View style={styles.streamInfo}>
          <GlitchText text={stream.rta_id.toUpperCase()} style={styles.rtaId} />
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="clock" size={14} color={COLORS.accent} />
              <Text style={styles.statText}>{stream.rta_duration}</Text>
            </View>
            
            <View style={styles.statItem}>
              <FontAwesome5 name="layer-group" size={14} color={COLORS.accent} />
              <Text style={styles.statText}>{stream.chunks} chunks</Text>
            </View>
            
            <View style={styles.statItem}>
              <FontAwesome5 
                name={stream.is_complete ? "check-circle" : "hourglass-half"} 
                size={14} 
                color={stream.is_complete ? COLORS.secondary : COLORS.primary} 
              />
              <Text style={[
                styles.statText,
                { color: stream.is_complete ? COLORS.secondary : COLORS.primary }
              ]}>
                {stream.is_complete ? "COMPLETE" : "STREAMING"}
              </Text>
            </View>
          </View>

          {/* Storage Info */}
          <View style={styles.storageRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="database" size={14} color={COLORS.textTertiary} />
              <Text style={styles.statText}>{stream.total_size_mb.toFixed(1)}MB</Text>
            </View>
            
            <View style={styles.statItem}>
              <FontAwesome5 name="shield-alt" size={14} color={COLORS.textTertiary} />
              <Text style={styles.statText}>PDP #{stream.synapse_proof_set_id}</Text>
            </View>
          </View>
        </View>

        {/* FilCDN Status */}
        <View style={styles.filcdnSection}>
          <FontAwesome5 name="globe" size={12} color={COLORS.textTertiary} />
          <View style={styles.filcdnIndicator} />
        </View>
      </TouchableOpacity>
    </GlitchContainer>
  );

  const handleStreamSelect = async (stream: any) => {
    console.log('🎵 Selected vibestream:', stream.rta_id);
    
    Alert.alert(
      'Vibestream Playback',
      `Play "${stream.rta_id}" with ${stream.chunks} chunks?\n\nCreator: ${stream.creator}\nDuration: ${stream.rta_duration}\nProof Set: ${stream.synapse_proof_set_id}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Info', 
          onPress: () => {
            Alert.alert(
              'RTA Details',
              `RTA ID: ${stream.rta_id}\nCreator: ${stream.creator}\nDuration: ${stream.rta_duration}\nChunks: ${stream.chunks}\nStatus: ${stream.is_complete ? 'Complete' : 'Streaming'}\nStorage: ${stream.total_size_mb.toFixed(1)}MB\nProof Set: ${stream.synapse_proof_set_id}\n\nFilCDN Base: ${stream.filcdn_base}`
            );
          }
        },
        {
          text: 'Play RTA',
          onPress: () => {
            setSelectedRTA(stream.rta_id);
            setShowRTAPlayer(true);
          }
        }
      ]
    );
  };

  const handleRefresh = () => {
    console.log('🔄 Refreshing vibestreams...');
    refreshVibestreams();
  };

  const handleRTAPlayerBack = () => {
    setShowRTAPlayer(false);
    setSelectedRTA(null);
  };

  const handleRTAPlayerError = (error: string) => {
    Alert.alert('Playback Error', error);
    setShowRTAPlayer(false);
    setSelectedRTA(null);
  };

  // Show RTA Player if selected
  if (showRTAPlayer && selectedRTA) {
    return (
      <RTAPlayer 
        rtaId={selectedRTA} 
        onBack={handleRTAPlayerBack}
        onError={handleRTAPlayerError}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Glitch lines background */}
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <GlitchText text="VIBE MARKET" style={styles.title} />
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <FontAwesome5 name="sync-alt" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Market Header */}
        <View style={styles.marketHeader}>
          <GlitchText text="VIBE MARKET" style={styles.marketTitle} />
          <Text style={styles.marketSubtitle}>DECENTRALIZED • PROOF SETS • FILCDN</Text>
          <Text style={styles.networkInfo}>CALIBRATION NETWORK</Text>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-triangle" size={48} color={COLORS.accent} />
            <Text style={styles.errorText}>CONNECTION ERROR</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {loading && !error && (
          <GlitchContainer intensity="medium" style={styles.loadingContainer}>
            <FontAwesome5 name="spinner" size={48} color={COLORS.primary} />
            <Text style={styles.loadingText}>SYNAPSE SDK LOADING...</Text>
          </GlitchContainer>
        )}

        {/* Vibestreams Grid */}
        {!loading && !error && (
          <View style={styles.vibestreamsSection}>
            <View style={styles.sectionHeader}>
              <GlitchText text="LIVE VIBESTREAMS" style={styles.sectionTitle} />
              <Text style={styles.vibestreamCount}>{vibestreams.length} STREAMS</Text>
            </View>

            {vibestreams.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="satellite-dish" size={48} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No vibestreams found in proof sets</Text>
                <Text style={styles.emptySubtext}>Create your first vibestream to see it here</Text>
              </View>
            ) : (
              vibestreams.map((stream, index) => renderVibestreamCard(stream, index))
            )}
          </View>
        )}

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>DECENTRALIZED FREQUENCIES</Text>
          <Text style={styles.brandText}>COLLECTIVE RESONANCE</Text>
          <Text style={styles.brandText}>POWERED BY FILCDN</Text>
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
  refreshButton: {
    padding: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  title: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.xl : FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.medium,
    zIndex: 2,
  },
  marketHeader: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
    paddingVertical: SPACING.large,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary + '40',
  },
  marketTitle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: SPACING.small,
  },
  marketSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
  },
  networkInfo: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.large,
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
    letterSpacing: 3,
  },
  vibestreamCount: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  cardContainer: {
    marginBottom: SPACING.medium,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  card: {
    padding: SPACING.medium,
    backgroundColor: COLORS.backgroundLight + '60',
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.medium,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: SPACING.medium,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 2,
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageBorder: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  creatorLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  streamInfo: {
    marginBottom: SPACING.medium,
  },
  rtaId: {
    fontSize: FONT_SIZES.large,
    color: COLORS.secondary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: SPACING.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.small,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filcdnSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.small,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
  },
  filcdnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginLeft: SPACING.xs,
    letterSpacing: 1,
    flex: 1,
  },
  filcdnIndicator: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.secondary,
    marginLeft: SPACING.small,
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
  },
  emptySubtext: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
    marginTop: SPACING.small,
    letterSpacing: 1,
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
  infoSection: {
    padding: SPACING.medium,
    backgroundColor: COLORS.backgroundLight + '40',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginVertical: SPACING.large,
  },
  infoTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: SPACING.medium,
  },
  infoText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    lineHeight: 20,
    marginBottom: SPACING.xs,
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

export default VibeMarket; 