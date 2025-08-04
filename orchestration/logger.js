/**
 * LOGGER.JS - Throttled Console Logging System
 * 
 * Implements smart console log grouping to prevent clutter while preserving
 * all debugging information. Groups similar messages with expandable details.
 */

/**
 * Throttled Logger for Orchestration System
 * Groups similar log messages to prevent console spam
 */
export class ThrottledLogger {
  constructor() {
    // Log groups storage
    this.logGroups = new Map();
    
    // Timing controls with category-specific rules
    this.flushInterval = 30000; // Flush groups every 30 seconds
    this.maxGroupSizes = {
      'sensor-data': 2000,     // High-frequency sensor data - very large groups to accumulate more
      'audio-chunk': 300,      // Audio chunks - medium groups  
      'buffer-status': 500,    // Buffer updates - medium groups
      'server-comm': 200,      // Server communication - smaller groups
      'interpretation': 75,    // Interpretations - smaller groups
      'performance': 400,      // Performance metrics - medium groups
      'default': 150           // Default for other categories
    };
    this.lastFlush = Date.now();
    
    // Auto-flush timer (longer interval for better grouping)
    this.flushTimer = setInterval(() => {
      this.flushAllGroups();
    }, this.flushInterval);
    
    // Track active groups to prevent memory leaks
    this.activeGroups = new Set();
  }

  /**
   * Log a message with throttling and grouping
   * @param {string} category - Log category (e.g., 'sensor-data', 'audio-chunk')
   * @param {string} message - Main message
   * @param {object} data - Additional data to log
   * @param {string} level - Log level ('log', 'warn', 'error', 'info')
   */
  log(category, message, data = {}, level = 'log') {
    const groupKey = `${category}-${level}`;
    
    if (!this.logGroups.has(groupKey)) {
      this.logGroups.set(groupKey, {
        category,
        message,
        level,
        count: 0,
        entries: [],
        firstTimestamp: Date.now(),
        lastTimestamp: Date.now()
      });
      this.activeGroups.add(groupKey);
    }
    
    const group = this.logGroups.get(groupKey);
    group.count++;
    group.lastTimestamp = Date.now();
    group.entries.push({
      timestamp: Date.now(),
      data: this.sanitizeData(data)
    });
    
    // Auto-flush if group gets too large (category-specific limits)
    const maxSize = this.maxGroupSizes[category] || this.maxGroupSizes.default;
    if (group.entries.length >= maxSize) {
      this.flushGroup(groupKey);
    }
  }

  /**
   * Sanitize data to prevent circular references and large objects
   */
  sanitizeData(data) {
    const seen = new WeakSet();
    
    const sanitize = (obj, depth = 0) => {
      if (depth > 3) return '[Max Depth Reached]';
      if (obj === null || typeof obj !== 'object') return obj;
      if (seen.has(obj)) return '[Circular Reference]';
      
      seen.add(obj);
      
      if (Array.isArray(obj)) {
        return obj.slice(0, 10).map(item => sanitize(item, depth + 1));
      }
      
      const sanitized = {};
      let count = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (count >= 10) {
          sanitized['...'] = `${Object.keys(obj).length - 10} more properties`;
          break;
        }
        sanitized[key] = sanitize(value, depth + 1);
        count++;
      }
      
      return sanitized;
    };
    
