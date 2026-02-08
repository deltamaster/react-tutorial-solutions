/**
 * API Cache Service
 * Caching logic for API responses
 */

// API response cache - key: cache key string, value: cached response
const apiCache = new Map();

/**
 * Generate a cache key from API endpoint/function and parameters
 * @param {string} apiType - 'alphavantage' or 'finnhub'
 * @param {string} endpoint - API endpoint or function name
 * @param {object} params - API parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(apiType, endpoint, params) {
  // Sort parameters to ensure consistent cache keys regardless of parameter order
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key];
      // Only include defined values in cache key
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {});
  
  // Create a deterministic string representation
  const paramsString = JSON.stringify(sortedParams);
  return `${apiType}:${endpoint}:${paramsString}`;
}

/**
 * Get cached response if available
 * @param {string} cacheKey - Cache key
 * @returns {object|undefined} Cached response or undefined
 */
export function getCachedResponse(cacheKey) {
  return apiCache.get(cacheKey);
}

/**
 * Set cached response
 * @param {string} cacheKey - Cache key
 * @param {object} response - Response to cache
 */
export function setCachedResponse(cacheKey, response) {
  apiCache.set(cacheKey, response);
}

/**
 * Check if cache has a key
 * @param {string} cacheKey - Cache key
 * @returns {boolean} True if cache has the key
 */
export function hasCachedResponse(cacheKey) {
  return apiCache.has(cacheKey);
}

/**
 * Clear all cached responses
 */
export function clearCache() {
  apiCache.clear();
}

/**
 * Clear cache for a specific API type
 * @param {string} apiType - 'alphavantage' or 'finnhub'
 */
export function clearCacheForApi(apiType) {
  for (const [key] of apiCache) {
    if (key.startsWith(`${apiType}:`)) {
      apiCache.delete(key);
    }
  }
}
