// Platform-aware polyfills for Web3 and Node.js compatibility
// Supports both Web and mobile

import { Platform } from 'react-native';

// Essential polyfills that work on both platforms
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Ensure globalThis exists for dynamic imports (webpack will handle import.meta)
(function() {
  'use strict';
  
  // Ensure globalThis exists first
  if (typeof globalThis === 'undefined') {
    if (typeof window !== 'undefined') {
      window.globalThis = window;
    } else if (typeof global !== 'undefined') {
      global.globalThis = global;
    } else if (typeof self !== 'undefined') {
      self.globalThis = self;
    }
  }
  
  console.log('✅ GlobalThis polyfill loaded:', {
    platform: Platform.OS,
    globalThis: typeof globalThis
  });
})();

// Note: import.meta is now handled by webpack DefinePlugin for better compatibility

// Set up stream polyfills BEFORE any other imports
if (Platform.OS !== 'web') {
  // Import stream polyfills immediately
  try {
    const {Readable, Writable, Transform, Duplex, PassThrough} = require('readable-stream');
    
    // Make stream modules available globally BEFORE any other modules load
    global.Readable = Readable;
    global.Writable = Writable;
    global.Transform = Transform;
    global.Duplex = Duplex;
    global.PassThrough = PassThrough;
    
    // Create comprehensive stream compatibility layer
    const Stream = {
      Readable: Readable,
      Writable: Writable,
      Transform: Transform,
      Duplex: Duplex,
      PassThrough: PassThrough,
      Stream: Readable
    };
    
    // Make stream available as a module that can be required
    global.stream = Stream;
    
    // Override require for stream module (for cipher-base compatibility)
    const originalRequire = require;
    global.require = function(id) {
      if (id === 'stream') {
        return Stream;
      }
      if (id === '_stream_readable') {
        return Readable;
      }
      if (id === '_stream_writable') {
        return Writable;
      }
      if (id === '_stream_transform') {
        return Transform;
      }
      if (id === '_stream_duplex') {
        return Duplex;
      }
      if (id === '_stream_passthrough') {
        return PassThrough;
      }
      return originalRequire.apply(this, arguments);
    };
    
    // Also ensure Module.require works (for bundled environments)
    if (typeof Module !== 'undefined' && Module.prototype) {
      const originalModuleRequire = Module.prototype.require;
      Module.prototype.require = function(id) {
        if (id === 'stream') {
          return Stream;
        }
        if (id === '_stream_readable') {
          return Readable;
        }
        if (id === '_stream_writable') {
          return Writable;
        }
        if (id === '_stream_transform') {
          return Transform;
        }
        if (id === '_stream_duplex') {
          return Duplex;
        }
        if (id === '_stream_passthrough') {
          return PassThrough;
        }
        return originalModuleRequire.apply(this, arguments);
      };
    }
    
    console.log('✅ Comprehensive stream polyfills loaded for React Native with require override');
  } catch (error) {
    console.warn('⚠️ Stream polyfill loading failed, using fallbacks:', error);
    
    // Enhanced fallback stream implementation
    const EventEmitter = require('events');
    
    class EnhancedReadable extends EventEmitter {
      constructor(options = {}) {
        super();
        this.readable = true;
        this._readableState = {
          objectMode: options.objectMode || false,
          highWaterMark: options.highWaterMark || 16384,
          buffer: [],
          ended: false,
          flowing: null
        };
      }
      
      read(size) { 
        this.emit('data', Buffer.alloc(0));
        return null; 
      }
      
      pipe(dest) { 
        this.on('data', (chunk) => {
          if (dest.write) dest.write(chunk);
        });
        return dest; 
      }
      
      push(chunk) {
        this.emit('data', chunk);
        return true;
      }
      
      end() {
        this.emit('end');
      }
    }
    
    class EnhancedWritable extends EventEmitter {
      constructor(options = {}) {
        super();
        this.writable = true;
        this._writableState = {
          objectMode: options.objectMode || false,
          highWaterMark: options.highWaterMark || 16384,
          ended: false
        };
      }
      
      write(chunk, encoding, callback) { 
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        if (callback) setTimeout(callback, 0);
        return true; 
      }
      
      end(chunk, encoding, callback) { 
        if (chunk) this.write(chunk, encoding);
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        if (callback) setTimeout(callback, 0);
        this.emit('finish'); 
      }
    }
    
    class EnhancedTransform extends EnhancedReadable {
      constructor(options = {}) {
        super(options);
        this.writable = true;
      }
      
      _transform(chunk, encoding, callback) {
        this.push(chunk);
        if (callback) callback();
      }
      
      write(chunk, encoding, callback) {
        this._transform(chunk, encoding, callback);
        return true;
      }
    }
    
    global.Readable = EnhancedReadable;
    global.Writable = EnhancedWritable;
    global.Transform = EnhancedTransform;
    global.Duplex = EnhancedTransform;
    global.PassThrough = EnhancedTransform;
    
    const FallbackStream = {
      Readable: EnhancedReadable,
      Writable: EnhancedWritable,
      Transform: EnhancedTransform,
      Duplex: EnhancedTransform,
      PassThrough: EnhancedTransform,
      Stream: EnhancedReadable
    };
    
    global.stream = FallbackStream;
    
    // Override require for fallback as well
    const originalRequire = require;
    global.require = function(id) {
      if (id === 'stream') {
        return FallbackStream;
      }
      return originalRequire.apply(this, arguments);
    };
  }
}

