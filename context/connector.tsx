import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

// Ensure polyfills are loaded first
import '../configs/polyfills';

// Metis wallet context - imported directly but used lazily
import { MetisWalletProvider, useMetisWallet } from '../context/metis';

// Viem for Metis contract interactions (better polyfill compatibility)
import { createPublicClient, createWalletClient, custom, parseEther, encodeFunctionData, parseAbiItem, getEventSelector } from 'viem';
import { metis } from 'viem/chains';

// Near wallet imports (web and mobile)
let setupWalletSelector: any = null;
let setupHereWallet: any = null;
let setupMyNearWallet: any = null;
let nearAPI: any = null;
let KeyPair: any = null;
let HereWallet: any = null;

// Conditional imports based on platform
if (Platform.OS === 'web') {
  try {
    // Near wallet selector (web)
    setupWalletSelector = require('@near-wallet-selector/core').setupWalletSelector;
    setupHereWallet = require('@near-wallet-selector/here-wallet').setupHereWallet;
    setupMyNearWallet = require('@near-wallet-selector/my-near-wallet').setupMyNearWallet;
    nearAPI = require('near-api-js');
    KeyPair = require('near-api-js').KeyPair;
    
  } catch (error) {
    console.warn('⚠️ Near wallet dependencies not available:', error);
  }

} else {
  try {
    // Mobile Near support
    nearAPI = require('near-api-js');
    KeyPair = require('near-api-js').KeyPair;
    
    // HERE Wallet mobile
    try {
      const hereWalletModule = require('@here-wallet/core');
      HereWallet = hereWalletModule.HereWallet || hereWalletModule.default || hereWalletModule;
      console.log('📱 HERE Wallet loaded for mobile');
    } catch (hereWalletError: any) {
      console.warn('⚠️ HERE Wallet not available for mobile:', hereWalletError?.message);
      HereWallet = null;
    }
  } catch (error) {
    console.warn('⚠️ Mobile Near dependencies not available:', error);
  }
}

// Contract addresses and network configurations
const CONTRACT_ADDRESSES = {
  NEAR: {
    RTA_FACTORY: process.env.RTA_FACTORY_CONTRACT || process.env.EXPO_PUBLIC_RTA_FACTORY_CONTRACT || 'rtav2.vibesflow.testnet',
    V1_CHUNKER: process.env.V1_CHUNKER_CONTRACT || process.env.EXPO_PUBLIC_V1_CHUNKER_CONTRACT || 'v1chunker.vibesflow.testnet',
    NETWORK: process.env.NEAR_NETWORK || process.env.EXPO_PUBLIC_NEAR_NETWORK || 'testnet'
  },
  METIS: {
    VIBE_FACTORY: process.env.VIBE_FACTORY_ADDRESS || process.env.EXPO_PUBLIC_VIBE_FACTORY_ADDRESS || '0x49B2E60fF51B107624be84363B718cfF292A0517',
    VIBE_KIOSK: process.env.VIBE_KIOSK_ADDRESS || process.env.EXPO_PUBLIC_VIBE_KIOSK_ADDRESS || '0x5ac3193b6DD7B520D63EbE65b59f97a2dF4ee686',
    PPM: process.env.PPM_ADDRESS || process.env.EXPO_PUBLIC_PPM_ADDRESS || '0x0BCc714c6eB21FbE2eEcB4A2f40356af181eAefB',
    SUBSCRIPTIONS: process.env.SUBSCRIPTIONS_ADDRESS || process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ADDRESS || '0xC5178c585784B93bc408eAd828701155a41e4f76',
    PROXY_ADMIN: process.env.PROXY_ADMIN_ADDRESS || process.env.EXPO_PUBLIC_PROXY_ADMIN_ADDRESS || '0x9DdF4Ff8FAc224fF54701c85b77A00F1b84A66Df',
    TREASURY_RECEIVER: process.env.TREASURY_RECEIVER || process.env.EXPO_PUBLIC_TREASURY_RECEIVER || '0x058271e764154c322F3D3dDC18aF44F7d91B1c80',
    NETWORK: 'hyperion',
    CHAIN_ID: parseInt(process.env.HYPERION_CHAIN_ID || process.env.EXPO_PUBLIC_HYPERION_CHAIN_ID || '133717'),
    RPC_URL: process.env.HYPERION_RPC_URL || process.env.EXPO_PUBLIC_HYPERION_RPC_URL || 'https://hyperion-testnet.metisdevops.link'
  }
};

// Guest account configuration - from environment variables with fallbacks
const GUEST_CONFIG = {
  ACCOUNT_ID: process.env.GUEST_ACCOUNT_ID || process.env.EXPO_PUBLIC_GUEST_ACCOUNT_ID || 'guest.vibesflow.testnet',
  PRIVATE_KEY: process.env.GUEST_ACCOUNT_PRIVATE_KEY || process.env.EXPO_PUBLIC_GUEST_ACCOUNT_PRIVATE_KEY || 'ed25519:48MKoy4G2L8WG8rZmEVccevy7DrJ9tk4nkHyjqFPnJRVYSXVt7tBQuRrQbdNxGxuqrhcyusjopESZ8WFuppNFQkf',
  PUBLIC_KEY: process.env.GUEST_ACCOUNT_PUBLIC_KEY || process.env.EXPO_PUBLIC_GUEST_ACCOUNT_PUBLIC_KEY || 'ed25519:HU4zJjREY9xKroH6pBa968pLFwkKd2gW8aeXJt7CsVnX'
};

// Supported wallet types
type WalletType = 'guest' | 'near' | 'metis';
type NetworkType = 'near-testnet' | 'metis-hyperion';

interface WalletAccount {
  accountId: string;
  publicKey: string;
  network: NetworkType;
  walletType: WalletType;
  isGuest?: boolean;
}

interface RTAConfig {
  mode: 'solo' | 'group';
  store_to_filecoin: boolean;
  distance?: number;
  ticket_amount?: number;
  ticket_price?: string;
  pay_per_stream: boolean;
  stream_price: string;
  creator: string;
  created_at: number;
}

interface UserVibestreamData {
  vibeId: string;
  rtaId: string;
  creator: string;
  created_at: number;
  mode: 'solo' | 'group';
  is_closed: boolean;
  total_chunks: number;
  filecoin_master_cid?: string;
  // Cross-matched FilCDN data
  filcdn_duration?: string;
  filcdn_chunks?: number;
  filcdn_size_mb?: number;
  // Participant data (for group mode)
  participants?: string[];
}

interface WalletContextType {
  account: WalletAccount | null;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  modal: {
    isOpen: boolean;
    step: 'selection' | 'near-options' | 'metis-options' | 'connecting';
  };
  
  // Connection methods
  openModal: () => void;
  closeModal: () => void;
  setModalStep: (step: 'selection' | 'near-options' | 'metis-options' | 'connecting') => void;
  connectAsGuest: () => Promise<void>;
  connectNear: (provider: 'here' | 'mynear') => Promise<void>;
  connectMetis: () => Promise<void>;
  disconnect: () => void;
  
