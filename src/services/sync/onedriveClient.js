/**
 * OneDrive Client Service
 * Handles OneDrive authentication and base API client functionality
 */

import { msalInstance, onedriveScopes, isMsalConfigured, msalConfig } from '../../config/msalConfig';

export const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Cache keys for localStorage
export const CACHE_KEYS = {
  CONVERSATIONS_FOLDER_ID: 'onedrive_conversations_folder_id',
  INDEX_FILE_ID: 'onedrive_conversations_index_file_id',
  LATEST_CONVERSATION_ID: 'onedrive_latest_conversation_id', // Per-device current conversation ID
};

/**
 * Get cached folder/file ID from localStorage
 */
export function getCachedId(cacheKey) {
  return localStorage.getItem(cacheKey);
}

/**
 * Cache folder/file ID in localStorage
 */
export function setCachedId(cacheKey, id) {
  if (id) {
    localStorage.setItem(cacheKey, id);
  } else {
    localStorage.removeItem(cacheKey);
  }
}

/**
 * Clear conversation cache
 */
export function clearConversationCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  // Clear all conversation file IDs
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('onedrive_conversation_') && key.endsWith('_file_id')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Get OneDrive access token from MSAL
 */
export async function getOneDriveAccessToken() {
  if (!isMsalConfigured() || !msalInstance) {
    console.log('getOneDriveAccessToken: MSAL not configured');
    return null;
  }
  // Check both getAllAccounts() and getActiveAccount()
  // For Chrome extensions with manually stored accounts, getActiveAccount() might work
  // even if getAllAccounts() doesn't return anything
  // Wrap in try-catch because MSAL might fail if our manually stored account format doesn't match exactly
  let accounts = [];
  let activeAccount = null;
  try {
    accounts = msalInstance.getAllAccounts();
    activeAccount = msalInstance.getActiveAccount();
  } catch (error) {
    console.warn('isConversationSyncConfigured: Error calling MSAL methods, will check cache:', error);
  }
  
  // If MSAL doesn't find accounts, check cache directly for manually stored accounts
  let account = activeAccount || (accounts.length > 0 ? accounts[0] : null);
  
  if (!account) {
    // Check cache directly for manually stored account
    const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
    const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
    const clientId = msalConfig?.auth?.clientId;
    
    if (clientId) {
      // Check for account list in cache
      const accountListKey = `msal.account.${clientId}`;
      const accountListStr = storage.getItem(accountListKey);
      
      if (accountListStr) {
        try {
          const accountList = JSON.parse(accountListStr);
          if (accountList.length > 0) {
            // Get the first account from cache
            const accountKey = `msal.account.${clientId}.${accountList[0]}`;
            const accountStr = storage.getItem(accountKey);
            if (accountStr) {
              account = JSON.parse(accountStr);
              console.log('getOneDriveAccessToken: Found account in cache:', account);
            }
          }
        } catch (e) {
          console.warn('getOneDriveAccessToken: Failed to parse account from cache:', e);
        }
      }
    }
  }
  
  if (!account) {
    console.log('getOneDriveAccessToken: No account available');
    return null;
  }
  
  // For Chrome extensions, MSAL's acquireTokenSilent uses iframe which is blocked by CSP
  // So we'll use cached tokens directly first
  const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
  const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
  const clientId = msalConfig?.auth?.clientId;
  
  // Try to get access token from cache first
  // The token might be stored with broader scopes (e.g., User.Read Files.ReadWrite)
  // but it will work for OneDrive operations if it includes Files.ReadWrite
  if (clientId && account.homeAccountId) {
    const realm = account.realm || account.tenantId || 'consumers';
    const requiredScopes = onedriveScopes.scopes;
    
    // Try exact scope match first
    let accessTokenKey = `msal.accesstoken.${clientId}.${account.homeAccountId}.${realm}.${requiredScopes.join(' ')}`;
    let cachedTokenStr = storage.getItem(accessTokenKey);
    
    // If not found, search for tokens with broader scopes that include our required scopes
    if (!cachedTokenStr) {
      // Get all MSAL cache keys
      const allKeys = Object.keys(storage);
      const tokenKeys = allKeys.filter(key => 
        key.startsWith(`msal.accesstoken.${clientId}.${account.homeAccountId}.${realm}.`)
      );
      
      // Check each token to see if its scopes include our required scopes
      for (const key of tokenKeys) {
        try {
          const tokenStr = storage.getItem(key);
          if (tokenStr) {
            const token = JSON.parse(tokenStr);
            const tokenScopes = token.target ? token.target.split(' ') : [];
            // Check if token scopes include all required scopes
            const hasRequiredScopes = requiredScopes.every(scope => tokenScopes.includes(scope));
            
            if (hasRequiredScopes) {
              cachedTokenStr = tokenStr;
              accessTokenKey = key;
              console.log('getOneDriveAccessToken: Found token with broader scopes:', tokenScopes);
              break;
            }
          }
        } catch (e) {
          // Skip invalid tokens
        }
      }
    }
    
    if (cachedTokenStr) {
      try {
        const cachedToken = JSON.parse(cachedTokenStr);
        const expiresOn = parseInt(cachedToken.expiresOn, 10);
        const now = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (expiresOn > now + 300000) {
          console.log('getOneDriveAccessToken: Using cached access token');
          return cachedToken.secret;
        } else if (cachedToken.extendedExpiresOn) {
          // Check extended expiry
          const extendedExpiresOn = parseInt(cachedToken.extendedExpiresOn, 10);
          if (extendedExpiresOn > now + 300000) {
            console.log('getOneDriveAccessToken: Using cached access token (extended expiry)');
            return cachedToken.secret;
          }
        }
        
        console.log('getOneDriveAccessToken: Cached token expired');
      } catch (e) {
        console.warn('getOneDriveAccessToken: Failed to parse cached token:', e);
      }
    } else {
      console.log('getOneDriveAccessToken: No cached token found for scopes:', requiredScopes);
    }
  }
  
  // If cached token not available or expired, try MSAL's acquireTokenSilent
  // This will fail for Chrome extensions due to CSP, but we'll catch the error
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...onedriveScopes,
      account: account,
    });
    return response.accessToken;
  } catch (error) {
    // For Chrome extensions, iframe-based silent token acquisition is blocked by CSP
    if (error.message && (error.message.includes('frame-src') || error.message.includes('CSP'))) {
      console.log('getOneDriveAccessToken: Silent token acquisition blocked by CSP (expected for Chrome extensions)');
      // Token refresh would require manual implementation using refresh token
      // For now, user needs to log in again when token expires
      return null;
    }
    
    if (error.errorCode === 'interaction_required' || 
        error.errorCode === 'consent_required' ||
        error.errorCode === 'login_required') {
      try {
        const response = await msalInstance.acquireTokenPopup({
          ...onedriveScopes,
          account: account,
        });
        return response.accessToken;
      } catch (popupError) {
        console.error("Error acquiring OneDrive token via popup:", popupError);
        return null;
      }
    }
    console.error("Error acquiring OneDrive token silently:", error);
    return null;
  }
}

