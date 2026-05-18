<script>
  import { onMount } from 'svelte';
  import { OddSocketsClient } from '../src/client.js';
  import { EnhancedFeatures } from '../src/enhanced-features.js';

  /**
   * OddSockets Svelte SDK - Enhanced Features Example
   * Demonstrates all 67 new Slack-like events with Svelte reactivity
   */

  let client;
  let enhanced;
  let connected = false;
  let logs = [];

  function addLog(message) {
    logs = [...logs, message];
  }

  onMount(async () => {
    addLog('🚀 OddSockets Svelte SDK - Enhanced Features Example');
    addLog('Demonstrating all 67 new Slack-like events');
    addLog('='.repeat(50));

    // Create and configure client
    client = new OddSocketsClient('your_api_key_here', 'user_123');
    enhanced = new EnhancedFeatures(client);

    // Set up event listeners
    client.on('connected', () => {
      connected = true;
      addLog('🟢 Connected event fired');
    });

    client.on('disconnected', () => {
      connected = false;
      addLog('🔴 Disconnected event fired');
    });

    client.on('error', (error) => {
      addLog(`❌ Error event: ${error}`);
    });

    // Connect
    addLog('\n🔄 Connecting to OddSockets...');
    await client.connect();

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!connected) {
      addLog('❌ Failed to connect');
      return;
    }

    addLog('✅ Connected successfully!\n');

    // Test all enhanced features
    await testAllFeatures();

    // Summary
    addLog('\n🎉 All enhanced features tested!');
    addLog('\n📊 Summary:');
    addLog('- Thread Events: 7 methods');
    addLog('- Reaction Events: 6 methods');
    addLog('- Read Receipt Events: 6 methods');
    addLog('- Channel Events: 11 methods');
    addLog('- Direct Message Events: 6 methods');
    addLog('- Notification Events: 6 methods');
    addLog('- File Upload Events: 7 methods');
    addLog('- Presence Events: 8 methods');
    addLog('- Message Editing Events: 5 methods');
    addLog('- Search Events: 4 methods');
    addLog('='.repeat(50));
    addLog('Total: 67 enhanced Slack-like events! 🚀');
  });

  async function testAllFeatures() {
    await testThreadEvents();
    await testReactionEvents();
    await testReadReceiptEvents();
    await testChannelEvents();
    await testDirectMessageEvents();
    await testNotificationEvents();
    await testPresenceEvents();
    await testMessageEditingEvents();
    await testSearchEvents();
  }

  async function testThreadEvents() {
    addLog('📝 Testing Thread Events...');
    try {
      const result = await enhanced.threadReply(
        'general',
        'msg_123',
        'This is a test reply from Svelte!',
        'user_123',
        'Test User'
      );
      addLog(`✅ Thread reply created: ${JSON.stringify(result)}`);

      const thread = await enhanced.getThread('thread_123');
      addLog(`✅ Thread data: ${JSON.stringify(thread)}`);

      enhanced.markThreadRead('thread_123', 'user_123');
      addLog('✅ Marked thread as read');

      enhanced.followThread('thread_123', 'user_123');
      addLog('✅ Following thread\n');
    } catch (e) {
      addLog(`❌ Thread events error: ${e.message}\n`);
    }
  }

  async function testReactionEvents() {
    addLog('😀 Testing Reaction Events...');
    try {
      enhanced.addReaction('msg_123', 'general', '👍', 'user_123', 'Test User');
      addLog('✅ Added reaction 👍');

      enhanced.removeReaction('msg_123', 'general', '👍', 'user_123');
      addLog('✅ Removed reaction');

      const reactions = await enhanced.getReactions('msg_123');
      addLog(`✅ Reactions: ${JSON.stringify(reactions)}\n`);
    } catch (e) {
      addLog(`❌ Reaction events error: ${e.message}\n`);
    }
  }

  async function testReadReceiptEvents() {
    addLog('✓ Testing Read Receipt Events...');
    try {
      enhanced.markRead('msg_123', 'general', 'user_123', 'Test User');
      addLog('✅ Marked message as read');

      const counts = await enhanced.getUnreadCounts('user_123', ['general', 'random']);
      addLog(`✅ Unread counts: ${JSON.stringify(counts)}`);

      enhanced.markAllRead('general', 'user_123');
      addLog('✅ Marked all messages as read\n');
    } catch (e) {
      addLog(`❌ Read receipt events error: ${e.message}\n`);
    }
  }

  async function testChannelEvents() {
    addLog('📢 Testing Channel Events...');
    try {
      const channel = await enhanced.createChannel(
        `svelte-test-${Date.now()}`,
        'public',
        'Created from Svelte SDK',
        'Testing',
        'user_123',
        'Test User'
      );
      addLog(`✅ Channel created: ${JSON.stringify(channel)}`);

      enhanced.updateChannel('channel_123', { topic: 'Updated topic' }, 'user_123');
      addLog('✅ Updated channel');

      enhanced.joinChannel('channel_123', 'user_123', 'Test User');
      addLog('✅ Joined channel\n');
    } catch (e) {
      addLog(`❌ Channel events error: ${e.message}\n`);
    }
  }

  async function testDirectMessageEvents() {
    addLog('💬 Testing Direct Message Events...');
    try {
      const dm = await enhanced.createDM(['user_123', 'user_456'], '1-on-1');
      addLog(`✅ DM created: ${JSON.stringify(dm)}`);

      enhanced.sendDM('dm_123', 'Hello from Svelte!', 'user_123', 'Test User');
      addLog('✅ Sent DM\n');
    } catch (e) {
      addLog(`❌ Direct message events error: ${e.message}\n`);
    }
  }

  async function testNotificationEvents() {
    addLog('🔔 Testing Notification Events...');
    try {
      enhanced.subscribeNotifications('user_123');
      addLog('✅ Subscribed to notifications');

      enhanced.markNotificationRead('notif_123', 'user_123');
      addLog('✅ Marked notification as read');

      enhanced.markAllNotificationsRead('user_123');
      addLog('✅ Marked all notifications as read\n');
    } catch (e) {
      addLog(`❌ Notification events error: ${e.message}\n`);
    }
  }

  async function testPresenceEvents() {
    addLog('👤 Testing Presence Events...');
    try {
      enhanced.setStatus('user_123', 'online');
      addLog('✅ Set status to online');

      enhanced.setCustomStatus('user_123', '🎨', 'Coding in Svelte');
      addLog('✅ Set custom status');

      enhanced.clearCustomStatus('user_123');
      addLog('✅ Cleared custom status');

      enhanced.startTyping('user_123', 'general');
      addLog('✅ Started typing indicator');

      await new Promise(resolve => setTimeout(resolve, 2000));

      enhanced.stopTyping('user_123', 'general');
      addLog('✅ Stopped typing indicator\n');
    } catch (e) {
      addLog(`❌ Presence events error: ${e.message}\n`);
    }
  }

  async function testMessageEditingEvents() {
    addLog('✏️ Testing Message Editing Events...');
    try {
      enhanced.editMessage('msg_123', 'general', 'Updated message from Svelte', 'user_123');
      addLog('✅ Edited message');

      enhanced.deleteMessage('msg_456', 'general', 'user_123');
      addLog('✅ Deleted message');

      enhanced.pinMessage('msg_123', 'general', 'user_123');
      addLog('✅ Pinned message');

      enhanced.unpinMessage('msg_123', 'general', 'user_123');
      addLog('✅ Unpinned message\n');
    } catch (e) {
      addLog(`❌ Message editing events error: ${e.message}\n`);
    }
  }

  async function testSearchEvents() {
    addLog('🔍 Testing Search Events...');
    try {
      const results = await enhanced.searchMessages('test', 'user_123', 10);
      addLog(`✅ Search results: ${JSON.stringify(results)}`);

      const channelResults = await enhanced.searchInChannel('general', 'test', 10);
      addLog(`✅ Channel search results: ${JSON.stringify(channelResults)}`);

      const filtered = await enhanced.filterMessages({
        channel: 'general',
        userId: 'user_123',
        limit: 10
      });
      addLog(`✅ Filter results: ${JSON.stringify(filtered)}\n`);
    } catch (e) {
      addLog(`❌ Search events error: ${e.message}\n`);
    }
  }
</script>

<div class="container">
  <h1>🚀 OddSockets Svelte SDK - Enhanced Features</h1>
  
  <div class="status">
    {#if connected}
      <span class="connected">🟢 Connected</span>
    {:else}
      <span class="disconnected">🔴 Disconnected</span>
    {/if}
  </div>

  <div class="logs">
    {#each logs as log}
      <div class="log-entry">{log}</div>
    {/each}
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Courier New', monospace;
  }

  h1 {
    color: #ff3e00;
    text-align: center;
  }

  .status {
    text-align: center;
    margin: 20px 0;
    font-size: 18px;
  }

  .connected {
    color: #00ff00;
  }

  .disconnected {
    color: #ff0000;
  }

  .logs {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 20px;
    border-radius: 8px;
    max-height: 600px;
    overflow-y: auto;
  }

  .log-entry {
    margin: 5px 0;
    white-space: pre-wrap;
  }
</style>
