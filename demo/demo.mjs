// OddSockets Svelte SDK - two-client round-trip demo (Node.js)
//
// Proves a real real-time round-trip using TWO independent clients:
//   connect -> subscribe (alice) -> publish (bob) -> receive (alice)
//
// Because the subscriber (alice) and the publisher (bob) are separate
// connections, a message that reaches the subscriber can only have travelled
// through the OddSockets worker - so this doubles as an honest end-to-end
// regression test (no mocks, no local echo). The SDK speaks genuine Socket.IO
// (socket.io-client) to the assigned worker, the same core that powers the
// Svelte reactive stores.
//
// Reads the API key from ODDSOCKETS_API_KEY.
// Run:  ODDSOCKETS_API_KEY=ak_... node demo.mjs

import { createOddSocketsClient, createChannel } from 'oddsockets-svelte';

const apiKey = process.env.ODDSOCKETS_API_KEY;
if (!apiKey) {
  console.error('Missing ODDSOCKETS_API_KEY. Get a free key (see README), then:');
  console.error('  export ODDSOCKETS_API_KEY="ak_..."');
  process.exit(1);
}

const channelName = `demo-${Math.floor(Math.random() * 1_000_000)}`;
const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let received = false;
let settled = false;

// Two independent connections - this is what makes the test honest.
const alice = createOddSocketsClient({ apiKey, userId: 'alice', autoConnect: false });
const bob = createOddSocketsClient({ apiKey, userId: 'bob', autoConnect: false });

alice.on('worker_assigned', (d) => console.log(`[alice] worker ${d.workerId}`));
bob.on('worker_assigned', (d) => console.log(`[bob]   worker ${d.workerId}`));

function finish(code, message) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  if (message) console.log(message);
  try { alice.disconnect(); } catch (_) {}
  try { bob.disconnect(); } catch (_) {}
  process.exit(code);
}

const timer = setTimeout(() => {
  finish(2, '\nTIMEOUT - no cross-client delivery within 15s');
}, 15000);

async function main() {
  console.log('[connect] connecting both clients...');
  await alice.connect();
  await bob.connect();
  console.log('[connect] alice = connected, bob = connected');

  // Subscriber (alice) - presence enabled.
  const inbox = createChannel(alice, channelName);
  await inbox.subscribe((data) => {
    const payload = data && data.message ? data.message : data;
    if (payload && payload.nonce === nonce) {
      received = true;
      console.log("[alice] received bob's message (nonce matched) - real round-trip.");
    }
  }, { enablePresence: true });
  console.log(`[alice] subscribed to ${channelName} (presence on)`);

  // Publisher (bob) - a DIFFERENT connection.
  const outbox = createChannel(bob, channelName);
  const ack = await outbox.publish({ text: 'hello from bob', nonce });
  console.log(`[bob] published, messageId = ${ack.messageId}`);

  // Wait for cross-client delivery.
  const deadline = Date.now() + 12000;
  while (!received && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (received) {
    const presence = await inbox.getPresence();
    const count = presence.occupancy ?? presence.count;
    if (count !== undefined) console.log(`[alice] presence: ${count} user(s).`);
    await inbox.unsubscribe();
    console.log('[alice] unsubscribed.');
    finish(0, '\nOK - cross-client round-trip verified');
  } else {
    finish(2, '\nTIMEOUT - no cross-client delivery within 15s');
  }
}

main().catch((err) => finish(1, `\nFAIL - ${err && err.message ? err.message : err}`));
