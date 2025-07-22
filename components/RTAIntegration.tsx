/**
 * RTA (Real-Time Asset) Integration for VibesFlow
 * MIT License
 * 
 * UPDATED: Network-aware integration supporting both NEAR (rtav2) and Metis (RTAWrapper) contracts
 * UPDATED: Proper rtaId handling for both networks with fallback support
 * UPDATED: Correct worker call sequence: CHUNKER -> DISPATCHER -> PRODUCER
 */

import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { WORKERS, CONTRACTS } from '../config';
import { useWallet } from '../context/connector';

interface RTAIntegrationProps {
  isStreaming: boolean;
  rtaId?: string; // Network-aware rtaId (could be "rta_xxx", "vibe_xxx", etc.)
  participants: number;
  onRTACreated: (rtaId: string) => void; // Returns the network-aware rtaId
  onChunkProcessed: (chunkId: number, cid: string, winner: string) => void;
}

export default function RTAIntegration({
  isStreaming,
  rtaId,
  participants,
  onRTACreated,
  onChunkProcessed,
}: RTAIntegrationProps) {
  const [workersConnected, setWorkersConnected] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const { addChunkToRTA, finalizeRTA, account, getNetworkInfo } = useWallet();
  const [lastProcessedCID, setLastProcessedCID] = useState<string | null>(null);
  const [networkType, setNetworkType] = useState<'near' | 'metis' | 'fallback'>('fallback');

  // Detect network from rtaId and wallet connection
  const detectNetwork = useCallback(() => {
    if (!rtaId) return 'fallback';
    
    // Check rtaId prefix to determine network
    if (rtaId.startsWith('metis_vibe_')) {
      return 'metis';
    } else if (rtaId.startsWith('rta_')) {
      return 'near';
    }
    
    // Fallback: check wallet connection
    const networkInfo = getNetworkInfo();
    if (networkInfo?.type === 'metis-hyperion') {
      return 'metis';
    } else if (networkInfo?.type === 'near-testnet') {
      return 'near';
    }
    
    return 'fallback';
  }, [rtaId, getNetworkInfo]);

  // Extract raw ID for worker systems (removes network prefixes)
  const extractRawId = useCallback((fullRtaId: string) => {
    if (fullRtaId.startsWith('metis_vibe_')) {
      return fullRtaId.replace('metis_vibe_', '');
    } else if (fullRtaId.startsWith('rta_')) {
      return fullRtaId.replace('rta_', '');
    }
    return fullRtaId;
  }, []);

  const initializeRTAStream = async () => {
    try {
      const detectedNetwork = detectNetwork();
      setNetworkType(detectedNetwork);
      
      const rawId = extractRawId(rtaId!);
      
      console.log(`🎬 Initializing ${detectedNetwork} RTA stream:`, {
        fullRtaId: rtaId,
        rawId,
        network: detectedNetwork,
        account: account?.accountId
      });

      // STEP 1: Start chunker worker (it will check store_to_filecoin flag)
      const chunkerResponse = await fetch(`${WORKERS.CHUNKER}/chunk/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtaId: rawId, // Use raw ID for workers
          fullRtaId: rtaId, // Include full ID for tracking
          network: detectedNetwork,
          config: {}
        }),
      });

      const chunkerResult = await chunkerResponse.json();

      if (!chunkerResult.success) {
        throw new Error(`Chunker failed to start: ${chunkerResult.message}`);
      }

      // STEP 2: Add initial participants to chunker raffle
      if (participants > 0 && account?.accountId) {
        await fetch(`${WORKERS.CHUNKER}/chunk/participant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rtaId: rawId, // Use raw ID for workers
            accountId: account.accountId,
            network: detectedNetwork
          }),
        });
      }

      setWorkersConnected(true);
      onRTACreated(rtaId!);
      
      console.log(`✅ ${detectedNetwork} RTA stream initialized successfully`);
      
    } catch (error) {
      console.error('❌ Failed to initialize RTA stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Don't show alert for fallback mode - just continue with chunking
      if (networkType !== 'fallback') {
        Alert.alert('RTA Error', `Failed to initialize: ${errorMessage}`);
      } else {
        console.log('🔄 Continuing in fallback mode with chunking system');
        setWorkersConnected(true);
        onRTACreated(rtaId!);
      }
    }
  };

  const addParticipantToRaffle = async (accountId: string) => {
    try {
      const rawId = extractRawId(rtaId!);
      
      await fetch(`${WORKERS.CHUNKER}/chunk/participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtaId: rawId, // Use raw ID for workers
          accountId: accountId,
          network: networkType
        }),
      });
      console.log(`👤 Added participant ${accountId} to ${networkType} chunk raffle`);
    } catch (error) {
      console.error('❌ Failed to add participant:', error);
    }
  };

  const closeRTAStream = async () => {
    try {
      const rawId = extractRawId(rtaId!);
      
      console.log(`🔚 Closing ${networkType} RTA stream:`, {
        fullRtaId: rtaId,
        rawId,
        network: networkType
      });

      // Finalize stream via appropriate contract method
      if (!rtaId) {
        throw new Error('rtaId is not available for finalize');
      }
      if (!lastProcessedCID) {
        console.warn('⚠️ No master CID available, skipping finalization');
        setWorkersConnected(false);
        return;
      }

      // Network-aware finalization
      if (networkType === 'near') {
        await finalizeRTA(rawId, String(lastProcessedCID));
        console.log('✅ NEAR RTA finalized');
      } else if (networkType === 'metis') {
        // TODO: Implement Metis finalization when contracts support it
        console.log('✅ Metis vibestream closed (finalization not yet implemented)');
      } else {
        console.log('✅ Fallback stream closed');
      }

      setWorkersConnected(false);
      console.log(`✅ ${networkType} RTA stream closed successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to close ${networkType} RTA stream:`, error);
      setWorkersConnected(false);
    }
  };

  useEffect(() => {
    if (isStreaming && rtaId && !workersConnected) {
      initializeRTAStream();
    } else if (!isStreaming && workersConnected) {
      closeRTAStream();
    }
  }, [isStreaming, rtaId]);

  // Network-aware status display
  const getNetworkStatusIcon = () => {
    switch (networkType) {
      case 'near':
        return '🌐'; // NEAR
      case 'metis':
        return '⚡'; // Metis
      default:
        return '🔄'; // Fallback
    }
  };

  const getNetworkDisplayName = () => {
    switch (networkType) {
      case 'near':
        return 'NEAR';
      case 'metis':
        return 'Metis';
      default:
        return 'Fallback';
    }
  };

  // Simple, minimal UI (no ugly tracker)
  if (!isStreaming || !rtaId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {getNetworkStatusIcon()} {getNetworkDisplayName()} | RTA: {workersConnected ? '🟢' : '🔴'} | Participants: {participants} | Workers: {workersConnected ? 'Active' : 'Inactive'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    minWidth: 300,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});