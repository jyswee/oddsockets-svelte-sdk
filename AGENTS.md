# Agent Integration Guide — Svelte
POST https://oddsockets.com/api/agent-signup then /verify.
```javascript
import { createOddSocketsClient } from '@oddsocketsai/svelte-sdk';
const client = createOddSocketsClient({ apiKey: 'ak_...' });
const channel = client.channel('agent-coordination');
channel.subscribe(msg => console.log(msg));
channel.publish({ task: 'summarize' });
```
Free: 100 MAU | 50 connections | 10K msg/day | 10 channels | 100MB/24h
