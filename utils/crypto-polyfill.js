// Comprehensive crypto polyfill for browser environment
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import crypto from 'crypto-browserify';

// Set up global polyfills
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
  global.crypto = crypto;
  global.process = global.process || { env: {} };
}

// Additional window polyfills for browser
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.crypto = window.crypto || crypto;
  window.process = window.process || { env: {} };
}

export default crypto;