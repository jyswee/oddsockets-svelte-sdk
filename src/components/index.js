/**
 * OddSockets Svelte SDK - Components
 * 
 * Pre-built Svelte components for common OddSockets use cases.
 * These components use the JavaScript SDK as the core dependency
 * and provide ready-to-use UI elements for real-time applications.
 */

// Note: These are placeholder exports for component structure
// In a full implementation, these would be actual Svelte components

/**
 * Provider component for OddSockets context
 * Wraps the application and provides OddSockets client to child components
 */
export const OddSocketsProvider = null; // Would be a .svelte component

/**
 * Channel subscriber component
 * Automatically subscribes to a channel and provides reactive data
 */
export const ChannelSubscriber = null; // Would be a .svelte component

/**
 * Message list component
 * Displays a list of messages with automatic scrolling and formatting
 */
export const MessageList = null; // Would be a .svelte component

/**
 * Presence indicator component
 * Shows online users and presence information
 */
export const PresenceIndicator = null; // Would be a .svelte component

/**
 * Connection status component
 * Displays current connection state with visual indicators
 */
export const ConnectionStatus = null; // Would be a .svelte component

// Export all components
export default {
  OddSocketsProvider,
  ChannelSubscriber,
  MessageList,
  PresenceIndicator,
  ConnectionStatus
};
