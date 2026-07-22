/**
 * OddSockets Svelte SDK
 * 
 * Official Svelte SDK for OddSockets real-time messaging platform.
 * Built on top of the JavaScript SDK with Svelte-specific reactive stores,
 * components, and utilities for building real-time applications.
 * 
 * This SDK uses the JavaScript SDK as the single source of truth for all
 * core WebSocket functionality, manager discovery, and cluster communication.
 * 
 * @example Basic usage with JavaScript SDK core
 * ```svelte
 * <script>
 *   import { createOddSocketsClient } from 'oddsockets-svelte-sdk';
 *   import { onMount } from 'svelte';
 *   
 *   const client = createOddSocketsClient({
 *     apiKey: 'ak_your_api_key_here'
 *   });
 *   
 *   onMount(() => {
 *     client.connect();
 *   });
 * </script>
 * ```
 * 
 * @example With reactive stores
 * ```svelte
 * <script>
 *   import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
 *   
 *   const { messages, presence, publish } = createChannelStore('my-channel', {
 *     apiKey: 'ak_your_api_key_here'
 *   });
 * </script>
 * 
 * {#each $messages as message}
 *   <div>{message.data.text}</div>
 * {/each}
 * ```
 */

// The Svelte SDK ships its own genuine Socket.IO client (socket.io-client),
// so it is self-contained - no external SDK dependency at runtime.
import { OddSocketsClient } from './client.js';
import { OddSocketsChannel } from './channel.js';

// Re-export the core client and channel classes.
export const OddSockets = OddSocketsClient;
export const Channel = OddSocketsChannel;

// Re-export Svelte-specific stores and components
export { 
  createOddSocketsStore, 
  createChannelStore, 
  createPresenceStore,
  createConnectionStore,
  createMultiChannelStore
} from './stores/index.js';

// Re-export Svelte components (when available)
export {
  OddSocketsProvider,
  ChannelSubscriber,
  MessageList,
  PresenceIndicator,
  ConnectionStatus
} from './components/index.js';

// Re-export utilities
export { Utils } from './utils.js';
export { MessageTypes } from './message-types.js';
export { OddSocketsError } from './errors.js';

/**
 * Create a new OddSockets client instance using the JavaScript SDK core
 * 
 * @param {Object} config - Client configuration
 * @param {string} config.apiKey - Your OddSockets API key
 * @param {string} [config.userId] - User ID for presence tracking
 * @param {boolean} [config.autoConnect=true] - Auto-connect on creation
 * @param {number} [config.heartbeatInterval=30000] - Heartbeat interval in ms
 * @param {number} [config.reconnectAttempts=5] - Max reconnection attempts
 * @param {number} [config.timeout=10000] - Connection timeout in ms
 * @returns {OddSockets} Client instance from JavaScript SDK
 * 
 * @example
 * ```js
 * const client = createOddSocketsClient({
 *   apiKey: 'ak_your_api_key_here',
 *   userId: 'user123',
 *   autoConnect: true
 * });
 * ```
 */
export function createOddSocketsClient(config) {
  return new OddSocketsClient(config);
}

/**
 * Create a channel instance using the JavaScript SDK core
 * 
 * @param {OddSockets} client - Client instance from JavaScript SDK
 * @param {string} channelName - Channel name
 * @returns {Channel} Channel instance from JavaScript SDK
 * 
 * @example
 * ```js
 * const client = createOddSocketsClient({ apiKey: 'ak_key' });
 * const channel = createChannel(client, 'my-channel');
 * ```
 */
export function createChannel(client, channelName) {
  return client.channel(channelName);
}

/**
 * Create multiple channels at once using the JavaScript SDK core
 * 
 * @param {OddSockets} client - Client instance from JavaScript SDK
 * @param {string[]} channelNames - Array of channel names
 * @returns {Object} Object with channel names as keys and channel instances as values
 * 
 * @example
 * ```js
 * const client = createOddSocketsClient({ apiKey: 'ak_key' });
 * const channels = createChannels(client, ['chat', 'notifications', 'updates']);
 * // channels.chat, channels.notifications, channels.updates
 * ```
 */
export function createChannels(client, channelNames) {
  const channels = {};
  for (const name of channelNames) {
    channels[name] = client.channel(name);
  }
  return channels;
}

