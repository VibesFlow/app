import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupNightly } from '@near-wallet-selector/nightly';
import { setupSender } from '@near-wallet-selector/sender';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import * as nearAPI from 'near-api-js';

// Contract addresses for deployed VibesFlow system
const CONTRACT_ADDRESSES = {
  RTA_FACTORY: 'rtav2.vibesflow.testnet',
  V1_CHUNKER: 'v1chunker.vibesflow.testnet',
  NETWORK: 'testnet'
};

const THIRTY_TGAS = "30000000000000";

interface WalletAccount {
  accountId: string;
  publicKey: string;
  network: string;
}

interface WalletContextType {
  account: WalletAccount | null;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (transaction: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  modal: any;
  selector: any;
  availableWallets: any[];
  connectToWallet: (walletId: string) => Promise<void>;
}

interface RTAConfig {
  mode: 'solo' | 'group';
  store_to_filecoin: boolean;
  distance?: number;
  ticket_amount?: number;
  ticket_price?: string;
  pay_per_stream: boolean;
  stream_price?: string;
  creator: string;
  created_at: number;
}

interface HotWalletContextType {
  accountId: string | null;
  isConnected: boolean;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSendTransaction: (transaction: any) => Promise<any>;
  createRTANFT: (rtaId: string, config: RTAConfig) => Promise<string>;
  addChunkToRTA: (rtaId: string, chunkId: number, filecoinCid: string, chunkOwner: string) => Promise<void>;
  finalizeRTA: (rtaId: string, masterCid: string) => Promise<void>;
  isRTAClosed: (rtaId: string) => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);
const HotWalletContext = createContext<HotWalletContextType | undefined>(undefined);

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const useHotWallet = (): HotWalletContextType => {
  const context = useContext(HotWalletContext);
  if (context === undefined) {
    throw new Error('useHotWallet must be used within a HotWalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: React.ReactNode;
}

interface HotWalletProviderProps {
  children: ReactNode;
}

let globalSelector: any = null;

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<any[]>([]);

  useEffect(() => {
    // Only initialize on web platform
    if (Platform.OS === 'web') {
      initWalletSelector();
    } else {
      setError('NEAR wallet selector is only supported on web platform');
    }
  }, []);

  const initWalletSelector = async () => {
    try {
      // Setup wallet selector with reliable RPC endpoint
      globalSelector = await setupWalletSelector({
        network: {
          networkId: "testnet",
          nodeUrl: "https://test.rpc.fastnear.com",
          helperUrl: "https://helper.testnet.near.org",
          explorerUrl: "https://testnet.nearblocks.io",
          indexerUrl: "https://testnet-api.kitwallet.app",
        },
        modules: [
          setupHereWallet(),
          setupMeteorWallet(),
          setupNightly(),
          setupSender(),
          setupMyNearWallet(),
        ],
      });

      // Get available wallets from the selector's store
      const state = globalSelector.store.getState();
      const wallets = state.modules || [];
      setAvailableWallets(wallets);

      // Listen for wallet state changes
      const subscription = globalSelector.store.observable.subscribe(async (state: any) => {
        const { accounts, modules } = state;
        
        // Update available wallets when they change
        if (modules) {
          setAvailableWallets(modules);
        }
        
        if (accounts && accounts.length > 0) {
          const accountId = accounts[0].accountId;
          const publicKey = accounts[0].publicKey || '';
          
          setAccount({
            accountId,
            publicKey,
            network: 'testnet'
          });
          setConnecting(false);
          setError(null);
          
          console.log('✅ Wallet connected:', accountId);
        } else {
          setAccount(null);
          setConnecting(false);
        }
      });

      // Check if already connected
      if (state.accounts && state.accounts.length > 0) {
        const accountId = state.accounts[0].accountId;
        const publicKey = state.accounts[0].publicKey || '';
        
        setAccount({
          accountId,
          publicKey,
          network: 'testnet'
        });
        
        console.log('✅ Wallet already connected:', accountId);
      }

      console.log('✅ Wallet selector initialized successfully');

    } catch (err: any) {
      console.error('❌ Failed to initialize wallet selector:', err);
      setError(`Failed to initialize wallet selector: ${err.message}`);
    }
  };

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);

    } catch (err: any) {
      console.error('❌ Connect error:', err);
      setError(err.message || 'Failed to connect wallet');
      setConnecting(false);
    }
  }, []);

  const connectToWallet = useCallback(async (walletId: string) => {
    try {
      setConnecting(true);
      setError(null);

      if (!globalSelector) {
        throw new Error('Wallet selector not initialized');
      }

      console.log('🔗 Connecting to wallet:', walletId);
      
      const wallet = await globalSelector.wallet(walletId);
      const result = await wallet.signIn({
        contractId: CONTRACT_ADDRESSES.RTA_FACTORY,
      });
      
    } catch (err: any) {
      console.error('❌ Wallet connection error:', err);
      setError(err.message || 'Failed to connect to wallet');
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (globalSelector) {
        const wallet = await globalSelector.wallet();
        if (wallet) {
          await wallet.signOut();
        }
      }
      setAccount(null);
      setError(null);
      console.log('✅ Wallet disconnected');
    } catch (err) {
      console.error('❌ Disconnect error:', err);
    }
  }, []);

  const signTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!account || !globalSelector) {
      throw new Error('No wallet connected');
    }

    try {
      const wallet = await globalSelector.wallet();
      const result = await wallet.signAndSendTransaction({
        receiverId: transaction.receiverId,
        actions: transaction.actions,
      });
      
      return result.transaction.hash;
    } catch (err: any) {
      console.error('❌ Transaction signing failed:', err);
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [account]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!account || !globalSelector) {
      throw new Error('No wallet connected');
    }

    try {
      const wallet = await globalSelector.wallet();
      const result = await wallet.signMessage({
        message,
        recipient: CONTRACT_ADDRESSES.RTA_FACTORY,
        nonce: Array.from(crypto.getRandomValues(new Uint8Array(32))),
      });
      
      return result.signature;
    } catch (err: any) {
      console.error('❌ Message signing failed:', err);
      throw new Error(`Message signing failed: ${err.message}`);
    }
  }, [account]);

  const value: WalletContextType = {
    account,
    connecting,
    connected: !!account,
    error,
    connect,
    disconnect,
    signTransaction,
    signMessage,
    modal: null, // We don't use the modal UI package anymore
    selector: globalSelector,
    availableWallets,
    connectToWallet
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const HotWalletProvider: React.FC<HotWalletProviderProps> = ({ children }) => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState('0');

  const { account, connected } = useWallet();

  useEffect(() => {
    if (connected && account) {
      setAccountId(account.accountId);
      setIsConnected(true);
      fetchBalance(account.accountId);
    } else {
      setAccountId(null);
      setIsConnected(false);
      setBalance('0');
    }
  }, [account, connected]);

  const fetchBalance = async (accountId: string) => {
    try {
      // Skip balance fetching to avoid CORS issues
      // Balance display is not critical for core functionality
      setBalance('Connected');
      console.log('📊 Balance fetching skipped to avoid CORS issues');
    } catch (error) {
      console.warn('Failed to fetch balance:', error);
      setBalance('0');
    }
  };

  const connect = async (): Promise<void> => {
  };

  const disconnect = () => {
    setAccountId(null);
    setIsConnected(false);
    setBalance('0');
  };

  const signAndSendTransaction = async (transaction: any): Promise<any> => {
    if (!globalSelector || !isConnected || !accountId) {
      throw new Error('Wallet not connected');
    }

    try {
      const wallet = await globalSelector.wallet();
      const result = await wallet.signAndSendTransaction({
        receiverId: transaction.receiverId,
        actions: transaction.actions,
      });
      
      console.log('✅ Transaction sent:', result);
      return result;
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  };

  // Create RTA NFT using proper NEAR wallet selector
  const createRTANFT = async (rtaId: string, config: RTAConfig): Promise<string> => {
    if (!globalSelector || !isConnected || !accountId) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('🔥 Creating RTA NFT for vibestream:', rtaId);

      const contractConfig = {
        mode: config.mode,
        store_to_filecoin: config.store_to_filecoin,
        distance: config.distance || null,
        ticket_amount: config.ticket_amount || null,
        ticket_price: config.ticket_price || null,
        pay_per_stream: config.pay_per_stream,
        stream_price: config.stream_price || null,
        creator: config.creator,
        created_at: config.created_at,
      };

      // Calculate proper deposit
      let depositAmount = '10000000000000000000000'; // 0.01 NEAR base
      if (config.store_to_filecoin) {
        depositAmount = '15000000000000000000000'; // +0.005 NEAR for Filecoin
      }
      if (config.mode === 'group' && config.ticket_amount && config.ticket_amount > 10) {
        depositAmount = '20000000000000000000000'; // +0.005 NEAR for large groups
      }

      const wallet = await globalSelector.wallet();
      
      // Create RTA NFT transaction
      const result = await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ADDRESSES.RTA_FACTORY,
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: 'create_rta',
            args: {
              rta_id: rtaId,
              config: contractConfig,
              receiver_id: accountId,
            },
            gas: THIRTY_TGAS,
            deposit: depositAmount
          }
        }]
      });

      console.log('🔥 RTA NFT created successfully:', result);

      // Chunking will happen in parallel background process
      return `rta_${rtaId}`;

    } catch (error) {
      console.error('❌ Failed to create RTA NFT:', error);
      throw error;
    }
  };

  const addChunkToRTA = async (rtaId: string, chunkId: number, filecoinCid: string, chunkOwner: string): Promise<void> => {
    if (!globalSelector || !isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const wallet = await globalSelector.wallet();
      await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ADDRESSES.RTA_FACTORY,
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: 'add_cids',
            args: {
              rta_id: rtaId,
              cids: [filecoinCid],
              chunk_owners: [chunkOwner],
            },
            gas: THIRTY_TGAS,
            deposit: '0'
          }
        }]
      });
      
      console.log('✅ Chunk added to RTA successfully');
    } catch (error) {
      console.error('❌ Failed to add chunk to RTA:', error);
      throw error;
    }
  };

  const finalizeRTA = async (rtaId: string, masterCid: string): Promise<void> => {
    if (!globalSelector || !isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const wallet = await globalSelector.wallet();
      await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ADDRESSES.RTA_FACTORY,
        actions: [{
          type: 'FunctionCall',
          params: {
            methodName: 'finalize',
            args: {
              rta_id: rtaId,
              filecoin_master_cid: masterCid,
            },
            gas: THIRTY_TGAS,
            deposit: '0'
          }
        }]
      });
      
      console.log('✅ RTA finalized successfully');
    } catch (error) {
      console.error('❌ Failed to finalize RTA:', error);
      throw error;
    }
  };

  const isRTAClosed = async (rtaId: string): Promise<boolean> => {
    try {
      return false;
    } catch (error) {
      console.error('❌ Failed to check RTA status:', error);
      return false;
    }
  };

  const contextValue: HotWalletContextType = {
    accountId,
    isConnected,
    balance,
    connect,
    disconnect,
    signAndSendTransaction,
    createRTANFT,
    addChunkToRTA,
    finalizeRTA,
    isRTAClosed,
  };

  return (
    <HotWalletContext.Provider value={contextValue}>
      {children}
    </HotWalletContext.Provider>
  );
};