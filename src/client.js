/**
 * OddSockets Svelte Client
 * 
 * Core client implementation for OddSockets real-time messaging.
 * This is the foundation that powers the reactive stores.
 */

import EventEmitter from 'eventemitter3';
import { OddSocketsChannel } from './channel.js';
import { OddSocketsError } from './errors.js';
import { Utils } from './utils.js';

export class OddSocketsClient extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      managerUrl: 'https://manager1.oddsockets.tyga.network',
      timeout: 10000,
      heartbeatInterval: 30000,
      reconnectAttempts: 5,
      autoConnect: true,
      ...config
    };
    
    if (!this.config.apiKey) {
      throw new OddSocketsError('API key is required', 'INVALID_CONFIGURATION');
    }
    
    this.state = 'disconnected';
    this.workerUrl = null;
    this.websocket = null;
    this.channels = new Map();
    this.reconnectCount = 0;
    this.heartbeatTimer = null;
    this.connectionPromise = null;
    
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
      const workerData = await this._getWorkerAssignment();
      this.workerUrl = workerData.workerUrl;
      this.emit('worker_assigned', workerData);
      
      // Connect to assigned worker
      await this._connectToWorker();
      
      this.state = 'connected';
      this.reconnectCount = 0;
      this.emit('connected');
      
      this._startHeartbeat();
      
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
    const response = await fetch(`${this.config.managerUrl}/api/worker-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        userId: this.config.userId,
        userAgent: 'OddSockets-Svelte-SDK/0.1.0-beta.1'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new OddSocketsError(error.message || 'Worker assignment failed', 'WORKER_ASSIGNMENT_FAILED');
    }
    
    return await response.json();
  }
  
  async _connectToWorker() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.workerUrl.replace('http', 'ws') + '/ws';
      this.websocket = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        reject(new OddSocketsError('Connection timeout', 'OPERATION_TIMEOUT'));
      }, this.config.timeout);
      
      this.websocket.onopen = () => {
        clearTimeout(timeout);
        
        // Send authentication
        this.websocket.send(JSON.stringify({
          type: 'auth',
          apiKey: this.config.apiKey,
          userId: this.config.userId
        }));
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'auth_success') {
            clearTimeout(timeout);
            resolve();
          } else if (message.type === 'auth_error') {
            clearTimeout(timeout);
            reject(new OddSocketsError(message.error, 'AUTHENTICATION_FAILED'));
          } else {
            this._handleMessage(message);
          }
        } catch (error) {
          this.emit('error', new OddSocketsError('Invalid message format', 'WEBSOCKET_ERROR'));
        }
      };
      
      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
        reject(new OddSocketsError('WebSocket connection failed', 'CONNECTION_FAILED'));
      };
      
      this.websocket.onclose = () => {
        this._handleDisconnection();
      };
    });
  }
  
  _handleMessage(message) {
    switch (message.type) {
      case 'message':
        const channel = this.channels.get(message.channel);
        if (channel) {
          channel.emit('message', message);
        }
        break;
        
      case 'presence':
        const presenceChannel = this.channels.get(message.channel);
        if (presenceChannel) {
          presenceChannel.emit('presence', message);
        }
        break;
        
      case 'heartbeat':
        this._sendHeartbeat();
        break;
        
      default:
        this.emit('message', message);
    }
  }
  
  _handleDisconnection() {
    if (this.state === 'connected') {
      this.state = 'disconnected';
      this.emit('disconnected');
      
      this._stopHeartbeat();
      
      if (this.reconnectCount < this.config.reconnectAttempts) {
        this._scheduleReconnect();
      }
    }
  }
  
  _scheduleReconnect() {
    this.reconnectCount++;
    this.state = 'reconnecting';
    this.emit('reconnecting', this.reconnectCount);
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount - 1), 30000);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, this.config.heartbeatInterval);
  }
  
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  _sendHeartbeat() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }
  
  disconnect() {
    this.state = 'disconnected';
    this._stopHeartbeat();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
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
      const channel = new OddSocketsChannel(channelName, this);
      this.channels.set(channelName, channel);
    }
    
    return this.channels.get(channelName);
  }
  
  async publishBulk(messages) {
    if (!Array.isArray(messages)) {
      throw new OddSocketsError('Messages must be an array', 'INVALID_CONFIGURATION');
    }
    
    const response = await fetch(`${this.workerUrl}/api/publish-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({ messages })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new OddSocketsError(error.message || 'Bulk publish failed', 'MESSAGE_DELIVERY_FAILED');
    }
    
    return await response.json();
  }
  
  getConnectionState() {
    return this.state;
  }
  
  isConnected() {
    return this.state === 'connected';
  }
  
  getWorkerUrl() {
    return this.workerUrl;
  }
  
  getChannels() {
    return Array.from(this.channels.keys());
  }
}