/**
 * Check if OneDrive sync is configured
 */
export async function isConversationSyncConfigured() {
  console.log('[isConversationSyncConfigured] Checking configuration...');
  
  if (!isMsalConfigured() || !msalInstance) {
    console.log('[isConversationSyncConfigured] MSAL not configured or instance missing');
    return false;
  }
  
  // Check both getAllAccounts() and getActiveAccount()
  // For Chrome extensions with manually stored accounts, getActiveAccount() might work
  // even if getAllAccounts() doesn't return anything
  // Wrap in try-catch because MSAL might fail if our manually stored account format doesn't match exactly
  let accounts = [];
  let activeAccount = null;
  try {
    accounts = msalInstance.getAllAccounts();
    activeAccount = msalInstance.getActiveAccount();
  } catch (error) {
    console.warn('isConversationSyncConfigured: Error calling MSAL methods, will check cache:', error);
  }
  console.log('[isConversationSyncConfigured] Accounts found:', accounts.length, 'Active account:', !!activeAccount);
  
  // If MSAL doesn't find accounts, check cache directly for manually stored accounts
  // This handles the case where we manually stored an account for Chrome extensions
  let accountToUse = activeAccount || (accounts.length > 0 ? accounts[0] : null);
  
  if (!accountToUse) {
    // Check cache directly for manually stored account
    const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
    const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
    const clientId = msalConfig?.auth?.clientId;
    
    if (clientId) {
      // Check for account list in cache
      const accountListKey = `msal.account.${clientId}`;
      const accountListStr = storage.getItem(accountListKey);
      
      if (accountListStr) {
        try {
          const accountList = JSON.parse(accountListStr);
          if (accountList.length > 0) {
            // Get the first account from cache
            const accountKey = `msal.account.${clientId}.${accountList[0]}`;
            const accountStr = storage.getItem(accountKey);
            if (accountStr) {
              accountToUse = JSON.parse(accountStr);
              console.log('[isConversationSyncConfigured] Found account in cache:', accountToUse);
            }
          }
        } catch (e) {
          console.warn('[isConversationSyncConfigured] Failed to parse account from cache:', e);
        }
      }
    }
  }
  
  if (!accountToUse) {
    console.log('[isConversationSyncConfigured] No accounts found - user not logged in');
    return false;
  }
  
  try {
    const token = await getOneDriveAccessToken();
    const isAvailable = token !== null;
    console.log('[isConversationSyncConfigured] Token acquired:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('[isConversationSyncConfigured] Error checking token:', error);
    return false;
  }
}
