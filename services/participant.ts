/**
 * Participant Tracking Service for VibesFlow
 * 
 * Provides real-time participant tracking for Group mode vibestreams
 * using blockchain events and view functions across NEAR and Metis networks.
 * 
 * Features:
 * - Network-aware participant tracking
 * - Event-based real-time updates
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
    console.warn('⚠️ Viem not available for participant tracking');
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

export interface ParticipantData {
  accountId: string;
  joinedAt: number;
  ticketId?: string; // For Metis VibeKiosk tickets
  isActive: boolean;
}

export interface VibestreamParticipants {
  vibeId: string;
  participants: ParticipantData[];
  totalParticipants: number;
  maxParticipants?: number;
  lastUpdated: number;
  network: 'near' | 'metis';
}

class ParticipantTrackingService {
  private participantCache = new Map<string, VibestreamParticipants>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private eventSubscriptions = new Map<string, any>();
  
  // Optimized polling settings to avoid RPC spam
  private readonly POLL_INTERVAL = 15000; // 15 seconds
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Start tracking participants for a vibestream
   */
  async startTracking(
    vibeId: string, 
    network: 'near' | 'metis',
    onUpdate: (participants: VibestreamParticipants) => void
  ): Promise<void> {
    console.log(`🎯 Starting participant tracking for ${network} vibestream:`, vibeId);
    
    // Clear any existing tracking for this vibestream
    this.stopTracking(vibeId);
    
    try {
      if (network === 'metis') {
        await this.startMetisTracking(vibeId, onUpdate);
      } else if (network === 'near') {
        await this.startNearTracking(vibeId, onUpdate);
      }
    } catch (error) {
      console.error(`❌ Failed to start ${network} participant tracking:`, error);
      
      // Fallback: return empty participants list
      const fallbackData: VibestreamParticipants = {
        vibeId,
        participants: [],
        totalParticipants: 0,
        lastUpdated: Date.now(),
        network
      };
      this.participantCache.set(vibeId, fallbackData);
      onUpdate(fallbackData);
    }
  }

  /**
   * Stop tracking participants for a vibestream
   */
  stopTracking(vibeId: string): void {
    console.log(`🛑 Stopping participant tracking for vibestream:`, vibeId);
    
    // Clear polling interval
    const interval = this.pollingIntervals.get(vibeId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(vibeId);
    }
    
    // Clear event subscriptions
    const subscription = this.eventSubscriptions.get(vibeId);
    if (subscription) {
      // Cleanup subscription if needed
      this.eventSubscriptions.delete(vibeId);
    }
    
    // Remove from cache
    this.participantCache.delete(vibeId);
  }

  /**
   * Get current participants (from cache if available)
   */
  getParticipants(vibeId: string): VibestreamParticipants | null {
    const cached = this.participantCache.get(vibeId);
    if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_DURATION) {
      return cached;
    }
    return null;
  }

  /**
   * Start tracking participants on Metis using VibeKiosk contract events
   */
  private async startMetisTracking(
    vibeId: string,
    onUpdate: (participants: VibestreamParticipants) => void
  ): Promise<void> {
    if (!createPublicClient || !custom || !parseAbiItem) {
      throw new Error('Viem not available for Metis tracking');
    }

    // Check if we have ethereum provider
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('Ethereum provider not available');
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

    // Initial fetch of participants
    await this.fetchMetisParticipants(vibeId, publicClient, onUpdate);
    
    // Set up periodic polling (optimized to avoid RPC spam)
    const interval = setInterval(async () => {
      try {
        await this.fetchMetisParticipants(vibeId, publicClient, onUpdate);
      } catch (error) {
        console.warn(`⚠️ Metis polling error for ${vibeId}:`, error);
      }
    }, this.POLL_INTERVAL);
    
    this.pollingIntervals.set(vibeId, interval);
  }

  /**
   * Fetch participants from Metis VibeKiosk contract
   */
  private async fetchMetisParticipants(
    vibeId: string,
    publicClient: any,
    onUpdate: (participants: VibestreamParticipants) => void
  ): Promise<void> {
    try {
      console.log(`🔍 Fetching Metis participants for vibe ${vibeId}`);
      
      // Get current block to limit event search range
      const currentBlock = await publicClient.getBlockNumber();
      const searchFromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;
      
      // Query TicketMinted events from VibeKiosk
      const ticketMintedEvents = await publicClient.getLogs({
        address: NETWORK_CONFIG.METIS.VIBE_KIOSK as `0x${string}`,
        event: parseAbiItem('event TicketMinted(uint256 indexed vibeId, uint256 indexed ticketId, address indexed buyer, string ticketName, uint256 price)'),
        args: {
          vibeId: BigInt(vibeId)
        },
        fromBlock: searchFromBlock,
        toBlock: currentBlock
      });

      // Process events to extract participants
      const participantMap = new Map<string, ParticipantData>();
      
      for (const event of ticketMintedEvents) {
        const { buyer, ticketId } = event.args as any;
        
        if (buyer && !participantMap.has(buyer.toLowerCase())) {
          participantMap.set(buyer.toLowerCase(), {
            accountId: buyer.toLowerCase(),
            joinedAt: Date.now(), // We don't have exact timestamp from event
            ticketId: ticketId?.toString(),
            isActive: true
          });
        }
      }

      // Get vibestream config to check max participants
      let maxParticipants: number | undefined;
      try {
        const vibeConfig = await publicClient.readContract({
          address: NETWORK_CONFIG.METIS.VIBE_KIOSK as `0x${string}`,
          abi: [parseAbiItem('function getVibeConfig(uint256 vibeId) external view returns (tuple(uint256 vibeId, address creator, uint256 ticketsAmount, uint256 ticketPrice, uint256 distance, uint256 ticketsSold, bool isActive))')],
          functionName: 'getVibeConfig',
          args: [BigInt(vibeId)]
        }) as any;
        
        maxParticipants = Number(vibeConfig.ticketsAmount);
      } catch (error) {
        console.warn('⚠️ Could not fetch vibe config:', error);
      }

      const participants = Array.from(participantMap.values());
      const participantData: VibestreamParticipants = {
        vibeId,
        participants,
        totalParticipants: participants.length,
        maxParticipants,
        lastUpdated: Date.now(),
        network: 'metis'
      };

      // Update cache and notify
      this.participantCache.set(vibeId, participantData);
      onUpdate(participantData);
      
      console.log(`✅ Metis participants updated: ${participants.length} participants`);
      
    } catch (error) {
      console.error('❌ Failed to fetch Metis participants:', error);
      
      // Return cached data if available, otherwise empty
      const cached = this.participantCache.get(vibeId);
      if (cached) {
        onUpdate(cached);
      }
    }
  }

  /**
   * Start tracking participants on NEAR (placeholder - NEAR doesn't have ticket system yet)
   */
  private async startNearTracking(
    vibeId: string,
    onUpdate: (participants: VibestreamParticipants) => void
  ): Promise<void> {
    console.log(`🔍 NEAR participant tracking for ${vibeId} - using creator as single participant`);
    
    // For NEAR, we currently don't have a ticket/participant system
    // So we'll return the creator as the only participant
    try {
      // Query RTA metadata to get creator
      const rpcUrl = NETWORK_CONFIG.NEAR.RPC_URL;
      if (!rpcUrl) {
        throw new Error('NEAR RPC URL not configured');
      }
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: NETWORK_CONFIG.NEAR.FACTORY_CONTRACT,
            method_name: 'get_rta_metadata',
            args_base64: typeof Buffer !== 'undefined' 
              ? Buffer.from(JSON.stringify({ rta_id: vibeId })).toString('base64')
              : btoa(JSON.stringify({ rta_id: vibeId }))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.result && result.result.result) {
          const resultBytes = result.result.result;
          const jsonString = new TextDecoder().decode(new Uint8Array(resultBytes));
          const metadata = JSON.parse(jsonString);
          
          const participantData: VibestreamParticipants = {
            vibeId,
            participants: [{
              accountId: metadata.config.creator,
              joinedAt: metadata.config.created_at,
              isActive: true
            }],
            totalParticipants: 1,
            maxParticipants: metadata.config.ticket_amount || undefined,
            lastUpdated: Date.now(),
            network: 'near'
          };

          this.participantCache.set(vibeId, participantData);
          onUpdate(participantData);
          
          console.log(`✅ NEAR participant data: creator ${metadata.config.creator}`);
          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch NEAR RTA metadata:', error);
    }

    // Fallback: empty participants
    const fallbackData: VibestreamParticipants = {
      vibeId,
      participants: [],
      totalParticipants: 0,
      lastUpdated: Date.now(),
      network: 'near'
    };
    
    this.participantCache.set(vibeId, fallbackData);
    onUpdate(fallbackData);
  }

  /**
   * Cleanup all tracking when service is destroyed
   */
  cleanup(): void {
    console.log('🧹 Cleaning up participant tracking service');
    
    // Clear all intervals
    for (const [vibeId, interval] of this.pollingIntervals.entries()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    
    // Clear all subscriptions
    this.eventSubscriptions.clear();
    
    // Clear cache
    this.participantCache.clear();
  }
}

// Export singleton instance
export const participantTrackingService = new ParticipantTrackingService();
export default participantTrackingService;
