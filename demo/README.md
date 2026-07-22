# OddSockets Svelte SDK - Demo

A tiny, runnable program that proves a real real-time round-trip against OddSockets
using **two independent clients**: **connect -> subscribe -> publish -> receive**.

Because the subscriber (`alice`) and the publisher (`bob`) are separate connections,
a message that reaches the subscriber can only have travelled through the OddSockets
worker - so this doubles as an honest end-to-end regression test (no mocks, no local
echo). The SDK speaks genuine Socket.IO (Engine.IO v4) to the assigned worker - the
same core that powers the Svelte reactive stores.

## Proof it's real

`demo/PROOF.txt` is a captured transcript of this demo running in Docker against the
live platform. Reproduce it yourself in one command (see below) - here is a real run:

```
[connect] connecting both clients...
[alice] worker w002-oddsockets-1
[bob]   worker w002-oddsockets-1
[connect] alice = connected, bob = connected
[alice] subscribed to demo-544250 (presence on)
[bob] published, messageId = 51dcedf0-3656-4fbe-aae8-0afb254ea5de
[alice] received bob's message (nonce matched) - real round-trip.
[alice] presence: 1 user(s).
[alice] unsubscribed.

OK - cross-client round-trip verified
```

## 1. Get a free API key

Two-step email verification (no card required):

```bash
# Step 1 - request a code
curl -X POST https://oddsockets.com/api/agent-signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","agentName":"demo","platform":"svelte"}'

# Step 2 - verify and receive your apiKey
curl -X POST https://oddsockets.com/api/agent-signup/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","code":"123456","agentName":"demo"}'
```

The verify response contains your `apiKey` (starts with `ak_`).

## 2. Run it in Docker (recommended)

No local Node toolchain needed. Build from the repo root so the SDK source is in
context (the demo uses an npm path dependency - `"oddsockets-svelte": "file:.."` - to
build the SDK straight from the parent, without publishing anything):

```bash
docker build -f demo/Dockerfile -t oddsockets-svelte-demo .
docker run --rm -e ODDSOCKETS_API_KEY="ak_your_key_here" oddsockets-svelte-demo
```

Dependencies are installed at image-build time, so a broken SDK fails the build. A
successful run prints `OK - cross-client round-trip verified` and exits `0`.

## 2b. Run it locally with Node

Requires Node 18+. The path dependency resolves the SDK from the parent directory, so
the demo is clone-and-run:

```bash
cd demo
npm install
export ODDSOCKETS_API_KEY="ak_your_key_here"
node demo.mjs
```

The key is read from `ODDSOCKETS_API_KEY` and never hardcoded; if it is missing the
program prints the signup instructions above and exits non-zero.

## The code, step by step

Create two clients - a subscriber and a publisher - each on its own connection:

```js
import { createOddSocketsClient, createChannel } from 'oddsockets-svelte';

const alice = createOddSocketsClient({ apiKey, userId: 'alice', autoConnect: false });
const bob   = createOddSocketsClient({ apiKey, userId: 'bob',   autoConnect: false });

await alice.connect();
await bob.connect();
```

Subscribe on the subscriber (presence enabled):

```js
const inbox = createChannel(alice, 'my-channel');

await inbox.subscribe((data) => {
  console.log(data.message ?? data);
}, { enablePresence: true });
```

Publish from the *other* client - this is what makes the test honest:

```js
const outbox = createChannel(bob, 'my-channel');
const ack = await outbox.publish({ text: 'hello from bob', nonce });
console.log(`messageId = ${ack.messageId}`);
```

Inspect presence, then tear down cleanly:

```js
const presence = await inbox.getPresence();
console.log(`count: ${presence.occupancy}`);
await inbox.unsubscribe();

alice.disconnect();
bob.disconnect();
```

## Using it in a Svelte app

The same client powers the reactive stores. In a component you would typically write:

```svelte
<script>
  import { createChannelStore } from 'oddsockets-svelte/stores';

  const { messages, presence, publish } = createChannelStore('my-channel', { apiKey });
</script>

{#each $messages as m}
  <div>{m.message.text}</div>
{/each}
```

## What it demonstrates

- Manager discovery + automatic worker assignment (fully transparent)
- `createChannel(client, name)` -> `channel.subscribe(cb)` -> `channel.publish(msg)`
- **Cross-client delivery**: a message published by `bob` is delivered to `alice`'s
  subscription in real time - provably through the worker, not a local echo
- Presence tracking, unsubscribe, and graceful disconnect
- A 15-second timeout so a stalled round-trip is reported as a failure (non-zero exit)

## Files

- `Dockerfile` - builds the SDK from source and runs the two-client demo on `node:20-slim`.
- `PROOF.txt` - captured transcript of a real containerised run against the platform.
- `demo.mjs` - the two-client round-trip program.
- `package.json` - resolves the SDK via an npm path dependency (`file:..`).
- `Demo.svelte` - a browser component example using the reactive stores.
