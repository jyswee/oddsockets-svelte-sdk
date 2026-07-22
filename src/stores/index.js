/**
 * OddSockets Svelte SDK - Reactive Stores
 * 
 * Svelte-specific reactive stores built on top of the JavaScript SDK.
 * These stores provide automatic UI updates and seamless integration
 * with Svelte's reactive system while using the JavaScript SDK as
 * the single source of truth for all WebSocket functionality.
 */

import { writable, derived, readable } from 'svelte/store';
import { onDestroy } from 'svelte';
import { OddSocketsClient } from '../client.js';

/**
 * Create a reactive store for an OddSockets client using the JavaScript SDK
 * 
 * @param {Object} config - Client configuration
 * @returns {Object} Reactive stores and methods
 */
export function createOddSocketsStore(config) {
  // Create the JavaScript SDK client instance (single source of truth)
  const client = new OddSocketsClient(config);
  
  // Reactive stores
  const connectionState = writable('disconnected');
  const isConnected = derived(connectionState, $state => $state === 'connected');
  const reconnectAttempts = writable(0);
  const lastError = writable(null);
  const workerInfo = writable(null);
  const sessionInfo = writable(null);
  
  // Connection duration tracking
  const connectionStartTime = writable(null);
  const connectionDuration = writable(0);
  const connectionDurationFormatted = derived(connectionDuration, duration => {
    if (duration === 0) return '0s';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  });
  
  // Set up event listeners on the JavaScript SDK client
  client.on('connecting', () => {
    connectionState.set('connecting');
    lastError.set(null);
  });
  
  client.on('connected', () => {
    connectionState.set('connected');
    connectionStartTime.set(Date.now());
    reconnectAttempts.set(0);
    lastError.set(null);
  });
  
  client.on('disconnected', () => {
    connectionState.set('disconnected');
    connectionStartTime.set(null);
    connectionDuration.set(0);
  });
  
  client.on('reconnecting', (data) => {
    connectionState.set('reconnecting');
    reconnectAttempts.set(data.attempt);
  });
  
  client.on('error', (error) => {
    lastError.set(error);
    if (client.getState() !== 'connected') {
      connectionState.set('failed');
    }
  });
  
  client.on('worker_assigned', (data) => {
    workerInfo.set(data);
    sessionInfo.set(data.session);
  });
  
  client.on('max_reconnect_attempts_reached', () => {
    connectionState.set('failed');
  });
  
  // Update connection duration periodically
  let durationInterval;
  const startDurationTracking = () => {
    durationInterval = setInterval(() => {
      const startTime = connectionStartTime.get ? connectionStartTime.get() : null;
      if (startTime) {
        connectionDuration.set(Date.now() - startTime);
      }
    }, 1000);
  };
  
  const stopDurationTracking = () => {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  };
  
  // Start tracking when connected
  isConnected.subscribe(connected => {
    if (connected) {
      startDurationTracking();
    } else {
      stopDurationTracking();
    }
  });
  
  // Cleanup function
  const cleanup = () => {
    stopDurationTracking();
    client.disconnect();
  };
  
  // Auto-cleanup on component destroy (if in component context)
  try {
    onDestroy(cleanup);
  } catch (e) {
    // Not in component context, cleanup must be called manually
  }
  
  return {
    // Core client from JavaScript SDK
    client,
    
    // Reactive stores
    connectionState: { subscribe: connectionState.subscribe },
    isConnected: { subscribe: isConnected.subscribe },
    reconnectAttempts: { subscribe: reconnectAttempts.subscribe },
    lastError: { subscribe: lastError.subscribe },
    workerInfo: { subscribe: workerInfo.subscribe },
    sessionInfo: { subscribe: sessionInfo.subscribe },
    connectionDuration: { subscribe: connectionDuration.subscribe },
    connectionDurationFormatted: { subscribe: connectionDurationFormatted.subscribe },
    
    // Methods
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    cleanup
  };
}

/**
 * Create a reactive store for a specific channel using the JavaScript SDK
 * 
 * @param {string} channelName - Channel name
 * @param {Object} config - Client configuration
 * @param {Object} options - Channel options
 * @returns {Object} Reactive stores and methods
 */
