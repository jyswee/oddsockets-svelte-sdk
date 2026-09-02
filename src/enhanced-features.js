/**
 * Enhanced Features for OddSockets Svelte SDK
 * Provides 67 new Slack-like events with Svelte stores and reactivity
 */

export class EnhancedFeatures {
  constructor(client) {
    this.client = client;
    this.timeout = 10000;
  }

  // Enhanced actions travel over the Socket.IO connection to the worker, not the
  // local EventEmitter. Resolve the live socket (guarded on connection state).
  _getSocket() {
    if (!this.client._isConnected()) {
      throw new Error('Not connected to OddSockets');
    }
    return this.client._getSocket();
  }

  // ==================== THREAD EVENTS ====================

  async threadReply(channel, parentMessageId, message, userId, userName) {
    return this._emitWithResponse('thread_reply', {
      channel,
      parentMessageId,
      message,
      userId,
      userName
    }, 'thread_reply_success');
  }

  async getThread(threadId) {
    return this._emitWithResponse('get_thread', { threadId }, 'thread_data');
  }

  async subscribeThread(threadId, userId) {
    return this._emitWithResponse('subscribe_thread', { threadId, userId }, 'thread_subscribed');
  }

  markThreadRead(threadId, userId) {
    this._getSocket().emit('mark_thread_read', { threadId, userId });
  }

  followThread(threadId, userId) {
    this._getSocket().emit('follow_thread', { threadId, userId });
  }

  unfollowThread(threadId, userId) {
    this._getSocket().emit('unfollow_thread', { threadId, userId });
  }

  // ==================== REACTION EVENTS ====================

  addReaction(messageId, channel, emoji, userId, userName) {
    this._getSocket().emit('add_reaction', { messageId, channel, emoji, userId, userName });
  }

  removeReaction(messageId, channel, emoji, userId) {
    this._getSocket().emit('remove_reaction', { messageId, channel, emoji, userId });
  }

  async getReactions(messageId) {
    return this._emitWithResponse('get_reactions', { messageId }, 'message_reactions');
  }

  // ==================== READ RECEIPT EVENTS ====================

  markRead(messageId, channel, userId, userName) {
    this._getSocket().emit('mark_read', { messageId, channel, userId, userName });
  }

  async getUnreadCounts(userId, channels) {
    return this._emitWithResponse('get_unread_counts', { userId, channels }, 'unread_counts');
  }

  markAllRead(channel, userId) {
    this._getSocket().emit('mark_all_read', { channel, userId });
  }

  // ==================== CHANNEL EVENTS ====================

  async createChannel(name, type, description, topic, createdBy, createdByName) {
    return this._emitWithResponse('create_channel', {
      name,
      type,
      description,
      topic,
      createdBy,
      createdByName,
      members: []
    }, 'channel_create_success');
  }

  updateChannel(channelId, updates, userId) {
    this._getSocket().emit('update_channel', { channelId, updates, userId });
  }

  archiveChannel(channelId, userId) {
    this._getSocket().emit('archive_channel', { channelId, userId });
  }

  inviteToChannel(channelId, invitedUserId, invitedUserName, invitedBy) {
    this._getSocket().emit('invite_to_channel', { channelId, invitedUserId, invitedUserName, invitedBy });
  }

  removeFromChannel(channelId, removedUserId, removedBy) {
    this._getSocket().emit('remove_from_channel', { channelId, removedUserId, removedBy });
  }

  joinChannel(channelId, userId, userName) {
    this._getSocket().emit('join_channel', { channelId, userId, userName });
  }

  leaveChannel(channelId, userId) {
    this._getSocket().emit('leave_channel', { channelId, userId });
  }

  async getChannelMembers(channelId) {
    return this._emitWithResponse('get_channel_members', { channelId }, 'channel_members');
  }

  // ==================== DIRECT MESSAGE EVENTS ====================

  async createDM(userIds, type) {
    return this._emitWithResponse('create_dm', { userIds, type }, 'dm_create_success');
  }

  sendDM(conversationId, message, userId, userName) {
    this._getSocket().emit('send_dm', { conversationId, message, userId, userName });
  }

  async getDMConversations(userId, includeArchived) {
    return this._emitWithResponse('get_dm_conversations', { userId, includeArchived }, 'dm_conversations');
  }

  // ==================== NOTIFICATION EVENTS ====================

  subscribeNotifications(userId) {
    this._getSocket().emit('subscribe_notifications', { userId });
  }

  markNotificationRead(notificationId, userId) {
    this._getSocket().emit('mark_notification_read', { notificationId, userId });
  }

  markAllNotificationsRead(userId) {
    this._getSocket().emit('mark_all_notifications_read', { userId });
  }

  clearNotifications(userId) {
    this._getSocket().emit('clear_notifications', { userId });
  }

  async getNotifications(userId, limit, status = 'all') {
    return this._emitWithResponse('get_notifications', { userId, limit, status }, 'notifications_data');
  }

  // ==================== PRESENCE EVENTS ====================

