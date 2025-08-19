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
   * Fetch live vibestreams from both networks
   */
  private async fetchLiveVibestreams(): Promise<void> {
    try {
      console.log('🔍 Fetching live vibestreams...');
      
      // Fetch from both networks in parallel
      const [nearLive, metisLive] = await Promise.allSettled([
        this.fetchNearLiveVibestreams(),
        this.fetchMetisLiveVibestreams()
      ]);

      const liveVibestreams: LiveVibestream[] = [];
      let nearCount = 0;
      let metisCount = 0;

      // Process NEAR results
      if (nearLive.status === 'fulfilled') {
        liveVibestreams.push(...nearLive.value);
        nearCount = nearLive.value.length;
      } else {
        console.warn('⚠️ NEAR live vibestreams fetch failed:', nearLive.reason);
      }

      // Process Metis results
      if (metisLive.status === 'fulfilled') {
        liveVibestreams.push(...metisLive.value);
        metisCount = metisLive.value.length;
      } else {
        console.warn('⚠️ Metis live vibestreams fetch failed:', metisLive.reason);
      }

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

      console.log(`✅ Live vibestreams updated: ${liveVibestreams.length} total (${nearCount} NEAR, ${metisCount} Metis)`);

    } catch (error) {
      console.error('❌ Failed to fetch live vibestreams:', error);
    }
  }

  /**
   * Fetch live vibestreams from NEAR
   */
  private async fetchNearLiveVibestreams(): Promise<LiveVibestream[]> {
    // For now, return empty array as NEAR doesn't have real-time live tracking yet
    // This would need to be implemented by querying the NEAR contract for active RTAs
    return [];
  }

  /**
   * Fetch live vibestreams from Metis
   */
  private async fetchMetisLiveVibestreams(): Promise<LiveVibestream[]> {
    if (!createPublicClient || !custom || !parseAbiItem) {
      throw new Error('Viem not available for Metis tracking');
    }

    // Check if we have ethereum provider
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      console.warn('Ethereum provider not available, skipping Metis live tracking');
      return [];
    }

    const ethProvider = (window as any).ethereum;
    
    // Create public client for reading contract state
    const publicClient = createPublicClient({
      chain: {
        id: NETWORK_CONFIG.METIS.CHAIN_ID,
        name: 'Metis Hyperion',
        nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
        rpcUrls: { default: { http: [NETWORK_CONFIG.METIS.RPC_URL] } },
      },
      transport: custom(ethProvider)
    });

    try {
      // Get current block to limit event search range
      const currentBlock = await publicClient.getBlockNumber();
      const searchFromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;
      
      // Query VibestreamCreated events from VibeFactory (recent ones)
      const vibestreamEvents = await publicClient.getLogs({
        address: NETWORK_CONFIG.METIS.VIBE_FACTORY as `0x${string}`,
        event: parseAbiItem('event VibestreamCreated(uint256 indexed vibeId, address indexed creator, string rtaId, bool storeToFilecoin, string mode, uint256 distance, uint256 ticketsAmount, uint256 ticketPrice, bool payPerStream, uint256 streamPrice, uint256 timestamp)'),
        fromBlock: searchFromBlock,
        toBlock: currentBlock
      });

      const liveVibestreams: LiveVibestream[] = [];
      
      // Process recent events (assume they're still live if created within last hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const event of vibestreamEvents) {
        const args = event.args as any;
        const timestamp = Number(args.timestamp) * 1000; // Convert to milliseconds
        
        // Consider vibestream live if created within last hour
        if (timestamp > oneHourAgo) {
          const liveVibe: LiveVibestream = {
            vibeId: args.vibeId.toString(),
            creator: args.creator,
            network: 'metis',
            mode: args.mode === 'group' ? 'group' : 'solo',
            startedAt: timestamp,
            isActive: true
          };
          
          // Add group mode specific data
          if (args.mode === 'group') {
            liveVibe.ticketsAmount = Number(args.ticketsAmount);
            liveVibe.ticketPrice = args.ticketPrice.toString();
            liveVibe.distance = Number(args.distance);
            liveVibe.payPerStream = args.payPerStream;
            if (args.payPerStream) {
              liveVibe.streamPrice = args.streamPrice.toString();
            }
            
            // Try to get tickets sold from VibeKiosk
            try {
              const vibeConfig = await publicClient.readContract({
                address: NETWORK_CONFIG.METIS.VIBE_KIOSK as `0x${string}`,
                abi: [parseAbiItem('function getVibeConfig(uint256 vibeId) external view returns (tuple(uint256 vibeId, address creator, uint256 ticketsAmount, uint256 ticketPrice, uint256 distance, uint256 ticketsSold, bool isActive))')],
                functionName: 'getVibeConfig',
                args: [args.vibeId]
              }) as any;
              
              liveVibe.ticketsSold = Number(vibeConfig.ticketsSold);
            } catch (error) {
              console.warn('Could not fetch ticket sales data:', error);
              liveVibe.ticketsSold = 0;
            }
          }
          
          liveVibestreams.push(liveVibe);
        }
      }

      return liveVibestreams;
      
    } catch (error) {
      console.error('❌ Failed to fetch Metis live vibestreams:', error);
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
