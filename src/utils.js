export const Utils = {
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  },
  
  validateChannelName(name) {
    return typeof name === 'string' && name.length > 0 && name.length <= 100;
  },
  
  sanitizeMessage(message) {
    if (typeof message === 'string') {
      return message.trim();
    }
    return message;
  }
};
