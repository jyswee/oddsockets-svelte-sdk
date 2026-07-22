/**
 * OddSockets Svelte Client
 *
 * Core client implementation for OddSockets real-time messaging.
 * This is the foundation that powers the reactive stores.
 *
 * The worker speaks genuine Socket.IO (Engine.IO v4), so this client uses the
 * socket.io-client library - the same transport as the JavaScript SDK. Manager
 * discovery assigns a worker, then a real Socket.IO connection carries every
 * subscribe / publish / presence request.
 */

import EventEmitter from 'eventemitter3';
import { io } from 'socket.io-client';
import { OddSocketsChannel } from './channel.js';
import { OddSocketsError } from './errors.js';

export class OddSocketsClient extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      managerUrl: 'https://connect.oddsockets.tyga.network',
      timeout: 10000,
      reconnectAttempts: 5,
      autoConnect: true,
      ...config
    };

    if (!this.config.apiKey) {
      throw new OddSocketsError('API key is required', 'INVALID_CONFIGURATION');
    }

    this.state = 'disconnected';
    this.workerUrl = null;
    this.workerId = null;
    this.sessionInfo = null;
    this.socket = null;
    this.channels = new Map();
    this.reconnectCount = 0;
    this.connectionPromise = null;
    this.clientIdentifier = this._generateClientIdentifier();

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  async connect() {
    if (this.state === 'connected' || this.state === 'connecting') {
      return this.connectionPromise;
    }

    this.state = 'connecting';
    this.emit('connecting');

    this.connectionPromise = this._performConnection();
    return this.connectionPromise;
  }

  async _performConnection() {
    try {
      // Get worker assignment from manager
      await this._getWorkerAssignment();

      // Connect to assigned worker over Socket.IO
      await this._connectToWorker();

      this.state = 'connected';
      this.reconnectCount = 0;
      this.emit('connected');
    } catch (error) {
      this.state = 'failed';
      this.emit('error', error);

      if (this.reconnectCount < this.config.reconnectAttempts) {
        this._scheduleReconnect();
      } else {
        this.emit('max_reconnect_attempts_reached');
      }

      throw error;
    }
  }

  async _getWorkerAssignment() {
    const params = new URLSearchParams({
      apiKey: this.config.apiKey,
      userId: this.config.userId || this.clientIdentifier,
      clientIdentifier: this.clientIdentifier
    });

    let response;
    try {
      response = await fetch(
        `${this.config.managerUrl}/api/cluster/select-worker?${params.toString()}`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'OddSockets-Svelte-SDK/0.1.0' }
        }
      );
    } catch (error) {
      throw new OddSocketsError(
        'Manager is offline. Cannot assign worker without session stickiness.',
        'WORKER_ASSIGNMENT_FAILED'
      );
    }

    if (!response.ok) {
      throw new OddSocketsError(
        `Worker assignment failed: ${response.status} ${response.statusText}`,
        'WORKER_ASSIGNMENT_FAILED'
      );
    }

    const data = await response.json();
    if (!data || !data.url) {
      throw new OddSocketsError('Invalid worker assignment response', 'WORKER_ASSIGNMENT_FAILED');
    }

    this.workerUrl = data.url;
    this.workerId = data.workerId;
    this.sessionInfo = data.session;

    this.emit('worker_assigned', {
      workerId: this.workerId,
      workerUrl: this.workerUrl,
      session: this.sessionInfo,
      clientIdentifier: this.clientIdentifier,
      managerUrl: this.config.managerUrl
    });
  }

  async _connectToWorker() {
    if (!this.workerUrl) {
      throw new OddSocketsError('No worker URL available', 'CONNECTION_FAILED');
    }

    return new Promise((resolve, reject) => {
      // Credentials go in the Socket.IO handshake auth, where the worker's
      // io.use() middleware reads socket.handshake.auth.apiKey.
      this.socket = io(this.workerUrl, {
        auth: {
          apiKey: this.config.apiKey,
          userId: this.config.userId
        },
        transports: ['websocket', 'polling'],
        timeout: this.config.timeout
      });

      this.socket.on('connect', () => {
        this._setupSocketEventHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        reject(new OddSocketsError(`Failed to connect to worker: ${error.message}`, 'CONNECTION_FAILED'));
      });

      setTimeout(() => {
        if (this.state === 'connecting') {
          reject(new OddSocketsError('Connection timeout', 'OPERATION_TIMEOUT'));
        }
      }, this.config.timeout + 5000);
    });
  }

  _setupSocketEventHandlers() {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.state = 'disconnected';
      this.emit('disconnected', reason);

      // Auto-reconnect unless we asked to disconnect.
      if (reason !== 'io client disconnect') {
        this._scheduleReconnect();
      }
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });

    // Route worker events to the owning channel.
    const routes = {
      message: '_handleMessage',
      subscribed: '_handleSubscribed',
      unsubscribed: '_handleUnsubscribed',
      published: '_handlePublished',
      presence: '_handlePresence',
      presence_change: '_handlePresenceChange',
      history: '_handleHistory'
    };

    for (const [event, handler] of Object.entries(routes)) {
      this.socket.on(event, (data) => {
        const channel = this.channels.get(data && data.channel);
        if (channel && typeof channel[handler] === 'function') {
          channel[handler](data);
        }
      });
    }
  }

  _scheduleReconnect() {
    if (this.state === 'connected') return;

    this.reconnectCount++;
    this.state = 'reconnecting';
    this.emit('reconnecting', this.reconnectCount);

    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount - 1), 30000);

    setTimeout(() => {
      if (this.state === 'reconnecting') {
        this.connect();
      }
    }, delay);
  }

  disconnect() {
    this.state = 'disconnected';

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.workerUrl = null;
    this.workerId = null;
    this.emit('disconnected');
  }

  reconnect() {
    this.disconnect();
    this.reconnectCount = 0;
    return this.connect();
  }

  channel(channelName) {
    if (!channelName || typeof channelName !== 'string') {
      throw new OddSocketsError('Invalid channel name', 'INVALID_CHANNEL_NAME');
    }

    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, new OddSocketsChannel(channelName, this));
    }

    return this.channels.get(channelName);
  }

  async publishBulk(messages) {
    if (!Array.isArray(messages)) {
      throw new OddSocketsError('Messages must be an array', 'INVALID_CONFIGURATION');
    }

    if (!this.isConnected()) {
      throw new OddSocketsError('Not connected to OddSockets', 'CONNECTION_FAILED');
    }

    const results = [];
    for (const msg of messages) {
      try {
        if (!msg.channel || msg.message === undefined) {
          results.push({ success: false, error: 'Missing channel or message' });
          continue;
        }
        const channel = this.channel(msg.channel);
        const result = await channel.publish(msg.message, msg.options || {});
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  // Internal: socket accessor for the Channel class.
  _getSocket() {
    return this.socket;
  }

  // Internal: connection guard for the Channel class.
  _isConnected() {
    return this.state === 'connected' && this.socket && this.socket.connected;
  }

  getConnectionState() {
    return this.state;
  }

  // Alias kept for API parity with the JavaScript SDK.
  getState() {
    return this.state;
  }

  getWorkerInfo() {
    if (!this.workerId || !this.workerUrl) return null;
    return { workerId: this.workerId, workerUrl: this.workerUrl };
  }

  getSessionInfo() {
    return this.sessionInfo;
  }

  isConnected() {
    return this._isConnected();
  }

  getWorkerUrl() {
    return this.workerUrl;
  }

  getChannels() {
    return Array.from(this.channels.keys());
  }

  getClientIdentifier() {
    return this.clientIdentifier;
  }

  // Internal: stable identifier for session stickiness.
  _generateClientIdentifier() {
    const baseId = this.config.userId || 'default';
    return `${this._hashString(this.config.apiKey)}_${baseId}`;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
