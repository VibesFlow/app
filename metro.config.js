const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Minimal resolver configuration for Buffer only
config.resolver.alias = {
  'buffer': 'buffer'
};

module.exports = config;