export function createChannelStore(channelName, config, options = {}) {
  // Create client using JavaScript SDK
  const client = new OddSocketsClient(config);
  const channel = client.channel(channelName);
  
  // Reactive stores
  const messages = writable([]);
  const presence = writable([]);
  const isSubscribed = writable(false);
  const lastMessage = writable(null);
  const messageHistory = writable([]);
  
  // Derived stores
  const messageCount = derived(messages, $messages => $messages.length);
  const presenceCount = derived(presence, $presence => $presence.length);
  const latestMessage = derived(messages, $messages => 
    $messages.length > 0 ? $messages[$messages.length - 1] : null
  );
  
  // Set up channel event listeners
  channel.on('message', (message) => {
    messages.update(msgs => [...msgs, message]);
    lastMessage.set(message);
  });
  
  channel.on('presence', (presenceData) => {
    presence.set(presenceData.users || []);
  });
  
  channel.on('presence_change', (data) => {
    if (data.action === 'join') {
      presence.update(users => [...users, data.user]);
    } else if (data.action === 'leave') {
      presence.update(users => users.filter(u => u.id !== data.user.id));
    }
  });
  
  channel.on('subscribed', () => {
    isSubscribed.set(true);
  });
  
  channel.on('unsubscribed', () => {
    isSubscribed.set(false);
  });
  
  channel.on('history', (data) => {
    messageHistory.set(data.messages || []);
    if (data.messages && data.messages.length > 0) {
      messages.update(msgs => [...data.messages, ...msgs]);
    }
  });
  
  // Methods
  const subscribe = async (callback = null, channelOptions = {}) => {
    await client.connect();
    return channel.subscribe(callback, { ...options, ...channelOptions });
  };
  
  const unsubscribe = () => {
    return channel.unsubscribe();
  };
  
  const publish = (message, publishOptions = {}) => {
    return channel.publish(message, publishOptions);
  };
  
  const publishBulk = (messageArray) => {
    const bulkMessages = messageArray.map(msg => ({
      channel: channelName,
      message: msg.message || msg,
      options: msg.options || {}
    }));
    return client.publishBulk(bulkMessages);
  };
  
  const getHistory = (options = {}) => {
    return channel.getHistory(options);
  };
  
  const getPresence = () => {
    return channel.getPresence();
  };
  
  const clearMessages = () => {
    messages.set([]);
  };
  
  const clearHistory = () => {
    messageHistory.set([]);
  };
  
  // Cleanup function
  const cleanup = () => {
    channel.unsubscribe();
    client.disconnect();
  };
  
  // Auto-cleanup on component destroy (if in component context)
  try {
    onDestroy(cleanup);
  } catch (e) {
    // Not in component context, cleanup must be called manually
  }
  
  return {
    // Core instances from JavaScript SDK
    client,
    channel,
    
    // Reactive stores
    messages: { subscribe: messages.subscribe },
    presence: { subscribe: presence.subscribe },
    isSubscribed: { subscribe: isSubscribed.subscribe },
    lastMessage: { subscribe: lastMessage.subscribe },
    messageHistory: { subscribe: messageHistory.subscribe },
    messageCount: { subscribe: messageCount.subscribe },
    presenceCount: { subscribe: presenceCount.subscribe },
    latestMessage: { subscribe: latestMessage.subscribe },
    
    // Methods
    subscribe,
    unsubscribe,
    publish,
    publishBulk,
    getHistory,
    getPresence,
    clearMessages,
    clearHistory,
    cleanup
  };
}

/**
 * Create a reactive store for connection status using the JavaScript SDK
 * 
 * @param {Object} config - Client configuration
 * @returns {Object} Reactive stores and methods
 */
export function createConnectionStore(config) {
  return createOddSocketsStore(config);
}

/**
 * Create a reactive store for presence tracking using the JavaScript SDK
 * 
 * @param {string} channelName - Channel name
 * @param {Object} config - Client configuration
 * @returns {Object} Reactive stores and methods
 */
export function createPresenceStore(channelName, config) {
  const channelStore = createChannelStore(channelName, config, { enablePresence: true });
  
  return {
    // Core instances
    client: channelStore.client,
    channel: channelStore.channel,
    
    // Presence-focused stores
    presence: channelStore.presence,
    presenceCount: channelStore.presenceCount,
    isSubscribed: channelStore.isSubscribed,
    
    // Methods
    subscribe: channelStore.subscribe,
    unsubscribe: channelStore.unsubscribe,
    getPresence: channelStore.getPresence,
    cleanup: channelStore.cleanup
  };
}

/**
 * Create a reactive store for multiple channels using the JavaScript SDK
 * 
 * @param {string[]} channelNames - Array of channel names
 * @param {Object} config - Client configuration
 * @param {Object} options - Channel options
 * @returns {Object} Reactive stores and methods
 */
