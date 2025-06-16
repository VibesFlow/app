import 'react-native-get-random-values';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { HereWallet } from '@here-wallet/core';
import * as nearAPI from 'near-api-js';

interface WalletAccount {
  address: string;
  publicKey: string;
  network: string;
  walletType: 'hot' | 'here' | 'near';
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
  authenticate: () => Promise<{ accountId: string; signature: string; publicKey: string }>;
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
  const [hereWallet, setHereWallet] = useState<any>(null);

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);

      // Initialize HereWallet with HOT Protocol support
      const here = await HereWallet.connect({
        botId: "VibesFlowApp/vibesflow", // Your app identifier
        walletId: "herewalletbot/app", // HOT Wallet identifier
      });

      setHereWallet(here);

      // Sign in without adding keys - simpler approach
      const accountId = await here.signIn();

      if (accountId) {
        setAccount({
          address: accountId,
          publicKey: '', // Will be populated when needed
          network: 'near-mainnet',
          walletType: 'hot'
        });
        return;
      }

      throw new Error('Failed to connect to HOT wallet. Please install HERE Wallet or try again.');
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet. Please install HERE Wallet with HOT Protocol support.');
      console.error('HOT wallet connection error:', err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
    setHereWallet(null);
  }, []);

  const signTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!account || !hereWallet) {
      throw new Error('No wallet connected');
    }

    try {
      // Use HereWallet for HOT Protocol transactions
      const result = await hereWallet.signAndSendTransaction({
        actions: transaction.actions || [transaction],
        receiverId: transaction.receiverId || transaction.contractId,
      });
      return result.transaction.hash;
    } catch (err: any) {
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [account, hereWallet]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!account || !hereWallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.walletType === 'hot' || account.walletType === 'here') {
        // Simplified message signing without crypto dependency
        const recipient = typeof window !== 'undefined' ? window.location.host : 'vibesflow.app';
        
        const { signature } = await hereWallet.signMessage({
          recipient, 
          message 
        });
        return signature;
      }
      
      throw new Error('Message signing only supported for HOT Protocol wallets');
    } catch (err: any) {
      throw new Error(`Message signing failed: ${err.message}`);
    }
  }, [account, hereWallet]);

  const authenticate = useCallback(async (): Promise<{ accountId: string; signature: string; publicKey: string }> => {
    if (!account || !hereWallet) {
      throw new Error('No wallet connected');
    }

    try {
      if (account.walletType === 'hot' || account.walletType === 'here') {
        // Return basic account info without complex authentication
        return {
          accountId: account.address,
          signature: '',
          publicKey: account.publicKey || ''
        };
      }
      
      throw new Error('Authentication only supported for HOT Protocol wallets');
    } catch (err: any) {
      throw new Error(`Authentication failed: ${err.message}`);
    }
  }, [account, hereWallet]);

  // Check for existing connections on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Try to reconnect to existing HOT wallet session
          const here = await HereWallet.connect({
            botId: "VibesFlowApp/vibesflow",
            walletId: "herewalletbot/app",
          });
          
          setHereWallet(here);
        }
      } catch (err) {
        // No existing connection found
        console.log('No existing HOT wallet connection');
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
    signMessage,
    authenticate
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};