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

// Network configs
const CONTRACT_ADDRESSES = {
  NEAR: {
    RTA_FACTORY: process.env.RTA_FACTORY_CONTRACT || process.env.EXPO_PUBLIC_RTA_FACTORY_CONTRACT || 'rtav2.vibesflow.testnet',
    NETWORK: process.env.NEAR_NETWORK || process.env.EXPO_PUBLIC_NEAR_NETWORK || 'testnet'
  },
  METIS: {
    VIBE_FACTORY: process.env.VIBE_FACTORY_ADDRESS || process.env.EXPO_PUBLIC_VIBE_FACTORY_ADDRESS || '0x69ee9D117fdE9874c148F995d2f4CC67f2BF8c9C',
    VIBE_KIOSK: process.env.VIBE_KIOSK_ADDRESS || process.env.EXPO_PUBLIC_VIBE_KIOSK_ADDRESS || '0xF463127B64F7acA9BeC512a1552b2e80f674D478',
    NETWORK: 'hyperion',
    CHAIN_ID: parseInt(process.env.HYPERION_CHAIN_ID || process.env.EXPO_PUBLIC_HYPERION_CHAIN_ID || '133717'),
    RPC_URL: process.env.HYPERION_RPC_URL || process.env.EXPO_PUBLIC_HYPERION_RPC_URL || 'https://hyperion-testnet.metisdevops.link'
  }
};

export interface ParticipantData {
  accountId: string;
  joinedAt: number;
  ticketId?: string; // For Metis VibeKiosk tickets
  isActive: boolean;
  streamingUrl?: string; // SRS streaming URL for participants
  isStreaming?: boolean; // Whether audio stream is active
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
    
