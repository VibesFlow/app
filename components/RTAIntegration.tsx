/**
 * RTA (Real-Time Asset) Integration for VibesFlow
 * MIT License
 * 
 * FIXED: rtaId is the ONLY identifier needed (contract shows token_id = "rta_{$ID}")
 * FIXED: Proper chunker worker integration for production deployment
 * FIXED: Correct worker call sequence: CHUNKER -> DISPATCHER -> PRODUCER
 */

import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { WORKERS, CONTRACTS } from '../config';
import { useHotWallet } from '../context/connector';

interface RTAIntegrationProps {
  isStreaming: boolean;
  rtaId?: string; // This is the rtaId
  participants: number;
  onRTACreated: (rtaId: string) => void; // Just returns the rtaId (token_id = "rta_{$ID}")
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
  const { addChunkToRTA, finalizeRTA } = useHotWallet();
  const [lastProcessedCID, setLastProcessedCID] = useState<string | null>(null);

  const initializeRTAStream = async () => {
    try {
      console.log(`🎬 Initializing RTA stream: ${rtaId}`);

      // STEP 1: Start chunker worker (it will check store_to_filecoin flag)
      const chunkerResponse = await fetch(`${WORKERS.CHUNKER}/chunk/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtaId: rtaId,
          config: {}
        }),
      });

      const chunkerResult = await chunkerResponse.json();

      if (!chunkerResult.success) {
        throw new Error(`Chunker failed to start: ${chunkerResult.message}`);
      }

      // STEP 2: Add initial participants to chunker raffle
      if (participants > 0) {
        await fetch(`${WORKERS.CHUNKER}/chunk/participant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rtaId: rtaId,
            accountId: process.env.EXPO_PUBLIC_NEAR_ACCOUNT_ID || 'vibesflow.testnet'
          }),
        });
      }

      setWorkersConnected(true);
      onRTACreated(rtaId!);
      
      console.log('✅ RTA stream initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize RTA stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('RTA Error', `Failed to initialize: ${errorMessage}`);
    }
  };

  const addParticipantToRaffle = async (accountId: string) => {
    try {
      await fetch(`${WORKERS.CHUNKER}/chunk/participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtaId: rtaId,
          accountId: accountId
        }),
      });
      console.log(`👤 Added participant ${accountId} to chunk raffle`);
    } catch (error) {
      console.error('❌ Failed to add participant:', error);
    }
  };

  const closeRTAStream = async () => {
    try {
      console.log(`🔚 Closing RTA stream: ${rtaId}`);

      // Finalize stream via producer worker
      if (!rtaId) {
        throw new Error('rtaId is not available for finalize');
      }
      if (!lastProcessedCID) {
        throw new Error('finalMasterCID is not available for finalize');
      }
      await finalizeRTA(String(rtaId), String(lastProcessedCID));

      setWorkersConnected(false);
      console.log('✅ RTA stream closed successfully');
      
    } catch (error) {
      console.error('❌ Failed to close RTA stream:', error);
    }
  };

  useEffect(() => {
    if (isStreaming && rtaId && !workersConnected) {
      initializeRTAStream();
    } else if (!isStreaming && workersConnected) {
      closeRTAStream();
    }
  }, [isStreaming, rtaId]);

  // Simple, minimal UI (no ugly tracker)
  if (!isStreaming || !rtaId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          RTA: {workersConnected ? '🟢' : '🔴'} | Participants: {participants} | Workers: {workersConnected ? 'Active' : 'Inactive'}
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