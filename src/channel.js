/**
 * OddSockets Svelte Channel
 *
 * A channel carries pub/sub for one topic. Requests travel over the client's
 * genuine Socket.IO connection as events (subscribe / publish / get_presence /
 * get_history) and the worker replies with the matching response event.
 */

import EventEmitter from 'eventemitter3';
import { OddSocketsError } from './errors.js';

// 32KB - matches the worker's message size limit (PubNub/Socket.IO standard).
const MAX_MESSAGE_SIZE = 32768;

function validateMessageSize(message) {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  const size = new TextEncoder().encode(messageStr).length;
  if (size > MAX_MESSAGE_SIZE) {
    throw new OddSocketsError(
      `Message size (${Math.round(size / 1024)}KB) exceeds the maximum of ${MAX_MESSAGE_SIZE / 1024}KB.`,
      'MESSAGE_DELIVERY_FAILED'
    );
  }
  return size;
}

export class OddSocketsChannel extends EventEmitter {
  constructor(name, client) {
    super();
    this.name = name;
    this.client = client;
    this.subscribed = false;
    this.subscribing = false;
    this.options = {};
    this.presence = new Map();
  }

  async subscribe(callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new OddSocketsError('Callback function is required', 'INVALID_CONFIGURATION');
    }

    if (this.subscribed || this.subscribing) {
      this.on('message', callback);
      return;
    }

    if (!this.client._isConnected()) {
      await this.client.connect();
    }

    this.subscribing = true;
    // Worker reads camelCase option keys.
    this.options = {
      maxHistory: options.maxHistory || 100,
      retainHistory: options.retainHistory !== false,
      enablePresence: options.enablePresence || false
    };

