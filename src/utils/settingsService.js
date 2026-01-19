/**
 * Settings Service
 * Centralized management for user settings including subscription key, user avatar, system prompt, and thinking toggle.
 */

// Debounce sync to prevent too many requests
let syncConfigTimeout = null;
let syncSystemPromptsTimeout = null;
const SYNC_DEBOUNCE_MS = 2000; // 2 seconds
let isSyncingFromRemote = false; // Flag to prevent sync loops
let isSyncingSystemPrompts = false; // Flag to prevent system prompts sync loops

/**
 * Set flag to indicate we're syncing from remote (prevents loops)
 * @param {boolean} syncing - Whether we're currently syncing from remote
 */
export const setSyncingFromRemote = (syncing) => {
  isSyncingFromRemote = syncing;
};

/**
 * Trigger config sync with debouncing
 * Only syncs if there are local changes (not when syncing from remote)
 */
export const triggerConfigSync = () => {
  // Clear existing timeout
  if (syncConfigTimeout) {
    clearTimeout(syncConfigTimeout);
  }
  
  // Set new timeout
  syncConfigTimeout = setTimeout(async () => {
    // Wait for any in-progress sync to complete before starting a new one
    // Poll every 100ms, max wait 5 seconds
    let waitCount = 0;
    const maxWait = 50; // 50 * 100ms = 5 seconds max wait
    
    while (isSyncingFromRemote && waitCount < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitCount++;
    }
    
    // If still syncing after max wait, skip this sync (another one is in progress)
    if (isSyncingFromRemote) {
      console.log('Config sync skipped - another sync in progress');
      return;
    }
    
    try {
      const profileSyncService = await import('./profileSyncService');
      const configured = await profileSyncService.default.isSyncConfigured();
      if (configured) {
        const result = await profileSyncService.default.syncConfig();
        if (!result.success) {
          console.error('Config sync failed:', result.message);
        } else {
          console.log('Config synced successfully:', result.message);
        }
      }
    } catch (err) {
      console.error('Error syncing config:', err);
    }
  }, SYNC_DEBOUNCE_MS);
};

const STORAGE_KEYS = {
  SUBSCRIPTION_KEY: 'subscriptionKey',
  USER_AVATAR: 'userAvatar',
  SYSTEM_PROMPT: 'systemPrompt', // Legacy key for migration
  SYSTEM_PROMPTS: 'systemPrompts', // New dictionary: {uuidkey: {title: string, prompt: string, lastUpdate: number}}
  SELECTED_SYSTEM_PROMPT_KEY: 'selectedSystemPromptKey', // UUID key of selected system prompt
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
  triggerConfigSync();
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
  triggerConfigSync();
};

/**
 * Ensure a system prompt has lastUpdate field, add if missing
 * @param {Object} prompt - The system prompt object
 * @returns {Object} System prompt with lastUpdate field
 */
const ensureLastUpdate = (prompt) => {
  if (!prompt.lastUpdate) {
    prompt.lastUpdate = Date.now();
  }
  return prompt;
};

/**
 * Migrate old system prompt format to new dictionary format
 * Handles the case where SYSTEM_PROMPT is stored as a plain string (non-JSON)
 */
const migrateSystemPrompt = () => {
  try {
    // Check if old format exists
    const oldPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    
    // Only proceed if old prompt exists and is a non-empty string
    if (oldPrompt && typeof oldPrompt === 'string' && oldPrompt.trim().length > 0) {
      // Check if new format already exists
      const stored = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPTS);
      
      // Only migrate if new format doesn't exist yet
      if (!stored) {
        // Treat oldPrompt as a plain string (not JSON)
        // Create new dictionary format
        const uuid = crypto.randomUUID();
        const prompts = {
          [uuid]: {
            title: 'Untitled',
            prompt: oldPrompt.trim(), // Use the plain string value directly
            lastUpdate: Date.now()
          }
        };
        
        // Save new format
        setSystemPrompts(prompts);
        setSelectedSystemPromptKey(uuid);
        
        // Remove old key after successful migration
        localStorage.removeItem(STORAGE_KEYS.SYSTEM_PROMPT);
      }
    }
  } catch (error) {
    // If migration fails, log error but don't throw
    // This ensures the app continues to work even if migration fails
    console.error('Error migrating system prompt:', error);
  }
};

/**
 * Get all system prompts dictionary from localStorage
 * @returns {Object} Dictionary of system prompts: {uuidkey: {title: string, prompt: string, lastUpdate: number}}
 */
