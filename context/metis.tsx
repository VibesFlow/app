import React, { createContext, useContext, ReactNode } from 'react';
import { createConfig, WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';

// Simple Metis Hyperion chain config
const metisHyperion = {
  id: 133717,
  name: 'Metis Hyperion Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Metis',
    symbol: 'tMETIS',
  },
  rpcUrls: {
    default: { 
      http: ['https://hyperion-testnet.metisdevops.link'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Hyperion Explorer', 
      url: 'https://hyperion-testnet-explorer.metisdevops.link' 
    },
  },
  testnet: true,
} as const;

// Simple Wagmi config
const wagmiConfig = createConfig({
  chains: [metisHyperion],
  connectors: [
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [metisHyperion.id]: http(),
  },
});

// Simple QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes 
    },
  },
});

// Context for Metis wallet
interface MetisWalletContextType {
  address: string | undefined;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

const MetisWalletContext = createContext<MetisWalletContextType>({
  address: undefined,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  error: null,
});

// Hook to use Metis wallet
export const useMetisWallet = () => {
  const context = useContext(MetisWalletContext);
  if (!context) {
    throw new Error('useMetisWallet must be used within MetisWalletProvider');
  }
  return context;
};

// Internal component that uses Wagmi hooks
const MetisWalletContent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const { connect: wagmiConnect, connectors, error } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const connect = async () => {
    const injectedConnector = connectors.find(c => c.type === 'injected');
    if (injectedConnector) {
      await wagmiConnect({ connector: injectedConnector });
    } else {
      throw new Error('No browser wallet found. Please install MetaMask.');
    }
  };

  const disconnect = () => {
    wagmiDisconnect();
  };

  const contextValue: MetisWalletContextType = {
    address,
    isConnected,
    connect,
    disconnect,
    error: error?.message || null,
  };

  return (
    <MetisWalletContext.Provider value={contextValue}>
      {children}
    </MetisWalletContext.Provider>
  );
};

// Main provider component
export const MetisWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <MetisWalletContent>
          {children}
        </MetisWalletContent>
      </WagmiProvider>
    </QueryClientProvider>
  );
}; 