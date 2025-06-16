import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

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

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Try to connect to HOT Wallet using HERE Wallet core
        try {
          // Check if HERE Wallet core is available
          const { HereWallet } = await import('@here-wallet/core');
          
          const here = await HereWallet.connect({
            botId: "VibesFlow/app",
            walletId: "herewalletbot/app", // HOT Wallet
          });

          // Authenticate without adding keys first
          const { accountId } = await here.authenticate();
          
          if (accountId) {
            setAccount({
              accountId: accountId,
              publicKey: '', // Will be populated when needed
              network: 'near-testnet'
            });
            console.log(`Connected to HOT wallet: ${accountId}`);
            return;
          }
        } catch (hereError: any) {
          console.log('HERE Wallet connection failed:', hereError.message);
          
          // Fallback to standard NEAR wallet connection
          if ((window as any).near) {
            const nearWallet = (window as any).near;
            const account = await nearWallet.requestSignIn({
              contractId: 'vibesflow.testnet',
              methodNames: ['create_composition', 'mint_nft']
            });
            
            if (account) {
              setAccount({
                accountId: account.accountId,
                publicKey: account.publicKey,
                network: 'near-testnet'
              });
              return;
            }
          }
        }

        throw new Error('No HOT Wallet found. Please install HERE Wallet or NEAR Wallet.');
      } else {
        // Mobile wallet connection using HERE Wallet
        try {
          const { HereWallet } = await import('@here-wallet/core');
          
          const here = await HereWallet.connect({
            botId: "VibesFlow/app",
            walletId: "herewalletbot/app",
          });

          const { accountId } = await here.authenticate();
          
          if (accountId) {
            setAccount({
              accountId: accountId,
              publicKey: '',
              network: 'near-testnet'
            });
            return;
          }
        } catch (mobileError: any) {
          throw new Error('Mobile HOT Wallet connection failed. Please install HERE Wallet.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect HOT wallet');
      console.error('HOT wallet connection error:', err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
    
    // Clear wallet connections
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if ((window as any).near?.signOut) {
        (window as any).near.signOut();
      }
    }
  }, []);

  const signTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.network === 'near-testnet') {
        // Use HERE Wallet for HOT Protocol transactions
        const { HereWallet } = await import('@here-wallet/core');
        const here = await HereWallet.connect({
          botId: "VibesFlow/app",
          walletId: "herewalletbot/app",
        });
        
        const result = await here.signAndSendTransaction({
          actions: transaction.actions,
          receiverId: transaction.receiverId,
        });
        
        return result.transaction.hash;
      }
      
      throw new Error('Unsupported wallet network');
    } catch (err: any) {
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [account]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.network === 'near-testnet') {
        // Use HERE Wallet for message signing
        const { HereWallet } = await import('@here-wallet/core');
        const here = await HereWallet.connect({
          botId: "VibesFlow/app",
          walletId: "herewalletbot/app",
        });
        
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)));
        const recipient = typeof window !== 'undefined' ? window.location.host : 'vibesflow.app';
        
        const { signature } = await here.signMessage({
          recipient,
          nonce,
          message
        });
        
        return signature;
      }
      
      throw new Error('Message signing not supported for this wallet');
    } catch (err: any) {
      throw new Error(`Message signing failed: ${err.message}`);
    }
  }, [account]);

  // Check for existing connections on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          // Check for existing HOT Wallet connection
          const { HereWallet } = await import('@here-wallet/core');
          const here = await HereWallet.connect({
            botId: "VibesFlow/app",
            walletId: "herewalletbot/app",
          });
          
          // Try to authenticate silently
          const { accountId } = await here.authenticate();
          if (accountId) {
            setAccount({
              accountId: accountId,
              publicKey: '',
              network: 'near-testnet'
            });
            console.log('Existing HOT wallet connection found:', accountId);
          }
        } catch (err) {
          console.log('No existing HOT wallet connection');
          
          // Fallback to check standard NEAR wallet
          if ((window as any).near?.isSignedIn && (window as any).near.isSignedIn()) {
            const accountId = (window as any).near.getAccountId();
            if (accountId) {
              setAccount({
                accountId: accountId,
                publicKey: '',
                network: 'near-testnet'
              });
            }
          }
        }
      }
    };

    checkExistingConnection();
  }, []);

  const value: WalletContextType = {
    account,
    connecting,
    connected: !!account,
    error,
    connect,
    disconnect,
    signTransaction,
    signMessage
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};