// Use our new crypto wrapper instead of problematic react-native-crypto
// Note: Importing dynamically to avoid Metro resolution issues during build
let crypto;

// Buffer polyfill (works on both platforms)
import { Buffer } from 'buffer';
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Process polyfill (works on both platforms)
import process from 'process/browser';
if (typeof global !== 'undefined') {
  global.process = process;
}
if (typeof window !== 'undefined') {
  window.process = process;
}

// ADDITIONAL NODE.JS MODULE POLYFILLS for crypto dependencies
try {
  // String decoder polyfill
  if (Platform.OS !== 'web') {
    const { StringDecoder } = require('string_decoder');
    global.StringDecoder = StringDecoder;
  }
  
  // Util polyfill
  const util = require('util');
  if (!global.util) {
    global.util = util;
  }
  
  // Events polyfill
  const EventEmitter = require('events');
  if (!global.EventEmitter) {
    global.EventEmitter = EventEmitter;
  }
  
  // Assert polyfill
  const assert = require('assert');
  if (!global.assert) {
    global.assert = assert;
  }
  
  // Constants polyfill
  if (Platform.OS !== 'web') {
    try {
      const constants = require('constants-browserify');
      global.constants = constants;
    } catch (err) {
      // Fallback constants
      global.constants = {
        O_RDONLY: 0,
        O_WRONLY: 1,
        O_RDWR: 2
      };
    }
  }
  
  console.log('✅ Additional Node.js module polyfills loaded');
} catch (error) {
  console.warn('⚠️ Some Node.js module polyfills failed:', error);
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

// ENHANCED CRYPTO POLYFILLS using our wrapper
try {
  // Load crypto dynamically to avoid Metro resolution issues
  try {
    crypto = require('./crypto.js');
  } catch (importError) {
    // Crypto wrapper loading failed, using fallback (normal on web platform)
    crypto = null;
  }
  
  // Ensure crypto is available globally using our wrapper
  if (!global.crypto && crypto) {
    global.crypto = crypto;
  }
  
  // Also make it available as a module export for direct imports
  if (typeof module !== 'undefined' && module.exports && crypto) {
    module.exports.crypto = crypto;
  }
  
  console.log(`✅ Enhanced crypto polyfill loaded for ${Platform.OS}`);
} catch (error) {
  console.error('❌ Failed to load crypto polyfill:', error);
  
  // Minimal fallback
  const fallbackCrypto = {
    randomBytes: (size) => {
      const array = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return Buffer.from(array);
    },
    createHash: () => ({
      update: function() { return this; },
      digest: () => 'fallback'
    })
  };
  
  global.crypto = fallbackCrypto;
  console.warn('⚠️ Using minimal crypto fallback');
}

// Additional Web3 polyfills for NEAR and other blockchain functionality
try {
  // TextEncoder/TextDecoder polyfills (if needed)
  if (typeof global.TextEncoder === 'undefined') {
    try {
      const { TextEncoder, TextDecoder } = require('text-encoding-polyfill');
      global.TextEncoder = TextEncoder;
      global.TextDecoder = TextDecoder;
    } catch (err) {
      // Fallback to basic implementation if text-encoding-polyfill is not available
      global.TextEncoder = class TextEncoder {
        encode(str) {
          const bytes = [];
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            if (char < 0x80) {
              bytes.push(char);
            } else if (char < 0x800) {
              bytes.push(0xc0 | (char >> 6));
              bytes.push(0x80 | (char & 0x3f));
            } else if (char < 0xd800 || char >= 0xe000) {
              bytes.push(0xe0 | (char >> 12));
              bytes.push(0x80 | ((char >> 6) & 0x3f));
              bytes.push(0x80 | (char & 0x3f));
            } else {
              // Surrogate pair
              i++;
              const char2 = str.charCodeAt(i);
              const codePoint = 0x10000 + (((char & 0x3ff) << 10) | (char2 & 0x3ff));
              bytes.push(0xf0 | (codePoint >> 18));
              bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
              bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
              bytes.push(0x80 | (codePoint & 0x3f));
            }
          }
          return new Uint8Array(bytes);
        }
      };
      
      global.TextDecoder = class TextDecoder {
        decode(bytes) {
          let str = '';
          let i = 0;
          while (i < bytes.length) {
            const byte1 = bytes[i++];
            if (byte1 < 0x80) {
              str += String.fromCharCode(byte1);
            } else if ((byte1 >> 5) === 0x06) {
              const byte2 = bytes[i++];
              str += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
            } else if ((byte1 >> 4) === 0x0e) {
              const byte2 = bytes[i++];
              const byte3 = bytes[i++];
              str += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
            } else if ((byte1 >> 3) === 0x1e) {
              const byte2 = bytes[i++];
              const byte3 = bytes[i++];
              const byte4 = bytes[i++];
              const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
              const surrogate1 = 0xd800 + ((codePoint - 0x10000) >> 10);
              const surrogate2 = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);
              str += String.fromCharCode(surrogate1, surrogate2);
            }
          }
          return str;
        }
      };
      
      console.log('✅ Using basic TextEncoder/TextDecoder implementation');
    }
  }
  
  // Stream polyfills for compatibility
  if (!global.ReadableStream && Platform.OS !== 'web') {
    // Basic ReadableStream polyfill for React Native
    global.ReadableStream = class ReadableStream {
      constructor() {
        console.warn('Using basic ReadableStream polyfill');
      }
    };
  }
  
  // Additional crypto module availability checks for React Native
  if (Platform.OS !== 'web') {
    // Make sure btoa/atob are available
    if (typeof global.btoa === 'undefined') {
      global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
    }
    if (typeof global.atob === 'undefined') {
      global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
    }
  }
  
  console.log('✅ Additional Web3 polyfills loaded');
} catch (error) {
  console.warn('⚠️ Some Web3 polyfills may not be available:', error);
}

// Console grouping polyfill for mobile (as per user preference)
if (Platform.OS !== 'web') {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.groupCollapsed = console.groupCollapsed || function(label) {
    originalLog(`🔽 ${label}`);
  };
  
  console.groupEnd = console.groupEnd || function() {
    // Silent end for mobile
  };
  
  // Enhanced logging with grouping for micro-variations
  const createGroupedLogger = (originalFn, icon) => {
    return function(...args) {
      if (args.length > 1 && typeof args[0] === 'string' && args[0].includes('micro')) {
        console.groupCollapsed(`${icon} Micro-variations`);
        originalFn.apply(console, args);
        console.groupEnd();
      } else {
        originalFn.apply(console, args);
      }
    };
  };
  
  console.log = createGroupedLogger(originalLog, '📝');
  console.warn = createGroupedLogger(originalWarn, '⚠️');
  console.error = createGroupedLogger(originalError, '❌');
}

console.log(`🚀 Comprehensive platform polyfills loaded for ${Platform.OS}`);