export const getSystemPrompts = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPTS);
    if (!stored) {
      // Try to migrate old format (plain string) to new format (dictionary)
      migrateSystemPrompt();
      // Check again after migration
      const migrated = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPTS);
      if (migrated) {
        try {
          const prompts = JSON.parse(migrated);
          // Ensure all prompts have lastUpdate field
          Object.keys(prompts).forEach(key => {
            prompts[key] = ensureLastUpdate(prompts[key]);
          });
          // Save back if any were updated
          setSystemPrompts(prompts);
          return prompts;
        } catch (parseError) {
          console.error('Error parsing migrated system prompts:', parseError);
          return {};
        }
      }
      return {};
    }
    // Parse the stored JSON dictionary
    try {
      const prompts = JSON.parse(stored);
      let needsUpdate = false;
      // Ensure all prompts have lastUpdate field
      Object.keys(prompts).forEach(key => {
        if (!prompts[key].lastUpdate) {
          prompts[key] = ensureLastUpdate(prompts[key]);
          needsUpdate = true;
        }
      });
      // Save back if any were updated (skip sync to avoid double sync)
      if (needsUpdate) {
        setSystemPrompts(prompts, true); // Skip sync - this is just ensuring metadata
      }
      return prompts;
    } catch (parseError) {
      console.error('Error parsing system prompts from localStorage:', parseError);
      // If parsing fails, try to migrate from old format
      migrateSystemPrompt();
      const migrated = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPTS);
      if (migrated) {
        const prompts = JSON.parse(migrated);
        Object.keys(prompts).forEach(key => {
          prompts[key] = ensureLastUpdate(prompts[key]);
        });
        setSystemPrompts(prompts, true); // Skip sync - migration shouldn't trigger sync
        return prompts;
      }
      return {};
    }
  } catch (error) {
    console.error('Error getting system prompts:', error);
    return {};
  }
};

/**
 * Save all system prompts dictionary to localStorage
 * @param {Object} prompts - Dictionary of system prompts
 * @param {boolean} skipSync - If true, skip triggering sync (used when updating from sync operation)
 */
export const setSystemPrompts = (prompts, skipSync = false) => {
  localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPTS, JSON.stringify(prompts));
  
  // Don't trigger sync if we're already syncing or if skipSync is true
  if (isSyncingSystemPrompts || skipSync) {
    return;
  }
  
  // Debounce sync to prevent multiple rapid calls
  if (syncSystemPromptsTimeout) {
    clearTimeout(syncSystemPromptsTimeout);
  }
  
  syncSystemPromptsTimeout = setTimeout(() => {
    // Double-check flag before syncing
    if (isSyncingSystemPrompts) {
      return;
    }
    
    // Trigger sync to OneDrive if available (async, don't wait)
    import('./profileSyncService').then(profileSyncService => {
      profileSyncService.default.isSyncConfigured().then(configured => {
        if (configured) {
          profileSyncService.default.syncSystemPrompts().catch(err => {
            console.error('Error auto-syncing system prompts:', err);
          });
        }
      }).catch(() => {
        // Ignore errors checking sync configuration
      });
    }).catch(() => {
      // Ignore errors importing profileSyncService
    });
  }, SYNC_DEBOUNCE_MS);
};

/**
 * Set flag to indicate we're syncing system prompts (prevents loops)
 * @param {boolean} syncing - Whether we're currently syncing system prompts
 */
export const setSyncingSystemPrompts = (syncing) => {
  isSyncingSystemPrompts = syncing;
};

/**
 * Get the selected system prompt key from localStorage
 * @returns {string} The UUID key of the selected system prompt or null
 */
export const getSelectedSystemPromptKey = () => {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_SYSTEM_PROMPT_KEY) || null;
};

/**
 * Set the selected system prompt key
 * @param {string} uuidKey - The UUID key of the system prompt to select
 */
export const setSelectedSystemPromptKey = (uuidKey) => {
  if (uuidKey) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_SYSTEM_PROMPT_KEY, uuidKey);
  } else {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_SYSTEM_PROMPT_KEY);
  }
};

/**
 * Get the system prompt from localStorage (returns prompt from selected system prompt)
 * @returns {string} The saved system prompt or empty string if not found
 */
export const getSystemPrompt = () => {
  migrateSystemPrompt(); // Ensure migration happens
  const selectedKey = getSelectedSystemPromptKey();
  if (!selectedKey) {
    return '';
  }
  const prompts = getSystemPrompts();
  const selectedPrompt = prompts[selectedKey];
  return selectedPrompt ? selectedPrompt.prompt : '';
};

