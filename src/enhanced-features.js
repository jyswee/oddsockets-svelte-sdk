/**
 * Enhanced Features for OddSockets Svelte SDK
 * Provides 67 new Slack-like events with Svelte stores and reactivity
 */

export class EnhancedFeatures {
  constructor(client) {
    this.client = client;
    this.timeout = 10000;
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
    this.client.emit('mark_thread_read', { threadId, userId });
  }

  followThread(threadId, userId) {
    this.client.emit('follow_thread', { threadId, userId });
  }

  unfollowThread(threadId, userId) {
    this.client.emit('unfollow_thread', { threadId, userId });
  }

  // ==================== REACTION EVENTS ====================

  addReaction(messageId, channel, emoji, userId, userName) {
    this.client.emit('add_reaction', { messageId, channel, emoji, userId, userName });
  }

  removeReaction(messageId, channel, emoji, userId) {
    this.client.emit('remove_reaction', { messageId, channel, emoji, userId });
  }

  async getReactions(messageId) {
    return this._emitWithResponse('get_reactions', { messageId }, 'message_reactions');
  }

  // ==================== READ RECEIPT EVENTS ====================

  markRead(messageId, channel, userId, userName) {
    this.client.emit('mark_read', { messageId, channel, userId, userName });
  }

  async getUnreadCounts(userId, channels) {
    return this._emitWithResponse('get_unread_counts', { userId, channels }, 'unread_counts');
  }

  markAllRead(channel, userId) {
    this.client.emit('mark_all_read', { channel, userId });
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
    this.client.emit('update_channel', { channelId, updates, userId });
  }

  archiveChannel(channelId, userId) {
    this.client.emit('archive_channel', { channelId, userId });
  }

  inviteToChannel(channelId, invitedUserId, invitedUserName, invitedBy) {
    this.client.emit('invite_to_channel', { channelId, invitedUserId, invitedUserName, invitedBy });
  }

  removeFromChannel(channelId, removedUserId, removedBy) {
    this.client.emit('remove_from_channel', { channelId, removedUserId, removedBy });
  }

  joinChannel(channelId, userId, userName) {
    this.client.emit('join_channel', { channelId, userId, userName });
  }

  leaveChannel(channelId, userId) {
    this.client.emit('leave_channel', { channelId, userId });
  }

  async getChannelMembers(channelId) {
    return this._emitWithResponse('get_channel_members', { channelId }, 'channel_members');
  }

  // ==================== DIRECT MESSAGE EVENTS ====================

  async createDM(userIds, type) {
    return this._emitWithResponse('create_dm', { userIds, type }, 'dm_create_success');
  }

  sendDM(conversationId, message, userId, userName) {
    this.client.emit('send_dm', { conversationId, message, userId, userName });
  }

  async getDMConversations(userId, includeArchived) {
    return this._emitWithResponse('get_dm_conversations', { userId, includeArchived }, 'dm_conversations');
  }

  // ==================== NOTIFICATION EVENTS ====================

  subscribeNotifications(userId) {
    this.client.emit('subscribe_notifications', { userId });
  }

  markNotificationRead(notificationId, userId) {
    this.client.emit('mark_notification_read', { notificationId, userId });
  }

  markAllNotificationsRead(userId) {
    this.client.emit('mark_all_notifications_read', { userId });
  }

  clearNotifications(userId) {
    this.client.emit('clear_notifications', { userId });
  }

  async getNotifications(userId, limit, status = 'all') {
    return this._emitWithResponse('get_notifications', { userId, limit, status }, 'notifications_data');
  }

  // ==================== PRESENCE EVENTS ====================

  setStatus(userId, status) {
    this.client.emit('set_status', { userId, status });
  }

  setCustomStatus(userId, emoji, text, expiresAt = null) {
    const params = { userId, emoji, text };
    if (expiresAt) params.expiresAt = expiresAt;
    this.client.emit('set_custom_status', params);
  }

  clearCustomStatus(userId) {
    this.client.emit('clear_custom_status', { userId });
  }

  setDND(userId, until = null) {
    const params = { userId };
    if (until) params.until = until;
    this.client.emit('set_dnd', params);
  }

  clearDND(userId) {
    this.client.emit('clear_dnd', { userId });
  }

  startTyping(userId, channel) {
    this.client.emit('start_typing', { userId, channel });
  }

  stopTyping(userId, channel) {
    this.client.emit('stop_typing', { userId, channel });
  }

  async getUserPresence(userIds) {
    return this._emitWithResponse('get_user_presence', { userIds }, 'user_presence_data');
  }

  // ==================== MESSAGE EDITING EVENTS ====================

  editMessage(messageId, channel, newContent, userId) {
    this.client.emit('edit_message', { messageId, channel, newContent, userId });
  }

  deleteMessage(messageId, channel, userId) {
    this.client.emit('delete_message', { messageId, channel, userId });
  }

  pinMessage(messageId, channel, userId) {
    this.client.emit('pin_message', { messageId, channel, userId });
  }

  unpinMessage(messageId, channel, userId) {
    this.client.emit('unpin_message', { messageId, channel, userId });
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

  // ==================== PRIVATE METHODS ====================

  _emitWithResponse(event, params, responseEvent) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.client.off(responseEvent, handler);
        reject(new Error(`Timeout waiting for ${responseEvent}`));
      }, this.timeout);

      const handler = (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      };

      this.client.once(responseEvent, handler);
      this.client.emit(event, params);
    });
  }
}
