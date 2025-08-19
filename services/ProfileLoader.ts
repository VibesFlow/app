/**
 * ProfileLoader - Load creator profiles in VibeMarket and Playback
 * Following EXACT pattern from UserProfile.tsx for consistency
 */

import { Platform } from 'react-native';

// Pinata configuration (exact pattern from UserProfile.tsx)
const PINATA_URL = process.env.PINATA_URL || process.env.EXPO_PUBLIC_PINATA_URL || 'vibesflow.mypinata.cloud';

interface CreatorProfile {
  displayName: string;
  profileImageUri: string | null;
  bio: string;
}

export class ProfileLoader {
  private profileCache: Map<string, CreatorProfile> = new Map();

  /**
   * Load creator profile following EXACT pattern from UserProfile.tsx:68-96
   */
  public async loadCreatorProfile(creatorAddress: string): Promise<CreatorProfile> {
    // Check cache first
    if (this.profileCache.has(creatorAddress)) {
      return this.profileCache.get(creatorAddress)!;
    }

    const profile: CreatorProfile = {
      displayName: this.formatWalletAddress(creatorAddress),
      profileImageUri: null,
      bio: ''
    };

    try {
      if (Platform.OS === 'web') {
        // Load profile image (exact pattern from UserProfile.tsx:73-76)
        const savedImageHash = localStorage.getItem(`vibesflow_profile_${creatorAddress}`);
        if (savedImageHash) {
          profile.profileImageUri = `https://${PINATA_URL}/ipfs/${savedImageHash}`;
        }
        
        // Load display name (exact pattern from UserProfile.tsx:78-83)
        const savedName = localStorage.getItem(`vibesflow_name_${creatorAddress}`);
        if (savedName) {
          profile.displayName = savedName;
        }

        // Load bio (exact pattern from UserProfile.tsx:85-88)
        const savedBio = localStorage.getItem(`vibesflow_bio_${creatorAddress}`);
        if (savedBio) {
          profile.bio = savedBio;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load profile data for ${creatorAddress}:`, error);
    }

    // Cache the result
    this.profileCache.set(creatorAddress, profile);
    return profile;
  }

  /**
   * Format wallet address for display
   * Following exact pattern from UserProfile.tsx:58-66
   */
  private formatWalletAddress(address: string): string {
    if (address.startsWith('0x')) {
      // Metis format: [first-5]...[last-6]
      return `${address.slice(0, 5)}...${address.slice(-6)}`;
    }
    // NEAR format: keep as is
    return address;
  }

  /**
   * Preload profiles for multiple creators
   */
  public async preloadProfiles(creatorAddresses: string[]): Promise<void> {
    const loadPromises = creatorAddresses.map(address => 
      this.loadCreatorProfile(address).catch(error => {
        console.warn(`⚠️ Failed to preload profile for ${address}:`, error);
      })
    );
    
    await Promise.all(loadPromises);
    console.log(`📚 Preloaded ${creatorAddresses.length} creator profiles`);
  }

  /**
   * Clear profile cache
   */
  public clearCache(): void {
    this.profileCache.clear();
  }
}
