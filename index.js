// Essential polyfills for web3 compatibility - MUST BE FIRST
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Minimal Buffer polyfill only
if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
  const { Buffer } = require('buffer');
  global.Buffer = Buffer;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);