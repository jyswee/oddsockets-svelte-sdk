export class OddSocketsError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'OddSocketsError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