    return sanitize(data);
  }

  /**
   * Flush a specific log group to console
   */
  flushGroup(groupKey) {
    const group = this.logGroups.get(groupKey);
    if (!group || group.count === 0) return;
    
    const duration = group.lastTimestamp - group.firstTimestamp;
    const rate = group.count / Math.max(duration / 1000, 1);
    const durationText = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    
    // Create collapsed group with summary showing accumulation time
    const groupTitle = `${group.message} (${group.count}) - ${rate.toFixed(1)}/s over ${durationText}`;
    
    // Use appropriate console method based on level
    const consoleMethod = console[group.level] || console.log;
    
    if (group.count === 1) {
      // Single entry - log directly without grouping
      consoleMethod(group.message, group.entries[0].data);
    } else {
      // Multiple entries - create collapsible group
      console.groupCollapsed(groupTitle);
      
      // Log summary info
      consoleMethod('📊 Summary:', {
        category: group.category,
        totalCount: group.count,
        duration: `${(duration / 1000).toFixed(1)}s`,
        rate: `${rate.toFixed(1)}/s`,
        firstSeen: new Date(group.firstTimestamp).toLocaleTimeString(),
        lastSeen: new Date(group.lastTimestamp).toLocaleTimeString()
      });
      
      // Show sample entries (first few and last few)
      const sampleSize = 3;
      const totalEntries = group.entries.length;
      
      if (totalEntries <= sampleSize * 2) {
        // Show all entries if small group
        group.entries.forEach((entry, index) => {
          consoleMethod(`[${index + 1}/${totalEntries}] ${new Date(entry.timestamp).toLocaleTimeString()}:`, entry.data);
        });
      } else {
        // Show first few entries
        console.group(`📈 First ${sampleSize} entries:`);
        group.entries.slice(0, sampleSize).forEach((entry, index) => {
          consoleMethod(`[${index + 1}/${totalEntries}] ${new Date(entry.timestamp).toLocaleTimeString()}:`, entry.data);
        });
        console.groupEnd();
        
        // Show last few entries
        console.group(`📉 Last ${sampleSize} entries:`);
        group.entries.slice(-sampleSize).forEach((entry, index) => {
          const actualIndex = totalEntries - sampleSize + index + 1;
          consoleMethod(`[${actualIndex}/${totalEntries}] ${new Date(entry.timestamp).toLocaleTimeString()}:`, entry.data);
        });
        console.groupEnd();
        
        // Show middle gap info
        const skippedCount = totalEntries - (sampleSize * 2);
        if (skippedCount > 0) {
          console.log(`... ${skippedCount} similar entries omitted (expand above for samples) ...`);
        }
      }
      
      console.groupEnd();
    }
    
    // Clear the group
    this.logGroups.delete(groupKey);
    this.activeGroups.delete(groupKey);
  }

  /**
   * Flush all active log groups
   */
  flushAllGroups() {
    const groupsToFlush = Array.from(this.activeGroups);
    groupsToFlush.forEach(groupKey => {
      this.flushGroup(groupKey);
    });
    this.lastFlush = Date.now();
  }

  /**
   * Force immediate flush (useful for debugging)
   */
  flush() {
    this.flushAllGroups();
  }

  /**
   * Flush specific category of logs
   */
  flushCategory(category) {
    const groupsToFlush = Array.from(this.activeGroups).filter(groupKey => 
      groupKey.startsWith(`${category}-`)
    );
    groupsToFlush.forEach(groupKey => {
      this.flushGroup(groupKey);
    });
  }

  /**
   * Get current accumulation stats without flushing (for debugging)
   */
  getCurrentStats() {
    const stats = {};
    this.logGroups.forEach((group, groupKey) => {
      stats[groupKey] = {
        count: group.count,
        duration: Date.now() - group.firstTimestamp,
        rate: group.count / Math.max((Date.now() - group.firstTimestamp) / 1000, 1)
      };
    });
    return stats;
  }

  /**
   * Cleanup logger
   */
  cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAllGroups();
    this.logGroups.clear();
    this.activeGroups.clear();
  }
}

// Create singleton instance
export const throttledLogger = new ThrottledLogger();

// Convenience methods for common log types
export const logSensorData = (data) => {
  throttledLogger.log('sensor-data', '🎛️ Sensor data captured', data);
};

export const logAudioChunk = (data) => {
  throttledLogger.log('audio-chunk', '🎵 Audio chunk processed', data);
};

export const logServerCommunication = (data) => {
  throttledLogger.log('server-comm', '📡 Server communication', data);
};

export const logBufferStatus = (data) => {
  throttledLogger.log('buffer-status', '🔄 Buffer status update', data);
};

export const logInterpretation = (data) => {
  throttledLogger.log('interpretation', '🎼 Music interpretation', data);
};

export const logPerformance = (data) => {
  throttledLogger.log('performance', '⚡ Performance metrics', data);
};

export const logError = (message, data) => {
  throttledLogger.log('error', `❌ ${message}`, data, 'error');
};

export const logWarning = (message, data) => {
  throttledLogger.log('warning', `⚠️ ${message}`, data, 'warn');
};

export const logInfo = (message, data) => {
  throttledLogger.log('info', `ℹ️ ${message}`, data, 'info');
};

// Export category flushing for manual control
export const flushSensorLogs = () => throttledLogger.flushCategory('sensor-data');
export const flushAudioLogs = () => throttledLogger.flushCategory('audio-chunk');
export const flushBufferLogs = () => throttledLogger.flushCategory('buffer-status');
export const flushAllLogs = () => throttledLogger.flush();

// Export stats for debugging
export const getLogStats = () => throttledLogger.getCurrentStats();

// For browser console debugging, expose some functions globally
if (typeof window !== 'undefined') {
  window.vibesFlowLogger = {
    getStats: getLogStats,
    flushAll: flushAllLogs,
    flushSensors: flushSensorLogs,
    flushAudio: flushAudioLogs,
    flushBuffer: flushBufferLogs
  };
}

// Export default
export default throttledLogger;