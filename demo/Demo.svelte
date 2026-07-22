<!--
  OddSockets Svelte SDK - in-UI round-trip demo.

  Uses the reactive channel store to subscribe to a unique channel,
  publish a {text, nonce} message, and verify our own message echoes
  back. Drop this component into a Svelte / SvelteKit app.

  In the browser the API key comes from your app config / env
  (for example import.meta.env.VITE_ODDSOCKETS_API_KEY). Never hardcode
  a production key into client-side source.
-->
<script>
  import { createChannelStore } from 'oddsockets-svelte/stores';
  import { onMount } from 'svelte';

  // Supply your key from your build env, e.g. Vite:
  //   import.meta.env.VITE_ODDSOCKETS_API_KEY
  export let apiKey = (typeof import.meta !== 'undefined' && import.meta.env)
    ? import.meta.env.VITE_ODDSOCKETS_API_KEY
    : '';

  // Unique channel per session + a nonce to recognise our own message.
  const channelName = `demo-${Math.random().toString(36).slice(2, 10)}`;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Manager URL is baked into the SDK: https://connect.oddsockets.tyga.network
  const { messages, publish, subscribe, unsubscribe, isConnected } =
    createChannelStore(channelName, { apiKey });

  let status = 'idle';

  onMount(() => {
    subscribe();
    return unsubscribe;
  });

  // When our own message echoes back with the matching nonce, mark verified.
  $: {
    for (const m of $messages) {
      const payload = m && m.message ? m.message : m && m.data ? m.data : m;
      if (payload && payload.nonce === nonce) {
        status = 'ok';
      }
    }
  }

  async function sendRoundTrip() {
    status = 'publishing';
    await publish({ text: 'hello from the svelte sdk demo', nonce });
  }
</script>

<div class="demo">
  <h2>OddSockets round-trip demo</h2>

  <p>Channel: <code>{channelName}</code></p>
  <p>Connection: {$isConnected ? 'connected' : 'connecting...'}</p>

  <button on:click={sendRoundTrip} disabled={!$isConnected || status === 'publishing'}>
    Publish and verify
  </button>

  {#if status === 'ok'}
    <p class="ok">OK - round-trip verified</p>
  {:else if status === 'publishing'}
    <p>Waiting for our message to echo back...</p>
  {/if}
</div>

<style>
  .demo {
    max-width: 480px;
    margin: 2rem auto;
    padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
  }

  button {
    padding: 0.6rem 1.2rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .ok {
    color: #155724;
    font-weight: 600;
  }
</style>
