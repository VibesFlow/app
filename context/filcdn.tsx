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
      console.log(`📡 Calling API: ${backendUrl}/api/vibestreams`);
      
      const response = await fetch(`${backendUrl}/api/vibestreams`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vibestreams: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`📊 Raw API response:`, {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        firstItem: Array.isArray(data) && data.length > 0 ? {
          rta_id: data[0].rta_id,
          creator: data[0].creator,
          chunks: data[0].chunks,
          duration: data[0].rta_duration,
          is_complete: data[0].is_complete
        } : null
      });
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array of vibestreams');
      }

      // Transform the data to ensure proper URL mapping
      const transformedData = data.map((vibestream: any) => ({
        ...vibestream,
        chunks_detail: vibestream.chunks_detail?.map((chunk: any) => ({
          ...chunk,
          url: chunk.url || chunk.filcdn_url || `https://gateway.pinata.cloud/ipfs/${chunk.cid}`, // Use existing URL or fallback
          fallback_url: `https://gateway.pinata.cloud/ipfs/${chunk.cid}` // Always provide IPFS fallback
        })) || []
      }));

      console.log(`✅ Loaded ${transformedData.length} vibestreams from Synapse SDK`);
      console.log(`📋 Sample vibestream:`, transformedData[0] ? {
        rta_id: transformedData[0].rta_id,
        creator: transformedData[0].creator,
        total_chunks: transformedData[0].chunks_detail?.length || 0,
        first_chunk_url: transformedData[0].chunks_detail?.[0]?.url,
        rta_duration: transformedData[0].rta_duration
      } : 'No vibestreams available');
      
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