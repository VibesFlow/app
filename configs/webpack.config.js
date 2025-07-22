const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: [
        '@near-wallet-selector',
        '@filoz/synapse-sdk',
        '@google/genai',
        '@near-js',
        'near-api-js',
        '@noble/hashes',
        '@siteed/expo-audio-studio',
        'react-native-blob-util',
        'react-native-device-info',
        'socket.io-client',
        // Add Dynamic Labs packages to transpilation
        '@dynamic-labs/sdk-react-core',
        '@dynamic-labs/ethereum',
        '@dynamic-labs/ethereum-core',
        '@dynamic-labs/wagmi-connector',
        '@dynamic-labs/react-native-extension'
      ]
    }
  }, argv);

  // Comprehensive polyfills for Web3 and Node.js functionality
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "process": require.resolve("process/browser"),
    "util": require.resolve("util"),
    "url": require.resolve("url"),
    "fs": false,
    "net": false,
    "tls": false,
    "child_process": false,
    "readline": false,
    "zlib": false,
    "http": false,
    "https": false,
    "os": false,
    "path": require.resolve("path-browserify"),
    "querystring": require.resolve("querystring-es3"),
    "vm": false,
    "assert": require.resolve("assert"),
    "constants": require.resolve("constants-browserify"),
    "domain": require.resolve("domain-browser"),
    "events": require.resolve("events"),
    "punycode": require.resolve("punycode"),
    "string_decoder": require.resolve("string_decoder"),
    "timers": require.resolve("timers-browserify")
  };

  // Add necessary plugins for polyfills and import.meta handling
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
      global: 'globalThis'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
      'process.env.NODE_DEBUG': JSON.stringify(''),
      'process.version': JSON.stringify('v18.0.0'),
      'process.browser': JSON.stringify(true),
      'global': 'globalThis',
      'globalThis.global': 'globalThis',
      // Fixed import.meta handling - use function-based approach to avoid module scope issues
      'import.meta': `{
        url: (typeof window !== 'undefined' && window.location) ? window.location.href : 'file://localhost/',
        env: (typeof process !== 'undefined' && process.env) ? process.env : {},
        resolve: function(id) { return Promise.resolve(id); }
      }`,
      'import.meta.url': `(typeof window !== 'undefined' && window.location) ? window.location.href : 'file://localhost/'`,
      'import.meta.env': `(typeof process !== 'undefined' && process.env) ? process.env : {}`,
      'import.meta.resolve': `function(id) { return Promise.resolve(id); }`
    })
  );

  // Ensure proper module resolution
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native$': 'react-native-web',
    'react-native-web$': 'react-native-web'
  };

  // Module rules for better compatibility and import.meta handling
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false
    }
  });

  // Enhanced rule to transform import.meta syntax and modern ES modules
  config.module.rules.push({
    test: /\.m?js$/,
    use: {
      loader: 'babel-loader',
      options: {
        plugins: [
          '@babel/plugin-syntax-import-meta',
          // Transform import.meta expressions before other transformations
          [
            '@babel/plugin-transform-modules-commonjs',
            {
              allowTopLevelThis: true,
              importInterop: 'babel',
              // Ensure import.meta is transformed correctly
              strictMode: false
            }
          ],
          // Handle dynamic imports properly
          '@babel/plugin-syntax-dynamic-import',
          // Add a custom plugin to replace import.meta
          [
            '@babel/plugin-transform-runtime',
            {
              regenerator: true,
              corejs: false,
              helpers: false,
              useESModules: false
            }
          ]
        ],
        // Handle import.meta specifically with updated preset
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: ['> 1%', 'last 2 versions']
              },
              modules: 'auto', // Changed from false to auto to handle import.meta better
              useBuiltIns: 'entry',
              corejs: 3
            }
          ]
        ]
      }
    },
    include: [
      /node_modules\/@noble/,
      /node_modules\/@near/,
      /node_modules\/near-api-js/,
      // Include Dynamic Labs packages for proper transpilation
      /node_modules\/@dynamic-labs/,
      /node_modules\/@wagmi/,
      /node_modules\/wagmi/,
      /node_modules\/viem/,
      /node_modules\/@tanstack/,
      // Additional Web3 and crypto packages that need transpilation
      /node_modules\/@walletconnect/,
      /node_modules\/@coinbase/,
      /node_modules\/@metamask/,
      /node_modules\/react-native-get-random-values/,
      /node_modules\/react-native-url-polyfill/
    ]
  });

  // Optimization for bundle splitting
  if (argv.mode === 'production') {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          wallet: {
            test: /[\\/]node_modules[\\/](@near-wallet-selector|near-api-js|@dynamic-labs)[\\/]/,
            name: 'wallet',
            chunks: 'all',
          },
          crypto: {
            test: /[\\/]node_modules[\\/](crypto-browserify|@noble)[\\/]/,
            name: 'crypto',
            chunks: 'all',
          },
          dynamic: {
            test: /[\\/]node_modules[\\/](@dynamic-labs|@wagmi|wagmi|viem|@tanstack|@walletconnect|@coinbase|@metamask)[\\/]/,
            name: 'dynamic',
            chunks: 'all',
          }
        }
      }
    };
  }

  // Ensure the same port for dev and prod
  if (config.devServer) {
    config.devServer.port = 19006; // Default Expo web port
  }

  return config;
};