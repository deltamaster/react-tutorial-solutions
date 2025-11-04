/**
 * Settings Service
 * Centralized management for user settings including subscription key, user avatar, system prompt, and thinking toggle.
 */

const STORAGE_KEYS = {
  SUBSCRIPTION_KEY: 'subscriptionKey',
  USER_AVATAR: 'userAvatar',
  SYSTEM_PROMPT: 'systemPrompt',
  THINKING_ENABLED: 'thinkingEnabled'
};

/**
 * Get the subscription key from localStorage
 * @returns {string} The saved subscription key or empty string if not found
 */
export const getSubscriptionKey = () => {
  return localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_KEY) || '';
};

/**
 * Save the subscription key to localStorage
 * @param {string} key - The subscription key to save
 */
export const setSubscriptionKey = (key) => {
  localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_KEY, key);
};

/**
 * Get the user avatar from localStorage
 * @returns {string} The saved user avatar name or empty string if not found
 */
export const getUserAvatar = () => {
  return localStorage.getItem(STORAGE_KEYS.USER_AVATAR) || '';
};

/**
 * Save the user avatar to localStorage
 * @param {string} avatarUrl - The avatar name to save
 */
export const setUserAvatar = (avatarUrl) => {
  localStorage.setItem(STORAGE_KEYS.USER_AVATAR, avatarUrl);
};

/**
 * Get the system prompt from localStorage
 * @returns {string} The saved system prompt or empty string if not found
 */
export const getSystemPrompt = () => {
  return localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || '';
};

/**
 * Save the system prompt to localStorage
 * @param {string} prompt - The system prompt to save
 */
export const setSystemPrompt = (prompt) => {
  localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
};

/**
 * Get the thinking toggle state from localStorage
 * @returns {boolean} The saved thinking toggle state or true by default
 */
export const getThinkingEnabled = () => {
  const savedSetting = localStorage.getItem(STORAGE_KEYS.THINKING_ENABLED);
  return savedSetting === null ? true : savedSetting === 'true';
};

/**
 * Save the thinking toggle state to localStorage
 * @param {boolean} enabled - Whether thinking mode is enabled
 */
export const setThinkingEnabled = (enabled) => {
  localStorage.setItem(STORAGE_KEYS.THINKING_ENABLED, enabled.toString());
};

/**
 * Clear all settings from localStorage
 */
export const clearAllSettings = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * Get all settings as an object
 * @returns {Object} Object containing all current settings
 */
export const getAllSettings = () => {
  return {
    subscriptionKey: getSubscriptionKey(),
    userAvatar: getUserAvatar(),
    systemPrompt: getSystemPrompt(),
    thinkingEnabled: getThinkingEnabled()
  };
};