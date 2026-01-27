import { PublicClientApplication } from "@azure/msal-browser";

// MSAL configuration
// TODO: Replace 'YOUR_CLIENT_ID_HERE' with your actual Azure AD Client ID
const CLIENT_ID = "dd795cb2-a5dd-47f6-a156-ff840409e404"; // Placeholder - replace with your Azure AD Client ID

// Detect iOS devices for cache configuration
const isIOSDevice = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Detect Chrome extension environment
const isChromeExtension = () => {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
};

// Get redirect URI - for Chrome extensions, use a hosted redirect handler page
// This page receives the auth code and communicates back to the extension via postMessage
const getRedirectUri = () => {
  try {
    if (isChromeExtension()) {
      // For Chrome extensions, use a redirect handler page hosted on production domain
      // This page must be registered in Azure AD under "Single-page application" platform
      // The handler page uses postMessage to send auth result back to extension
      // This works for all users who install the extension
      return 'https://answer.hansenh.xyz/auth-redirect.html';
    }
    return window.location.origin;
  } catch (error) {
    console.error('[msalConfig] Error getting redirect URI:', error);
    // Fallback to production domain
    return 'https://answer.hansenh.xyz/auth-redirect.html';
  }
};

// Create config object - don't call getRedirectUri() at module load time
// It will be called when MSAL initializes
export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/consumers", // Use 'consumers' for personal Microsoft accounts (Consumer audience)
    redirectUri: getRedirectUri(), // Redirect URI after login
  },
  cache: {
    // Use localStorage for iOS and Chrome extensions for better persistence
    // sessionStorage can be cleared aggressively, especially in Chrome extensions
    cacheLocation: (isIOSDevice() || isChromeExtension()) ? "localStorage" : "sessionStorage",
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
// Includes both User.Read and Files.ReadWrite so users don't need separate consent
export const loginRequest = {
  scopes: ["User.Read", "Files.ReadWrite"],
};

// OneDrive scopes for profile sync (same as loginRequest, kept for backward compatibility)
export const onedriveScopes = {
  scopes: ["Files.ReadWrite"],
};

// Check if client ID is configured
export const isMsalConfigured = () => {
  return CLIENT_ID && CLIENT_ID !== "YOUR_CLIENT_ID_HERE" && CLIENT_ID.trim() !== "";
};

console.log('[msalConfig] Config created:', {
  clientId: CLIENT_ID,
  redirectUri: msalConfig.auth.redirectUri,
  isConfigured: isMsalConfigured()
});

// Create the main myMSALObj instance
// Only create if client ID is configured
let msalInstance = null;
try {
  if (isMsalConfigured()) {
    console.log('[msalConfig] Creating MSAL instance...');
    msalInstance = new PublicClientApplication(msalConfig);
    console.log('[msalConfig] MSAL instance created successfully');
  } else {
    console.warn('[msalConfig] MSAL not configured - CLIENT_ID is missing or invalid');
  }
} catch (error) {
  console.error('[msalConfig] Error creating MSAL instance:', error);
  msalInstance = null;
}

export { msalInstance };
