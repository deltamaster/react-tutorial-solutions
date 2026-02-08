/**
 * API Client Service
 * Base API client utilities including request queue management and error handling
 */

/**
 * Custom error class for API errors with consistent structure
 */
export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status || null;
    this.statusCode = options.statusCode || options.status || null;
    this.errorType = options.errorType || "api_error";
    this.originalError = options.originalError || null;
    this.details = options.details || {};
  }
}

/**
 * Request queue managers for rate limiting (1 request/second per API)
 */
export class RequestQueue {
  constructor(name) {
    this.name = name;
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minInterval = 2000; // 2 second in milliseconds
  }

  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if needed to maintain 1 request/second rate
      if (timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const { requestFn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();

      const timeStr = new Date().toLocaleString();
      console.log(
        `[apiClient] [${this.name} queue] Request at ${timeStr}`
      );

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}

/**
 * Validate required parameters
 * @param {object} args - Arguments object to validate
 * @param {string[]} requiredParams - Array of required parameter names
 * @returns {object|null} Error object if validation fails, null if valid
 */
export function validateRequiredParams(args, requiredParams) {
  if (!args || typeof args !== 'object') {
    return {
      success: false,
      error: 'Invalid arguments: arguments must be an object',
    };
  }

  for (const param of requiredParams) {
    if (args[param] === undefined || args[param] === null || args[param] === '') {
      return {
        success: false,
        error: `Missing required parameter: ${param}`,
      };
    }
  }

  return null;
}

// Create separate queue instances for each API
export const alphavantageQueue = new RequestQueue('alphavantage');
export const finnhubQueue = new RequestQueue('finnhub');
