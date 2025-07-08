// Polyfills for Web3 and Node.js compatibility in browser

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Buffer } from 'buffer';
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Process polyfill
import process from 'process/browser';
if (typeof global !== 'undefined') {
  global.process = process;
}
if (typeof window !== 'undefined') {
  window.process = process;
}

// Global polyfill
if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  } else if (typeof self !== 'undefined') {
    self.global = self;
  } else {
    throw new Error('Unable to locate global object');
  }
}

// Crypto polyfill for older browsers
if (typeof window !== 'undefined' && !window.crypto) {
  window.crypto = require('crypto-browserify');
}

// Stream polyfill
if (typeof window !== 'undefined' && !window.stream) {
  window.stream = require('stream-browserify');
}

// TextEncoder/TextDecoder polyfill for older browsers
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Performance polyfill for Node.js APIs
if (typeof performance === 'undefined') {
  global.performance = require('perf_hooks').performance;
}

// Console polyfill enhancement for debugging
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Filter out known non-critical polyfill warnings
    if (message.includes('Cannot redefine property: ethereum') ||
        message.includes('BigInt is not supported') ||
        message.includes('TextEncoder is not defined')) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

console.log('🔧 Polyfills loaded successfully for VibesFlow Web');

export default true; 