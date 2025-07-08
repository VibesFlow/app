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
        '@here-wallet',
        '@noble/hashes',
        '@siteed/expo-audio-studio',
        'react-native-blob-util',
        'react-native-device-info',
        'socket.io-client'
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

  // Add necessary plugins for polyfills
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
      global: 'global'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
      'process.env.NODE_DEBUG': JSON.stringify(''),
      'process.version': JSON.stringify('v16.0.0'),
      'process.browser': JSON.stringify(true),
      'global': 'globalThis'
    })
  );

  // Ensure proper module resolution
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native$': 'react-native-web',
    'react-native-web$': 'react-native-web'
  };

  // Module rules for better compatibility
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false
    }
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
            test: /[\\/]node_modules[\\/](@near-wallet-selector|near-api-js|@here-wallet)[\\/]/,
            name: 'wallet',
            chunks: 'all',
          },
          crypto: {
            test: /[\\/]node_modules[\\/](crypto-browserify|@noble)[\\/]/,
            name: 'crypto',
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