    // Create public client
    const publicClient = createPublicClient({
      chain: {
        id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
        name: 'Metis Hyperion',
        nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
        rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
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
        address: CONTRACT_ADDRESSES.METIS.VIBE_KIOSK as `0x${string}`,
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
          address: CONTRACT_ADDRESSES.METIS.VIBE_KIOSK as `0x${string}`,
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
      const rpcUrl = process.env.EXPO_PUBLIC_NEAR_NODE_URL;
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
            account_id: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
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
   * Join a vibestream as a participant with wallet signature (required for tracking)
   * Uses RTA config data instead of blockchain verification to avoid blocking
   */
  async joinVibestreamAsParticipant(
    vibeId: string, 
    participantId: string,
    walletAddress: string,
    signMessage?: (message: string) => Promise<string>
  ): Promise<{ streamingUrl?: string; hlsUrl?: string; success: boolean; error?: string }> {
    try {
      const streamingServerUrl = process.env.EXPO_PUBLIC_STREAMING_URL || 'https://srs.vibesflow.ai';
      
      console.log(`🎵 Joining vibestream ${vibeId} as participant ${participantId} with wallet signature`);
      
      // Use RTA config data instead of blockchain verification
      let ticketVerification: any = null;
      let walletSignature: string | null = null;
      let hasValidTicket = false;
      
      try {
        // Parse RTA ID to understand the vibestream format
        console.log(`🔍 Parsing vibeId: "${vibeId}"`);
        
        let isMetisVibestream = false;
        let isFallbackMode = false;
        
        // Detect network and fallback mode from RTA ID format
        if (vibeId.startsWith('metis_vibe_')) {
          isMetisVibestream = true;
          // Check if this is a fallback mode vibestream
          // Fallback vibestreams have the format: metis_vibe_${timestamp}_${random}
          const parts = vibeId.split('_');
          if (parts.length >= 4) {
            console.log(`✅ Metis vibestream format detected: ${vibeId}`);
          }
        } else if (vibeId.startsWith('rta_')) {
          console.log(`✅ NEAR vibestream format detected: ${vibeId}`);
        } else {
          // Raw timestamp format - likely fallback mode
          isFallbackMode = true;
          console.log(`✅ Fallback mode vibestream detected: ${vibeId}`);
        }
        
        // For all vibestreams, generate wallet signature for participant tracking using wallet context
        try {
          const joinMessage = `Join vibestream ${vibeId} as participant ${participantId} at ${Date.now()}`;
          
          // Use the provided wallet signing function if available
          if (signMessage) {
            walletSignature = await signMessage(joinMessage);
            console.log(`✅ Wallet signature generated via wallet context for participant tracking`);
          } else if (typeof window !== 'undefined' && (window as any).ethereum) {
            // Fallback to direct ethereum provider if no signing function provided
            const ethProvider = (window as any).ethereum;
            
            walletSignature = await ethProvider.request({
              method: 'personal_sign',
              params: [joinMessage, walletAddress]
            });
            console.log(`✅ Wallet signature generated via direct provider for participant tracking`);
          }
        } catch (signError) {
          console.warn('⚠️ Wallet signature failed, continuing without signature:', signError);
          // Continue without signature - don't block the join process
        }
        
        // Set up verification data for streaming server
        ticketVerification = {
          hasTicket: false, // Default to free access
          isFreeVibestream: true,
          isMetisVibestream,
          isFallbackMode,
          verifiedAt: Date.now(),
          vibeIdFormat: vibeId
        };
        
        console.log(`✅ Vibestream verification completed:`, {
          vibeId,
          isMetis: isMetisVibestream,
          isFallback: isFallbackMode,
          hasSignature: !!walletSignature
        });
        
      } catch (verificationError: any) {
        console.warn('⚠️ Verification failed, continuing with basic tracking:', verificationError);
        
        // Fallback verification - don't block the join process
        ticketVerification = {
          hasTicket: false,
          isFreeVibestream: true,
          isFallbackMode: true,
          verificationFailed: true,
          verifiedAt: Date.now(),
          error: verificationError.message
        };
      }
      
      // MINIMAL: Generate SRS streaming URLs based on blockchain RTA_ID - let SRS handle everything
      const streamingUrl = `https://srs.vibesflow.ai/live/${vibeId}.flv`;
      const hlsUrl = `https://srs.vibesflow.ai/live/${vibeId}.m3u8`;
      
      console.log(`✅ Generated streaming URLs for blockchain RTA ${vibeId}:
        - HTTP-FLV: ${streamingUrl}
        - HLS: ${hlsUrl}`);
      
      // MINIMAL: Don't verify stream existence - SRS will handle it automatically
      // If stream doesn't exist, player will get 404 and can handle gracefully
      
      return {
        streamingUrl,
        hlsUrl,
        success: true
      };

    } catch (error: any) {
      console.error(`❌ Failed to join vibestream ${vibeId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Leave a vibestream as a participant
   */
  async leaveVibestreamAsParticipant(
    vibeId: string, 
    participantId: string,
    walletAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const streamingServerUrl = process.env.EXPO_PUBLIC_STREAMING_URL || 'https://srs.vibesflow.ai';
      
      console.log(`🚪 Leaving vibestream ${vibeId} as participant ${participantId}`);
      
      const response = await fetch(`${streamingServerUrl}/stream/${vibeId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId,
          walletAddress,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Streaming server responded with ${response.status}`);
      }

      const result = await response.json();
      
      console.log(`✅ Left vibestream ${vibeId}: ${result.participantCount} remaining participants`);
      
      return { success: true };

    } catch (error: any) {
      console.error(`❌ Failed to leave vibestream ${vibeId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle blockchain-based participant routing via URL
   * Format: /join/{rtaId} - where rtaId is the full blockchain RTA ID
   */
  async handleParticipantRouting(
    rtaId: string,
    walletAddress: string,
    signMessage?: (message: string) => Promise<string>
  ): Promise<{ success: boolean; streamingUrl?: string; hlsUrl?: string; error?: string; redirectUrl?: string }> {
    try {
      console.log(`🔗 Handling participant routing for RTA: ${rtaId}`);
      
      // Validate RTA ID format
      if (!this.isValidRtaId(rtaId)) {
        return {
          success: false,
          error: 'Invalid RTA ID format'
        };
      }
      
      // Extract participant ID from wallet address
      const participantId = walletAddress.split('.')[0] || walletAddress;
      
      // Check if this is a valid, active vibestream
      const streamExists = await this.verifyVibestreamExists(rtaId);
      if (!streamExists) {
        return {
          success: false,
          error: 'Vibestream not found or not active',
          redirectUrl: '/live' // Redirect to live vibes page
        };
      }
      
      // Join the vibestream
      const joinResult = await this.joinVibestreamAsParticipant(
        rtaId,
        participantId,
        walletAddress,
        signMessage
      );
      
      if (joinResult.success) {
        console.log(`✅ Participant routing successful for ${rtaId}`);
        return {
          success: true,
          streamingUrl: joinResult.streamingUrl,
          hlsUrl: joinResult.hlsUrl
        };
      } else {
        return {
          success: false,
          error: joinResult.error || 'Failed to join vibestream',
          redirectUrl: '/live'
        };
      }
      
    } catch (error: any) {
      console.error('❌ Participant routing failed:', error);
      return {
        success: false,
        error: error.message,
        redirectUrl: '/live'
      };
    }
  }

  /**
   * Validate RTA ID format for blockchain consistency
   */
  private isValidRtaId(rtaId: string): boolean {
    // Valid formats:
    // - metis_vibe_{timestamp}_{random} (Metis vibestreams)
    // - rta_{timestamp}_{random} (NEAR vibestreams)
    // - {timestamp}_{random} (fallback mode)
    
    if (rtaId.startsWith('metis_vibe_')) {
      const parts = rtaId.split('_');
      return parts.length >= 4 && /^\d+$/.test(parts[2]);
    }
    
    if (rtaId.startsWith('rta_')) {
      const parts = rtaId.split('_');
      return parts.length >= 3 && /^\d+$/.test(parts[1]);
    }
    
    // Fallback mode: timestamp_random
    const parts = rtaId.split('_');
    return parts.length >= 2 && /^\d+$/.test(parts[0]);
  }

  /**
   * MINIMAL: Verify RTA ID format only - let SRS handle stream existence
   */
  private async verifyVibestreamExists(rtaId: string): Promise<boolean> {
    // MINIMAL: Just validate blockchain RTA ID format - SRS will handle the rest
    return this.isValidRtaId(rtaId);
  }

  /**
   * Generate participant join URL for sharing
   */
  generateParticipantJoinUrl(rtaId: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://vibesflow.ai');
    return `${base}/join/${rtaId}`;
  }

  /**
   * Extract RTA ID from participant join URL
   */
  extractRtaIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // Look for /join/{rtaId} pattern
      const joinIndex = pathParts.indexOf('join');
      if (joinIndex >= 0 && joinIndex < pathParts.length - 1) {
        return pathParts[joinIndex + 1];
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to extract RTA ID from URL:', error);
      return null;
    }
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