  setStatus(userId, status) {
    this._getSocket().emit('set_status', { userId, status });
  }

  setCustomStatus(userId, emoji, text, expiresAt = null) {
    const params = { userId, emoji, text };
    if (expiresAt) params.expiresAt = expiresAt;
    this._getSocket().emit('set_custom_status', params);
  }

  clearCustomStatus(userId) {
    this._getSocket().emit('clear_custom_status', { userId });
  }

  setDND(userId, until = null) {
    const params = { userId };
    if (until) params.until = until;
    this._getSocket().emit('set_dnd', params);
  }

  clearDND(userId) {
    this._getSocket().emit('clear_dnd', { userId });
  }

  startTyping(userId, channel) {
    this._getSocket().emit('start_typing', { userId, channel });
  }

  stopTyping(userId, channel) {
    this._getSocket().emit('stop_typing', { userId, channel });
  }

  async getUserPresence(userIds) {
    return this._emitWithResponse('get_user_presence', { userIds }, 'user_presence_data');
  }

  // ==================== MESSAGE EDITING EVENTS ====================

  editMessage(messageId, channel, newContent, userId) {
    this._getSocket().emit('edit_message', { messageId, channel, newContent, userId });
  }

  deleteMessage(messageId, channel, userId) {
    this._getSocket().emit('delete_message', { messageId, channel, userId });
  }

  pinMessage(messageId, channel, userId) {
    this._getSocket().emit('pin_message', { messageId, channel, userId });
  }

  unpinMessage(messageId, channel, userId) {
    this._getSocket().emit('unpin_message', { messageId, channel, userId });
  }

  async getPinnedMessages(channel) {
    return this._emitWithResponse('get_pinned_messages', { channel }, 'pinned_messages');
  }

  // ==================== SEARCH EVENTS ====================

  async searchMessages(query, userId, limit) {
    return this._emitWithResponse('search_messages', { query, userId, limit }, 'search_results');
  }

  async filterMessages(filters) {
    return this._emitWithResponse('filter_messages', filters, 'filter_results');
  }

  async searchInChannel(channel, query, limit) {
    return this._emitWithResponse('search_in_channel', { channel, query, limit }, 'channel_search_results');
  }

  async searchByUser(userId, query, limit) {
    const params = { userId, limit };
    if (query) params.query = query;
    return this._emitWithResponse('search_by_user', params, 'user_search_results');
  }

  // ==================== CHALLENGE / LEADERBOARD / ACHIEVEMENT EVENTS ====================

  async createChallenge(params) {
    return this._emitWithAck('challenge_create', params, 'challenge_create_success', 'challenge_create');
  }

  reportProgress(params) {
    this._getSocket().emit('challenge_progress', params);
  }

  async completeChallenge(params) {
    return this._emitWithAck('challenge_complete', params, 'challenge_complete_success', 'challenge_complete');
  }

  unlockAchievement(params) {
    this._getSocket().emit('achievement_unlock', params);
  }

  async getStandings(params) {
    return this._emitWithAck('challenge_standings', params, 'challenge_standings_success', 'challenge_standings');
  }

  async getAchievements(params) {
    return this._emitWithAck('achievement_query', params, 'achievement_state', 'achievement_query');
  }

  async sendChallengeInvite(params) {
    return this._emitWithAck('challenge_invite', params, 'challenge_invite_success', 'challenge_invite');
  }

  async replyChallengeInvite(params) {
    return this._emitWithAck('challenge_reply', params, 'challenge_reply_success', 'challenge_reply');
  }

  async cancelChallengeInvite(params) {
    return this._emitWithAck('challenge_invite_cancel', params, 'challenge_invite_cancel_success', 'challenge_invite_cancel');
  }

  async getChallengeInvites(params = {}) {
    return this._emitWithAck('challenge_invites_query', params, 'challenge_invites', 'challenge_invites_query');
  }

  // ==================== PRIVATE METHODS ====================

  // Request/ack with an error path: emit the action, resolve on the success
  // event, reject when the worker emits an 'error' whose event matches ours.
  _emitWithAck(event, params, successEvent, errorKey) {
    return new Promise((resolve, reject) => {
      const socket = this._getSocket();

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.off(successEvent, onSuccess);
        socket.off('error', onError);
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${successEvent}`));
      }, this.timeout);

      const onSuccess = (data) => {
        cleanup();
        resolve(data);
      };

      const onError = (error) => {
        if (error && error.event === errorKey) {
          cleanup();
          reject(new Error(error.message || `Request failed: ${event}`));
        }
      };

      socket.once(successEvent, onSuccess);
      socket.once('error', onError);
      socket.emit(event, params);
    });
  }

  _emitWithResponse(event, params, responseEvent) {
    return new Promise((resolve, reject) => {
      const socket = this._getSocket();

      const timeoutId = setTimeout(() => {
        socket.off(responseEvent, handler);
        reject(new Error(`Timeout waiting for ${responseEvent}`));
      }, this.timeout);

      const handler = (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      };

      socket.once(responseEvent, handler);
      socket.emit(event, params);
    });
  }
}
