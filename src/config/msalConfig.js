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
  if (isChromeExtension()) {
    // For Chrome extensions, use a redirect handler page hosted on production domain
    // This page must be registered in Azure AD under "Single-page application" platform
    // The handler page uses postMessage to send auth result back to extension
    // This works for all users who install the extension
    return 'https://answer.hansenh.xyz/auth-redirect.html';
  }
  return window.location.origin;
};

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: "https://login.microsoftonline.com/consumers", // Use 'consumers' for personal Microsoft accounts (Consumer audience)
    redirectUri: getRedirectUri(), // Redirect URI after login
  },
  cache: {
    // Use localStorage on iOS for better persistence (sessionStorage can be cleared aggressively)
    cacheLocation: isIOSDevice() ? "localStorage" : "sessionStorage",
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

// Create the main myMSALObj instance
// Only create if client ID is configured
export const msalInstance = isMsalConfigured() 
  ? new PublicClientApplication(msalConfig)
  : null;
