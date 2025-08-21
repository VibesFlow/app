/**
 * Live Vibestreams Tracker for VibesFlow
 * 
 * Tracks active/live vibestreams across NEAR and Metis networks
 * by monitoring blockchain events and contract state.
 * 
 * Features:
 * - Network-aware live session tracking
 * - Real-time blockchain event monitoring
 * - CORS-compliant RPC optimization
 * - Efficient caching and polling
 */

import { Platform } from 'react-native';

// Import viem for Metis event handling
let createPublicClient: any = null;
let custom: any = null;
let parseAbiItem: any = null;

// Conditional import for web platform
if (Platform.OS === 'web') {
  try {
    const viem = require('viem');
    createPublicClient = viem.createPublicClient;
    custom = viem.custom;
    parseAbiItem = viem.parseAbiItem;
  } catch (error) {
    console.warn('⚠️ Viem not available for live tracking');
  }
}

// Network configuration
const NETWORK_CONFIG = {
  NEAR: {
    RPC_URL: process.env.EXPO_PUBLIC_NEAR_NODE_URL,
    FACTORY_CONTRACT: process.env.EXPO_PUBLIC_NEAR_CONTRACT_ID,
  },
  METIS: {
    CHAIN_ID: parseInt(process.env.EXPO_PUBLIC_HYPERION_CHAIN_ID || '133717'),
    RPC_URL: process.env.EXPO_PUBLIC_HYPERION_RPC_URL,
    VIBE_FACTORY: process.env.EXPO_PUBLIC_VIBE_FACTORY_ADDRESS,
    VIBE_KIOSK: process.env.EXPO_PUBLIC_VIBE_KIOSK_ADDRESS,
  }
};

export interface LiveVibestream {
  vibeId: string;
  creator: string;
  network: 'near' | 'metis';
  mode: 'solo' | 'group';
  startedAt: number;
  isActive: boolean;
  rtaId?: string; // Full RTA ID from blockchain event
  // Group mode specific fields
  ticketsAmount?: number;
  ticketPrice?: string;
  ticketsSold?: number;
  distance?: number;
  payPerStream?: boolean;
  streamPrice?: string;
}

export interface LiveVibestreamsData {
  liveVibestreams: LiveVibestream[];
  totalLive: number;
  nearLive: number;
  metisLive: number;
  lastUpdated: number;
}

class LiveVibestreamsTracker {
  private cache: LiveVibestreamsData = {
    liveVibestreams: [],
    totalLive: 0,
    nearLive: 0,
    metisLive: 0,
    lastUpdated: 0
  };
  
  private pollingInterval: NodeJS.Timeout | null = null;
  private listeners: ((data: LiveVibestreamsData) => void)[] = [];
  
  // Optimized polling settings
  private readonly POLL_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_DURATION = 45000; // 45 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Start tracking live vibestreams
   */
  async startTracking(onUpdate: (data: LiveVibestreamsData) => void): Promise<void> {
    console.log('🔴 Starting live vibestreams tracking...');
    
    // Add listener
    this.listeners.push(onUpdate);
    
    // Initial fetch
    await this.fetchLiveVibestreams();
    
    // Set up polling
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(async () => {
        try {
          await this.fetchLiveVibestreams();
        } catch (error) {
          console.warn('⚠️ Live vibestreams polling error:', error);
        }
      }, this.POLL_INTERVAL);
    }
    
    // Return current data
    onUpdate(this.cache);
  }

  /**
   * Stop tracking
   */
  stopTracking(onUpdate: (data: LiveVibestreamsData) => void): void {
    console.log('🛑 Stopping live vibestreams tracking');
    
    // Remove listener
    this.listeners = this.listeners.filter(listener => listener !== onUpdate);
    
    // Clear polling if no more listeners
    if (this.listeners.length === 0 && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Get current live vibestreams (from cache if available)
   */
  getLiveVibestreams(): LiveVibestreamsData {
    if ((Date.now() - this.cache.lastUpdated) < this.CACHE_DURATION) {
      return this.cache;
    }
    
    // Return stale data but trigger refresh
    this.fetchLiveVibestreams().catch(error => {
      console.warn('Background refresh failed:', error);
    });
    
    return this.cache;
  }

  /**
   * Fetch live vibestreams - track only active streaming sessions
   */
  private async fetchLiveVibestreams(): Promise<void> {
    try {
      console.log('🔍 Fetching live vibestreams...');
      
      // Get active streams from SRS
      const activeStreams = await this.fetchOrchestratorLiveVibestreams();
      
      // Convert SRS streams to LiveVibestream format
      const liveVibestreams: LiveVibestream[] = activeStreams.map(stream => {
        const isMetis = stream.vibeId.startsWith('metis_vibe_');
        const isNear = stream.vibeId.startsWith('rta_');
        
        return {
          vibeId: stream.vibeId,
          creator: stream.creator,
          network: isMetis ? 'metis' : 'near',
          mode: 'solo', // Default mode
          startedAt: Date.now() - 300000, // Estimate started 5 minutes ago
          isActive: true,
          rtaId: stream.vibeId
        };
      });

      const nearCount = liveVibestreams.filter(v => v.network === 'near').length;
      const metisCount = liveVibestreams.filter(v => v.network === 'metis').length;

      // Update cache
      this.cache = {
        liveVibestreams,
        totalLive: liveVibestreams.length,
        nearLive: nearCount,
        metisLive: metisCount,
        lastUpdated: Date.now()
      };

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.cache);
        } catch (error) {
          console.warn('Listener error:', error);
        }
      });

      console.log(`✅ Live vibestreams updated: ${liveVibestreams.length} total (${nearCount} NEAR, ${metisCount} Metis) from active streaming sessions`);

    } catch (error) {
      console.error('❌ Failed to fetch live vibestreams:', error);
    }
  }

  /**
   * Fetch active sessions from SRS HTTP API
   */
  private async fetchOrchestratorLiveVibestreams(): Promise<{vibeId: string, creator: string}[]> {
    try {
      // MINIMAL: Just get active streams from SRS - let SRS handle everything
      const response = await fetch('https://srs.vibesflow.ai/api/v1/streams/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`SRS API responded with ${response.status}`);
      }

      const data = await response.json();
      
      // MINIMAL: Extract only vibestream IDs from active SRS streams
      const activeStreams: {vibeId: string, creator: string}[] = [];
      
      if (data.streams && Array.isArray(data.streams)) {
        data.streams.forEach((stream: any) => {
          // Only track streams with blockchain RTA ID format
          if (stream.name && (stream.name.includes('metis_vibe_') || stream.name.includes('rta_') || /^\d+_\w+$/.test(stream.name))) {
            activeStreams.push({
              vibeId: stream.name,
              creator: 'creator' // SRS handles creator tracking
            });
          }
        });
      }

      return activeStreams;

    } catch (error) {
      console.warn('⚠️ Failed to fetch active sessions from SRS:', error);
      return [];
    }
  }



  /**
   * Cleanup when service is destroyed
   */
  cleanup(): void {
    console.log('🧹 Cleaning up live vibestreams tracker');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.listeners = [];
    this.cache = {
      liveVibestreams: [],
      totalLive: 0,
      nearLive: 0,
      metisLive: 0,
      lastUpdated: 0
    };
  }
}

// Export singleton instance
export const liveVibestreamsTracker = new LiveVibestreamsTracker();
export default liveVibestreamsTracker;
