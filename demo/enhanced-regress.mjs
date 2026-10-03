// OddSockets Svelte SDK - enhanced-events two-client regression (Node.js)
//
// Proves the RECEIVE path for enhanced (Slack-like) events: an action fired by
// one client (bob) is broadcast by the worker and surfaces on the OTHER client's
// public event listener (alice). Because publisher and subscriber are separate
// connections, an event that reaches alice can only have travelled through the
// OddSockets worker - an honest end-to-end test, no local echo.
//
//   bob.enhanced.startTyping(...)  -> alice.on('user_typing')
//   bob.enhanced.addReaction(...)  -> alice.on('reaction_added')
//
// Run:  ODDSOCKETS_API_KEY=ak_... node enhanced-regress.mjs

import { createOddSocketsClient, createChannel } from '../src/index.js';

const apiKey = process.env.ODDSOCKETS_API_KEY;
if (!apiKey) {
  console.error('Missing ODDSOCKETS_API_KEY');
  process.exit(1);
}

const channelName = `enh-${Math.floor(Math.random() * 1_000_000)}`;

let gotTyping = false;
let gotReaction = false;
let settled = false;

const alice = createOddSocketsClient({ apiKey, userId: 'alice', autoConnect: false });
const bob = createOddSocketsClient({ apiKey, userId: 'bob', autoConnect: false });

// Enhanced broadcasts must surface on alice's PUBLIC event surface.
alice.on('user_typing', (d) => {
  if (d && d.userId === 'bob') {
    gotTyping = true;
    console.log(`[alice] received 'user_typing' from bob (channel ${d.channel}) - broadcast round-trip.`);
  }
});
alice.on('reaction_added', (d) => {
  if (d && d.emoji) {
    gotReaction = true;
    console.log(`[alice] received 'reaction_added' (${d.emoji}) from ${d.userId} - broadcast round-trip.`);
  }
});

function finish(code, message) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  if (message) console.log(message);
  try { alice.disconnect(); } catch (_) {}
  try { bob.disconnect(); } catch (_) {}
  process.exit(code);
}

const timer = setTimeout(() => finish(2, '\nTIMEOUT - enhanced broadcast not received within 20s'), 20000);

async function main() {
  console.log('[connect] connecting both clients...');
  await alice.connect();
  await bob.connect();
  console.log('[connect] alice = connected, bob = connected');

  // Both clients join the channel so the worker broadcasts to the room.
  const aliceCh = createChannel(alice, channelName);
  const bobCh = createChannel(bob, channelName);
  await aliceCh.subscribe(() => {}, { enablePresence: true });
  await bobCh.subscribe(() => {}, { enablePresence: true });
  console.log(`[both] subscribed to ${channelName}`);

  // Give the room membership a beat to settle.
  await new Promise((r) => setTimeout(r, 500));

  // 1) Typing indicator (fire-and-forget over the socket).
  console.log('[bob] enhanced.startTyping(bob) ...');
  bob.enhanced.startTyping('bob', channelName);

  // 2) Reaction on a real published message.
  const ack = await bobCh.publish({ text: 'react to me' });
  const messageId = ack.messageId;
  console.log(`[bob] published messageId=${messageId}, enhanced.addReaction :thumbsup: ...`);
  bob.enhanced.addReaction(messageId, channelName, ':thumbsup:', 'bob', 'Bob');

  const deadline = Date.now() + 18000;
  while ((!gotTyping || !gotReaction) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (gotTyping && gotReaction) {
    finish(0, '\nOK - enhanced broadcast receive-path verified (user_typing + reaction_added)');
  } else {
    finish(2, `\nPARTIAL/TIMEOUT - typing=${gotTyping} reaction=${gotReaction}`);
  }
}

main().catch((err) => finish(1, `\nFAIL - ${err && err.message ? err.message : err}`));
