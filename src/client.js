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
import { EnhancedFeatures } from './enhanced-features.js';

// Enhanced-feature broadcasts the worker pushes to subscribers. These are
// re-emitted onto the client event surface so apps can listen with
// client.on('reaction_added', handler), client.on('user_typing', handler), etc.
const ENHANCED_BROADCAST_EVENTS = [
  'reaction_added', 'reaction_removed',
  'user_typing', 'user_stopped_typing',
  'user_read', 'unread_count_updated', 'all_marked_read',
  'thread_reply', 'thread_subscribed', 'thread_followed', 'thread_unfollowed', 'thread_read_updated',
  'message_edited', 'message_deleted', 'message_pinned', 'message_unpinned',
  'user_status_changed', 'custom_status_updated', 'custom_status_cleared',
  'dnd_status_changed', 'status_updated',
  'file_upload_completed', 'file_upload_progress', 'file_upload_failed',
  'dm_created', 'dm_received',
  'notification', 'notification_read', 'all_notifications_read', 'notifications_cleared',
  'channel_created', 'channel_updated', 'user_invited', 'user_joined_channel', 'user_left_channel', 'user_removed'
];

export class OddSocketsClient extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      managerUrl: 'https://connect.oddsockets.tyga.network',
      timeout: 10000,
      reconnectAttempts: 5,
      autoConnect: true,
      tokenRefreshLeadMs: 120000,
      ...config
    };

    if (!this.config.apiKey && !this.config.tokenProvider) {
      throw new OddSocketsError(
        'Either an API key or a tokenProvider is required',
        'INVALID_CONFIGURATION'
      );
    }

    // Reject a malformed manager up front rather than letting it surface later
    // as a confusing fetch error. The configured manager is used verbatim: if
    // it is unreachable the connection fails, we never retarget the default.
    this.config.managerUrl = this._validateManagerUrl(this.config.managerUrl);

    this.state = 'disconnected';
    this.workerUrl = null;
    this.workerId = null;
    this.sessionInfo = null;
    this.socket = null;
    this.channels = new Map();
    this.reconnectCount = 0;
    this.connectionPromise = null;
    this.currentToken = null;
    this.tokenExpiresAt = null;
    this.tokenRefreshTimer = null;
    this.clientIdentifier = this._generateClientIdentifier();

    // Enhanced features (Slack-like events: reactions, threads, presence, DMs,
    // notifications, search). Actions travel over the Socket.IO connection;
    // inbound broadcasts arrive on the client event surface (see below).
    this.enhanced = new EnhancedFeatures(this);

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  _validateManagerUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      throw new OddSocketsError(`Invalid managerUrl: ${url}`, 'INVALID_CONFIGURATION');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new OddSocketsError(
        `Invalid managerUrl protocol '${parsed.protocol}' in ${url} (expected http or https)`,
        'INVALID_CONFIGURATION'
      );
    }
    return url.replace(/\/+$/, '');
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
      // Step 0: in token mode, resolve a FRESH short-lived token before every
      // (re)connect - it authenticates both worker selection and the handshake.
      if (this._isTokenMode()) {
        await this._resolveToken();
      }

      // Get worker assignment from manager
      await this._getWorkerAssignment();

      // Connect to assigned worker over Socket.IO
      await this._connectToWorker();

      this.state = 'connected';
      this.reconnectCount = 0;
      this._scheduleTokenRefresh();
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
    const credential = this._isTokenMode()
      ? { token: this.currentToken }
      : { apiKey: this.config.apiKey };
    const params = new URLSearchParams({
      ...credential,
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
      // io.use() middleware reads socket.handshake.auth.apiKey (or .token when
      // running keyless with a tokenProvider).
      const auth = this._isTokenMode()
        ? { token: this.currentToken, userId: this.config.userId }
        : { apiKey: this.config.apiKey, userId: this.config.userId };
      this.socket = io(this.workerUrl, {
        auth,
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

    // Forward enhanced-feature broadcasts to the client event surface so apps
    // can listen with client.on('reaction_added', handler), etc.
    for (const event of ENHANCED_BROADCAST_EVENTS) {
      this.socket.on(event, (data) => this.emit(event, data));
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

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

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
    return `${this._hashString(this.config.apiKey || 'token-client')}_${baseId}`;
  }

  // Internal: true when the client authenticates with minted tokens
  // (tokenProvider) instead of an API key.
  _isTokenMode() {
    return typeof this.config.tokenProvider === 'function';
  }

  // Internal: ask the app's tokenProvider for a fresh short-lived token.
  // The provider may return a raw JWT string or a mint response object
  // ({token, expiresAt, exp, ...}), synchronously or as a promise.
  async _resolveToken() {
    let result;
    try {
      result = await this.config.tokenProvider();
    } catch (error) {
      throw new OddSocketsError(
        `tokenProvider failed: ${error && error.message}`,
        'AUTHENTICATION_FAILED'
      );
    }

    let token = null;
    let expiresAtMs = null;

    if (typeof result === 'string') {
      token = result;
    } else if (result && typeof result === 'object') {
      token = result.token;
      if (typeof result.exp === 'number') {
        expiresAtMs = result.exp * 1000;
      } else if (typeof result.expiresAt === 'number') {
        expiresAtMs = result.expiresAt < 1e12 ? result.expiresAt * 1000 : result.expiresAt;
      } else if (typeof result.expiresAt === 'string') {
        const parsed = Date.parse(result.expiresAt);
        if (!Number.isNaN(parsed)) expiresAtMs = parsed;
      }
    }

    if (!token) {
      throw new OddSocketsError('tokenProvider returned no token', 'AUTHENTICATION_FAILED');
    }

    if (expiresAtMs === null) {
      expiresAtMs = this._expiryFromJwt(token);
    }

    this.currentToken = token;
    this.tokenExpiresAt = expiresAtMs;
  }

  // Internal: best-effort expiry from the JWT payload's exp claim (browser-safe
  // base64url decode via atob, Buffer fallback for SSR/node).
  _expiryFromJwt(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      let json;
      if (typeof atob === 'function') {
        json = atob(b64);
      } else if (typeof Buffer !== 'undefined') {
        json = Buffer.from(b64, 'base64').toString('utf8');
      } else {
        return null;
      }
      const payload = JSON.parse(json);
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch (e) {
      return null;
    }
  }

  // Internal: silently refresh the token tokenRefreshLeadMs before expiry so
  // reconnects always carry a live credential. Emits 'token_refreshed' on
  // success and 'token_refresh_failed' on failure.
  _scheduleTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    if (!this._isTokenMode() || this.tokenExpiresAt === null) return;

    const delay = Math.max(this.tokenExpiresAt - Date.now() - this.config.tokenRefreshLeadMs, 0);

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this._resolveToken();
        // Swap the fresh token into the live socket's auth so the next
        // reconnect handshake uses it.
        if (this.socket) {
          this.socket.auth = { token: this.currentToken, userId: this.config.userId };
        }
        this.emit('token_refreshed', { expiresAt: this.tokenExpiresAt });
        this._scheduleTokenRefresh();
      } catch (error) {
        this.emit('token_refresh_failed', error);
      }
    }, delay);
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
