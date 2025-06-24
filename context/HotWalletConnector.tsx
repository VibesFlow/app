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
          const HereWallet = require('@here-wallet/core').HereWallet;
          
          const here = await HereWallet.connect();

          // Use signIn method to connect to NEAR testnet
          const accountId = await here.signIn({
            contractId: 'vibesflow.testnet'
          });
          
          if (accountId) {
            const walletAccount = {
              accountId: accountId,
              publicKey: '', 
              network: 'near-testnet'
            };
            setAccount(walletAccount);
            localStorage.setItem('vibesflow_wallet_account', JSON.stringify(walletAccount));
            console.log(`Connected to HOT wallet: ${accountId}`);
            return;
          }
        } catch (hereError: any) {
          console.log('HERE Wallet connection failed:', hereError.message);
          
          // Fallback to NEAR Web Wallet
          if (typeof window !== 'undefined' && (window as any).near) {
            try {
              const wallet = (window as any).near;
              await wallet.requestSignIn({
                contractId: 'vibesflow.testnet',
                methodNames: ['create_composition', 'mint_nft']
              });
              
              const accountId = wallet.getAccountId();
              if (accountId) {
                const walletAccount = {
                  accountId: accountId,
                  publicKey: '',
                  network: 'near-testnet'
                };
                setAccount(walletAccount);
                localStorage.setItem('vibesflow_wallet_account', JSON.stringify(walletAccount));
                return;
              }
            } catch (nearError: any) {
              console.log('NEAR Wallet connection failed:', nearError.message);
            }
          }
        }

        throw new Error('No NEAR wallet found. Please install HERE Wallet or visit https://wallet.near.org');
      } else {
        // Mobile wallet connection using HERE Wallet
        try {
          const HereWallet = require('@here-wallet/core').HereWallet;
          
          const here = await HereWallet.connect();
          const accountId = await here.signIn({
            contractId: 'vibesflow.testnet'
          });
          
          if (accountId) {
            setAccount({
              accountId: accountId,
              publicKey: '',
              network: 'near-testnet'
            });
            return;
          }
        } catch (mobileError: any) {
          throw new Error('Mobile NEAR Wallet connection failed. Please install HERE Wallet.');
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
    
    // Clear localStorage cache
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.removeItem('vibesflow_wallet_account');
      
      // Clear wallet connections
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
          message,
          nonce: Buffer.from(nonce),
          recipient
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
          const HereWallet = require('@here-wallet/core').HereWallet;
          const here = await HereWallet.connect();
          
          // Check if already signed in
          if (here.isSignedIn && here.isSignedIn()) {
            const accountId = here.getAccountId();
            if (accountId && typeof accountId === 'string') {
              setAccount({
                accountId: accountId,
                publicKey: '',
                network: 'near-testnet'
              });
              console.log('Existing HOT wallet connection found:', { accountId });
              return;
            }
          }
          
          // Try alternative method to get account from HERE wallet
          const accounts = await here.getAccounts();
          if (accounts && accounts.length > 0) {
            const accountId = accounts[0].accountId || accounts[0];
            if (accountId && typeof accountId === 'string') {
              setAccount({
                accountId: accountId,
                publicKey: '',
                network: 'near-testnet'
              });
              console.log('Existing HOT wallet connection found via getAccounts:', { accountId });
              return;
            }
          }
        } catch (err) {
          console.log('No existing HOT wallet connection:', err);
          
          // Fallback to check standard NEAR wallet
          try {
            if ((window as any).near?.isSignedIn && (window as any).near.isSignedIn()) {
              const accountId = (window as any).near.getAccountId();
              if (accountId && typeof accountId === 'string') {
                setAccount({
                  accountId: accountId,
                  publicKey: '',
                  network: 'near-testnet'
                });
                console.log('Existing NEAR wallet connection found:', { accountId });
                return;
              }
            }
          } catch (nearErr) {
            console.log('No existing NEAR wallet connection:', nearErr);
          }
        }
        
        // Final fallback - check localStorage for cached account
        try {
          const cachedAccount = localStorage.getItem('vibesflow_wallet_account');
          if (cachedAccount) {
            const parsedAccount = JSON.parse(cachedAccount);
            if (parsedAccount.accountId) {
              setAccount(parsedAccount);
              console.log('Restored wallet from localStorage:', { accountId: parsedAccount.accountId });
              return;
            }
          }
        } catch (storageErr) {
          console.log('No cached wallet account found');
        }
        
        // TEST: Set a test account to verify display logic works
        const testAccount = {
          accountId: 'testuser.testnet',
          publicKey: '',
          network: 'near-testnet'
        };
        setAccount(testAccount);
        localStorage.setItem('vibesflow_wallet_account', JSON.stringify(testAccount));
        console.log('Set test account for display verification:', { accountId: testAccount.accountId });
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