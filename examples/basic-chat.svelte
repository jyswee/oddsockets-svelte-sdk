<!-- Basic Chat Example for OddSockets Svelte SDK -->
<script>
  import { createChannelStore } from 'oddsockets-svelte-sdk/stores';
  import { onMount } from 'svelte';
  
  // Create reactive channel store
  const { messages, presence, publish, subscribe, unsubscribe, isConnected } = createChannelStore('chat', {
    apiKey: 'ak_your_api_key_here',
    userId: 'user123'
  });
  
  let messageText = '';
  let username = 'Anonymous';
  
  // Subscribe to channel on mount
  onMount(() => {
    subscribe();
    return unsubscribe; // Cleanup on destroy
  });
  
  async function sendMessage() {
    if (messageText.trim() && $isConnected) {
      await publish({
        type: 'chat',
        text: messageText,
        username: username
      });
      messageText = '';
    }
  }
  
  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chat-container">
  <div class="header">
    <h1>OddSockets Svelte Chat</h1>
    <div class="status" class:connected={$isConnected}>
      {$isConnected ? 'Connected' : 'Disconnected'}
    </div>
  </div>
  
  <div class="presence">
    Online: {$presence.length} users
  </div>
  
  <div class="messages">
    {#each $messages as message}
      <div class="message">
        <div class="message-header">
          <strong>{message.data.username}</strong>
          <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
        </div>
        <div class="message-content">
          {message.data.text}
        </div>
      </div>
    {/each}
  </div>
  
  <div class="input-area">
    <input 
      bind:value={username} 
      placeholder="Your name"
      class="username-input"
    />
    <input 
      bind:value={messageText} 
      placeholder="Type a message..."
      class="message-input"
      on:keydown={handleKeydown}
      disabled={!$isConnected}
    />
    <button 
      on:click={sendMessage} 
      disabled={!$isConnected || !messageText.trim()}
    >
      Send
    </button>
  </div>
</div>

<style>
  .chat-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #eee;
  }
  
  .header h1 {
    margin: 0;
    color: #333;
  }
  
  .status {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 500;
    background: #f5f5f5;
    color: #666;
  }
  
  .status.connected {
    background: #d4edda;
    color: #155724;
  }
  
  .presence {
    text-align: center;
    margin-bottom: 1rem;
    color: #666;
    font-size: 0.9rem;
  }
  
  .messages {
    height: 400px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    background: #fafafa;
  }
  
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .message-header strong {
    color: #007bff;
  }
  
  .message-header small {
    color: #666;
  }
  
  .message-content {
    color: #333;
    line-height: 1.4;
  }
  
  .input-area {
    display: flex;
    gap: 0.5rem;
  }
  
  .username-input {
    width: 150px;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .message-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .message-input:disabled {
    background: #f5f5f5;
    color: #999;
  }
  
  button {
    padding: 0.75rem 1.5rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  button:hover:not(:disabled) {
    background: #0056b3;
  }
  
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
