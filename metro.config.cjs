const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enhanced resolver configuration for React Native polyfills and Dynamic Labs
config.resolver.alias = {
  // Essential polyfills for React Native
  'buffer': 'buffer',
  'process': 'process/browser.js',
  'util': 'util',
  'url': 'react-native-url-polyfill/auto',
  
  // COMPREHENSIVE STREAM ALIASES - Use our dedicated stream polyfill
  'stream': path.resolve(__dirname, 'configs/stream-polyfill.js'),
  '_stream_duplex': 'readable-stream/duplex',
  '_stream_passthrough': 'readable-stream/passthrough',
  '_stream_readable': 'readable-stream/readable',
  '_stream_transform': 'readable-stream/transform',
  '_stream_writable': 'readable-stream/writable',
  
  // CRYPTO ALIASES - Use our crypto wrapper for all crypto imports
  'crypto': path.resolve(__dirname, 'configs/crypto.js'),
  'crypto-browserify': path.resolve(__dirname, 'configs/crypto.js'),
  
  // Additional crypto-related modules
  'cipher-base': 'cipher-base',
  'safe-buffer': 'buffer',
  'string_decoder': 'string_decoder',
  'inherits': 'inherits',
  
  // Node.js polyfills for better Web3 compatibility
  'assert': 'assert',
  'events': 'events',
  'path': 'path-browserify',
  'querystring': 'querystring-es3',
  'constants': 'constants-browserify',
  'domain': 'domain-browser',
  'timers': 'timers-browserify',
  
  // Additional essential polyfills
  'util/types': 'util',
  'util/_extend': 'util',
  'util/deprecate': 'util/deprecate',
  'util/format': 'util/format',
  
  // Stream-browserify for additional compatibility
  'stream-browserify': path.resolve(__dirname, 'configs/stream-polyfill.js'),
  
  // Dynamic Labs and Wagmi specific polyfills for React Native compatibility
  'encoding': false,
  'lokijs': false,
  'pino-pretty': false,
  'rn-nodeify': false,
  
  // Keep these disabled as they don't have good RN polyfills
  'http': false,
  'https': false,
  'os': false,
  'zlib': false,
  'fs': false,
  'net': false,
  'tls': false,
  'child_process': false,
  'vm': false,
  'readline': false
};

// Enhanced resolver configuration
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Asset extensions for multimedia files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'wav',
  'mp3',
  'mp4',
  'webm',
  'ogg',
  'flac'
];

// Source extensions for various file types
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs'
];

// Enhanced transformer configuration for better compatibility
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  minifierConfig: {
    // Ensure polyfills aren't mangled
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Add resolver to handle specific cases like cipher-base
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.hasteImplModulePath = undefined;

// Enhanced module resolution for problematic packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle stream imports specifically for cipher-base and other crypto modules
  if (moduleName === 'stream') {
    return {
      filePath: path.resolve(__dirname, 'configs/stream-polyfill.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle crypto imports for nanoid and other packages
  if (moduleName === 'crypto') {
    return {
              filePath: path.resolve(__dirname, 'configs/crypto.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle other _stream_ modules
  if (moduleName.startsWith('_stream_')) {
    const streamType = moduleName.replace('_stream_', '');
    try {
      return context.resolveRequest(context, `readable-stream/${streamType}`, platform);
    } catch (error) {
      // Fallback to our stream polyfill
      return {
        filePath: path.resolve(__dirname, 'configs/stream-polyfill.js'),
        type: 'sourceFile',
      };
    }
  }
  
  // Use default resolver for all other modules
  return context.resolveRequest(context, moduleName, platform);
};

// Enhanced platform-specific configurations with Dynamic Labs support
if (process.env.EXPO_PLATFORM === 'web') {
  // Web-specific optimizations for Dynamic Labs + Wagmi
  config.resolver.platforms = ['web', 'native'];
  
  // For web, still use our crypto wrapper (it handles web internally)
      config.resolver.alias['crypto'] = path.resolve(__dirname, 'configs/crypto.js');
    config.resolver.alias['crypto-browserify'] = path.resolve(__dirname, 'configs/crypto.js');
  
  // Use stream-browserify for web platform to support Dynamic Labs
  config.resolver.alias['stream'] = 'stream-browserify';
  
  // Web-specific aliases for Dynamic Labs packages
  config.resolver.alias['@dynamic-labs/sdk-react-core'] = '@dynamic-labs/sdk-react-core';
  config.resolver.alias['@dynamic-labs/ethereum'] = '@dynamic-labs/ethereum';
  config.resolver.alias['@dynamic-labs/wagmi-connector'] = '@dynamic-labs/wagmi-connector';
  
  // Enable ESM support for web builds
  config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
  
} else {
  // Mobile-specific optimizations
  config.resolver.platforms = ['native', 'android', 'ios'];
  
  // Enhanced stream resolution for mobile - use our dedicated polyfill
      config.resolver.alias['stream'] = path.resolve(__dirname, 'configs/stream-polyfill.js');
  config.resolver.alias['_stream_readable'] = 'readable-stream/readable';
  config.resolver.alias['_stream_writable'] = 'readable-stream/writable';
  config.resolver.alias['_stream_duplex'] = 'readable-stream/duplex';
  config.resolver.alias['_stream_transform'] = 'readable-stream/transform';
  config.resolver.alias['_stream_passthrough'] = 'readable-stream/passthrough';
}

// Enhanced Metro configuration for better performance and React Native compatibility
config.maxWorkers = 2; // Limit workers for stability
config.resetCache = false; // Keep cache for faster builds

// Ensure node_modules resolution works properly for React Native polyfills
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules')
];

module.exports = config;