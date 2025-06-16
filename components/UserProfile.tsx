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
import { PINATA_JWT, PINATA_GATEWAY_URL } from '@env';
import { COLORS, FONT_SIZES, SPACING, BRANDING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import AcidButton from './ui/AcidButton';
import VibestreamModal from './VibestreamModal';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

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
            setProfileImageUri(`${PINATA_GATEWAY_URL}${savedImageHash}`);
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
          'Authorization': `Bearer ${PINATA_JWT}`,
        },
        body: formData,
      });

      const result = await pinataResponse.json();
      
      if (result.IpfsHash) {
        const ipfsUrl = `${PINATA_GATEWAY_URL}${result.IpfsHash}`;
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

  const renderVibestreamGrid = () => {
    const gridItems = [...vibestreams];
    
    // Add the create new vibestream button
    gridItems.push({ id: 'create-new', isCreateButton: true });

    return (
      <View style={styles.grid}>
        {gridItems.map((item, index) => (
          <TouchableOpacity
            key={item.id || index}
            style={styles.gridItem}
            onPress={item.isCreateButton ? () => setModalVisible(true) : undefined}
            activeOpacity={0.8}
          >
            <GlitchContainer 
              style={styles.gridItemContainer}
              intensity="low"
              animated={item.isCreateButton}
            >
              {item.isCreateButton ? (
                <View style={styles.createButton}>
                  <FontAwesome5 
                    name="plus" 
                    size={40} 
                    color={COLORS.primary} 
                  />
                </View>
              ) : (
                <View style={styles.vibestreamThumbnail}>
                  <FontAwesome5 
                    name="music" 
                    size={20} 
                    color={COLORS.accent} 
                  />
                  <Text style={styles.vibestreamTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.vibestreamDate}>
                    {item.date}
                  </Text>
                </View>
              )}
            </GlitchContainer>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={selectImage} style={styles.avatarContainer}>
            <GlitchContainer 
              style={styles.avatarGlitch} 
              intensity="medium"
              animated={true}
            >
              <View style={styles.avatar}>
                {profileImageUri ? (
                  <Image 
                    source={{ uri: profileImageUri }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <FontAwesome5 
                    name="user-astronaut" 
                    size={48} 
                    color={COLORS.primary} 
                  />
                )}
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <FontAwesome5 
                      name="spinner" 
                      size={24} 
                      color={COLORS.primary} 
                    />
                  </View>
                )}
              </View>
            </GlitchContainer>
          </TouchableOpacity>
          
          <Text style={styles.accountName}>{accountId}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>VIBESTREAMS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0:00:00</Text>
              <Text style={styles.statLabel}>TOTAL TIME</Text>
            </View>
          </View>
        </View>

        {/* Vibestreams Section */}
        <View style={styles.vibestreamsSection}>
          <Text style={styles.sectionTitle}>YOUR VIBESTREAMS</Text>
          <Text style={styles.sectionSubtitle}>
            ARCHIVED · FREQUENCIES · CAPTURED
          </Text>
          
          {renderVibestreamGrid()}
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>{BRANDING.manifesto}</Text>
        </View>
      </ScrollView>

      <VibestreamModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onLaunchVibePlayer={onCreateVibestream}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + '20',
  },
  backButton: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.textSecondary + '40',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent + '20',
  },
  avatarContainer: {
    marginBottom: SPACING.lg,
  },
  avatarGlitch: {
    borderRadius: 0,
  },
  avatar: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    position: 'relative',
  },
  profileImage: {
    width: 116,
    height: 116,
    resizeMode: 'cover',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  accountType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.accent,
    marginBottom: SPACING.lg,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginTop: SPACING.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
  },
  vibestreamsSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    marginBottom: SPACING.md,
  },
  gridItemContainer: {
    height: 120,
    overflow: 'hidden',
  },
  createButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  vibestreamThumbnail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: SPACING.sm,
  },
  vibestreamTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: SPACING.xs,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  vibestreamDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },
  brandFooter: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary + '20',
  },
  brandText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
});

export default UserProfile;