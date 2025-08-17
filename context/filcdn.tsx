/**
 * FilCDN Context - Direct Synapse SDK Integration  
 * Provides vibestream data with native FilCDN URL support
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWallet } from './connector';

interface VibestreamData {
  rta_id: string;
  creator: string;
  rta_duration: string;
  chunks: number;
  user_profile_image?: string;
  is_complete: boolean;
  filcdn_base: string;
  first_chunk_url?: string;
  last_chunk_url?: string;
  upload_timestamp: number;
  synapse_proof_set_id: number;
  chunks_detail: ChunkDetail[];
}

interface ChunkDetail {
  chunk_id: string;
  cid: string;
  size: number;
  root_id?: number;
  url: string;
  filcdn_url?: string; // Direct FilCDN URL
  duration?: number;
  participants?: number;
  owner?: string;
  sequence?: number;
}

interface FilCDNContextType {
  vibestreams: VibestreamData[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  networkType: 'metis' | 'near' | null;
  currentAddress: string | null;
  refreshVibestreams: () => Promise<void>;
  downloadChunk: (cid: string, useDirectCDN?: boolean) => Promise<ArrayBuffer>;
  getVibestreamsByCreator: (creator: string) => VibestreamData[];
  getVibestreamByRTA: (rtaId: string) => VibestreamData | null;
  constructFilCDNUrl: (cid: string, clientAddress?: string) => string;
}

const FilCDNContext = createContext<FilCDNContextType | undefined>(undefined);

interface FilCDNProviderProps {
  children: React.ReactNode;
}

export const FilCDNProvider: React.FC<FilCDNProviderProps> = ({ children }) => {
  const { connected, account, getNetworkInfo } = useWallet();
  const [vibestreams, setVibestreams] = useState<VibestreamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current address and network info
  const currentAddress = account?.accountId || null;
  const networkInfo = getNetworkInfo();

  // Determine network type based on connected network
  const getNetworkType = (): 'metis' | 'near' | null => {
    if (!networkInfo) return null;
    if (networkInfo.type === 'metis-hyperion') return 'metis';
    if (networkInfo.type === 'near-testnet' || networkInfo.type === 'near-mainnet') return 'near';
    return null;
  };

  // Construct direct FilCDN URL using provider wallet
  const constructFilCDNUrl = (cid: string, providerAddress?: string): string => {
    const address = providerAddress || 
      process.env.EXPO_PUBLIC_FILCDN_PROVIDER_ADDRESS;
    
    // Use calibration network
    return `https://${address}.calibration.filcdn.io/${cid}`;
  };

  const refreshVibestreams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching vibestreams from Synapse SDK...');
      
      // Call the backend endpoint that uses Synapse SDK
      const backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai';
      
      // Add cache-busting parameter to force fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`${backendUrl}/api/vibestreams?t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vibestreams: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array of vibestreams');
      }

      // Transform the data with proper FilCDN URLs
      const transformedData = data.map((vibestream: any) => ({
        ...vibestream,
        chunks_detail: vibestream.chunks_detail?.map((chunk: any) => {
          if (!chunk.cid) return chunk;
          
          try {
            // Construct direct FilCDN URL using the provider wallet address
            const filcdnUrl = constructFilCDNUrl(chunk.cid);
            
            return {
              ...chunk,
              // Use backend proxy as fallback
              url: `${backendUrl}/api/proxy/${chunk.cid}`,
              // Direct FilCDN URL for optimal performance
              filcdn_url: filcdnUrl,
            };
          } catch (error) {
            console.warn(`⚠️ Failed to construct FilCDN URL for chunk ${chunk.chunk_id}:`, error);
            return {
              ...chunk,
              url: `${backendUrl}/api/proxy/${chunk.cid}`,
            };
          }
        }) || []
      }));

      console.log(`✅ Loaded ${transformedData.length} vibestreams with FilCDN URLs`);
      setVibestreams(transformedData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to fetch vibestreams:', errorMessage);
      setError(errorMessage);
      setVibestreams([]); // Clear any existing data on error
    } finally {
      setLoading(false);
    }
  };

  const downloadChunk = async (cid: string, useDirectCDN: boolean = true): Promise<ArrayBuffer> => {
    try {
      console.log(`📥 Downloading chunk ${cid} ${useDirectCDN ? 'from FilCDN (provider wallet)' : 'from backend proxy'}...`);
      
      let response: Response;
      
      if (useDirectCDN) {
        try {
          // Attempt direct FilCDN download using provider wallet
          const filcdnUrl = constructFilCDNUrl(cid);
          response = await fetch(filcdnUrl, {
            method: 'GET',
            headers: {
              'Accept': 'audio/*',
              'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
            }
          });
          
          if (response.ok) {
            console.log(`✅ FilCDN download successful for ${cid} using provider wallet`);
          } else if (response.status === 402) {
            console.warn('📋 FilCDN requires payment - using backend proxy fallback');
            throw new Error('FilCDN payment required');
          } else {
            throw new Error(`FilCDN failed with status: ${response.status}`);
          }
        } catch (filcdnError) {
          console.warn(`⚠️ FilCDN download failed for ${cid}:`, filcdnError);
          // Fall back to backend proxy
          const backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai';
          response = await fetch(`${backendUrl}/api/proxy/${cid}`, {
            method: 'GET'
          });
        }
      } else {
        // Use backend proxy directly
        const backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai';
        response = await fetch(`${backendUrl}/api/proxy/${cid}`, {
          method: 'GET'
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to download chunk: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`✅ Downloaded chunk ${cid}: ${arrayBuffer.byteLength} bytes`);
      
      return arrayBuffer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      console.error(`❌ Failed to download chunk ${cid}:`, errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getVibestreamsByCreator = (creator: string): VibestreamData[] => {
    return vibestreams.filter(stream => stream.creator === creator);
  };

  const getVibestreamByRTA = (rtaId: string): VibestreamData | null => {
    return vibestreams.find(stream => stream.rta_id === rtaId) || null;
  };



  // Load vibestreams on mount - on-demand.
  // Only load when explicitly requested to avoid 500 errors on empty state
  // useEffect(() => {
  //   refreshVibestreams();
  // }, []);

  const contextValue: FilCDNContextType = {
    vibestreams,
    loading,
    error,
    isConnected: connected,
    networkType: getNetworkType(),
    currentAddress,
    refreshVibestreams,
    downloadChunk,
    getVibestreamsByCreator,
    getVibestreamByRTA,
    constructFilCDNUrl,
  };

  return (
    <FilCDNContext.Provider value={contextValue}>
      {children}
    </FilCDNContext.Provider>
  );
};

export const useFilCDN = (): FilCDNContextType => {
  const context = useContext(FilCDNContext);
  if (context === undefined) {
    throw new Error('useFilCDN must be used within a FilCDNProvider');
  }
  return context;
};

export default FilCDNProvider; 