/**
 * Save the system prompt to localStorage (updates the selected system prompt)
 * @param {string} prompt - The system prompt to save
 * @param {boolean} skipSync - If true, skip triggering sync (used when loading existing prompt)
 */
export const setSystemPrompt = (prompt, skipSync = false) => {
  migrateSystemPrompt(); // Ensure migration happens
  const selectedKey = getSelectedSystemPromptKey();
  if (!selectedKey) {
    // If no selected key, create a new system prompt
    const uuid = crypto.randomUUID();
    const prompts = getSystemPrompts();
    prompts[uuid] = {
      title: 'Untitled',
      prompt: prompt,
      lastUpdate: Date.now()
    };
    setSystemPrompts(prompts, skipSync);
    setSelectedSystemPromptKey(uuid);
  } else {
    // Update the selected system prompt only if it actually changed
    const prompts = getSystemPrompts();
    if (prompts[selectedKey]) {
      // Check if prompt actually changed before updating
      if (prompts[selectedKey].prompt !== prompt) {
        prompts[selectedKey].prompt = prompt;
        prompts[selectedKey].lastUpdate = Date.now();
        setSystemPrompts(prompts, skipSync);
      } else if (!skipSync) {
        // If prompt didn't change but skipSync is false, still update lastUpdate silently
        // This handles the case where we want to ensure metadata is up to date
        // but don't want to trigger sync if nothing changed
        const currentPrompt = prompts[selectedKey];
        if (!currentPrompt.lastUpdate) {
          prompts[selectedKey].lastUpdate = Date.now();
          setSystemPrompts(prompts, true); // Skip sync since content didn't change
        }
      }
    }
  }
};

/**
 * Add a new system prompt
 * @param {string} title - The title for the system prompt (defaults to 'Untitled')
 * @param {string} prompt - The prompt text
 * @returns {string} The UUID key of the newly created system prompt
 */
export const addSystemPrompt = (title = 'Untitled', prompt = '') => {
  const uuid = crypto.randomUUID();
  const prompts = getSystemPrompts();
  prompts[uuid] = {
    title: title || 'Untitled',
    prompt: prompt,
    lastUpdate: Date.now()
  };
  setSystemPrompts(prompts);
  return uuid;
};

/**
 * Update an existing system prompt
 * @param {string} uuidKey - The UUID key of the system prompt to update
 * @param {string} title - The new title (optional)
 * @param {string} prompt - The new prompt text (optional)
 */
export const updateSystemPrompt = (uuidKey, { title, prompt } = {}) => {
  const prompts = getSystemPrompts();
  if (prompts[uuidKey]) {
    if (title !== undefined) {
      prompts[uuidKey].title = title || 'Untitled';
      prompts[uuidKey].lastUpdate = Date.now();
    }
    if (prompt !== undefined) {
      prompts[uuidKey].prompt = prompt;
      prompts[uuidKey].lastUpdate = Date.now();
    }
    // Ensure lastUpdate exists even if nothing was updated
    if (!prompts[uuidKey].lastUpdate) {
      prompts[uuidKey].lastUpdate = Date.now();
    }
    setSystemPrompts(prompts);
  }
};

/**
 * Delete a system prompt
 * @param {string} uuidKey - The UUID key of the system prompt to delete
 */
export const deleteSystemPrompt = (uuidKey) => {
  const prompts = getSystemPrompts();
  if (prompts[uuidKey]) {
    delete prompts[uuidKey];
    setSystemPrompts(prompts);
    
    // If the deleted prompt was selected, clear selection or select first available
    const selectedKey = getSelectedSystemPromptKey();
    if (selectedKey === uuidKey) {
      const remainingKeys = Object.keys(prompts);
      if (remainingKeys.length > 0) {
        setSelectedSystemPromptKey(remainingKeys[0]);
      } else {
        setSelectedSystemPromptKey(null);
      }
    }
  }
};

/**
 * Get the lastUpdate timestamp from a system prompt
 * @param {string} uuidKey - The UUID key of the system prompt
 * @returns {number} Timestamp, or 0 if not available
 */
export const getSystemPromptLastUpdate = (uuidKey) => {
  const prompts = getSystemPrompts();
  if (prompts[uuidKey] && prompts[uuidKey].lastUpdate) {
    return prompts[uuidKey].lastUpdate;
  }
  return 0;
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
  triggerConfigSync();
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
    systemPrompts: getSystemPrompts(),
    selectedSystemPromptKey: getSelectedSystemPromptKey(),
    thinkingEnabled: getThinkingEnabled(),
    model: getModel(),
    autoSyncEnabled: getAutoSyncEnabled()
  };
};