export function createMultiChannelStore(channelNames, config, options = {}) {
  // Create client using JavaScript SDK
  const client = new OddSocketsClient(config);
  
  // Create channel stores for each channel
  const channelStores = {};
  const channels = {};
  
  for (const channelName of channelNames) {
    channels[channelName] = client.channel(channelName);
    channelStores[channelName] = createChannelStore(channelName, config, options);
  }
  
  // Combined reactive stores
  const allMessages = writable([]);
  const totalPresence = writable(0);
  const channelStatuses = writable({});
  
  // Aggregate data from all channels
  const updateAggregates = () => {
    let combinedMessages = [];
    let totalUsers = 0;
    const statuses = {};
    
    for (const [channelName, store] of Object.entries(channelStores)) {
      // Get current values (this is a simplified approach)
      // In a real implementation, you'd want to properly subscribe to each store
      statuses[channelName] = {
        subscribed: false, // Would get from store
        messageCount: 0,   // Would get from store
        presenceCount: 0   // Would get from store
      };
    }
    
    allMessages.set(combinedMessages);
    totalPresence.set(totalUsers);
    channelStatuses.set(statuses);
  };
  
  // Methods
  const subscribeAll = async () => {
    await client.connect();
    const promises = Object.values(channelStores).map(store => store.subscribe());
    return Promise.all(promises);
  };
  
  const unsubscribeAll = () => {
    const promises = Object.values(channelStores).map(store => store.unsubscribe());
    return Promise.all(promises);
  };
  
  const publishToChannel = (channelName, message, publishOptions = {}) => {
    if (channelStores[channelName]) {
      return channelStores[channelName].publish(message, publishOptions);
    }
    throw new Error(`Channel ${channelName} not found`);
  };
  
  const publishToAll = async (message, publishOptions = {}) => {
    const promises = Object.entries(channelStores).map(([name, store]) => 
      store.publish(message, publishOptions)
    );
    return Promise.all(promises);
  };
  
  // Cleanup function
  const cleanup = () => {
    Object.values(channelStores).forEach(store => store.cleanup());
  };
  
  // Auto-cleanup on component destroy (if in component context)
  try {
    onDestroy(cleanup);
  } catch (e) {
    // Not in component context, cleanup must be called manually
  }
  
  return {
    // Core instances
    client,
    channels,
    channelStores,
    
    // Reactive stores
    allMessages: { subscribe: allMessages.subscribe },
    totalPresence: { subscribe: totalPresence.subscribe },
    channelStatuses: { subscribe: channelStatuses.subscribe },
    
    // Methods
    subscribeAll,
    unsubscribeAll,
    publishToChannel,
    publishToAll,
    cleanup,
    
    // Individual channel access
    getChannelStore: (channelName) => channelStores[channelName],
    getChannel: (channelName) => channels[channelName]
  };
}

/**
 * Create a reactive store for real-time analytics using the JavaScript SDK
 * 
 * @param {Object} config - Client configuration
 * @returns {Object} Reactive stores and methods
 */
export function createAnalyticsStore(config) {
  const client = new OddSocketsClient(config);
  
  // Analytics stores
  const messageStats = writable({
    totalMessages: 0,
    messagesPerSecond: 0,
    averageMessageSize: 0
  });
  
  const connectionStats = writable({
    totalConnections: 0,
    reconnections: 0,
    uptime: 0,
    latency: 0
  });
  
  const errorStats = writable({
    totalErrors: 0,
    errorRate: 0,
    lastError: null
  });
  
  // Track statistics
  let messageCount = 0;
  let errorCount = 0;
  let reconnectCount = 0;
  let startTime = Date.now();
  
  client.on('connected', () => {
    startTime = Date.now();
  });
  
  client.on('reconnecting', () => {
    reconnectCount++;
    connectionStats.update(stats => ({
      ...stats,
      reconnections: reconnectCount
    }));
  });
  
  client.on('error', (error) => {
    errorCount++;
    errorStats.update(stats => ({
      ...stats,
      totalErrors: errorCount,
      lastError: error,
      errorRate: errorCount / ((Date.now() - startTime) / 1000)
    }));
  });
  
  // Update stats periodically
  const statsInterval = setInterval(() => {
    const uptime = Date.now() - startTime;
    connectionStats.update(stats => ({
      ...stats,
      uptime: uptime / 1000
    }));
  }, 1000);
  
  const cleanup = () => {
    clearInterval(statsInterval);
    client.disconnect();
  };
  
  try {
    onDestroy(cleanup);
  } catch (e) {
    // Not in component context
  }
  
  return {
    client,
    messageStats: { subscribe: messageStats.subscribe },
    connectionStats: { subscribe: connectionStats.subscribe },
    errorStats: { subscribe: errorStats.subscribe },
    cleanup
  };
}

// Export all store creators
export default {
  createOddSocketsStore,
  createChannelStore,
  createConnectionStore,
  createPresenceStore,
  createMultiChannelStore,
  createAnalyticsStore
};
