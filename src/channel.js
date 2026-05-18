import EventEmitter from 'eventemitter3';
import { OddSocketsError } from './errors.js';

export class OddSocketsChannel extends EventEmitter {
  constructor(name, client) {
    super();
    this.name = name;
    this.client = client;
    this.isSubscribed = false;
  }
  
  async subscribe() {
    if (this.isSubscribed) return;
    
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
    
    this.client.websocket.send(JSON.stringify({
      type: 'subscribe',
      channel: this.name
    }));
    
    this.isSubscribed = true;
  }
  
  async unsubscribe() {
    if (!this.isSubscribed) return;
    
    if (this.client.websocket) {
      this.client.websocket.send(JSON.stringify({
        type: 'unsubscribe',
        channel: this.name
      }));
    }
    
    this.isSubscribed = false;
  }
  
  async publish(message) {
    const response = await fetch(`${this.client.workerUrl}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.client.config.apiKey}`
      },
      body: JSON.stringify({
        channel: this.name,
        message
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new OddSocketsError(error.message || 'Publish failed', 'MESSAGE_DELIVERY_FAILED');
    }
    
    return await response.json();
  }
  
  async publishBulk(messages) {
    const bulkMessages = messages.map(msg => ({
      channel: this.name,
      message: msg
    }));
    
    return await this.client.publishBulk(bulkMessages);
  }
}
