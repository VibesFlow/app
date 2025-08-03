/**
 * VibesFlow Production Configuration
 * 
 * Deployed contract addresses and worker endpoints for the complete system
 */

export const CONTRACTS = {
  RTA_V2: process.env.EXPO_PUBLIC_RTA_CONTRACT_ID || 'rtav2.vibesflow.testnet',
  CHUNKER: process.env.EXPO_PUBLIC_CHUNKER_CONTRACT || 'v1chunker.vibesflow.testnet',
  NETWORK: process.env.EXPO_PUBLIC_NEAR_NETWORK || 'testnet'
};

export const NETWORKS = {
  NEAR: {
    RPC: process.env.EXPO_PUBLIC_NEAR_RPC_URL || 'https://rpc.testnet.near.org',
    EXPLORER: 'https://testnet.nearblocks.io'
  },
  FILECOIN: {
    RPC: 'https://api.calibration.node.glif.io/rpc/v1',
    NETWORK: 'calibration',
    CHAIN_ID: 314159
  },
  ETHEREUM: {
    RPC: 'https://sepolia.infura.io/v3/your_infura_key',
    NETWORK: 'sepolia'
  }
};

export const SYNAPSE_CONFIG = {
  RPC_URL: 'https://api.calibration.node.glif.io/rpc/v1',
  NETWORK: 'calibration',
  PANDORA_ADDRESS: '0xf49ba5eaCdFD5EE3744efEdf413791935FE4D4c5',
  PDP_VERIFIER_ADDRESS: '0x5A23b7df87f59A291C26A2A1d684AD03Ce9B68DC',
  USDFC_ADDRESS: '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0',
  WITH_CDN: true
};

export const API_KEYS = {
  LYRIA: process.env.EXPO_PUBLIC_LYRIA_API_KEY || '',
};

// MPC Configuration for NEAR MPC contract
export const MPC_CONFIG = {
  CONTRACT_ID: process.env.EXPO_PUBLIC_MPC_CONTRACT_ID || 'v1.signer-prod.testnet',
  DERIVATION_PATH: process.env.EXPO_PUBLIC_MPC_DERIVATION_PATH || 'ethereum-filecoin-vibesflow',
  KEY_VERSION: parseInt(process.env.EXPO_PUBLIC_MPC_KEY_VERSION || '0'),
};

// Filecoin Configuration (for direct Filecoin storage, not via Synapse SDK)
export const FILECOIN_CONFIG = {
  NETWORK: process.env.EXPO_PUBLIC_FILECOIN_NETWORK || 'calibration',
  RPC_URL: process.env.EXPO_PUBLIC_FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1',
  PRIVATE_KEY: process.env.EXPO_PUBLIC_FILECOIN_PRIVATE_KEY,
};

// Worker Code Hashes for verification
export const CODE_HASHES = {
  SWAPPER: '785a18b4b646a4fccb3d95ad6274539394db830853ae074d5a674d9cc75ed6c7',
  CHUNKER: 'a8a56acd4ef00bcae05b8bb5b40334adcaf31499061a7db14866ca6ffdadb331',
  DISPATCHER: '67f0faac8db027593591e2d87dc09fc590d9faf465a1b2216f3c4996af727041',
  PRODUCER: '687a2666b16addc363da9a0bfec25f20953b7bc03f0d2d8f7319d5df504a40a0'
};

// Debug/Development flags
export const DEBUG = {
  LOGS: process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true',
  VERBOSE: process.env.EXPO_PUBLIC_DEBUG_VERBOSE === 'true',
  SKIP_VALIDATION: process.env.EXPO_PUBLIC_SKIP_VALIDATION === 'true'
};

// Deployment Information
export const DEPLOYMENT_INFO = {
  PHALA_APP_ID: '0660a0cfef5b51daaa3a51a3f57ff01d60b66c2b',
  PHALA_DOMAIN: 'dstack-prod5.phala.network',
  DEPLOYED_AT: '2025-01-25T19:59:54Z',
  VERSION: '2.0.0',
  STATUS: 'PRODUCTION'
};

export default {
  CONTRACTS,
  WORKERS,
  NETWORKS,
  SYNAPSE_CONFIG,
  API_KEYS,
  DEBUG,
  DEPLOYMENT_INFO,
  CODE_HASHES,
  MPC_CONFIG,
  FILECOIN_CONFIG
}; 