    return new Promise((resolve, reject) => {
      const socket = this.client._getSocket();

      const onSubscribed = (data) => {
        if (data.channel !== this.name) return;
        this.subscribed = true;
        this.subscribing = false;
        this.on('message', callback);
        socket.off('subscribed', onSubscribed);
        socket.off('error', onError);
        this.emit('subscribed', data);
        resolve(data);
      };

      const onError = (error) => {
        this.subscribing = false;
        socket.off('subscribed', onSubscribed);
        socket.off('error', onError);
        reject(error);
      };

      socket.on('subscribed', onSubscribed);
      socket.on('error', onError);

      socket.emit('subscribe', { channel: this.name, options: this.options });

      setTimeout(() => {
        if (this.subscribing) {
          socket.off('subscribed', onSubscribed);
          socket.off('error', onError);
          this.subscribing = false;
          reject(new OddSocketsError('Subscription timeout', 'OPERATION_TIMEOUT'));
        }
      }, 10000);
    });
  }

  async unsubscribe() {
    if (!this.subscribed) return;
    if (!this.client._isConnected()) {
      throw new OddSocketsError('Client is not connected', 'CONNECTION_FAILED');
    }

    return new Promise((resolve, reject) => {
      const socket = this.client._getSocket();

      const onUnsubscribed = (data) => {
        if (data.channel !== this.name) return;
        this.subscribed = false;
        this.removeAllListeners('message');
        socket.off('unsubscribed', onUnsubscribed);
        socket.off('error', onError);
        this.emit('unsubscribed', data);
        resolve(data);
      };

      const onError = (error) => {
        socket.off('unsubscribed', onUnsubscribed);
        socket.off('error', onError);
        reject(error);
      };

      socket.on('unsubscribed', onUnsubscribed);
      socket.on('error', onError);

      socket.emit('unsubscribe', { channel: this.name });

      setTimeout(() => {
        socket.off('unsubscribed', onUnsubscribed);
        socket.off('error', onError);
        reject(new OddSocketsError('Unsubscription timeout', 'OPERATION_TIMEOUT'));
      }, 5000);
    });
  }

  async publish(message, options = {}) {
    if (!this.client._isConnected()) {
      throw new OddSocketsError('Client is not connected', 'CONNECTION_FAILED');
    }

    validateMessageSize(message);

    return new Promise((resolve, reject) => {
      const socket = this.client._getSocket();

      const onPublished = (data) => {
        if (data.channel !== this.name) return;
        socket.off('published', onPublished);
        socket.off('error', onError);
        resolve(data);
      };

      const onError = (error) => {
        socket.off('published', onPublished);
        socket.off('error', onError);
        reject(error);
      };

      socket.on('published', onPublished);
      socket.on('error', onError);

      // Only include options if the caller supplied keys - the worker
      // destructures option defaults on `undefined`, so an empty object
      // (not null) is the safe neutral value.
      socket.emit('publish', { channel: this.name, message, options });

      setTimeout(() => {
        socket.off('published', onPublished);
        socket.off('error', onError);
        reject(new OddSocketsError('Publish timeout', 'OPERATION_TIMEOUT'));
      }, 10000);
    });
  }

  async getPresence() {
    if (!this.client._isConnected()) {
      throw new OddSocketsError('Client is not connected', 'CONNECTION_FAILED');
    }

    return new Promise((resolve, reject) => {
      const socket = this.client._getSocket();

      const onPresence = (data) => {
        if (data.channel !== this.name) return;
        socket.off('presence', onPresence);
        socket.off('error', onError);
        resolve(data);
      };

      const onError = (error) => {
        socket.off('presence', onPresence);
        socket.off('error', onError);
        reject(error);
      };

      socket.on('presence', onPresence);
      socket.on('error', onError);

      socket.emit('get_presence', { channel: this.name });

      setTimeout(() => {
        socket.off('presence', onPresence);
        socket.off('error', onError);
        reject(new OddSocketsError('Presence request timeout', 'OPERATION_TIMEOUT'));
      }, 5000);
    });
  }

  async getHistory(options = {}) {
    if (!this.client._isConnected()) {
      throw new OddSocketsError('Client is not connected', 'CONNECTION_FAILED');
    }

    return new Promise((resolve, reject) => {
      const socket = this.client._getSocket();

      const onHistory = (data) => {
        if (data.channel !== this.name) return;
        socket.off('history', onHistory);
        socket.off('error', onError);
        resolve(data.messages || []);
      };

      const onError = (error) => {
        socket.off('history', onHistory);
        socket.off('error', onError);
        reject(error);
      };

      socket.on('history', onHistory);
      socket.on('error', onError);

      socket.emit('get_history', {
        channel: this.name,
        count: options.count || 50,
        start: options.start,
        end: options.end
      });

      setTimeout(() => {
        socket.off('history', onHistory);
        socket.off('error', onError);
        reject(new OddSocketsError('History request timeout', 'OPERATION_TIMEOUT'));
      }, 10000);
    });
  }

  async publishBulk(messages) {
    const bulk = messages.map((message) => ({ channel: this.name, message }));
    return this.client.publishBulk(bulk);
  }

  isSubscribed() {
    return this.subscribed;
  }

  getName() {
    return this.name;
  }

  getPresenceMap() {
    return new Map(this.presence);
  }

  // Internal: worker event handlers, invoked by the client router.
  _handleMessage(data) {
    this.emit('message', data);
  }

  _handleSubscribed(data) {
    this.emit('subscribed', data);
  }

  _handleUnsubscribed(data) {
    this.emit('unsubscribed', data);
  }

  _handlePublished(data) {
    this.emit('published', data);
  }

  _handlePresence(data) {
    if (data.occupants) {
      this.presence.clear();
      data.occupants.forEach((occupant) => this.presence.set(occupant.userId, occupant));
    }
    this.emit('presence', data);
  }

  _handlePresenceChange(data) {
    if (data.action === 'join') {
      this.presence.set(data.user.userId, data.user);
    } else if (data.action === 'leave') {
      this.presence.delete(data.user.userId);
    }
    this.emit('presence_change', data);
  }

  _handleHistory(data) {
    this.emit('history', data);
  }
}