  // Transaction methods
  signTransaction: (transaction: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  
  // Smart contract methods (network-aware)
  createRTANFT: (rtaId: string, config: RTAConfig) => Promise<string>;
  createVibestreamAndDelegate: (rtaId: string, config: RTAConfig, delegatee?: string) => Promise<string>;
  addChunkToRTA: (rtaId: string, chunkId: number, filecoinCid: string, chunkOwner: string) => Promise<void>;
  finalizeRTA: (rtaId: string, masterCid: string) => Promise<void>;
  isRTAClosed: (rtaId: string) => Promise<boolean>;
  
  // User vibestream query methods
  getUserVibestreams: () => Promise<UserVibestreamData[]>;
  getUserVibestreamCount: () => Promise<number>;
  getVibestreamMetadata: (vibeId: string) => Promise<any>;
  
  // Participant tracking methods (for future group mode)
  addParticipantToVibestream: (vibeId: string, participantId: string) => Promise<void>;
  removeParticipantFromVibestream: (vibeId: string, participantId: string) => Promise<void>;
  getVibestreamParticipants: (vibeId: string) => Promise<string[]>;
  
  // PPM contract methods
  authorizePPMSpending: (vibeId: string, allowanceAmount: string) => Promise<string>;
  joinPPMVibestream: (vibeId: string) => Promise<string>;
  leavePPMVibestream: (vibeId: string) => Promise<string>;
  getPPMAllowance: (vibeId: string, participant?: string) => Promise<any>;
  
  // Subscription contract methods (Metis only for now)
  isUserSubscribed: () => Promise<boolean>;
  
  // Network-aware session info
  getNetworkInfo: () => { type: NetworkType; contracts: any } | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: React.ReactNode;
}

let globalNearSelector: any = null;
let guestKeyPair: any = null;

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState({
    isOpen: false,
    step: 'selection' as 'selection' | 'near-options' | 'metis-options' | 'connecting'
  });
  
  // Mobile HERE Wallet state
  const [hereWallet, setHereWallet] = useState<any | null>(null);
  
  // Metis wallet state - will be initialized when user clicks "Metis Hyperion"
  const [metisWalletReady, setMetisWalletReady] = useState(false);
  
  // Simplified Metis wallet state tracking - event handling moved to MetisWalletBridge
  const useMetisWalletSync = () => {
    // This is now handled by MetisWalletBridge component below
    // No need for duplicate event listeners
  };

  // Use the Metis wallet sync hook
  useMetisWalletSync();

  // Initialize guest account keypair when needed
  const initializeGuestAccount = () => {
    try {
      if (KeyPair && !guestKeyPair) {
        guestKeyPair = KeyPair.fromString(GUEST_CONFIG.PRIVATE_KEY);
        console.log('✅ Guest account initialized:', GUEST_CONFIG.ACCOUNT_ID);
      }
    } catch (error) {
      console.error('❌ Failed to initialize guest account:', error);
    }
  };

  const openModal = useCallback(() => {
    setModal({ isOpen: true, step: 'selection' });
    setError(null);
  }, []);

  const closeModal = useCallback(() => {
    setModal({ isOpen: false, step: 'selection' });
    setError(null);
  }, []);



  const setModalStep = useCallback((step: 'selection' | 'near-options' | 'metis-options' | 'connecting') => {
    setModal(prev => ({ ...prev, step }));
  }, []);

