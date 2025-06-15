import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

interface WalletAccount {
  address: string;
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

      // Check if we're on web and if Near Wallet is available
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Try to connect to Near Wallet first
        if ((window as any).near) {
          const nearWallet = (window as any).near;
          const account = await nearWallet.requestSignIn({
            contractId: 'vibesflow.near',
            methodNames: ['create_composition', 'mint_nft']
          });
          
          if (account) {
            setAccount({
              address: account.accountId,
              publicKey: account.publicKey,
              network: 'near-mainnet'
            });
            return;
          }
        }

        // Try Sui Wallet
        if ((window as any).suiWallet) {
          const suiWallet = (window as any).suiWallet;
          const response = await suiWallet.requestPermissions(['viewAccount']);
          
          if (response.accounts && response.accounts.length > 0) {
            setAccount({
              address: response.accounts[0],
              publicKey: response.accounts[0],
              network: 'sui-mainnet'
            });
            return;
          }
        }

        // Try Ethereum wallets
        if ((window as any).ethereum) {
          const ethereum = (window as any).ethereum;
          const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          
          if (accounts && accounts.length > 0) {
            setAccount({
              address: accounts[0],
              publicKey: accounts[0],
              network: 'ethereum-mainnet'
            });
            return;
          }
        }

        throw new Error('No supported wallet found. Please install Near Wallet, Sui Wallet, or MetaMask.');
      } else {
        // Mobile wallet connection
        throw new Error('Mobile wallet connection not yet implemented');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Wallet connection error:', err);
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
      if (account.network === 'near-mainnet' && (window as any).near) {
        const result = await (window as any).near.account().functionCall(transaction);
        return result.transaction.hash;
      } else if (account.network === 'sui-mainnet' && (window as any).suiWallet) {
        const result = await (window as any).suiWallet.signTransaction(transaction);
        return result.signature;
      } else if (account.network === 'ethereum-mainnet' && (window as any).ethereum) {
        const result = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [transaction]
        });
        return result;
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
      if (account.network === 'ethereum-mainnet' && (window as any).ethereum) {
        const signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, account.address]
        });
        return signature;
      } else if (account.network === 'sui-mainnet' && (window as any).suiWallet) {
        const result = await (window as any).suiWallet.signMessage({ message });
        return result.signature;
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
        // Check Near Wallet
        if ((window as any).near?.isSignedIn && (window as any).near.isSignedIn()) {
          const accountId = (window as any).near.getAccountId();
          if (accountId) {
            setAccount({
              address: accountId,
              publicKey: accountId,
              network: 'near-mainnet'
            });
          }
        }
        
        // Check Ethereum wallet
        else if ((window as any).ethereum) {
          try {
            const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              setAccount({
                address: accounts[0],
                publicKey: accounts[0],
                network: 'ethereum-mainnet'
              });
            }
          } catch (err) {
            console.log('No existing Ethereum connection');
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