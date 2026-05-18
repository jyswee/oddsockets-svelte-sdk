export const MessageTypes = {
  chatMessage(text, username, messageType = 'chat') {
    return {
      type: messageType,
      text,
      username,
      timestamp: new Date().toISOString()
    };
  },
  
  notificationMessage(title, body, category = 'general', priority = 'normal', data = null) {
    return {
      type: 'notification',
      title,
      body,
      category,
      priority,
      data,
      timestamp: new Date().toISOString()
    };
  },
  
  systemMessage(action, data = null) {
    return {
      type: 'system',
      action,
      data,
      timestamp: new Date().toISOString()
    };
  },
  
  presenceMessage(userId, status, metadata = null) {
    return {
      type: 'presence',
      userId,
      status,
      metadata,
      timestamp: new Date().toISOString()
    };
  }
};
