# OddSockets Svelte SDK

[![npm version](https://badge.fury.io/js/oddsockets-svelte-sdk.svg)](https://badge.fury.io/js/oddsockets-svelte-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Svelte SDK for OddSockets real-time messaging platform. Built specifically for Svelte and SvelteKit applications with reactive stores, components, and seamless integration.

## Features

- **🔄 Reactive Stores**: Automatic UI updates with Svelte's reactive system
- **📦 Svelte Components**: Pre-built components for common use cases
- **⚡ SvelteKit Ready**: Full SSR and hydration support
- **🎯 TypeScript Support**: Complete type definitions included
- **🔌 Auto-Reconnection**: Intelligent reconnection with exponential backoff
- **📊 Bulk Publishing**: High-performance bulk message publishing
- **👥 Presence Tracking**: Real-time user presence and status
- **🏗️ Cluster Abstraction**: Automatic manager → worker load balancing
- **🛡️ Error Handling**: Comprehensive error handling and recovery

## 📦 Installation

```bash
npm install oddsockets-svelte-sdk
```

## Quick Start

### Basic Usage

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  import { onMount } from 'svelte';
  
  const { messages, presence, publish, subscribe, unsubscribe } = createChannelStore('chat', {
    apiKey: 'ak_your_api_key_here',
    userId: 'user123'
  });
  
  let messageText = '';
  
  onMount(() => {
    subscribe();
    return unsubscribe; // Cleanup on destroy
  });
  
  async function sendMessage() {
    if (messageText.trim()) {
      await publish({
        type: 'chat',
        text: messageText,
        username: 'John Doe'
      });
      messageText = '';
    }
  }
</script>

<!-- Reactive UI updates automatically -->
<div class="chat-container">
  <div class="messages">
    {#each $messages as message}
      <div class="message">
        <strong>{message.data.username}:</strong>
        {message.data.text}
        <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
      </div>
    {/each}
  </div>
  
  <div class="presence">
    Online: {$presence.length} users
  </div>
  
  <div class="input-area">
    <input 
      bind:value={messageText} 
      placeholder="Type a message..."
      on:keydown={(e) => e.key === 'Enter' && sendMessage()}
    />
    <button on:click={sendMessage}>Send</button>
  </div>
</div>

<style>
  .chat-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .messages {
    height: 400px;
    overflow-y: auto;
    border: 1px solid #ccc;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .message {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
  }
  
  .presence {
    text-align: center;
    margin-bottom: 1rem;
    color: #666;
  }
  
  .input-area {
    display: flex;
    gap: 0.5rem;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  button {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

## 🏪 Reactive Stores

The Svelte SDK's main strength is its reactive stores that automatically update your UI.

### Channel Store

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  const { 
    messages, 
    presence, 
    messageCount, 
    presenceCount,
    latestMessage,
    publish, 
    subscribe 
  } = createChannelStore('my-channel', {
    apiKey: 'ak_your_api_key_here'
  });
</script>

<!-- All stores are reactive -->
<div>Total messages: {$messageCount}</div>
<div>Users online: {$presenceCount}</div>

{#if $latestMessage}
  <div>Latest: {$latestMessage.data.text}</div>
{/if}
```

### Connection Store

```svelte
<script>
  import { createConnectionStore } from 'oddsockets-svelte-sdk/stores';
  
  const { 
    connectionState, 
    isConnected, 
    isReconnecting,
    reconnectAttempts,
    connectionDurationFormatted 
  } = createConnectionStore({
    apiKey: 'ak_your_api_key_here'
  });
</script>

<div class="status-bar">
  <div class="status {$connectionState}">
    {$connectionState}
  </div>
  
  {#if $isConnected}
    <div>Connected for: {$connectionDurationFormatted}</div>
  {/if}
  
  {#if $isReconnecting}
    <div>Reconnecting... (attempt {$reconnectAttempts})</div>
  {/if}
</div>

<style>
  .status.connected { color: green; }
  .status.connecting { color: orange; }
  .status.reconnecting { color: orange; }
  .status.disconnected { color: red; }
  .status.failed { color: red; }
</style>
```

### Multi-Channel Store

```svelte
<script>
  import { createMultiChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  const { channels, allMessages, totalPresence } = createMultiChannelStore(
    ['chat', 'notifications', 'updates'],
    { apiKey: 'ak_your_api_key_here' }
  );
</script>

<div>Total users across all channels: {$totalPresence}</div>

{#each $allMessages as message}
  <div class="message" data-channel="{message.channel}">
    <span class="channel-tag">{message.channel}</span>
    {message.data.text}
  </div>
{/each}
```

## 🎨 Pre-built Components

### Message List Component

```svelte
<!-- MessageList.svelte -->
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  export let channelName;
  export let apiKey;
  export let maxMessages = 100;
  
  const { messages, subscribe, unsubscribe } = createChannelStore(channelName, { apiKey });
  
  import { onMount } from 'svelte';
  
  onMount(() => {
    subscribe();
    return unsubscribe;
  });
  
  $: displayMessages = $messages.slice(-maxMessages);
</script>

<div class="message-list">
  {#each displayMessages as message}
    <div class="message">
      <div class="message-header">
        <strong>{message.data.username || message.userId}</strong>
        <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
      </div>
      <div class="message-content">
        {message.data.text || JSON.stringify(message.data)}
      </div>
    </div>
  {/each}
</div>

<style>
  .message-list {
    height: 100%;
    overflow-y: auto;
  }
  
  .message {
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  
  .message-content {
    color: #333;
  }
</style>
```

### Connection Status Component

```svelte
<!-- ConnectionStatus.svelte -->
<script>
  import { createConnectionStore } from 'oddsockets-svelte-sdk/stores';
  
  export let apiKey;
  export let showDetails = false;
  
  const { 
    connectionState, 
    isConnected, 
    reconnectAttempts,
    lastError,
    connectionDurationFormatted 
  } = createConnectionStore({ apiKey });
</script>

<div class="connection-status">
  <div class="status-indicator {$connectionState}">
    <div class="dot"></div>
    <span>{$connectionState}</span>
  </div>
  
  {#if showDetails}
    <div class="details">
      {#if $isConnected}
        <div>Connected for: {$connectionDurationFormatted}</div>
      {/if}
      
      {#if $reconnectAttempts > 0}
        <div>Reconnect attempts: {$reconnectAttempts}</div>
      {/if}
      
      {#if $lastError}
        <div class="error">Error: {$lastError.message}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .connection-status {
    padding: 0.5rem;
    border-radius: 4px;
    background: #f8f9fa;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .connected .dot { background: #28a745; }
  .connecting .dot { background: #ffc107; animation: pulse 1s infinite; }
  .reconnecting .dot { background: #fd7e14; animation: pulse 1s infinite; }
  .disconnected .dot { background: #6c757d; }
  .failed .dot { background: #dc3545; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .details {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }
  
  .error {
    color: #dc3545;
  }
</style>
```

## Advanced Usage

### Bulk Publishing

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  const { publishBulk } = createChannelStore('notifications', {
    apiKey: 'ak_your_api_key_here'
  });
  
  async function sendBulkNotifications() {
    const messages = [
      { type: 'notification', title: 'Welcome!', body: 'Thanks for joining' },
      { type: 'notification', title: 'Update', body: 'New features available' },
      { type: 'notification', title: 'Reminder', body: 'Check your settings' }
    ];
    
    try {
      const results = await publishBulk(messages);
      console.log('Bulk publish results:', results);
    } catch (error) {
      console.error('Bulk publish failed:', error);
    }
  }
</script>
```

### Custom Message Types

```svelte
<script>
  import { createChannelStore, createChatMessage, createNotification } from 'oddsockets-svelte-sdk';
  
  const { publish } = createChannelStore('events', {
    apiKey: 'ak_your_api_key_here'
  });
  
  async function sendChatMessage() {
    const message = createChatMessage('Hello everyone!', 'john_doe');
    await publish(message);
  }
  
  async function sendNotification() {
    const notification = createNotification(
      'System Alert', 
      'Maintenance scheduled for tonight',
      'system',
      'high'
    );
    await publish(notification);
  }
</script>
```

### SvelteKit Integration

```svelte
<!-- src/routes/chat/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  import { onMount } from 'svelte';
  
  let channelStore;
  
  onMount(() => {
    if (browser) {
      channelStore = createChannelStore('chat', {
        apiKey: 'ak_your_api_key_here'
      });
      
      channelStore.subscribe();
      
      return () => {
        channelStore.unsubscribe();
      };
    }
  });
</script>

{#if channelStore}
  <div class="chat">
    {#each $channelStore.messages as message}
      <div class="message">{message.data.text}</div>
    {/each}
  </div>
{:else}
  <div>Loading chat...</div>
{/if}
```

## 🔌 API Reference

### Store Creators

#### `createChannelStore(channelName, config, options)`

Creates a reactive store for a specific channel.

**Parameters:**
- `channelName` (string): Channel name
- `config` (object): Client configuration
- `options` (object): Channel options

**Returns:**
- `messages`: Writable store of messages
- `presence`: Writable store of presence data
- `messageCount`: Derived store of message count
- `presenceCount`: Derived store of presence count
- `latestMessage`: Derived store of latest message
- `publish(message)`: Function to publish a message
- `subscribe()`: Function to subscribe to channel
- `unsubscribe()`: Function to unsubscribe from channel

#### `createConnectionStore(config)`

Creates a reactive store for connection status.

**Parameters:**
- `config` (object): Client configuration

**Returns:**
- `connectionState`: Connection state store
- `isConnected`: Boolean connection status
- `reconnectAttempts`: Number of reconnect attempts
- `lastError`: Last error that occurred
- `connectionDuration`: Connection duration in ms

### Configuration Options

```javascript
const config = {
  apiKey: 'ak_your_api_key_here',        // Required
  managerUrl: 'https://manager1.oddsockets.tyga.network', // Optional
  userId: 'user123',                      // Optional
  timeout: 10000,                         // Optional (ms)
  heartbeatInterval: 30000,               // Optional (ms)
  reconnectAttempts: 5,                   // Optional
  autoConnect: true                       // Optional
};
```

## Performance Tips

### Memory Management

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  const { messages, clearMessages } = createChannelStore('chat', {
    apiKey: 'ak_your_api_key_here'
  });
  
  // Clear messages periodically to prevent memory issues
  setInterval(() => {
    if ($messages.length > 1000) {
      clearMessages();
    }
  }, 60000);
</script>
```

### Efficient Rendering

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  
  const { messages } = createChannelStore('chat', {
    apiKey: 'ak_your_api_key_here'
  });
  
  // Only show recent messages for better performance
  $: recentMessages = $messages.slice(-50);
</script>

{#each recentMessages as message (message.id)}
  <div class="message">{message.data.text}</div>
{/each}
```

## 🛠️ Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Examples

Check out the `examples/` directory for complete working examples:

- **Basic Chat**: Simple chat application
- **Multi-Channel**: Managing multiple channels
- **SvelteKit Integration**: Full SvelteKit application
- **Component Library**: Reusable components
- **Advanced Features**: Bulk publishing, presence, etc.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Get a Free API Key

```bash
curl -X POST https://oddsockets.com/api/agent-signup \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "agentName": "my-agent", "platform": "svelte"}'
curl -X POST https://oddsockets.com/api/agent-signup/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "code": "123456", "agentName": "my-agent"}'
```

## Plans

| | Free | Starter | Pro |
|---|---|---|---|
| **Price** | $0/mo | $49.99/mo | $299/mo |
| **MAU** | 100 | 1,000 | 50,000 |
| **Concurrent connections** | 50 | 1,000 | Unlimited |
| **Messages/day** | 10,000 | 4,320,000 | Unlimited |
| **Channels** | 10 | Unlimited | Unlimited |
| **Storage** | 100MB (24h) | 50GB (6 months) | Unlimited |

## Support

- [Documentation](https://docs.oddsockets.com/sdks/svelte)
- [Issue Tracker](https://github.com/jyswee/oddsockets-svelte-sdk/issues)
- [Email Support](mailto:support@oddsockets.com)

## License

MIT License - Copyright (c) 2026 Joe Wee, Tyga.Cloud Ltd. See [LICENSE](LICENSE) for details.
