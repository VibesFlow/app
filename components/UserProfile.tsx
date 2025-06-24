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
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { PINATA_API_KEY, PINATA_API_SECRET, PINATA_URL } from '@env';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import GlitchText from './ui/GlitchText';
import VibestreamModal from './VibestreamModal';
import * as ImagePicker from 'expo-image-picker';

const { width, height } = Dimensions.get('window');

interface UserProfileProps {
  accountId: string;
  onCreateVibestream: () => void;
  onBack: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  accountId, 
  onCreateVibestream,
  onBack 
}) => {
  const [vibestreams] = useState<any[]>([]); // Initially empty as requested
  const [modalVisible, setModalVisible] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load saved profile image on component mount
  useEffect(() => {
    const loadProfileImage = async () => {
      try {
        if (Platform.OS === 'web') {
          const savedImageHash = localStorage.getItem(`vibesflow_profile_${accountId}`);
          if (savedImageHash) {
            setProfileImageUri(`https://${PINATA_URL}/ipfs/${savedImageHash}`);
          }
        }
      } catch (error) {
        console.warn('Failed to load profile image:', error);
      }
    };
    loadProfileImage();
  }, [accountId]);

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

  const renderVibestreamGrid = () => (
    <GlitchContainer intensity="low" style={styles.gridContainer}>
      {vibestreams.length === 0 ? (
        <TouchableOpacity style={styles.gridPlaceholder} onPress={openVibestreamModal}>
          <View style={styles.plusIcon}>
            <FontAwesome5 name="plus" size={width * 0.06} color={COLORS.primary} />
          </View>
          <GlitchText text="CREATE VIBESTREAM" style={styles.createText} />
        </TouchableOpacity>
      ) : (
        vibestreams.map((stream, index) => (
          <View key={index} style={styles.gridItem}>
            {/* Render stream thumbnail */}
          </View>
        ))
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
        <View style={styles.headerSpacer} />
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
          
          <GlitchText text={accountId} style={styles.username} />
          <Text style={styles.userType}>NEAR PROTOCOL</Text>
        </GlitchContainer>
        
        {/* Stats Container */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <GlitchText text="0" style={styles.statValue} />
            <Text style={styles.statLabel}>VIBESTREAMS</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statItem}>
            <GlitchText text="0:00:00" style={styles.statValue} />
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
        onLaunchVibePlayer={() => {
          setModalVisible(false);
          onCreateVibestream();
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
  title: {
    fontSize: Platform.OS === 'web' ? FONT_SIZES.xl : FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.medium,
    zIndex: 2,
  },
  profileContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
    paddingVertical: SPACING.xl,
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
    fontSize: Platform.OS === 'web' ? FONT_SIZES.xxl : FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: SPACING.small,
  },
  userType: {
    fontSize: FONT_SIZES.small,
    color: COLORS.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
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
  gridItem: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
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