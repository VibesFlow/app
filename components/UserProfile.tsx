import React, { useState, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import { useWallet } from '../context/connector';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import VibestreamModal from './VibestreamModal';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

// Pinata configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY || process.env.EXPO_PUBLIC_PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET || process.env.EXPO_PUBLIC_PINATA_SECRET;
const PINATA_URL = process.env.PINATA_URL || process.env.EXPO_PUBLIC_PINATA_URL || 'vibesflow.mypinata.cloud';

interface UserProfileProps {
  accountId: string;
  onCreateVibestream: (rtaId?: string, config?: any) => void;
  onBack: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  accountId, 
  onCreateVibestream,
  onBack 
}) => {
  const { 
    account, 
    getNetworkInfo, 
    getUserVibestreams, 
    getUserVibestreamCount 
  } = useWallet();
  const [vibestreams, setVibestreams] = useState<any[]>([]);
  const [vibestreamCount, setVibestreamCount] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingVibestreams, setLoadingVibestreams] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);

  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    const networkInfo = getNetworkInfo();
    if (networkInfo?.type === 'metis-hyperion' && address.startsWith('0x')) {
      // Metis format: [first-5]...[last-6]
      return `${address.slice(0, 5)}...${address.slice(-6)}`;
    }
    // NEAR format: keep as is
    return address;
  };

  // Load saved profile data on component mount
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        if (Platform.OS === 'web') {
          const savedImageHash = localStorage.getItem(`vibesflow_profile_${accountId}`);
          if (savedImageHash) {
            setProfileImageUri(`https://${PINATA_URL}/ipfs/${savedImageHash}`);
          }
          
          const savedName = localStorage.getItem(`vibesflow_name_${accountId}`);
          if (savedName) {
            setDisplayName(savedName);
          } else {
            setDisplayName(formatWalletAddress(accountId));
          }

          const savedBio = localStorage.getItem(`vibesflow_bio_${accountId}`);
          if (savedBio) {
            setBio(savedBio);
          }
        }
      } catch (error) {
        console.warn('Failed to load profile data:', error);
      }
    };
    loadProfileData();
    fetchVibestreams();
  }, [accountId, account]); // Also re-fetch when account changes

  // Refresh handler for manual updates
  const handleRefreshVibestreams = () => {
    console.log('🔄 Manually refreshing user vibestreams...');
    fetchVibestreams();
  };

  // Fetch vibestreams from contracts with cross-matched FilCDN data
  const fetchVibestreams = async () => {
    if (!account) {
      setVibestreams([]);
      setVibestreamCount(0);
      return;
    }

    try {
      setLoadingVibestreams(true);
      console.log('📊 Fetching user vibestreams for profile...');
      
      // Fetch on-chain vibestreams with cross-matched FilCDN data
      const userVibestreams = await getUserVibestreams();
      const count = await getUserVibestreamCount();
      
      console.log(`✅ Found ${userVibestreams.length} vibestreams for user profile`);
      
      setVibestreams(userVibestreams);
      setVibestreamCount(count);
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch vibestreams for profile:', error);
      setVibestreams([]);
      setVibestreamCount(0);
    } finally {
      setLoadingVibestreams(false);
    }
  };

  const uploadToPinata = async (imageUri: string) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      const filename = `profile_${accountId}_${Date.now()}.jpg`;
      
      if (Platform.OS === 'web') {
        // Web implementation
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        // Mobile implementation
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: filename,
        } as any);
      }

      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          userId: accountId,
          type: 'profile_image'
        }
      });
      formData.append('pinataMetadata', metadata);

      if (!PINATA_API_KEY || !PINATA_API_SECRET) {
        throw new Error('Pinata credentials not configured');
      }

      const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
        },
        body: formData,
      });

      const result = await pinataResponse.json();
      
      if (result.IpfsHash) {
        const ipfsUrl = `https://${PINATA_URL}/ipfs/${result.IpfsHash}`;
        setProfileImageUri(ipfsUrl);
        
        // Save hash to local storage
        if (Platform.OS === 'web') {
          localStorage.setItem(`vibesflow_profile_${accountId}`, result.IpfsHash);
        }
        
        console.log('Profile image uploaded to IPFS:', result.IpfsHash);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Upload Failed', 'Could not upload profile image');
    } finally {
      setUploading(false);
    }
  };

  // Save profile data to Pinata
  const saveProfileDataToPinata = async (name: string, bioText: string) => {
    try {
      if (!PINATA_API_KEY || !PINATA_API_SECRET) {
        console.warn('⚠️ Pinata credentials not found, saving locally only');
        if (Platform.OS === 'web') {
          localStorage.setItem(`vibesflow_name_${accountId}`, name);
          localStorage.setItem(`vibesflow_bio_${accountId}`, bioText);
        }
        return;
      }

      const profileData = {
        userId: accountId,
        displayName: name,
        bio: bioText,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_API_SECRET,
        },
        body: JSON.stringify({
          pinataContent: profileData,
          pinataMetadata: {
            name: `vibesflow-profile-${accountId}.json`,
            keyvalues: {
              userId: accountId,
              type: 'profile_data'
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Profile data uploaded to Pinata:', result.IpfsHash);
        
        // Also save locally for faster access
        if (Platform.OS === 'web') {
          localStorage.setItem(`vibesflow_name_${accountId}`, name);
          localStorage.setItem(`vibesflow_bio_${accountId}`, bioText);
          localStorage.setItem(`vibesflow_profile_data_${accountId}`, result.IpfsHash);
        }
      } else {
        throw new Error('Failed to upload to Pinata');
      }
    } catch (error) {
      console.warn('⚠️ Failed to upload to Pinata, saving locally:', error);
      if (Platform.OS === 'web') {
        localStorage.setItem(`vibesflow_name_${accountId}`, name);
        localStorage.setItem(`vibesflow_bio_${accountId}`, bioText);
      }
    }
  };

  const selectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadToPinata(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image selection failed:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const openVibestreamModal = () => {
    setModalVisible(true);
  };

  // Calculate total duration from all vibestreams
  const calculateTotalDuration = (streams: any[]): string => {
    if (!streams || streams.length === 0) return "0:00:00";
    
    let totalSeconds = 0;
    
    streams.forEach(stream => {
      if (stream.filcdn_duration) {
        // Parse duration in "MM:SS" format
        const parts = stream.filcdn_duration.split(':');
        if (parts.length === 2) {
          const minutes = parseInt(parts[0], 10) || 0;
          const seconds = parseInt(parts[1], 10) || 0;
          totalSeconds += minutes * 60 + seconds;
        }
      }
    });
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVibestreamGrid = () => (
    <GlitchContainer intensity="low" style={styles.gridContainer}>
      {loadingVibestreams ? (
        <View style={styles.gridPlaceholder}>
          <FontAwesome5 name="spinner" size={width * 0.06} color={COLORS.primary} />
          <GlitchText text="LOADING VIBESTREAMS..." style={styles.createText} />
        </View>
      ) : vibestreams.length === 0 ? (
        <TouchableOpacity style={styles.gridPlaceholder} onPress={openVibestreamModal}>
          <View style={styles.plusIcon}>
            <FontAwesome5 name="plus" size={width * 0.06} color={COLORS.primary} />
          </View>
          <GlitchText text="CREATE VIBESTREAM" style={styles.createText} />
        </TouchableOpacity>
      ) : (
        <View style={styles.vibestreamsList}>
          {vibestreams.map((stream, index) => (
            <View key={stream.vibeId || index} style={styles.gridItem}>
              <View style={styles.vibestreamHeader}>
                <GlitchText 
                  text={`${stream.rtaId.toUpperCase()}`} 
                  style={styles.vibestreamTitle} 
                />
                <Text style={[
                  styles.vibestreamStatus,
                  { color: stream.is_closed ? COLORS.secondary : COLORS.primary }
                ]}>
                  {stream.is_closed ? "COMPLETE" : "ACTIVE"}
                </Text>
              </View>
              
              <View style={styles.vibestreamInfo}>
                <View style={styles.vibestreamStat}>
                  <FontAwesome5 name="clock" size={12} color={COLORS.accent} />
                  <Text style={styles.vibestreamStatText}>
                    {stream.filcdn_duration || "0:00"}
                  </Text>
                </View>
                
                <View style={styles.vibestreamStat}>
                  <FontAwesome5 name="layer-group" size={12} color={COLORS.accent} />
                  <Text style={styles.vibestreamStatText}>
                    {stream.total_chunks || 0} chunks
                  </Text>
                </View>
                
                <View style={styles.vibestreamStat}>
                  <FontAwesome5 name="database" size={12} color={COLORS.accent} />
                  <Text style={styles.vibestreamStatText}>
                    {stream.filcdn_size_mb ? `${stream.filcdn_size_mb.toFixed(1)}MB` : "0MB"}
                  </Text>
                </View>
              </View>
              
              <View style={styles.vibestreamFooter}>
                <Text style={styles.vibestreamMode}>
                  {(stream.mode || 'solo').toUpperCase()}
                </Text>
                <Text style={styles.vibestreamDate}>
                  {stream.created_at ? new Date(stream.created_at * 1000).toLocaleDateString() : ""}
                </Text>
              </View>
            </View>
          ))}
          
          {/* Add new vibestream button */}
          <TouchableOpacity style={styles.addVibestreamButton} onPress={openVibestreamModal}>
            <View style={styles.plusIcon}>
              <FontAwesome5 name="plus" size={width * 0.04} color={COLORS.primary} />
            </View>
            <Text style={styles.addVibestreamText}>ADD NEW</Text>
          </TouchableOpacity>
          </View>
      )}
    </GlitchContainer>
  );

  return (
    <View style={styles.container}>
      {/* Glitch lines background */}
      <GlitchContainer glitchOnly intensity="low" style={styles.backgroundGlitch} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <GlitchText text="PROFILE" style={styles.title} />
        <TouchableOpacity 
          onPress={handleRefreshVibestreams} 
          style={styles.refreshButton}
          disabled={loadingVibestreams}
        >
          <FontAwesome5 
            name={loadingVibestreams ? "spinner" : "sync-alt"} 
            size={20} 
            color={COLORS.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <GlitchContainer 
          animated={uploading} 
          intensity="medium"
          style={styles.profileContainer}
        >
          <TouchableOpacity onPress={selectImage} style={styles.profileImageContainer}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <FontAwesome5 name="user-astronaut" size={width * 0.08} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.profileImageBorder} />
          </TouchableOpacity>
          
          {editingName ? (
            <TextInput
              style={styles.usernameInput}
              value={displayName}
              onChangeText={setDisplayName}
              onBlur={() => {
                setEditingName(false);
                saveProfileDataToPinata(displayName, bio);
              }}
              onSubmitEditing={() => {
                setEditingName(false);
                saveProfileDataToPinata(displayName, bio);
              }}
              autoFocus
              maxLength={30}
              placeholder="Enter display name"
              placeholderTextColor={COLORS.textSecondary}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <GlitchText 
                text={displayName || formatWalletAddress(accountId)} 
                style={styles.username} 
              />
            </TouchableOpacity>
          )}
          
          {editingBio ? (
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              onBlur={() => {
                setEditingBio(false);
                saveProfileDataToPinata(displayName, bio);
              }}
              onSubmitEditing={() => {
                setEditingBio(false);
                saveProfileDataToPinata(displayName, bio);
              }}
              autoFocus
              maxLength={100}
              placeholder="Add a bio..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingBio(true)}>
              <Text style={styles.userBio}>
                {bio || 'Add a bio...'}
              </Text>
            </TouchableOpacity>
          )}
        </GlitchContainer>
        
        {/* Stats Container */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <GlitchText text={vibestreamCount.toString()} style={styles.statValue} />
            <Text style={styles.statLabel}>VIBESTREAMS</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statItem}>
            <GlitchText 
              text={calculateTotalDuration(vibestreams)} 
              style={styles.statValue} 
            />
            <Text style={styles.statLabel}>TOTAL TIME</Text>
          </View>
        </View>

        {/* Vibestreams Section */}
        <View style={styles.vibestreamsSection}>
          <GlitchText text="YOUR VIBESTREAMS" style={styles.sectionTitle} />
          <Text style={styles.sectionSubtitle}>ARCHIVED • FREQUENCIES • CAPTURED</Text>
          {renderVibestreamGrid()}
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>DECENTRALIZED FREQUENCIES</Text>
          <Text style={styles.brandText}>COLLECTIVE RESONANCE</Text>
          <Text style={styles.brandText}>AUTONOMOUS WAVES</Text>
        </View>
      </ScrollView>

      <VibestreamModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onLaunchVibePlayer={(rtaId: string, config: any) => {
          setModalVisible(false);
          onCreateVibestream(rtaId, config);
        }}
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
  profileContainer: {
    alignItems: 'center',
    marginVertical: SPACING.large,
    paddingVertical: SPACING.large,
    paddingHorizontal: SPACING.medium,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: SPACING.large,
  },
  profileImage: {
    width: Platform.OS === 'web' ? width * 0.2 : width * 0.3,
    height: Platform.OS === 'web' ? width * 0.2 : width * 0.3,
    maxWidth: 150,
    maxHeight: 150,
  },
  profileImagePlaceholder: {
    width: Platform.OS === 'web' ? width * 0.2 : width * 0.3,
    height: Platform.OS === 'web' ? width * 0.2 : width * 0.3,
    maxWidth: 150,
    maxHeight: 150,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  username: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.large : FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
    textAlign: 'center',
  },
  usernameInput: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.large : FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SPACING.small,
    backgroundColor: COLORS.backgroundLight + '80',
    minWidth: 200,
  },
  userBio: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  bioInput: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SPACING.small,
    backgroundColor: COLORS.backgroundLight + '80',
    minWidth: 200,
    maxHeight: 60,
  },
  statsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundLight + '80',
    marginVertical: SPACING.medium,
    paddingVertical: SPACING.medium,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: COLORS.primary,
  },
  statValue: {
    fontSize: FONT_SIZES.large,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: SPACING.small,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  vibestreamsSection: {
    marginVertical: SPACING.large,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.medium,
  },
  gridContainer: {
    minHeight: Platform.OS === 'web' ? 200 : 180,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  gridPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  plusIcon: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.medium,
    marginBottom: SPACING.medium,
  },
  createText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  vibestreamsList: {
    paddingVertical: SPACING.small,
  },
  gridItem: {
    width: '100%',
    backgroundColor: COLORS.backgroundLight + '80',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    marginBottom: SPACING.small,
    padding: SPACING.medium,
  },
  vibestreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.small,
  },
  vibestreamTitle: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  vibestreamStatus: {
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  vibestreamInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.small,
  },
  vibestreamStat: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vibestreamStatText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    letterSpacing: 0.5,
  },
  vibestreamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
    paddingTop: SPACING.small,
  },
  vibestreamMode: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  vibestreamDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
  },
  addVibestreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight + '40',
    borderWidth: 2,
    borderColor: COLORS.primary + '60',
    borderStyle: 'dashed',
    padding: SPACING.medium,
    marginTop: SPACING.small,
  },
  addVibestreamText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginLeft: SPACING.small,
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

export default UserProfile;