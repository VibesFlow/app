/**
 * stream-polyfill.js - Dedicated Stream Polyfill for Metro Bundler
 * Provides comprehensive stream compatibility for React Native
 * Used by Metro resolver to handle Node.js stream imports
 */

import { Platform } from 'react-native';

let Stream;

if (Platform.OS === 'web') {
  // Use browserify stream for web (maintains compatibility)
  try {
    Stream = require('stream-browserify');
  } catch (error) {
    // Fallback to readable-stream for web if stream-browserify not available
    const {Readable, Writable, Transform, Duplex, PassThrough} = require('readable-stream');
    Stream = {
      Readable,
      Writable,
      Transform,
      Duplex,
      PassThrough,
      Stream: Readable
    };
  }
} else {
  // Use readable-stream for React Native
  try {
    const {Readable, Writable, Transform, Duplex, PassThrough} = require('readable-stream');
    
    // Create comprehensive stream compatibility
    Stream = {
      Readable,
      Writable,
      Transform,
      Duplex,
      PassThrough,
      Stream: Readable
    };
    
    // Add prototype compatibility for cipher-base
    Stream.Readable.prototype.read = Stream.Readable.prototype.read || function(size) {
      return null;
    };
    
    Stream.Writable.prototype.write = Stream.Writable.prototype.write || function(chunk, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding;
      }
      if (callback) setTimeout(callback, 0);
      return true;
    };
    
    // Ensure proper inheritance
    Stream.Transform.prototype = Object.create(Stream.Readable.prototype);
    Stream.Transform.prototype.constructor = Stream.Transform;
    Stream.Transform.prototype.write = Stream.Writable.prototype.write;
    
    Stream.Duplex.prototype = Object.create(Stream.Readable.prototype);
    Stream.Duplex.prototype.constructor = Stream.Duplex;
    Stream.Duplex.prototype.write = Stream.Writable.prototype.write;
    
    console.log('✅ Stream polyfill loaded for React Native with enhanced compatibility');
  } catch (error) {
    console.warn('⚠️ readable-stream not available, using fallback:', error);
    
    // Enhanced fallback stream implementation
    const EventEmitter = require('events');
    
    class PolyfillReadable extends EventEmitter {
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
        // Emit empty data for compatibility
        setTimeout(() => this.emit('data', Buffer.alloc(0)), 0);
        return null;
      }
      
      pipe(dest) {
        this.on('data', (chunk) => {
          if (dest && typeof dest.write === 'function') {
            dest.write(chunk);
          }
        });
        this.on('end', () => {
          if (dest && typeof dest.end === 'function') {
            dest.end();
          }
        });
        return dest;
      }
      
      push(chunk) {
        if (chunk === null) {
          this.emit('end');
        } else {
          this.emit('data', chunk);
        }
        return true;
      }
      
      end() {
        this.emit('end');
      }
      
      pause() {
        this._readableState.flowing = false;
        return this;
      }
      
      resume() {
        this._readableState.flowing = true;
        return this;
      }
    }
    
    class PolyfillWritable extends EventEmitter {
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
          encoding = null;
        }
        if (callback) {
          setTimeout(callback, 0);
        }
        this.emit('data', chunk);
        return true;
      }
      
      end(chunk, encoding, callback) {
        if (chunk) {
          this.write(chunk, encoding);
        }
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        if (callback) {
          setTimeout(callback, 0);
        }
        this._writableState.ended = true;
        this.emit('finish');
      }
      
      destroy(error) {
        if (error) {
          this.emit('error', error);
        }
        this.emit('close');
      }
    }
    
    class PolyfillTransform extends PolyfillReadable {
      constructor(options = {}) {
        super(options);
        this.writable = true;
        this._writableState = {
          objectMode: options.objectMode || false,
          highWaterMark: options.highWaterMark || 16384,
          ended: false
        };
      }
      
      _transform(chunk, encoding, callback) {
        // Default transformation: pass-through
        this.push(chunk);
        if (callback) callback();
      }
      
      write(chunk, encoding, callback) {
        if (typeof encoding === 'function') {
          callback = encoding;
          encoding = null;
        }
        this._transform(chunk, encoding, callback);
        return true;
      }
      
      end(chunk, encoding, callback) {
        if (chunk) {
          this.write(chunk, encoding);
        }
        if (typeof encoding === 'function') {
          callback = encoding;
        }
        this.push(null); // Signal end
        if (callback) {
          setTimeout(callback, 0);
        }
      }
    }
    
    Stream = {
      Readable: PolyfillReadable,
      Writable: PolyfillWritable,
      Transform: PolyfillTransform,
      Duplex: PolyfillTransform, // Duplex is like Transform
      PassThrough: PolyfillTransform, // PassThrough is like Transform
      Stream: PolyfillReadable
    };
  }
}

// Export all stream classes for compatibility
export const Readable = Stream.Readable;
export const Writable = Stream.Writable;
export const Transform = Stream.Transform;
export const Duplex = Stream.Duplex;
export const PassThrough = Stream.PassThrough;

// Default export for require('stream') compatibility
export default Stream;

// Make it available globally for modules that expect it
if (typeof global !== 'undefined') {
  global.Stream = Stream;
  global.stream = Stream;
}

console.log(`📡 Stream polyfill module loaded for ${Platform.OS}`); 