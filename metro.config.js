const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable modern Metro features for latest packages
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true; // Re-enable with custom resolver handling

// Enhanced resolver configuration for React Native polyfills
config.resolver.alias = {
  // Essential polyfills for React Native
  'buffer': 'buffer',
  'process': 'process/browser.js',
  'util': 'util',
  'url': 'react-native-url-polyfill/auto',
  
  // Stream polyfills
  'stream': path.resolve(__dirname, 'configs/stream-polyfill.js'),
  '_stream_duplex': 'readable-stream/duplex',
  '_stream_passthrough': 'readable-stream/passthrough',
  '_stream_readable': 'readable-stream/readable',
  '_stream_transform': 'readable-stream/transform',
  '_stream_writable': 'readable-stream/writable',
  
  // Crypto polyfills
  'crypto': path.resolve(__dirname, 'configs/crypto.js'),
  'crypto-browserify': path.resolve(__dirname, 'configs/crypto.js'),
  
  // Node.js polyfills
  'assert': 'assert',
  'events': 'events',
  'path': 'path-browserify',
  'querystring': 'querystring-es3',
  'constants': 'constants-browserify',
  'domain': 'domain-browser',
  'timers': 'timers-browserify',
  
  // Disable problematic modules
  'encoding': false,
  'lokijs': false,
  'pino-pretty': false,
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

// Configure for better module resolution
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Add problematic packages to transpilation
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Configure for handling @reown/appkit and wallet packages
config.resolver.alias = {
  ...config.resolver.alias,
  '@reown/appkit/core': path.resolve(__dirname, 'node_modules/@reown/appkit/dist/esm/exports/core.js'),
  '@reown/appkit/react': '@reown/appkit/react',
};

// Add custom resolver to handle problematic module issues
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @reown/appkit/core import issue
  if (moduleName === '@reown/appkit/core') {
    const corePath = path.resolve(__dirname, 'node_modules/@reown/appkit/dist/esm/exports/core.js');
    const fs = require('fs');
    if (fs.existsSync(corePath)) {
      return {
        filePath: corePath,
        type: 'sourceFile',
      };
    }
  }
  
  // Handle viem's internal ox module resolution (all relative imports)
  if ((moduleName.startsWith('../') || moduleName.startsWith('./')) && 
      context.originModulePath?.includes('node_modules/viem/node_modules/ox/') &&
      moduleName.endsWith('.js')) {
    
    // Remove .js extension and resolve the path
    const baseModuleName = moduleName.replace('.js', '');
    const originDir = path.dirname(context.originModulePath);
    const targetPath = path.resolve(originDir, baseModuleName);
    
    // Try different extensions - prioritize .ts since that's what ox uses
    const extensions = ['.ts', '.js', '.mjs', '.cjs'];
    for (const ext of extensions) {
      const fullPath = targetPath + ext;
      try {
        const fs = require('fs');
        if (fs.existsSync(fullPath)) {
          return {
            filePath: fullPath,
            type: 'sourceFile',
          };
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }
  
  // Use default resolver for all other modules
  return context.resolveRequest(context, moduleName, platform);
};

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

// Enhanced resolver main fields for better compatibility
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add TypeScript extensions to source extensions for viem/ox
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'ts',
  'tsx',
  'cjs',
  'mjs'
];

// Enhanced transformer configuration
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Platform-specific configurations
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.platforms = ['web', 'native'];
} else {
  config.resolver.platforms = ['native', 'android', 'ios'];
}

// Performance optimizations
config.maxWorkers = 2;
config.resetCache = false;

// Ensure proper node_modules resolution
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules')
];

module.exports = config;