/**
 * Bulk publish messages to multiple channels using the JavaScript SDK core
 * 
 * @param {OddSockets} client - Client instance from JavaScript SDK
 * @param {Array} messages - Array of bulk message objects
 * @returns {Promise<Array>} Array of publish results
 * 
 * @example
 * ```js
 * const results = await bulkPublish(client, [
 *   { channel: 'chat', message: { text: 'Hello' } },
 *   { channel: 'notifications', message: { title: 'Alert' } }
 * ]);
 * ```
 */
export async function bulkPublish(client, messages) {
  return await client.publishBulk(messages);
}

/**
 * Create a message with timestamp using JavaScript SDK utilities
 * 
 * @param {Object} data - Message data
 * @param {string} [userId] - User ID
 * @param {Object} [metadata] - Additional metadata
 * @returns {Object} Message object with timestamp
 * 
 * @example
 * ```js
 * const message = createMessage({ text: 'Hello' }, 'user123');
 * ```
 */
export function createMessage(data, userId = null, metadata = null) {
  return {
    data,
    userId,
    metadata,
    timestamp: new Date().toISOString(),
    id: generateMessageId()
  };
}

/**
 * Create a chat message using message types
 * 
 * @param {string} text - Message text
 * @param {string} username - Username
 * @param {string} [messageType='chat'] - Message type
 * @returns {Object} Chat message object
 * 
 * @example
 * ```js
 * const chatMessage = createChatMessage('Hello world!', 'john_doe');
 * ```
 */
export function createChatMessage(text, username, messageType = 'chat') {
  return {
    type: messageType,
    data: {
      text,
      username
    },
    timestamp: new Date().toISOString(),
    id: generateMessageId()
  };
}

/**
 * Create a notification message
 * 
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} [category='general'] - Notification category
 * @param {string} [priority='normal'] - Notification priority
 * @param {Object} [data] - Additional data
 * @returns {Object} Notification message object
 * 
 * @example
 * ```js
 * const notification = createNotification('New Message', 'You have a new message', 'chat', 'high');
 * ```
 */
export function createNotification(title, body, category = 'general', priority = 'normal', data = null) {
  return {
    type: 'notification',
    data: {
      title,
      body,
      category,
      priority,
      ...data
    },
    timestamp: new Date().toISOString(),
    id: generateMessageId()
  };
}

/**
 * Generate a unique message ID
 * @private
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Connection states enum (from JavaScript SDK)
 */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
};

/**
 * Event types enum (from JavaScript SDK)
 */
export const EventType = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTED: 'reconnected',
  ERROR: 'error',
  MESSAGE: 'message',
  PRESENCE: 'presence',
  WORKER_ASSIGNED: 'worker_assigned',
  MAX_RECONNECT_ATTEMPTS_REACHED: 'max_reconnect_attempts_reached'
};

/**
 * Error codes enum (from JavaScript SDK)
 */
export const ErrorCode = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  CHANNEL_ACCESS_DENIED: 'CHANNEL_ACCESS_DENIED',
  MESSAGE_DELIVERY_FAILED: 'MESSAGE_DELIVERY_FAILED',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  WORKER_ASSIGNMENT_FAILED: 'WORKER_ASSIGNMENT_FAILED',
  MAX_RECONNECT_ATTEMPTS_REACHED: 'MAX_RECONNECT_ATTEMPTS_REACHED',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  INVALID_CHANNEL_NAME: 'INVALID_CHANNEL_NAME',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR'
};

/**
 * SDK version information
 */
export const Version = {
  version: '0.1.0-beta.1',
  sdkName: 'OddSockets-Svelte-SDK',
  userAgent: 'OddSockets-Svelte-SDK/0.1.0-beta.1'
};

// Default export for convenience (maintains compatibility)
export default {
  // Core client functionality
  createOddSocketsClient,
  createChannel,
  createChannels,
  bulkPublish,

  // Message creation utilities
  createMessage,
  createChatMessage,
  createNotification,

  // Core classes
  OddSockets,
  Channel,

  // Svelte-specific exports
  createChannelStore: () => { throw new Error('Import createChannelStore from "oddsockets-svelte-sdk/stores"'); },
  createConnectionStore: () => { throw new Error('Import createConnectionStore from "oddsockets-svelte-sdk/stores"'); },
  
  // Constants
  ConnectionState,
  EventType,
  ErrorCode,
  Version
};
