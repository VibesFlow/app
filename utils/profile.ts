/**
 * PROFILE UTILITIES - Shared creator profile management
 * Eliminates code duplication between VibeMarket.tsx and Playback.tsx
 */

import { Platform } from 'react-native';

export interface CreatorProfile {
  name?: string;
  profileImage?: string;
  bio?: string;
}

export class ProfileManager {
  private static profileCache: Map<string, CreatorProfile> = new Map();
  private static readonly PINATA_URL = process.env.PINATA_URL || process.env.EXPO_PUBLIC_PINATA_URL || 'vibesflow.mypinata.cloud';

  /**
   * Load creator profile from localStorage (web) or cache
   */
  static async loadCreatorProfile(creatorAccountId: string): Promise<CreatorProfile> {
    // Check cache first
    if (this.profileCache.has(creatorAccountId)) {
      return this.profileCache.get(creatorAccountId)!;
    }

    try {
      const profile: CreatorProfile = {};
      
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const savedImageHash = localStorage.getItem(`vibesflow_profile_${creatorAccountId}`);
        if (savedImageHash) {
          profile.profileImage = savedImageHash;
        }
        
        const savedName = localStorage.getItem(`vibesflow_name_${creatorAccountId}`);
        if (savedName) {
          profile.name = savedName;
        }

        const savedBio = localStorage.getItem(`vibesflow_bio_${creatorAccountId}`);
        if (savedBio) {
          profile.bio = savedBio;
        }
      }
      
      // Cache the profile
      this.profileCache.set(creatorAccountId, profile);
      return profile;
    } catch (error) {
      console.warn(`⚠️ Failed to load profile for creator ${creatorAccountId}:`, error);
      return {};
    }
  }

  /**
   * Get creator display name with proper formatting
   */
  static getCreatorDisplayName(creator: string, profile?: CreatorProfile): string {
    // Use profile name if available
    if (profile?.name) {
      return profile.name;
    }
    
    // Format wallet address
    if (creator.startsWith('0x')) {
      return `${creator.slice(0, 4)}...${creator.slice(-4)}`;
    }
    
    if (creator.includes('.testnet') || creator.includes('.near')) {
      const baseName = creator.split('.')[0];
      return baseName.length > 12 ? `${baseName.slice(0, 8)}...` : baseName;
    }
    
    return creator.length > 12 ? `${creator.slice(0, 8)}...` : creator;
  }

  /**
   * Get creator image URL from hash
   */
  static getCreatorImageUrl(creator: string, profile?: CreatorProfile): string | null {
    const imageHash = profile?.profileImage;
    if (imageHash) {
      return `https://${this.PINATA_URL}/ipfs/${imageHash}`;
    }
    return null;
  }

  /**
   * Clear profile cache (for memory management)
   */
  static clearCache(): void {
    this.profileCache.clear();
  }

  /**
   * Get cache size for debugging
   */
  static getCacheSize(): number {
    return this.profileCache.size;
  }
}

/**
 * Format time helper (shared utility)
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format date helper (shared utility)
 */
export const formatDate = (timestamp: number): string => {
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

/**
 * Network detection helper (shared utility)
 */
export const getNetworkFromRtaId = (rtaId: string): 'metis' | 'near' => {
  const upperRtaId = rtaId.toUpperCase();
  
  if (upperRtaId.startsWith('METIS_') || upperRtaId.includes('METIS')) {
    return 'metis';
  }
  if (upperRtaId.startsWith('RTA_') || upperRtaId.startsWith('NEAR_')) {
    return 'near';
  }
  
  return 'near'; // Default to NEAR
};

/**
 * Title extraction helper (shared utility)
 */
export const getVibestreamTitle = (stream: any): string => {
  const rtaId = stream.rta_id;
  const upperRtaId = rtaId.toUpperCase();
  
  // Remove network prefixes for cleaner titles
  if (upperRtaId.startsWith('METIS_VIBE_')) {
    return rtaId.substring(11);
  } else if (upperRtaId.startsWith('METIS_')) {
    return rtaId.substring(6);
  } else if (upperRtaId.startsWith('RTA_ID_')) {
    return rtaId.substring(7);
  } else if (upperRtaId.startsWith('RTA_')) {
    return rtaId.substring(4);
  } else if (upperRtaId.startsWith('NEAR_')) {
    return rtaId.substring(5);
  }
  
  return rtaId.toUpperCase();
};
