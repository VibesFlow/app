const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for better compatibility
config.resolver.alias = {
  'crypto': 'crypto-browserify',
  'stream': 'stream-browserify',
  'buffer': 'buffer'
};

config.resolver.fallback = {
  'crypto': require.resolve('crypto-browserify'),
  'stream': require.resolve('stream-browserify'),
  'buffer': require.resolve('buffer')
};

module.exports = config;