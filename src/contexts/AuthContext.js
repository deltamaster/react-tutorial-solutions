import React, { createContext, useContext, useState, useEffect } from "react";
import { msalInstance, loginRequest, onedriveScopes, isMsalConfigured, msalConfig } from "../config/msalConfig";
import * as msal from "@azure/msal-browser";
import profileSyncService from "../utils/profileSyncService";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const hasSyncedAfterLoginRef = React.useRef(false); // Track if we've synced after login

  useEffect(() => {
    console.log('[AuthContext] useEffect started');
    
    // Helper function to detect iOS devices
    const isIOSDevice = () => {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    // Helper function to detect Chrome extension environment
    const isChromeExtension = () => {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    };

    // Check if MSAL is configured
    const configured = isMsalConfigured();
    console.log('[AuthContext] MSAL configured:', configured, 'msalInstance:', !!msalInstance);
    setIsConfigured(configured);

    if (!configured || !msalInstance) {
      console.log('[AuthContext] MSAL not configured or instance is null, setting isLoading to false');
      setIsLoading(false);
      return;
    }
    
    console.log('[AuthContext] MSAL instance exists, proceeding with initialization');

    // For Chrome extensions, listen for postMessage from auth redirect handler
    let messageHandler = null;
    if (isChromeExtension()) {
      messageHandler = async (event) => {
        // Only accept messages from our redirect handler domain
        if (event.origin !== 'https://answer.hansenh.xyz') {
          return;
        }

        if (event.data && event.data.type === 'msal:auth-result') {
          // We received auth result from redirect handler
          // Update the URL hash so MSAL can process it
          const currentHash = window.location.hash;
          window.location.hash = event.data.hash;
          
          // Give MSAL a moment to process, then handle redirect promise
          setTimeout(async () => {
            try {
              const redirectResponse = await msalInstance.handleRedirectPromise();
              if (redirectResponse) {
                setUser(redirectResponse.account);
                setIsAuthenticated(true);
                setIsLoading(false);
                
                // Clear hash
                if (window.history && window.history.replaceState) {
                  window.history.replaceState(null, '', window.location.pathname);
                }
              }
            } catch (error) {
              console.error('[AuthContext] Error handling redirect from postMessage:', error);
              setIsLoading(false);
            }
          }, 100);
        } else if (event.data && event.data.type === 'msal:auth-error') {
          console.error('[AuthContext] Auth error from redirect handler:', event.data.error, event.data.errorDescription);
          setIsLoading(false);
        }
      };

      window.addEventListener('message', messageHandler);
    }

    // Check if we're coming back from a redirect (check URL for hash or query params)
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hasRedirectParams = hash.includes('code=') || hash.includes('access_token=') || hash.includes('id_token=') || urlParams.has('code');
    
    console.log('[AuthContext] Initializing MSAL, redirect params detected:', hasRedirectParams, { hash, search: window.location.search });

    // Initialize MSAL with proper error handling
    let initCompleted = false;
    
    const initializeMSAL = async () => {
      try {
        console.log('[AuthContext] Calling msalInstance.initialize()...');
        await msalInstance.initialize();
        console.log('[AuthContext] MSAL initialized successfully');
        initCompleted = true;
        
        // Handle redirect response
        try {
          const redirectResponse = await msalInstance.handleRedirectPromise();
          console.log('[AuthContext] Redirect promise result:', redirectResponse ? 'SUCCESS' : 'NO_RESPONSE', redirectResponse);
          
          if (redirectResponse) {
            // User just completed redirect login
            console.log('[AuthContext] Redirect login successful, account:', redirectResponse.account);
            setUser(redirectResponse.account);
            setIsAuthenticated(true);
            setIsLoading(false);
            
            // Trigger config sync after redirect login (only once)
            if (!hasSyncedAfterLoginRef.current) {
              hasSyncedAfterLoginRef.current = true;
              try {
                const configured = await profileSyncService.isSyncConfigured();
                if (configured) {
                  await profileSyncService.syncConfig();
                  await profileSyncService.syncSystemPrompts();
                }
              } catch (err) {
                console.error('Error syncing after redirect login:', err);
              }
            }
            
            // Clear URL hash/params
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }
            return; // Exit early
          }
        } catch (redirectError) {
          console.error("[AuthContext] Redirect error:", redirectError?.errorCode || redirectError?.message, redirectError);
        }
        
        // Check if user is already logged in (cached account)
        // For Chrome extensions, check cache directly first to avoid MSAL errors
        // MSAL's getAllAccounts() might fail if our manually stored account format doesn't match exactly
        let accounts = [];
        let account = null;
        
        // For Chrome extensions, check cache first to avoid MSAL errors
        if (isChromeExtension()) {
          try {
            const cacheLocation = msalConfig.cache.cacheLocation || 'localStorage';
            const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
            const clientId = msalConfig.auth.clientId;
            
            if (clientId) {
              const accountListKey = `msal.account.${clientId}`;
              const accountListStr = storage.getItem(accountListKey);
              
              if (accountListStr) {
                try {
                  const accountList = JSON.parse(accountListStr);
                  if (accountList.length > 0) {
                    const accountKey = `msal.account.${clientId}.${accountList[0]}`;
                    const accountStr = storage.getItem(accountKey);
                    if (accountStr) {
                      account = JSON.parse(accountStr);
                      console.log('[AuthContext] Found account in cache for auto-login:', account.username);
                    }
                  }
                } catch (e) {
                  console.warn('[AuthContext] Failed to parse account from cache:', e);
                }
              }
            }
          } catch (e) {
            console.warn('[AuthContext] Error checking cache for account:', e);
          }
        }
        
        // Only call getAllAccounts() if we didn't find account in cache (to avoid MSAL errors)
        if (!account) {
          try {
            accounts = msalInstance.getAllAccounts();
            account = accounts.length > 0 ? accounts[0] : null;
          } catch (error) {
            console.warn('[AuthContext] Error calling getAllAccounts(), will use cache:', error);
            // If getAllAccounts() fails, we'll rely on cache check above
            accounts = [];
          }
        }
        
        // For Chrome extensions, check cache directly if MSAL doesn't find accounts
        if (!account && isChromeExtension()) {
          console.log('[AuthContext] MSAL did not find accounts, checking cache directly for Chrome extension...');
          const cacheLocation = msalConfig.cache.cacheLocation || 'localStorage';
          const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
          const clientId = msalConfig.auth.clientId;
          
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
                    console.log('[AuthContext] Found account in cache for auto-login:', account.username);
                    
                    // Set as active account so MSAL knows about it
                    msalInstance.setActiveAccount(account);
                  }
                }
              } catch (e) {
                console.warn('[AuthContext] Failed to parse account from cache:', e);
              }
            }
          }
        }
        
        console.log('[AuthContext] All accounts after initialization:', accounts.length, accounts);
        console.log('[AuthContext] Account for auto-login:', account ? account.username : 'none');
        
        if (account) {
          console.log('[AuthContext] Found account, attempting silent token acquisition:', account.username);
          
          // For Chrome extensions, try to use cached token first
          if (isChromeExtension()) {
            const cacheLocation = msalConfig.cache.cacheLocation || 'localStorage';
            const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
            const clientId = msalConfig.auth.clientId;
            const realm = account.realm || account.tenantId || 'consumers';
            
            // Try to get cached access token
            const accessTokenKey = `msal.accesstoken.${clientId}.${account.homeAccountId}.${realm}.${loginRequest.scopes.join(' ')}`;
            const cachedTokenStr = storage.getItem(accessTokenKey);
            
            if (cachedTokenStr) {
              try {
                const cachedToken = JSON.parse(cachedTokenStr);
                const expiresOn = parseInt(cachedToken.expiresOn, 10);
                const now = Date.now();
                
                // Check if token is still valid (with 5 minute buffer)
                if (expiresOn > now + 300000) {
                  console.log('[AuthContext] Using cached access token for auto-login');
                  setUser(account);
                  setIsAuthenticated(true);
                  setIsLoading(false);
                  
                  // Trigger config sync
                  if (!hasSyncedAfterLoginRef.current) {
                    hasSyncedAfterLoginRef.current = true;
                    try {
                      const configured = await profileSyncService.isSyncConfigured();
                      if (configured) {
                        await profileSyncService.syncConfig();
                        await profileSyncService.syncSystemPrompts();
                      }
                    } catch (err) {
                      console.error('Error syncing after auto-login:', err);
                    }
                  }
                  return; // Exit early, we're done
                } else {
                  console.log('[AuthContext] Cached token expired, will try to refresh');
                }
              } catch (e) {
                console.warn('[AuthContext] Failed to parse cached token:', e);
              }
            }
          }
          
          // Try MSAL's acquireTokenSilent (will fail for Chrome extensions due to CSP, but try anyway)
          try {
            const response = await msalInstance.acquireTokenSilent({
              ...loginRequest,
              account: account,
            });
            console.log('[AuthContext] Silent token acquisition successful');
            setUser(response.account);
            setIsAuthenticated(true);
            setIsLoading(false);
            
            // Trigger config sync
            if (!hasSyncedAfterLoginRef.current) {
              hasSyncedAfterLoginRef.current = true;
              try {
                const configured = await profileSyncService.isSyncConfigured();
                if (configured) {
                  await profileSyncService.syncConfig();
                  await profileSyncService.syncSystemPrompts();
                }
              } catch (err) {
                console.error('Error syncing after silent login:', err);
              }
            }
          } catch (error) {
            // For Chrome extensions, iframe-based silent token acquisition is blocked by CSP
            // But we already tried cached token above, so if we get here, token might be expired
            if (isChromeExtension() && (error.message?.includes('frame-src') || error.message?.includes('CSP') || error.message?.includes('timeout'))) {
              console.log('[AuthContext] Silent token acquisition blocked by CSP (expected for Chrome extensions)');
              // If we have a cached account but token is expired, user needs to log in again
              // But we can still set them as logged in if we have the account
              if (account) {
                console.log('[AuthContext] Setting user as authenticated based on cached account (token may need refresh)');
                setUser(account);
                setIsAuthenticated(true);
                setIsLoading(false);
              } else {
                setIsLoading(false);
              }
            } else {
              console.log("Silent login not possible:", error.errorCode || error.message);
              setIsLoading(false);
            }
          }
        } else {
          // No cached account found - skip ssoSilent for Chrome extensions
          if (isIOSDevice() || isChromeExtension()) {
            console.log("iOS/Chrome extension detected - skipping ssoSilent");
            setIsLoading(false);
          } else {
            // Try silent SSO login on other platforms
            try {
              const response = await msalInstance.ssoSilent({
                ...loginRequest,
                loginHint: undefined,
              });
              setUser(response.account);
              setIsAuthenticated(true);
              setIsLoading(false);
            } catch (error) {
              console.log("Silent SSO login not possible:", error.errorCode || error.message);
              setIsLoading(false);
            }
          }
        }
      } catch (error) {
        console.error("[AuthContext] MSAL initialization error:", error);
        setIsLoading(false);
      } finally {
        // Ensure isLoading is false even if something goes wrong
        if (!initCompleted) {
          console.warn('[AuthContext] Initialization did not complete, setting isLoading to false');
          setIsLoading(false);
        }
      }
    };

    // Start initialization
    initializeMSAL().catch((error) => {
      console.error("[AuthContext] Fatal error in initializeMSAL:", error);
      setIsLoading(false);
    });

    // Cleanup function
    return () => {
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
      }
    };
  }, []);

  const login = async () => {
    if (!isConfigured || !msalInstance) {
      throw new Error("MSAL is not configured. Please set your Azure AD Client ID in msalConfig.js");
    }
    
    // Helper function to detect iOS devices
    const isIOSDevice = () => {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };
    
    // Helper function to detect Chrome extension environment
    const isChromeExtension = () => {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    };
    
    try {
      if (isIOSDevice()) {
        // On iOS, use redirect flow (more reliable than popup)
        await msalInstance.loginRedirect(loginRequest);
        // Note: After redirect, handleRedirectPromise() in useEffect will handle the response
        return;
      } else if (isChromeExtension()) {
        // For Chrome extensions, manually handle popup flow with PKCE
        // MSAL's loginPopup doesn't work well with cross-origin redirects
        return new Promise((resolve, reject) => {
          // Generate PKCE code verifier and challenge
          // Code verifier: random URL-safe string, 43-128 characters
          const generateCodeVerifier = () => {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return btoa(String.fromCharCode(...array))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');
          };
          
          // Code challenge: SHA256 hash of verifier, base64url encoded
          const generateCodeChallenge = async (verifier) => {
            const encoder = new TextEncoder();
            const data = encoder.encode(verifier);
            const digest = await crypto.subtle.digest('SHA-256', data);
            return btoa(String.fromCharCode(...new Uint8Array(digest)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');
          };
          
          // Generate PKCE values
          const codeVerifier = generateCodeVerifier();
          
          // Generate code challenge and set up login flow
          generateCodeChallenge(codeVerifier).then((codeChallenge) => {
            // Create a promise that will be resolved when we get the auth result via postMessage
            const loginPromise = new Promise((innerResolve, innerReject) => {
              const timeout = setTimeout(() => {
                innerReject(new Error('Login timeout - popup did not respond'));
              }, 300000); // 5 minute timeout
              
              const messageHandler = async (event) => {
                // Only accept messages from our redirect handler domain
                if (event.origin !== 'https://answer.hansenh.xyz') {
                  return;
                }
                
                if (event.data && event.data.type === 'msal:auth-result') {
                  clearTimeout(timeout);
                  window.removeEventListener('message', messageHandler);
                  
                  try {
                    // Parse the hash to get the auth code
                    const hash = event.data.hash;
                    const params = new URLSearchParams(hash);
                    const code = params.get('code');
                    const state = params.get('state');
                    
                    if (!code) {
                      throw new Error('No authorization code received');
                    }
                    
                    // Exchange the code for tokens using PKCE
                    const tokenEndpoint = `https://login.microsoftonline.com/consumers/oauth2/v2.0/token`;
                    const redirectUri = 'https://answer.hansenh.xyz/auth-redirect.html';
                    
                    // Include 'openid' scope to get ID token
                    const scopes = ['openid', ...loginRequest.scopes];
                    
                    const tokenResponse = await fetch(tokenEndpoint, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      body: new URLSearchParams({
                        client_id: msalConfig.auth.clientId,
                        code: code,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                        code_verifier: codeVerifier, // PKCE: include code verifier
                        scope: scopes.join(' '),
                      }),
                    });
                    
                    if (!tokenResponse.ok) {
                      const errorText = await tokenResponse.text();
                      throw new Error(`Token exchange failed: ${errorText}`);
                    }
                    
                    const tokens = await tokenResponse.json();
                    console.log('[AuthContext] Token response:', tokens);
                    
                    // Check if we got access token
                    if (!tokens.access_token) {
                      throw new Error(`No access token in response: ${JSON.stringify(tokens)}`);
                    }
                  
                  // Fetch user info from Microsoft Graph API using access token
                  console.log('[AuthContext] Fetching user info from Graph API');
                  const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: {
                      'Authorization': `Bearer ${tokens.access_token}`,
                    },
                  });
                  
                  if (!graphResponse.ok) {
                    throw new Error(`Failed to fetch user info: ${await graphResponse.text()}`);
                  }
                  
                  const userInfo = await graphResponse.json();
                  console.log('[AuthContext] User info from Graph API:', userInfo);
                  
                  // Create account object from Graph API response
                  // Use userInfo.id as the account identifier
                  const account = {
                    homeAccountId: `${userInfo.id}.consumers`,
                    environment: 'login.microsoftonline.com',
                    tenantId: 'consumers',
                    username: userInfo.userPrincipalName || userInfo.mail || userInfo.displayName,
                    localAccountId: userInfo.id,
                    name: userInfo.displayName,
                  };
                  
                  // Store tokens in MSAL cache by calling acquireTokenSilent
                  // First, we need to set the account in MSAL's cache
                  // MSAL doesn't expose a direct way to set tokens, so we'll use a workaround
                  // We can use the account to acquire tokens silently, which will cache them
                  
                  // Actually, MSAL should handle this if we set the account properly
                  // Let's use MSAL's setActiveAccount and then try to get tokens
                  msalInstance.setActiveAccount(account);
                  
                  // Try to acquire token silently - this should use the cached tokens
                  // But first we need to manually add tokens to cache
                  // Since MSAL doesn't expose cache manipulation, we'll use acquireTokenSilent
                  // which will fail, then fall back to interactive, OR we manually add to cache
                  
                  // Actually, the best approach is to use MSAL's handleRedirectPromise with the tokens
                  // But that expects a redirect response format
                  
                  // Let's try a different approach: use MSAL's internal cache
                  // We'll construct a response object similar to what handleRedirectPromise returns
                  const authResponse = {
                    account: account,
                    accessToken: tokens.access_token,
                    idToken: tokens.id_token,
                    scopes: loginRequest.scopes,
                    expiresOn: new Date(Date.now() + (tokens.expires_in * 1000)),
                    tenantId: account.tenantId,
                  };
                  
                  // Store tokens in MSAL's cache format
                  // MSAL uses a specific cache structure - we need to store account and tokens
                  // For Chrome extensions, use localStorage for persistence (auto-login)
                  const cacheLocation = isChromeExtension() ? 'localStorage' : (msalConfig.cache.cacheLocation || 'sessionStorage');
                  const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
                  const clientId = msalConfig.auth.clientId;
                  
                  // MSAL cache key format - MSAL v2 uses a specific structure
                  // The cache key includes the clientId and homeAccountId
                  const accountKey = `msal.account.${clientId}.${account.homeAccountId}`;
                  const idTokenKey = `msal.idtoken.${clientId}.${account.homeAccountId}.${account.tenantId}`;
                  const accessTokenKey = `msal.accesstoken.${clientId}.${account.homeAccountId}.${account.tenantId}.${loginRequest.scopes.join(' ')}`;
                  
                  // Parse ID token claims if available
                  let idTokenClaims = null;
                  if (tokens.id_token) {
                    try {
                      const idTokenParts = tokens.id_token.split('.');
                      if (idTokenParts.length === 3) {
                        idTokenClaims = JSON.parse(atob(idTokenParts[1]));
                      }
                    } catch (e) {
                      console.warn('[AuthContext] Failed to parse ID token for claims:', e);
                    }
                  }
                  
                  if (!idTokenClaims) {
                    // Create synthetic claims from Graph API user info
                    idTokenClaims = {
                      sub: userInfo.id,
                      oid: userInfo.id,
                      tid: 'consumers',
                      preferred_username: account.username,
                      name: account.name,
                      aud: clientId, // Audience should be the client ID
                      iss: 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0', // Issuer for consumers tenant
                      iat: Math.floor(Date.now() / 1000),
                      exp: Math.floor(Date.now() / 1000) + 3600,
                    };
                  }
                  
                  // Store account in MSAL's exact format
                  // MSAL v2 AccountEntity structure - must match exactly what MSAL expects
                  const accountCacheEntry = {
                    homeAccountId: account.homeAccountId,
                    environment: account.environment,
                    realm: account.tenantId, // MSAL uses 'realm' instead of 'tenantId' in cache
                    localAccountId: account.localAccountId,
                    username: account.username,
                    name: account.name,
                    authorityType: 'MSSTS',
                    clientInfo: btoa(JSON.stringify({
                      uid: userInfo.id,
                      utid: 'consumers'
                    })),
                    lastModificationTime: Date.now().toString(),
                    lastModificationApp: clientId,
                    // MSAL v2 expects tenantProfiles object
                    tenantProfiles: {
                      [account.tenantId]: {
                        localAccountId: account.localAccountId,
                        name: account.name,
                        isHomeTenant: true,
                      }
                    },
                  };
                  
                  storage.setItem(accountKey, JSON.stringify(accountCacheEntry));
                  console.log('[AuthContext] Stored account in cache:', accountKey, accountCacheEntry);
                  
                  // Store ID token (if we have one) - not required but helps MSAL
                  if (tokens.id_token) {
                    try {
                      const idTokenParts = tokens.id_token.split('.');
                      if (idTokenParts.length === 3) {
                        const idTokenPayload = JSON.parse(atob(idTokenParts[1]));
                        const idTokenExpiresOn = new Date((idTokenPayload.exp || (Date.now() / 1000 + 3600)) * 1000).getTime();
                        storage.setItem(idTokenKey, JSON.stringify({
                          homeAccountId: account.homeAccountId,
                          environment: account.environment,
                          credentialType: 'IdToken',
                          clientId: clientId,
                          secret: tokens.id_token,
                          target: loginRequest.scopes.join(' '),
                          expiresOn: idTokenExpiresOn.toString(),
                          extendedExpiresOn: idTokenExpiresOn.toString(),
                        }));
                      }
                    } catch (e) {
                      console.warn('[AuthContext] Failed to parse ID token:', e);
                    }
                  }
                  
                  // Store access token
                  const accessTokenExpiresOn = Date.now() + (tokens.expires_in * 1000);
                  storage.setItem(accessTokenKey, JSON.stringify({
                    homeAccountId: account.homeAccountId,
                    environment: account.environment,
                    credentialType: 'AccessToken',
                    clientId: clientId,
                    secret: tokens.access_token,
                    target: loginRequest.scopes.join(' '),
                    expiresOn: accessTokenExpiresOn.toString(),
                    extendedExpiresOn: accessTokenExpiresOn.toString(),
                    tokenType: tokens.token_type || 'Bearer',
                  }));
                  
                  // Also store access token for OneDrive scopes separately
                  // This ensures getOneDriveAccessToken can find it
                  const onedriveScopesStr = onedriveScopes.scopes.join(' ');
                  const onedriveAccessTokenKey = `msal.accesstoken.${clientId}.${account.homeAccountId}.${account.tenantId}.${onedriveScopesStr}`;
                  // If the scopes match, we can reuse the same token
                  // Otherwise, we'd need to acquire a new token with OneDrive scopes
                  if (loginRequest.scopes.join(' ') === onedriveScopesStr) {
                    storage.setItem(onedriveAccessTokenKey, JSON.stringify({
                      homeAccountId: account.homeAccountId,
                      environment: account.environment,
                      credentialType: 'AccessToken',
                      clientId: clientId,
                      secret: tokens.access_token,
                      target: onedriveScopesStr,
                      expiresOn: accessTokenExpiresOn.toString(),
                      extendedExpiresOn: accessTokenExpiresOn.toString(),
                      tokenType: tokens.token_type || 'Bearer',
                    }));
                  }
                  
                  // Store refresh token if available (for manual token refresh)
                  if (tokens.refresh_token) {
                    const refreshTokenKey = `msal.refreshtoken.${clientId}.${account.homeAccountId}.${account.tenantId}`;
                    storage.setItem(refreshTokenKey, JSON.stringify({
                      homeAccountId: account.homeAccountId,
                      environment: account.environment,
                      credentialType: 'RefreshToken',
                      clientId: clientId,
                      secret: tokens.refresh_token,
                      target: loginRequest.scopes.join(' '),
                    }));
                    console.log('[AuthContext] Stored refresh token');
                  }
                  
                  // Force MSAL to reload its cache by re-initializing
                  // Actually, MSAL reads from cache on getAllAccounts(), so we need to ensure
                  // the cache format matches exactly. Let's try setting active account first
                  msalInstance.setActiveAccount(account);
                  
                  // MSAL v2 maintains an account list index for getAllAccounts()
                  // We need to add our account to this list
                  const accountListKey = `msal.account.${clientId}`;
                  let accountList = [];
                  try {
                    const existingList = storage.getItem(accountListKey);
                    if (existingList) {
                      accountList = JSON.parse(existingList);
                    }
                  } catch (e) {
                    console.warn('[AuthContext] Failed to parse account list:', e);
                  }
                  
                  // Add our account ID to the list if not already present
                  if (!accountList.includes(account.homeAccountId)) {
                    accountList.push(account.homeAccountId);
                    storage.setItem(accountListKey, JSON.stringify(accountList));
                    console.log('[AuthContext] Updated account list:', accountListKey, accountList);
                  }
                  
                  // Check if MSAL can see the account now
                  const accounts = msalInstance.getAllAccounts();
                  console.log('[AuthContext] MSAL accounts after storage:', accounts.length, accounts);
                  
                  if (accounts.length === 0) {
                    console.warn('[AuthContext] MSAL still did not find account');
                    // MSAL might need a page reload to recognize the account
                    // For now, we'll proceed with setActiveAccount which should work
                  }
                  
                  setUser(account);
                  setIsAuthenticated(true);
                  
                  // Trigger config sync
                  if (!hasSyncedAfterLoginRef.current) {
                    hasSyncedAfterLoginRef.current = true;
                    try {
                      const configured = await profileSyncService.isSyncConfigured();
                      if (configured) {
                        await profileSyncService.syncConfig();
                        await profileSyncService.syncSystemPrompts();
                      }
                    } catch (err) {
                      console.error('Error syncing after login:', err);
                    }
                  }
                  
                    innerResolve(authResponse);
                  } catch (error) {
                    console.error('[AuthContext] Error processing auth result:', error);
                    innerReject(error);
                  }
                } else if (event.data && event.data.type === 'msal:auth-error') {
                  clearTimeout(timeout);
                  window.removeEventListener('message', messageHandler);
                  innerReject(new Error(event.data.errorDescription || event.data.error));
                }
              };
              
              window.addEventListener('message', messageHandler);
            });
            
            // Open popup to Azure AD login with PKCE
            const authUrl = new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
            authUrl.searchParams.set('client_id', msalConfig.auth.clientId);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('redirect_uri', 'https://answer.hansenh.xyz/auth-redirect.html');
            authUrl.searchParams.set('response_mode', 'fragment');
            // Include 'openid' scope to get ID token
            const scopes = ['openid', ...loginRequest.scopes];
            authUrl.searchParams.set('scope', scopes.join(' '));
            authUrl.searchParams.set('state', Math.random().toString(36).substring(7));
            authUrl.searchParams.set('code_challenge', codeChallenge); // PKCE: include code challenge
            authUrl.searchParams.set('code_challenge_method', 'S256'); // PKCE: SHA256 method
            
            const popup = window.open(
              authUrl.toString(),
              'msal-login',
              'width=500,height=600,left=100,top=100'
            );
            
            if (!popup) {
              reject(new Error('Popup blocked. Please allow popups for this site.'));
              return;
            }
            
            // Wait for the login promise
            loginPromise
              .then((response) => {
                popup.close();
                resolve(response);
              })
              .catch((error) => {
                popup.close();
                reject(error);
              });
          }).catch((error) => {
            reject(error);
          });
        });
      } else {
        // On other platforms, use standard popup flow
        const response = await msalInstance.loginPopup(loginRequest);
        setUser(response.account);
        setIsAuthenticated(true);
        
        // Trigger config sync after manual login (only once)
        if (!hasSyncedAfterLoginRef.current) {
          hasSyncedAfterLoginRef.current = true;
          try {
            const configured = await profileSyncService.isSyncConfigured();
            if (configured) {
              await profileSyncService.syncConfig();
              await profileSyncService.syncSystemPrompts();
            }
          } catch (err) {
            console.error('Error syncing after manual login:', err);
          }
        }
        
        return response;
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    if (!isConfigured || !msalInstance || !user) {
      return;
    }
    try {
      await msalInstance.logoutPopup({
        account: user,
      });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const getAccessToken = async () => {
    if (!isConfigured || !msalInstance || !user) {
      return null;
    }
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: user,
      });
      return response.accessToken;
    } catch (error) {
      console.error("Error acquiring token silently:", error);
      // If silent token acquisition fails, try interactive
      try {
        const response = await msalInstance.acquireTokenPopup({
          ...loginRequest,
          account: user,
        });
        return response.accessToken;
      } catch (popupError) {
        console.error("Error acquiring token via popup:", popupError);
        return null;
      }
    }
  };

  const requestOneDriveConsent = async () => {
    if (!isConfigured || !msalInstance || !user) {
      throw new Error("User must be logged in to request OneDrive access");
    }
    try {
      // First try silent acquisition - if it works, no need to prompt
      try {
        const silentResponse = await msalInstance.acquireTokenSilent({
          ...onedriveScopes,
          account: user,
        });
        return silentResponse.accessToken;
      } catch (silentError) {
        // Only prompt if silent acquisition failed due to consent issues
        if (silentError.errorCode === 'interaction_required' || 
            silentError.errorCode === 'consent_required' ||
            silentError.errorCode === 'login_required') {
          const response = await msalInstance.acquireTokenPopup({
            ...onedriveScopes,
            account: user,
          });
          return response.accessToken;
        }
        // Re-throw if it's a different error
        throw silentError;
      }
    } catch (error) {
      console.error("Error requesting OneDrive consent:", error);
      throw error;
    }
  };

  const getOneDriveAccessToken = async () => {
    if (!isConfigured || !msalInstance || !user) {
      return null;
    }
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...onedriveScopes,
        account: user,
      });
      return response.accessToken;
    } catch (error) {
      // Check if this is a consent-related error that requires user interaction
      if (error.errorCode === 'interaction_required' || 
          error.errorCode === 'consent_required' ||
          error.errorCode === 'login_required') {
        // Try interactive acquisition only if consent is needed
        try {
          console.log("OneDrive consent required, requesting interactively...");
          const response = await msalInstance.acquireTokenPopup({
            ...onedriveScopes,
            account: user,
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
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    isLoading,
    isConfigured,
    getAccessToken,
    requestOneDriveConsent,
    getOneDriveAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
