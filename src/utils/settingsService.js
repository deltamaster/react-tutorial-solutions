/**
 * Settings Service
 * Centralized management for user settings including subscription key, user avatar, system prompt, and thinking toggle.
 */

const STORAGE_KEYS = {
  SUBSCRIPTION_KEY: 'subscriptionKey',
  USER_AVATAR: 'userAvatar',
  SYSTEM_PROMPT: 'systemPrompt',
  THINKING_ENABLED: 'thinkingEnabled',
  MODEL: 'model',
  AUTO_SYNC_ENABLED: 'autoSyncEnabled'
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
 * Get the selected model from localStorage
 * @returns {string} The saved model or "gemini-3-flash-preview" as default
 */
export const getModel = () => {
  return localStorage.getItem(STORAGE_KEYS.MODEL) || 'gemini-3-flash-preview';
};

/**
 * Save the model to localStorage
 * @param {string} model - The model identifier to save
 */
export const setModel = (model) => {
  localStorage.setItem(STORAGE_KEYS.MODEL, model);
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
 * Get the auto-sync enabled state from localStorage
 * @returns {boolean} The saved auto-sync state or false by default
 */
export const getAutoSyncEnabled = () => {
  const savedSetting = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
  return savedSetting === 'true';
};

/**
 * Save the auto-sync enabled state to localStorage
 * @param {boolean} enabled - Whether auto-sync is enabled
 */
export const setAutoSyncEnabled = (enabled) => {
  localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled.toString());
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
    thinkingEnabled: getThinkingEnabled(),
    model: getModel(),
    autoSyncEnabled: getAutoSyncEnabled()
  };
};