  const connectAsGuest = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);
      setModalStep('connecting');
      
      // Initialize guest account on demand
      initializeGuestAccount();
      
      if (!guestKeyPair) {
        throw new Error('Guest account not initialized');
      }

      // Set guest account as connected
      setAccount({
        accountId: GUEST_CONFIG.ACCOUNT_ID,
        publicKey: GUEST_CONFIG.PUBLIC_KEY,
        network: 'near-testnet',
        walletType: 'guest',
        isGuest: true
      });
      
      setConnecting(false);
      closeModal();
      
      console.log('✅ Connected as guest:', GUEST_CONFIG.ACCOUNT_ID);
    } catch (err: any) {
      console.error('❌ Guest connection error:', err);
      setError(err.message || 'Failed to connect as guest');
      setConnecting(false);
    }
  }, [closeModal, setModalStep]);

  const connectNear = useCallback(async (provider: 'here' | 'mynear') => {
    try {
      setConnecting(true);
      setError(null);
      setModalStep('connecting');

      if (Platform.OS === 'web') {
        // Web Near connection
        if (!setupWalletSelector) {
          throw new Error('Near wallet selector not available');
        }

        if (!globalNearSelector) {
          const networkConfig = {
            networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
            nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com",
            helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || "https://helper.testnet.near.org",
            explorerUrl: process.env.EXPO_PUBLIC_NEAR_EXPLORER_URL || "https://testnet.nearblocks.io",
            indexerUrl: "https://testnet-api.kitwallet.app",
          };

          globalNearSelector = await setupWalletSelector({
            network: networkConfig,
            modules: [
              setupHereWallet({ networkId: 'testnet' }),
              setupMyNearWallet({ networkId: 'testnet' }),
            ],
          });
        }

        const walletId = provider === 'here' ? 'here-wallet' : 'my-near-wallet';
        const wallet = await globalNearSelector.wallet(walletId);
        const result = await wallet.signIn({
          contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
        });

        // Get account info from result or selector state
        const state = globalNearSelector.store.getState();
        if (state.accounts && state.accounts.length > 0) {
          const accountId = state.accounts[0].accountId;
          const publicKey = state.accounts[0].publicKey || '';
          
          setAccount({
            accountId,
            publicKey,
            network: 'near-testnet',
            walletType: 'near',
            isGuest: false
          });
        }

        console.log('✅ Near web wallet connected:', provider);
      } else {
        // Mobile Near connection (HERE Wallet only)
        if (provider !== 'here') {
          throw new Error('Only HERE Wallet is supported on mobile');
        }

        // Initialize mobile HERE Wallet on demand
        if (!hereWallet && HereWallet) {
          try {
            let hereWalletInstance;
            
            if (typeof HereWallet === 'function') {
              try {
                hereWalletInstance = new HereWallet({
                  networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
                  nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com'
                });
              } catch (constructorError: any) {
                if (typeof HereWallet.connect === 'function') {
                  hereWalletInstance = await HereWallet.connect({
                    networkId: CONTRACT_ADDRESSES.NEAR.NETWORK
                  });
                } else {
                  hereWalletInstance = HereWallet();
                }
              }
            } else if (HereWallet.instance) {
              hereWalletInstance = HereWallet.instance;
            }
            
            if (hereWalletInstance) {
              setHereWallet(hereWalletInstance);
            }
          } catch (error: any) {
            console.warn('⚠️ HERE Wallet initialization failed:', error?.message);
          }
        }

        if (!hereWallet) {
          throw new Error('HERE Wallet not available on this device');
        }

        const result = await hereWallet.signIn({ 
          contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          successUrl: 'vibesflow://wallet-success',
          failureUrl: 'vibesflow://wallet-failure'
        });
        
        let accountId;
        if (typeof result === 'string') {
          accountId = result;
        } else if (result && (result.accountId || result.account_id)) {
          accountId = result.accountId || result.account_id;
        } else if (typeof hereWallet.getAccountId === 'function') {
          accountId = await hereWallet.getAccountId();
        }
        
        if (!accountId) {
          throw new Error('Failed to get account ID from HERE Wallet');
        }

        setAccount({
          accountId,
          publicKey: '',
          network: 'near-testnet',
          walletType: 'near',
          isGuest: false
        });

        console.log('✅ Near mobile wallet connected:', accountId);
      }
      
      setConnecting(false);
      closeModal();
    } catch (err: any) {
      console.error('❌ Near connection error:', err);
      setError(err.message || 'Failed to connect Near wallet');
      setConnecting(false);
    }
  }, [hereWallet, closeModal]);

  const connectMetis = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setModalStep('connecting');
    
    try {
      console.log('🔗 Connecting to Metis Hyperion...');
      
      // Simple browser wallet connection
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts: string[] = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (accounts && accounts.length > 0) {
          setAccount({
            accountId: accounts[0],
            walletType: 'metis',
            publicKey: accounts[0],
            network: 'metis-hyperion' as NetworkType,
          });
          
          console.log('✅ Connected to Metis:', accounts[0]);
          setError(null);
          setConnecting(false);
          closeModal();
        } else {
          throw new Error('No accounts found');
        }
      } else {
        throw new Error('No browser wallet found. Please install MetaMask.');
      }
      
    } catch (err: any) {
      console.error('❌ Metis connection failed:', err);
      setError(err.message || 'Failed to connect to Metis wallet');
      setConnecting(false);
      setModalStep('selection');
    }
  }, [closeModal, setModalStep]);

  const disconnect = useCallback(() => {
    try {
      setAccount(null);
      setConnecting(false);
      setError(null);
      closeModal();
      
      // Reset Metis wallet state
      setMetisWalletReady(false);
      
      // Clear HERE wallet if connected
      if (hereWallet) {
        setHereWallet(null);
      }
      
      console.log('✅ Disconnected from all wallets');
    } catch (err: any) {
      console.error('❌ Disconnect failed:', err);
      setError(err.message || 'Failed to disconnect');
    }
  }, [hereWallet, closeModal]);

  const signTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.walletType === 'guest' && guestKeyPair) {
        // Sign with guest account
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
        
        const nearConnection = await nearAPI.connect({
          networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
          keyStore: keyStore,
          nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
          walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
          helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
        });
        
        const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);
        const result = await guestAccount.signAndSendTransaction({
          receiverId: transaction.receiverId,
          actions: transaction.actions,
        });
        
        return result.transaction.hash;
      } else if (account.walletType === 'near') {
        // Sign with Near wallet
        if (Platform.OS === 'web' && globalNearSelector) {
          const wallet = await globalNearSelector.wallet();
          const result = await wallet.signAndSendTransaction({
            receiverId: transaction.receiverId,
            actions: transaction.actions,
          });
          return result.transaction.hash;
        } else if (hereWallet) {
          const result = await hereWallet.signAndSendTransaction({
            receiverId: transaction.receiverId,
            actions: transaction.actions,
          });
          return result.transaction.hash;
        }
        throw new Error('Near wallet not available');
              } else if (account.walletType === 'metis') {
                // Sign with Metis wallet using browser wallet
                if (
                  Platform.OS === 'web' &&
                  typeof window !== 'undefined' &&
                  (window as any).ethereum
                ) {
                  const result = await (window as any).ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                      from: account.accountId,
                to: transaction.receiverId,
                value: '0x0', // Convert properly if needed
                data: '0x', // Convert transaction data
                gas: '0x5208', // Default gas limit
                gasPrice: '0x09184e72a000', // Default gas price
              }],
            });
            return result;
          }
          throw new Error('Metis wallet not available');
        }
      
      throw new Error('No suitable wallet method available');
    } catch (err: any) {
      console.error('❌ Transaction signing failed:', err);
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [account, hereWallet]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.walletType === 'guest' && guestKeyPair) {
        // Sign message with guest account
        const messageBuffer = Buffer.from(message);
        const signature = guestKeyPair.sign(messageBuffer);
        return Buffer.from(signature.signature).toString('base64');
      } else if (account.walletType === 'near') {
        // Sign with Near wallet
        if (Platform.OS === 'web' && globalNearSelector) {
          const wallet = await globalNearSelector.wallet();
          const result = await wallet.signMessage({
            message,
            recipient: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
            nonce: Array.from(crypto.getRandomValues(new Uint8Array(32))),
          });
          return result.signature;
        } else if (hereWallet) {
          const result = await hereWallet.signMessage({
            message,
            recipient: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
            nonce: Array.from(crypto.getRandomValues(new Uint8Array(32))),
          });
          return result.signature;
        }
        throw new Error('Near wallet not available');
      } else if (account.walletType === 'metis') {
        // Implement Metis message signing using ethereum provider
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const ethProvider = (window as any).ethereum;
          const signature = await ethProvider.request({
            method: 'personal_sign',
            params: [message, account.accountId]
          });
          return signature;
        }
        throw new Error('Ethereum provider not available for Metis signing');
      }
      
      throw new Error('No suitable wallet method available');
    } catch (err: any) {
      console.error('❌ Message signing failed:', err);
      throw new Error(`Message signing failed: ${err.message}`);
    }
  }, [account, hereWallet]);

  // Helper function to upload metadata to Pinata
  const uploadMetadataToPinata = async (rtaId: string, config: RTAConfig): Promise<string> => {
    try {
      const metadata = {
        name: `VibesFlow Vibestream ${rtaId}`,
        description: `A ${config.mode} vibestream created on VibesFlow`,
        attributes: [
          { trait_type: "Mode", value: config.mode },
          { trait_type: "Store to Filecoin", value: config.store_to_filecoin },
          { trait_type: "Creator", value: config.creator },
          { trait_type: "Created At", value: new Date(config.created_at).toISOString() },
          ...(config.distance ? [{ trait_type: "Distance (meters)", value: config.distance }] : []),
          ...(config.ticket_amount ? [{ trait_type: "Tickets Available", value: config.ticket_amount }] : []),
          ...(config.ticket_price ? [{ trait_type: "Ticket Price", value: config.ticket_price }] : []),
        ],
        external_url: "https://vibesflow.ai",
      };

      // Get Pinata credentials from environment
      const pinataApiKey = process.env.PINATA_API_KEY || process.env.EXPO_PUBLIC_PINATA_API_KEY;
      const pinataSecret = process.env.PINATA_API_SECRET || process.env.EXPO_PUBLIC_PINATA_SECRET;

      if (!pinataApiKey || !pinataSecret) {
        console.warn('⚠️ Pinata credentials not found, using minimal metadata');
        // Use a minimal, valid metadata URI that won't cause contract issues
        return `data:application/json,{"name":"Vibestream ${rtaId}","description":"A ${config.mode} vibestream","mode":"${config.mode}"}`;
      }

      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': pinataApiKey,
          'pinata_secret_api_key': pinataSecret,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `vibestream-${rtaId}-metadata.json`,
            keyvalues: {
              vibestream_id: rtaId,
              mode: config.mode,
              creator: config.creator
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const ipfsHash = result.IpfsHash;
      
      console.log('✅ Metadata uploaded to Pinata:', ipfsHash);
      return `ipfs://${ipfsHash}`;
      
    } catch (error) {
      console.warn('⚠️ Failed to upload to Pinata, using minimal metadata:', error);
      // Use minimal metadata that won't cause contract issues
      return `data:application/json,{"name":"VibesFlow Vibestream ${rtaId}","description":"A ${config.mode} vibestream","mode":"${config.mode}"}`;
    }
  };

  // Create Vibestream with integrated delegation on Metis (single transaction)
  const createVibestreamAndDelegate = useCallback(async (rtaId: string, config: RTAConfig, delegatee?: string): Promise<string> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    if (account.network !== 'metis-hyperion') {
      throw new Error('This function is only for Metis network');
    }

    try {
      console.log('🔥 Creating Vibestream with integrated delegation on Metis:', rtaId);

      // Check if we have a Metis account connected
      if (account?.walletType !== 'metis') {
        throw new Error('Metis wallet not properly connected');
      }

      // Check ethereum provider and network
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      // Verify we're on the correct network using window.ethereum (with type safety)
      const ethProvider = (window as any).ethereum;
      if (!ethProvider || typeof ethProvider.request !== 'function') {
        throw new Error('Ethereum provider not available');
      }
      
      const chainId = await ethProvider.request({ method: 'eth_chainId' });
      const expectedChainId = '0x20a55'; // 133717 in hex
      if (chainId !== expectedChainId) {
        throw new Error(`Wrong network: expected Metis Hyperion (${expectedChainId}), got ${chainId}`);
      }

      // Get current account (reuse existing ethProvider)
      const accounts: string[] = await ethProvider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      // Define Metis Hyperion chain config using our environment variables
      const metisHyperion = {
        id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
        name: 'Metis Hyperion Testnet',
        network: 'metis-hyperion',
        nativeCurrency: {
          decimals: 18,
          name: 'tMETIS',
          symbol: 'tMETIS',
        },
        rpcUrls: {
          default: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
          public: {
            http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
          },
        },
        blockExplorers: {
          default: {
            name: 'Metis Hyperion Explorer',
            url: 'https://hyperion-testnet-explorer.metisdevops.link',
          },
        },
      };

      // VibeFactory ABI for createVibestreamWithDelegate function - matches current VibeFactory.sol with PPM integration
      const createVibestreamWithDelegateAbi = parseAbiItem(
        'function createVibestreamWithDelegate(string calldata mode, bool storeToFilecoin, uint256 distance, string calldata metadataURI, uint256 ticketsAmount, uint256 ticketPrice, bool payPerStream, uint256 streamPrice, address delegatee) external returns (uint256 vibeId)'
      );

      // Prepare contract parameters to match the struct in contracts
      const mode = config.mode; // 'solo' or 'group'
      const storeToFilecoin = config.store_to_filecoin;
      
      // Ensure all parameters are properly defined for the contract
      const distance = BigInt(config.distance || 0);
      // FIXED: Temporarily set ticketsAmount to 0 to avoid VibeKiosk call that's causing revert
      // The VibeFactory tries to call VibeKiosk when ticketsAmount > 0 && mode != "solo"
      // but the VibeKiosk might not be properly configured
      const ticketsAmount = BigInt(0); // TODO: Re-enable when VibeKiosk is properly configured
      
      // Upload metadata to Pinata and get IPFS URI
      const metadataURI = await uploadMetadataToPinata(rtaId, config);
      
      // Convert ticket price from string to wei
      let ticketPriceWei = BigInt(0);
      if (config.ticket_price && parseFloat(config.ticket_price) > 0) {
        ticketPriceWei = parseEther(config.ticket_price);
      }
      
      // Handle pay-per-stream parameters - ensure they're always defined
      const payPerStream = config.pay_per_stream === true; // Explicit boolean
      let streamPriceWei = BigInt(0);
      if (payPerStream && config.stream_price && config.stream_price !== '0' && parseFloat(config.stream_price) > 0) {
        streamPriceWei = parseEther(config.stream_price);
      }
      
      // Set delegatee address - default to zero address if not provided
      const delegateeAddress = delegatee || '0x0000000000000000000000000000000000000000';

      console.log('📋 Contract parameters:', {
        mode,
        storeToFilecoin,
        distance: distance.toString(),
        metadataURI,
        ticketsAmount: ticketsAmount.toString(),
        ticketPrice: ticketPriceWei.toString(),
        payPerStream,
        streamPrice: streamPriceWei.toString(),
        delegatee: delegateeAddress,
        vibeFactory: CONTRACT_ADDRESSES.METIS.VIBE_FACTORY
      });

      // Validate parameters before sending to contract to prevent revert
      if (!mode || mode.length === 0) {
        throw new Error('Mode cannot be empty');
      }
      if (!metadataURI || metadataURI.length === 0) {
        throw new Error('Metadata URI cannot be empty');
      }
      if (payPerStream && mode !== 'group') {
        throw new Error('Pay-per-stream only available for group mode');
      }
      if (payPerStream && streamPriceWei === BigInt(0)) {
        throw new Error('Stream price must be greater than 0 for pay-per-stream');
      }

      // Log the original config for debugging
      console.log('📋 Original config:', config);

      // Create wallet client for contract interaction
      const walletClient = createWalletClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      // Create public client for gas estimation
      const publicClient = createPublicClient({
        chain: metisHyperion,
        transport: custom(ethProvider)
      });

      // Use viem for gas estimation and transaction
      try {
        console.log('📤 Sending createVibestreamWithDelegate transaction to:', CONTRACT_ADDRESSES.METIS.VIBE_FACTORY);
        console.log('🔍 Exact contract arguments:', [
          mode,
          storeToFilecoin,
          distance,
          metadataURI,
          ticketsAmount,
          ticketPriceWei,
          payPerStream,
          streamPriceWei,
          delegateeAddress
        ]);
        
        // Send transaction using viem wallet client with explicit gas settings
        const txHash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.METIS.VIBE_FACTORY as `0x${string}`,
          abi: [createVibestreamWithDelegateAbi],
          functionName: 'createVibestreamWithDelegate',
          args: [
            mode,
            storeToFilecoin,
            distance,
            metadataURI,
            ticketsAmount,
            ticketPriceWei,
            payPerStream,
            streamPriceWei,
            delegateeAddress as `0x${string}`
          ],
          account: accounts[0] as `0x${string}`,
          gas: BigInt(3000000), 
        });

        console.log('✅ Transaction sent:', txHash);
        console.log('🔍 Check transaction on explorer:', `https://hyperion-testnet-explorer.metisdevops.link/tx/${txHash}`);
        
        // Wait for transaction confirmation using viem with extended timeout for Metis
        let receipt;
        try {
          receipt = await publicClient.waitForTransactionReceipt({ 
            hash: txHash,
            timeout: 120000 // 2 minute timeout for Metis testnet
          });
        } catch (timeoutError) {
          console.warn('⏰ Transaction receipt timeout, checking manually...');
          
          // Manual fallback: check transaction status multiple times
          let attempts = 0;
          const maxAttempts = 20;
          
          while (attempts < maxAttempts) {
            try {
              receipt = await publicClient.getTransactionReceipt({ hash: txHash });
              if (receipt) {
                console.log('✅ Got receipt via manual check');
                break;
              }
            } catch (error) {
              // Transaction might still be pending
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            attempts++;
            console.log(`🔄 Manual check attempt ${attempts}/${maxAttempts}`);
          }
          
          if (!receipt) {
            throw new Error(`Transaction submitted but receipt not available after ${maxAttempts * 3} seconds. Check explorer: https://hyperion-testnet-explorer.metisdevops.link/tx/${txHash}`);
          }
        }

        if (receipt && receipt.status === 'success') {
          console.log('✅ Vibestream created successfully on Metis:', receipt);
          
          // Parse receipt logs to get the actual vibeId created by the contract
          try {
            const vibestreamCreatedEvent = parseAbiItem(
              'event VibestreamCreated(uint256 indexed vibeId, address indexed creator, uint256 timestamp, string mode, uint256 ticketsAmount, uint256 ticketPrice, address requestedDelegatee)'
            );
            
            const eventSelector = getEventSelector(vibestreamCreatedEvent);
            
            for (const log of receipt.logs) {
              try {
                // Check if this log matches the VibestreamCreated event
                if (log.topics[0] === eventSelector && log.topics[1]) {
                  // Parse the vibeId from the first indexed topic
                  const vibeId = BigInt(log.topics[1]).toString();
                  console.log('🎯 Extracted vibeId from receipt:', vibeId);
                  return `metis_vibe_${vibeId}`;
                }
              } catch (logError) {
                // Skip logs that don't match our interface
                continue;
              }
            }
          } catch (parseError) {
            console.warn('⚠️ Could not parse vibeId from receipt, using fallback');
          }
          
          // Fallback: return the original rtaId with prefix
          return `metis_vibe_${rtaId}`;
        } else if (receipt && receipt.status === 'reverted') {
          console.error('💥 Transaction reverted on-chain:', receipt);
          throw new Error(`Transaction reverted on Metis blockchain. Check explorer: https://hyperion-testnet-explorer.metisdevops.link/tx/${txHash}`);
        } else {
          console.error('❓ Unexpected transaction status:', receipt?.status);
          throw new Error(`Transaction has unexpected status: ${receipt?.status}. Check explorer: https://hyperion-testnet-explorer.metisdevops.link/tx/${txHash}`);
        }
      } catch (contractError: any) {
        console.error('❌ Contract call failed:', contractError);
        
        // Check if we have a transaction hash in the error (transaction was sent but failed later)
        let errorMessage = '';
        
        // Provide more specific error messages based on viem error types
        if (contractError.message?.includes('User rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (contractError.message?.includes('insufficient funds')) {
          errorMessage = 'Insufficient tMETIS balance for transaction';
        } else if (contractError.message?.includes('Check explorer:')) {
          // This error already contains explorer link, pass it through
          errorMessage = contractError.message;
        } else if (contractError.shortMessage) {
          errorMessage = `Contract call failed: ${contractError.shortMessage}`;
        } else {
          errorMessage = `Contract call failed: ${contractError.message || contractError}`;
        }
        
        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error('❌ Failed to create vibestream on Metis:', error);
      
      // Provide detailed error messages
      if (error.message?.includes('user rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient tMETIS balance for transaction');
      } else if (error.message?.includes('wrong network')) {
        throw new Error('Please switch to Metis Hyperion network');
      } else {
        throw error;
      }
    }
  }, [account]);

  // Create RTA NFT - Network-aware creation (NEAR contracts or Metis contracts)
  const createRTANFT = useCallback(async (rtaId: string, config: RTAConfig): Promise<string> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    // Network-aware creation: NEAR contracts vs Metis contracts
    if (account.network === 'metis-hyperion') {
      // For Metis network, use the integrated createVibestreamWithDelegate function
      console.log('🔗 Creating vibestream on Metis network via VibeFactory');
      return await createVibestreamAndDelegate(rtaId, config);
    }

    // Near implementation (existing logic)
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

      let depositAmount = '10000000000000000000000'; // 0.01 NEAR base
      if (config.store_to_filecoin) {
        depositAmount = '15000000000000000000000'; // +0.005 NEAR for Filecoin
      }
      if (config.mode === 'group' && config.ticket_amount && config.ticket_amount > 10) {
        depositAmount = '20000000000000000000000'; // +0.005 NEAR for large groups
      }

      if (account.walletType === 'guest' && guestKeyPair) {
        // Guest account implementation
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
        
        const nearConnection = await nearAPI.connect({
          networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
          keyStore: keyStore,
          nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
          walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
          helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
        });
        
        const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);
        
        const result = await guestAccount.functionCall({
          contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          methodName: 'create_rta',
          args: {
            rta_id: rtaId,
            config: contractConfig,
            receiver_id: account.accountId,
          },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt(depositAmount)
        });

        console.log('🔥 RTA NFT created with guest account:', result);
        return `rta_${rtaId}`;
      } else {
        // Regular wallet implementation
        const transaction = {
          receiverId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          actions: [{
            type: 'FunctionCall',
            params: {
              methodName: 'create_rta',
              args: {
                rta_id: rtaId,
                config: contractConfig,
                receiver_id: account.accountId,
              },
              gas: '30000000000000',
              deposit: depositAmount
            }
          }]
        };

        const result = await signTransaction(transaction);
        console.log('🔥 RTA NFT created successfully:', result);
        return `rta_${rtaId}`;
      }

    } catch (error) {
      console.error('❌ Failed to create RTA NFT:', error);
      throw error;
    }
  }, [account, signTransaction, createVibestreamAndDelegate]);

  const addChunkToRTA = useCallback(async (rtaId: string, chunkId: number, filecoinCid: string, chunkOwner: string): Promise<void> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    if (account.network === 'metis-hyperion') {
      // TODO: Implement Metis contract interaction when contracts are deployed
      throw new Error('Metis contracts not yet deployed');
    }

    // Near implementation
    try {
      if (account.walletType === 'guest' && guestKeyPair) {
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
        
        const nearConnection = await nearAPI.connect({
          networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
          keyStore: keyStore,
          nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
          walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
          helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
        });

        const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);

        await guestAccount.functionCall({
          contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          methodName: 'add_cids',
          args: {
            rta_id: rtaId,
            cids: [filecoinCid],
            chunk_owners: [chunkOwner],
          },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt('0')
        });
      } else {
        const transaction = {
          receiverId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          actions: [{
            type: 'FunctionCall',
            params: {
              methodName: 'add_cids',
              args: {
                rta_id: rtaId,
                cids: [filecoinCid],
                chunk_owners: [chunkOwner],
              },
              gas: '30000000000000',
              deposit: '0'
            }
          }]
        };

        await signTransaction(transaction);
      }
      
      console.log('✅ Chunk added to RTA successfully');
    } catch (error) {
      console.error('❌ Failed to add chunk to RTA:', error);
      throw error;
    }
  }, [account, signTransaction]);

  const finalizeRTA = useCallback(async (rtaId: string, masterCid: string): Promise<void> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    if (account.network === 'metis-hyperion') {
      // TODO: Implement Metis contract interaction when contracts are deployed
      throw new Error('Metis contracts not yet deployed');
    }

    // Near implementation
    try {
      if (account.walletType === 'guest' && guestKeyPair) {
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
        
        const nearConnection = await nearAPI.connect({
          networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
          keyStore: keyStore,
          nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
          walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
          helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
        });

        const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);

        await guestAccount.functionCall({
          contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          methodName: 'finalize',
          args: {
            rta_id: rtaId,
            filecoin_master_cid: masterCid,
          },
          gas: BigInt('30000000000000'),
          attachedDeposit: BigInt('0')
        });
      } else {
        const transaction = {
          receiverId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
          actions: [{
            type: 'FunctionCall',
            params: {
              methodName: 'finalize',
              args: {
                rta_id: rtaId,
                filecoin_master_cid: masterCid,
              },
              gas: '30000000000000',
              deposit: '0'
            }
          }]
        };

        await signTransaction(transaction);
      }
      
      console.log('✅ RTA finalized successfully');
    } catch (error) {
      console.error('❌ Failed to finalize RTA:', error);
      throw error;
    }
  }, [account, signTransaction]);

  const isRTAClosed = useCallback(async (rtaId: string): Promise<boolean> => {
    try {
      // TODO: Implement for both networks when contracts are deployed
      return false;
    } catch (error) {
      console.error('❌ Failed to check RTA status:', error);
      return false;
    }
  }, []);

  // Get user's vibestreams with cross-matched FilCDN data
  const getUserVibestreams = useCallback(async (): Promise<UserVibestreamData[]> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    try {
      let onChainVibestreams: any[] = [];

      if (account.network === 'metis-hyperion') {
        // Query Metis VibeFactory contract for user's vibestreams
        console.log('🔍 Querying Metis VibeFactory for user vibestreams...');
        
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).ethereum) {
            const ethProvider = (window as any).ethereum;
            
            // Create public client for reading contract state
            const publicClient = createPublicClient({
              chain: {
                id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
                name: 'Metis Hyperion',
                nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
                rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
              },
              transport: custom(ethProvider)
            });

            // Get current block number and limit the range to avoid RPC limits
            const currentBlock = await publicClient.getBlockNumber();
            const maxBlockRange = 50000n; // Metis RPC limit is 100k, use 50k for safety
            const fromBlock = currentBlock > maxBlockRange ? currentBlock - maxBlockRange : 0n;

            console.log(`📊 Querying Metis events from block ${fromBlock} to ${currentBlock}`);

            // Query VibestreamCreated events for this user
            const vibestreamCreatedEvents = await publicClient.getLogs({
              address: CONTRACT_ADDRESSES.METIS.VIBE_FACTORY as `0x${string}`,
              event: parseAbiItem('event VibestreamCreated(uint256 indexed vibeId, address indexed creator, uint256 timestamp, string mode, uint256 ticketsAmount, uint256 ticketPrice, address requestedDelegatee)'),
              args: {
                creator: account.accountId as `0x${string}`
              },
              fromBlock,
              toBlock: currentBlock
            });

            console.log(`📊 Found ${vibestreamCreatedEvents.length} vibestreams for user on Metis`);

            // Convert events to vibestream data
            onChainVibestreams = vibestreamCreatedEvents.map((event: any) => ({
              vibeId: event.args.vibeId.toString(),
              rtaId: `metis_${event.args.vibeId}`, // Generate RTA ID for cross-matching
              creator: event.args.creator,
              created_at: Number(event.args.timestamp),
              mode: event.args.mode.toLowerCase(),
              is_closed: false, // TODO: Query contract state to check if finalized
              total_chunks: 0, // Will be filled from FilCDN data
              participants: []
            }));
          }
        } catch (metisError) {
          console.warn('⚠️ Failed to query Metis contract:', metisError);
          // Continue with empty array if Metis query fails
        }
      } else if (account.network === 'near-testnet') {
        // Query NEAR rtav2 contract for user's NFTs
        console.log('🔍 Querying NEAR rtav2 contract for user RTAs...');
        
        try {
          if (account.walletType === 'guest' && guestKeyPair) {
            const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
            await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
            
            const nearConnection = await nearAPI.connect({
              networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
              keyStore: keyStore,
              nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
              walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
              helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
            });

            const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);

            // Query user's NFTs using nft_tokens_for_owner
            const tokens = await guestAccount.viewFunction({
              contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
              methodName: 'nft_tokens_for_owner',
              args: {
                account_id: account.accountId,
                from_index: '0',
                limit: 100
              }
            });

            console.log(`📊 Found ${tokens.length} RTAs for user on NEAR`);

            // Convert tokens to vibestream data
            onChainVibestreams = tokens.map((token: any) => {
              const metadata = token.metadata?.extra ? JSON.parse(token.metadata.extra) : {};
              return {
                vibeId: token.token_id.replace('rta_', ''),
                rtaId: metadata.rta_id || token.token_id.replace('rta_', ''),
                creator: metadata.config?.creator || account.accountId,
                created_at: metadata.config?.created_at || 0,
                mode: metadata.config?.mode || 'solo',
                is_closed: metadata.is_closed || false,
                total_chunks: metadata.total_chunks || 0,
                filecoin_master_cid: metadata.filecoin_master_cid,
                participants: []
              };
            });
          } else {
            // Use wallet selector for other NEAR wallets
            if (Platform.OS === 'web' && globalNearSelector) {
              const wallet = await globalNearSelector.wallet();
              const walletId = globalNearSelector.store.getState().selectedWalletId;
              
              console.log(`📊 Using NEAR wallet: ${walletId}`);
              
              // Use signAndSendTransaction approach for view methods
              const nearConnection = await nearAPI.connect({
                networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
                keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore(),
                nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
                walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
                helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
              });

              const nearAccount = await nearConnection.account(account.accountId);
              
              const tokens = await nearAccount.viewFunction({
                contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
                methodName: 'nft_tokens_for_owner',
                args: {
                  account_id: account.accountId,
                  from_index: '0',
                  limit: 100
                }
              });

              console.log(`📊 Found ${tokens.length} RTAs for user on NEAR`);

              onChainVibestreams = tokens.map((token: any) => {
                const metadata = token.metadata?.extra ? JSON.parse(token.metadata.extra) : {};
                return {
                  vibeId: token.token_id.replace('rta_', ''),
                  rtaId: metadata.rta_id || token.token_id.replace('rta_', ''),
                  creator: metadata.config?.creator || account.accountId,
                  created_at: metadata.config?.created_at || 0,
                  mode: metadata.config?.mode || 'solo',
                  is_closed: metadata.is_closed || false,
                  total_chunks: metadata.total_chunks || 0,
                  filecoin_master_cid: metadata.filecoin_master_cid,
                  participants: []
                };
              });
            }
          }
        } catch (nearError) {
          console.warn('⚠️ Failed to query NEAR contract via wallet, trying direct RPC:', nearError);
          
          // Fallback: Try direct RPC call
          try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com'}`, {
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
                  method_name: 'nft_tokens_for_owner',
                  args_base64: typeof Buffer !== 'undefined' 
                    ? Buffer.from(JSON.stringify({
                        account_id: account.accountId,
                        from_index: '0',
                        limit: 100
                      })).toString('base64')
                    : btoa(JSON.stringify({
                        account_id: account.accountId,
                        from_index: '0',
                        limit: 100
                      }))
                }
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (result.result && result.result.result) {
                // result.result.result is a Uint8Array representing the JSON string
                const resultBytes = result.result.result;
                const jsonString = new TextDecoder().decode(new Uint8Array(resultBytes));
                const tokens = JSON.parse(jsonString);
                console.log(`📊 Found ${tokens.length} RTAs for user on NEAR (via RPC)`);

                onChainVibestreams = tokens.map((token: any) => {
                  const metadata = token.metadata?.extra ? JSON.parse(token.metadata.extra) : {};
                  return {
                    vibeId: token.token_id.replace('rta_', ''),
                    rtaId: metadata.rta_id || token.token_id.replace('rta_', ''),
                    creator: metadata.config?.creator || account.accountId,
                    created_at: metadata.config?.created_at || 0,
                    mode: metadata.config?.mode || 'solo',
                    is_closed: metadata.is_closed || false,
                    total_chunks: metadata.total_chunks || 0,
                    filecoin_master_cid: metadata.filecoin_master_cid,
                    participants: []
                  };
                });
              }
            }
          } catch (rpcError) {
            console.warn('⚠️ Direct RPC call also failed:', rpcError);
            // Continue with empty array if both approaches fail
          }
        }
      }

      // Cross-match with FilCDN data for enhanced metadata
      try {
        console.log('🔄 Cross-matching with FilCDN data...');
        const backendUrl = process.env.EXPO_PUBLIC_RAWCHUNKS_URL || 'https://api.vibesflow.ai';
        const cacheBuster = Date.now();
        const response = await fetch(`${backendUrl}/api/vibestreams?t=${cacheBuster}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          const filcdnVibestreams = await response.json();
          
          // Cross-match on-chain data with FilCDN data
          onChainVibestreams = onChainVibestreams.map(onChainVibe => {
            const filcdnMatch = filcdnVibestreams.find((filcdnVibe: any) => 
              filcdnVibe.rta_id === onChainVibe.rtaId || 
              filcdnVibe.creator === onChainVibe.creator
            );

            if (filcdnMatch) {
              return {
                ...onChainVibe,
                filcdn_duration: filcdnMatch.rta_duration,
                filcdn_chunks: filcdnMatch.chunks,
                filcdn_size_mb: filcdnMatch.total_size_mb,
                total_chunks: filcdnMatch.chunks || onChainVibe.total_chunks
              };
            }

            return onChainVibe;
          });

          console.log(`✅ Cross-matched ${onChainVibestreams.length} vibestreams with FilCDN data`);
        }
      } catch (filcdnError) {
        console.warn('⚠️ Failed to cross-match with FilCDN data:', filcdnError);
        // Continue with on-chain data only
      }

      return onChainVibestreams;

    } catch (error) {
      console.error('❌ Failed to fetch user vibestreams:', error);
      throw error;
    }
  }, [account, guestKeyPair]);

  // Get count of user's vibestreams
  const getUserVibestreamCount = useCallback(async (): Promise<number> => {
    try {
      const vibestreams = await getUserVibestreams();
      return vibestreams.length;
    } catch (error) {
      console.warn('⚠️ Failed to get vibestream count:', error);
      return 0;
    }
  }, [getUserVibestreams]);

  // Get specific vibestream metadata
  const getVibestreamMetadata = useCallback(async (vibeId: string): Promise<any> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    try {
      if (account.network === 'metis-hyperion') {
        // Query Metis VibeFactory contract
        if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).ethereum) {
          const ethProvider = (window as any).ethereum;
          
          const publicClient = createPublicClient({
            chain: {
              id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
              name: 'Metis Hyperion',
              nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
              rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
            },
            transport: custom(ethProvider)
          });

          // Read vibestream data from contract
          const vibeData = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.METIS.VIBE_FACTORY as `0x${string}`,
            abi: [parseAbiItem('function getVibestream(uint256 vibeId) external view returns (tuple(address creator, uint256 startDate, string mode, bool storeToFilecoin, uint256 distance, string metadataURI, uint256 ticketsAmount, uint256 ticketPrice, bool finalized, bool payPerStream, uint256 streamPrice))')],
            functionName: 'getVibestream',
            args: [BigInt(vibeId)]
          });

          return vibeData;
        }
      } else if (account.network === 'near-testnet') {
        // Query NEAR rtav2 contract
        try {
          if (account.walletType === 'guest' && guestKeyPair) {
            const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
            await keyStore.setKey(CONTRACT_ADDRESSES.NEAR.NETWORK, GUEST_CONFIG.ACCOUNT_ID, guestKeyPair);
            
            const nearConnection = await nearAPI.connect({
              networkId: CONTRACT_ADDRESSES.NEAR.NETWORK,
              keyStore: keyStore,
              nodeUrl: process.env.EXPO_PUBLIC_NEAR_NODE_URL || 'https://test.rpc.fastnear.com',
              walletUrl: process.env.EXPO_PUBLIC_NEAR_WALLET_URL || 'https://wallet.testnet.near.org',
              helperUrl: process.env.EXPO_PUBLIC_NEAR_HELPER_URL || 'https://helper.testnet.near.org',
            });

            const guestAccount = await nearConnection.account(GUEST_CONFIG.ACCOUNT_ID);

            const metadata = await guestAccount.viewFunction({
              contractId: CONTRACT_ADDRESSES.NEAR.RTA_FACTORY,
              methodName: 'get_rta_metadata',
              args: { rta_id: vibeId }
            });

            return metadata;
          }
        } catch (nearError) {
          console.warn('⚠️ Failed to query NEAR metadata:', nearError);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get vibestream metadata:', error);
      throw error;
    }
  }, [account, guestKeyPair]);

  // Participant tracking methods (for future group mode)
  const addParticipantToVibestream = useCallback(async (vibeId: string, participantId: string): Promise<void> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    // TODO: Implement participant tracking when group mode contracts are ready
    console.log(`🎯 Adding participant ${participantId} to vibestream ${vibeId} (placeholder for future group mode)`);
    
    // This will be implemented when group mode contracts are deployed
    // For now, just log the action for future reference
  }, [account]);

  const removeParticipantFromVibestream = useCallback(async (vibeId: string, participantId: string): Promise<void> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    // TODO: Implement participant tracking when group mode contracts are ready
    console.log(`🎯 Removing participant ${participantId} from vibestream ${vibeId} (placeholder for future group mode)`);
    
    // This will be implemented when group mode contracts are deployed
  }, [account]);

  const getVibestreamParticipants = useCallback(async (vibeId: string): Promise<string[]> => {
    if (!account) {
      throw new Error('Wallet not connected');
    }

    // TODO: Implement participant tracking when group mode contracts are ready
    console.log(`🎯 Getting participants for vibestream ${vibeId} (placeholder for future group mode)`);
    
    // For now, return empty array until group mode contracts are ready
    return [];
  }, [account]);

  // PPM Contract Methods
  const authorizePPMSpending = useCallback(async (vibeId: string, allowanceAmount: string): Promise<string> => {
    if (!account || account.network !== 'metis-hyperion') {
      throw new Error('PPM only available on Metis Hyperion network');
    }

    try {
      console.log(`💰 Authorizing PPM spending: ${allowanceAmount} tMETIS for vibe ${vibeId}`);

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;
      const allowanceInWei = parseEther(allowanceAmount);

      // PPM authorizeSpending ABI
      const authorizePPMAbi = parseAbiItem(
        'function authorizeSpending(uint256 vibeId, uint256 authorizedAmount) external payable'
      );

      // Create wallet client
      const walletClient = createWalletClient({
        chain: {
          id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
        },
        transport: custom(ethProvider)
      });

      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.METIS.PPM as `0x${string}`,
        abi: [authorizePPMAbi],
        functionName: 'authorizeSpending',
        args: [BigInt(vibeId), allowanceInWei],
        account: account.accountId as `0x${string}`,
        value: allowanceInWei, // Send tMETIS with the transaction
        gas: BigInt(200000),
      });

      console.log('✅ PPM allowance authorized:', txHash);
      return txHash;

    } catch (error: any) {
      console.error('❌ Failed to authorize PPM spending:', error);
      throw new Error(`PPM authorization failed: ${error.message}`);
    }
  }, [account]);

  const joinPPMVibestream = useCallback(async (vibeId: string): Promise<string> => {
    if (!account || account.network !== 'metis-hyperion') {
      throw new Error('PPM only available on Metis Hyperion network');
    }

    try {
      console.log(`🎵 Joining PPM vibestream: ${vibeId}`);

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;

      // PPM joinVibestream ABI
      const joinPPMAbi = parseAbiItem(
        'function joinVibestream(uint256 vibeId) external'
      );

      const walletClient = createWalletClient({
        chain: {
          id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
        },
        transport: custom(ethProvider)
      });

      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.METIS.PPM as `0x${string}`,
        abi: [joinPPMAbi],
        functionName: 'joinVibestream',
        args: [BigInt(vibeId)],
        account: account.accountId as `0x${string}`,
        gas: BigInt(150000),
      });

      console.log('✅ Joined PPM vibestream:', txHash);
      return txHash;

    } catch (error: any) {
      console.error('❌ Failed to join PPM vibestream:', error);
      throw new Error(`PPM join failed: ${error.message}`);
    }
  }, [account]);

  const leavePPMVibestream = useCallback(async (vibeId: string): Promise<string> => {
    if (!account || account.network !== 'metis-hyperion') {
      throw new Error('PPM only available on Metis Hyperion network');
    }

    try {
      console.log(`🚪 Leaving PPM vibestream: ${vibeId}`);

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;

      // PPM leaveVibestream ABI
      const leavePPMAbi = parseAbiItem(
        'function leaveVibestream(uint256 vibeId) external'
      );

      const walletClient = createWalletClient({
        chain: {
          id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
        },
        transport: custom(ethProvider)
      });

      const txHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.METIS.PPM as `0x${string}`,
        abi: [leavePPMAbi],
        functionName: 'leaveVibestream',
        args: [BigInt(vibeId)],
        account: account.accountId as `0x${string}`,
        gas: BigInt(150000),
      });

      console.log('✅ Left PPM vibestream:', txHash);
      return txHash;

    } catch (error: any) {
      console.error('❌ Failed to leave PPM vibestream:', error);
      throw new Error(`PPM leave failed: ${error.message}`);
    }
  }, [account]);

  const getPPMAllowance = useCallback(async (vibeId: string, participant?: string): Promise<any> => {
    if (!account || account.network !== 'metis-hyperion') {
      throw new Error('PPM only available on Metis Hyperion network');
    }

    try {
      const participantAddress = participant || account.accountId;

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Ethereum provider not available');
      }

      const ethProvider = (window as any).ethereum;

      const publicClient = createPublicClient({
        chain: {
          id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: { default: { http: [CONTRACT_ADDRESSES.METIS.RPC_URL] } },
        },
        transport: custom(ethProvider)
      });

      // Get participant allowance
      const allowanceData = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.METIS.PPM as `0x${string}`,
        abi: [parseAbiItem('function getParticipantAllowance(uint256 vibeId, address participant) external view returns (tuple(uint256 vibeId, address participant, uint256 authorizedAmount, uint256 spentAmount, uint256 payPerMinute, uint256 joinedAt, uint256 lastDeduction, bool isActive, address creator))')],
        functionName: 'getParticipantAllowance',
        args: [BigInt(vibeId), participantAddress as `0x${string}`]
      });

      return allowanceData;

    } catch (error: any) {
      console.error('❌ Failed to get PPM allowance:', error);
      throw new Error(`PPM allowance query failed: ${error.message}`);
    }
  }, [account]);

  const getNetworkInfo = useCallback(() => {
    if (!account) return null;
    
    if (account.network === 'near-testnet') {
      return {
        type: 'near-testnet' as NetworkType,
        contracts: CONTRACT_ADDRESSES.NEAR
      };
    } else if (account.network === 'metis-hyperion') {
      return {
        type: 'metis-hyperion' as NetworkType,
        contracts: CONTRACT_ADDRESSES.METIS
      };
    }
    
    return null;
  }, [account]);

  // Simple subscription check for Metis users
  const isUserSubscribed = useCallback(async (): Promise<boolean> => {
    if (!account || account.network !== 'metis-hyperion') {
      return false;
    }

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).ethereum) {
        const ethProvider = (window as any).ethereum;
        
        // Verify we're on the correct network first
        const chainId = await ethProvider.request({ method: 'eth_chainId' });
        const expectedChainId = '0x20a55'; // 133717 in hex
        if (chainId !== expectedChainId) {
          console.warn(`Wrong network for subscription check: expected ${expectedChainId}, got ${chainId}`);
          return false;
        }

        // Use the exact same chain config as createVibestreamWithDelegate
        const metisHyperion = {
          id: CONTRACT_ADDRESSES.METIS.CHAIN_ID,
          name: 'Metis Hyperion Testnet',
          network: 'metis-hyperion',
          nativeCurrency: {
            decimals: 18,
            name: 'tMETIS',
            symbol: 'tMETIS',
          },
          rpcUrls: {
            default: {
              http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
            },
            public: {
              http: [CONTRACT_ADDRESSES.METIS.RPC_URL],
            },
          },
          blockExplorers: {
            default: {
              name: 'Metis Hyperion Explorer',
              url: 'https://hyperion-testnet-explorer.metisdevops.link',
            },
          },
        };
        
        const publicClient = createPublicClient({
          chain: metisHyperion,
          transport: custom(ethProvider)
        });

        console.log('🔍 Checking subscription for address:', account.accountId);
        console.log('🔍 Using contract address:', CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS);

        const isSubscribed = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.METIS.SUBSCRIPTIONS as `0x${string}`,
          abi: [parseAbiItem('function isSubscribed(address user) external view returns (bool)')],
          functionName: 'isSubscribed',
          args: [account.accountId as `0x${string}`]
        }) as boolean;

        console.log('✅ Subscription check result:', isSubscribed);
        return isSubscribed;
      }
      return false;
    } catch (error: any) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }, [account]);

  const value: WalletContextType = {
    account,
    connecting,
    connected: !!account,
    error,
    modal,
    openModal,
    closeModal,
    setModalStep,
    connectAsGuest,
    connectNear,
    connectMetis,
    disconnect,
    signTransaction,
    signMessage,
    createRTANFT,
    createVibestreamAndDelegate,
    addChunkToRTA,
    finalizeRTA,
    isRTAClosed,
    getUserVibestreams,
    getUserVibestreamCount,
    getVibestreamMetadata,
    addParticipantToVibestream,
    removeParticipantFromVibestream,
    getVibestreamParticipants,
    authorizePPMSpending,
    joinPPMVibestream,
    leavePPMVibestream,
    getPPMAllowance,
    isUserSubscribed,
    getNetworkInfo,
  };



  // Always wrap with MetisWalletProvider for web (it includes QueryClientProvider)
  if (Platform.OS === 'web') {
    return (
      <MetisWalletProvider>
        <WalletContext.Provider value={value}>
          {children}
        </WalletContext.Provider>
      </MetisWalletProvider>
    );
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};