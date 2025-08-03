/**
 * ALITH WRAPPER - Client-Side Proxy for Alith Framework
 * 
 * This wrapper provides the same API as the Alith framework but routes
 * all operations through the backend WebSocket service where the Alith
 * agents are running. This ensures we use the actual Alith NPM package
 * while maintaining compatibility with React Native/Expo.
 * 
 * Architecture:
 * Client (this wrapper) <--WebSocket--> Backend (Alith agents)
 */

import { Platform } from 'react-native';

// Use polyfilled EventEmitter for cross-platform compatibility
const EventEmitter = global.EventEmitter || class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
  removeListener(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
};

/**
 * WebSocket-based Alith Agent Proxy
 * Provides the same interface as the Alith Agent class
 */
export class Agent extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      model: options.model || 'gemini-2.5-flash-lite',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl || 'generativelanguage.googleapis.com',
      temperature: options.temperature || 0.3,
      preamble: options.preamble || '',
      tools: options.tools || [],
      backendUrl: options.backendUrl || this.getBackendUrl(),
      ...options
    };
    
    // WebSocket connection
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    
    // Initialize connection
    this.connect();
  }

  /**
   * Get backend URL based on environment
   */
  getBackendUrl() {
    // Check for environment-specific URL
    if (process.env.EXPO_PUBLIC_ALITH_ORCHESTRATOR_URL) {
      return process.env.EXPO_PUBLIC_ALITH_ORCHESTRATOR_URL;
    }
    
    // Default URLs by platform
    if (Platform.OS === 'web') {
      return 'wss://alith.vibesflow.ai/orchestrator';
    } else {
      // For mobile, also use production URL
      return 'wss://alith.vibesflow.ai/orchestrator';
    }
  }

  /**
   * Connect to backend WebSocket
   */
  async connect() {
    if (this.connecting || this.connected) {
      return;
    }
    
    this.connecting = true;
    this.connectionAttempts++;
    
    try {
      console.log(`🔌 Connecting to Alith backend (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}): ${this.config.backendUrl}`);
      
      this.ws = new WebSocket(this.config.backendUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.connecting && this.ws.readyState === WebSocket.CONNECTING) {
          console.warn('⏰ WebSocket connection timeout');
          this.ws.close();
        }
      }, 10000); // 10 second timeout
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Connected to Alith backend');
        this.connected = true;
        this.connecting = false;
        this.connectionAttempts = 0;
        
        // Send initialization message with agent config
        try {
          this.ws.send(JSON.stringify({
            type: 'agent_init',
            config: {
              model: this.config.model,
              temperature: this.config.temperature,
              preamble: this.config.preamble,
              tools: this.config.tools
            },
            timestamp: Date.now()
          }));
        } catch (sendError) {
          console.error('❌ Failed to send init message:', sendError);
        }
        
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 Disconnected from Alith backend (code: ${event.code}, reason: ${event.reason})`);
        this.connected = false;
        this.connecting = false;
        this.ws = null;
        
        // Only attempt reconnection if not at max attempts and not a deliberate close
        if (this.connectionAttempts < this.maxConnectionAttempts && event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 30000); // Exponential backoff, max 30s
          console.log(`🔄 Attempting reconnection in ${delay}ms...`);
          setTimeout(() => this.connect(), delay);
        } else if (this.connectionAttempts >= this.maxConnectionAttempts) {
          console.error('❌ Max reconnection attempts reached, giving up');
        }
        
        this.emit('disconnected');
      };
      
      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
        this.connecting = false;
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('❌ Failed to connect to Alith backend:', error);
      this.connecting = false;
      this.emit('error', error);
    }
  }

  /**
   * Send message to backend
   */
  sendMessage(message) {
    if (!this.connected || !this.ws) {
      console.warn('Not connected to Alith backend, queueing message');
      return Promise.reject(new Error('Not connected to backend'));
    }
    
    const messageId = ++this.messageId;
    const fullMessage = {
      id: messageId,
      timestamp: Date.now(),
      ...message
    };
    
    this.ws.send(JSON.stringify(fullMessage));
    
    // Return a promise that resolves when we get a response
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(messageId, { resolve, reject });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(messageId)) {
          this.pendingMessages.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    // Handle response to a pending message
    if (message.id && this.pendingMessages.has(message.id)) {
      const { resolve, reject } = this.pendingMessages.get(message.id);
      this.pendingMessages.delete(message.id);
      
      if (message.success !== false) {
        resolve(message.data || message);
      } else {
        reject(new Error(message.error || 'Backend operation failed'));
      }
      return;
    }
    
    // Handle event messages
    switch (message.type) {
      case 'agent_response':
        this.emit('response', message.data);
        break;
      case 'agent_error':
        this.emit('error', new Error(message.error));
        break;
      default:
        console.log('Received message from backend:', message);
    }
  }

  /**
   * Send prompt to Alith agent
   * This is the main interface that mirrors the Alith Agent.prompt() method
   */
  async prompt(message) {
    try {
      const response = await this.sendMessage({
        type: 'agent_prompt',
        message: message
      });
      
      return response.response || response;
      
    } catch (error) {
      console.error('Alith prompt failed:', error);
      throw error;
    }
  }

  /**
   * Process sensor data (custom method for VibesFlow)
   */
  async processSensorData(sensorData, currentStyle) {
    try {
      const response = await this.sendMessage({
        type: 'sensor_data',
        data: {
          sensorData,
          currentStyle,
          timestamp: Date.now()
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Sensor data processing failed:', error);
      throw error;
    }
  }

  /**
   * Optimize Lyria configuration (custom method for VibesFlow)
   */
  async optimizeLyriaConfig(intensity, genre, performance, bufferState) {
    try {
      const response = await this.sendMessage({
        type: 'optimize_lyria',
        data: {
          intensity,
          genre,
          performance,
          bufferState,
          timestamp: Date.now()
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Lyria optimization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze sensor patterns (custom method for VibesFlow)
   */
  async analyzeSensorPatterns(magnitude, source, style, metrics) {
    try {
      const response = await this.sendMessage({
        type: 'analyze_sensor_patterns',
        data: {
          magnitude,
          source,
          style,
          metrics,
          timestamp: Date.now()
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Sensor pattern analysis failed:', error);
      throw error;
    }
  }

  /**
   * Predict transition quality (custom method for VibesFlow)
   */
  async predictTransitionQuality(fromStyle, toStyle, speed, context) {
    try {
      const response = await this.sendMessage({
        type: 'predict_transition',
        data: {
          fromStyle,
          toStyle,
          speed,
          context,
          timestamp: Date.now()
        }
      });
      
      return response;
      
    } catch (error) {
      console.error('Transition prediction failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup and disconnect
   */
  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.pendingMessages.clear();
  }
}

/**
 * Alith Memory classes - these are simple proxies since memory is handled on the backend
 */
export class WindowBufferMemory {
  constructor(options = {}) {
    this.options = options;
  }
}

export class VectorMemory {
  constructor(options = {}) {
    this.options = options;
  }
}

// Export the wrapper as the main Alith interface
export default {
  Agent,
  WindowBufferMemory,
  VectorMemory
};