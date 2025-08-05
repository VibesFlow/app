/**
 * FilCDN Context - Integration with Synapse SDK
 * Bridges frontend and backend for vibestream data retrieval
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  duration?: number;
  participants?: number;
  owner?: string;
  sequence?: number;
}

interface FilCDNContextType {
  vibestreams: VibestreamData[];
  loading: boolean;
  error: string | null;
  refreshVibestreams: () => Promise<void>;
  downloadChunk: (cid: string) => Promise<ArrayBuffer>;
  getVibestreamsByCreator: (creator: string) => VibestreamData[];
  getVibestreamByRTA: (rtaId: string) => VibestreamData | null;
}

const FilCDNContext = createContext<FilCDNContextType | undefined>(undefined);

interface FilCDNProviderProps {
  children: React.ReactNode;
}

export const FilCDNProvider: React.FC<FilCDNProviderProps> = ({ children }) => {
  const [vibestreams, setVibestreams] = useState<VibestreamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Transform the data to ensure proper URL mapping with CORS proxy
      const transformedData = data.map((vibestream: any) => ({
        ...vibestream,
        chunks_detail: vibestream.chunks_detail?.map((chunk: any) => ({
          ...chunk,
          // Use CORS proxy for all chunks to avoid CORS issues
          url: chunk.cid ? `${backendUrl}/api/proxy/${chunk.cid}` : (chunk.url || `https://gateway.pinata.cloud/ipfs/${chunk.cid}`),
          filcdn_url: chunk.cid ? `https://${process.env.FILECOIN_ADDRESS || '0xedD801D6c993B3c8052e485825A725ee09F1ff4D'}.calibration.filcdn.io/${chunk.cid}` : undefined,
        })) || []
      }));

      console.log(`✅ Loaded ${transformedData.length} vibestreams from Synapse SDK`);
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

  const downloadChunk = async (cid: string): Promise<ArrayBuffer> => {
    try {
      console.log(`📥 Downloading chunk ${cid} from FilCDN...`);
      
      const backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai';
      const response = await fetch(`${backendUrl}/api/download/${cid}`, {
        method: 'GET'
      });

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
    refreshVibestreams,
    downloadChunk,
    getVibestreamsByCreator,
    getVibestreamByRTA,
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