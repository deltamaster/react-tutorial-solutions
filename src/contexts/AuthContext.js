import React, { createContext, useContext, useState, useEffect } from "react";
import { msalInstance, loginRequest, onedriveScopes, isMsalConfigured } from "../config/msalConfig";
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
    setIsConfigured(configured);

    if (!configured || !msalInstance) {
      setIsLoading(false);
      return;
    }

    // For Chrome extensions, listen for postMessage from auth redirect handler
    if (isChromeExtension()) {
      const handleMessage = async (event) => {
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
            }
          }, 100);
        } else if (event.data && event.data.type === 'msal:auth-error') {
          console.error('[AuthContext] Auth error from redirect handler:', event.data.error, event.data.errorDescription);
          setIsLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }

    // Check if we're coming back from a redirect (check URL for hash or query params)
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hasRedirectParams = hash.includes('code=') || hash.includes('access_token=') || hash.includes('id_token=') || urlParams.has('code');
    
    console.log('[AuthContext] Initializing MSAL, redirect params detected:', hasRedirectParams, { hash, search: window.location.search });

    // Initialize MSAL
    msalInstance
      .initialize()
      .then(async () => {
        console.log('[AuthContext] MSAL initialized, handling redirect promise...');
        
        // Handle redirect response first (for iOS and Chrome extension redirect flow)
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
                  console.log('Redirect login successful, triggering config and system prompts sync...');
                  // Sync config
                  const configResult = await profileSyncService.syncConfig();
                  if (configResult.success) {
                    console.log('Config synced after redirect login:', configResult.message);
                  } else {
                    console.error('Config sync failed after redirect login:', configResult.message);
                  }
                  // Sync system prompts
                  const promptsResult = await profileSyncService.syncSystemPrompts();
                  if (promptsResult.success) {
                    console.log('System prompts synced after redirect login:', promptsResult.message);
                  } else {
                    console.error('System prompts sync failed after redirect login:', promptsResult.message);
                  }
                }
              } catch (err) {
                console.error('Error syncing after redirect login:', err);
              }
            }
            
            // Clear URL hash/params after successful redirect handling
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }
            
            return; // Exit early, don't try silent login
          } else if (hasRedirectParams) {
            // We have redirect params but handleRedirectPromise didn't catch them
            // This might be a timing issue - try again after a short delay
            console.warn('[AuthContext] Redirect params detected but handleRedirectPromise returned null, retrying...');
            setTimeout(async () => {
              try {
                const retryResponse = await msalInstance.handleRedirectPromise();
                if (retryResponse) {
                  console.log('[AuthContext] Retry successful, account:', retryResponse.account);
                  setUser(retryResponse.account);
                  setIsAuthenticated(true);
                  setIsLoading(false);
                  if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                  return;
                }
              } catch (retryError) {
                console.error('[AuthContext] Retry failed:', retryError);
              }
            }, 500);
          }
        } catch (redirectError) {
          // Redirect promise failed or no redirect response, continue with normal flow
          console.error("[AuthContext] Redirect error:", redirectError?.errorCode || redirectError?.message, redirectError);
        }
        
        // Check if user is already logged in (cached account)
        // Also check if a new account appeared after redirect (even if handleRedirectPromise didn't catch it)
        const accounts = msalInstance.getAllAccounts();
        console.log('[AuthContext] All accounts after initialization:', accounts.length, accounts);
        
        if (accounts.length > 0) {
          const account = accounts[0];
          console.log('[AuthContext] Found account, attempting silent token acquisition:', account.username);
          
          // Try to acquire token silently to verify the account is still valid
          msalInstance
            .acquireTokenSilent({
              ...loginRequest,
              account: account,
            })
            .then(async (response) => {
              // Silent token acquisition successful, user is authenticated
              console.log('[AuthContext] Silent token acquisition successful');
              setUser(response.account);
              setIsAuthenticated(true);
              setIsLoading(false);
              
              // Trigger config sync after successful silent login (only once)
              // Check ref BEFORE any async operations to prevent race conditions
              if (hasSyncedAfterLoginRef.current) {
                return; // Already syncing or synced
              }
              hasSyncedAfterLoginRef.current = true;
              
              try {
                const configured = await profileSyncService.isSyncConfigured();
                if (configured) {
                  console.log('Silent login successful, triggering config and system prompts sync...');
                  // Sync config
                  const configResult = await profileSyncService.syncConfig();
                  if (configResult.success) {
                    console.log('Config synced after silent login:', configResult.message);
                  } else {
                    console.error('Config sync failed after silent login:', configResult.message);
                  }
                  // Sync system prompts
                  const promptsResult = await profileSyncService.syncSystemPrompts();
                  if (promptsResult.success) {
                    console.log('System prompts synced after silent login:', promptsResult.message);
                  } else {
                    console.error('System prompts sync failed after silent login:', promptsResult.message);
                  }
                } else {
                  console.log('OneDrive sync not configured yet, skipping sync');
                }
              } catch (err) {
                console.error('Error syncing after silent login:', err);
              }
            })
            .catch((error) => {
              // Silent token acquisition failed, account may be invalid
              // Give up and wait for user to manually login
              console.log("Silent login not possible:", error.errorCode || error.message);
              setIsLoading(false);
            });
        } else {
          // No cached account found
          // On iOS, ssoSilent won't work due to Intelligent Tracking Prevention (ITP)
          // Skip ssoSilent on iOS and wait for manual login
          if (isIOSDevice()) {
            console.log("iOS device detected - skipping ssoSilent (not supported due to ITP)");
            setIsLoading(false);
            return;
          }
          
          // Try silent SSO login on non-iOS devices
          msalInstance
            .ssoSilent({
              ...loginRequest,
              loginHint: undefined, // Try without login hint first
            })
            .then(async (response) => {
              // Silent SSO login successful
              setUser(response.account);
              setIsAuthenticated(true);
              setIsLoading(false);
              
              // Trigger config sync after successful silent SSO login (only once)
              // Check ref BEFORE any async operations to prevent race conditions
              if (hasSyncedAfterLoginRef.current) {
                return; // Already syncing or synced
              }
              hasSyncedAfterLoginRef.current = true;
              
              try {
                const configured = await profileSyncService.isSyncConfigured();
                if (configured) {
                  console.log('Silent SSO login successful, triggering config and system prompts sync...');
                  // Sync config
                  const configResult = await profileSyncService.syncConfig();
                  if (configResult.success) {
                    console.log('Config synced after silent SSO login:', configResult.message);
                  } else {
                    console.error('Config sync failed after silent SSO login:', configResult.message);
                  }
                  // Sync system prompts
                  const promptsResult = await profileSyncService.syncSystemPrompts();
                  if (promptsResult.success) {
                    console.log('System prompts synced after silent SSO login:', promptsResult.message);
                  } else {
                    console.error('System prompts sync failed after silent SSO login:', promptsResult.message);
                  }
                } else {
                  console.log('OneDrive sync not configured yet, skipping sync');
                }
              } catch (err) {
                console.error('Error syncing after silent SSO login:', err);
              }
            })
            .catch((error) => {
              // Silent SSO login failed, give up and wait for manual login
              console.log("Silent SSO login not possible:", error.errorCode || error.message);
              setIsLoading(false);
            });
        }
      })
      .catch((error) => {
        console.error("MSAL initialization error:", error);
        setIsLoading(false);
      });
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
      // Use redirect flow only for iOS (popups are often blocked)
      // For Chrome extensions, use popup flow with HTTP redirect URI (registered in SPA platform)
      // Popup flow uses postMessage, so it works even though the redirect URI is HTTP
      if (isIOSDevice()) {
        // On iOS, use redirect flow (more reliable than popup)
        await msalInstance.loginRedirect(loginRequest);
        // Note: After redirect, handleRedirectPromise() in useEffect will handle the response
        return;
      } else {
        // On other platforms including Chrome extensions, use popup flow
        // For Chrome extensions, popup flow redirects to HTTP URL but uses postMessage to communicate back
        const response = await msalInstance.loginPopup(loginRequest);
        setUser(response.account);
        setIsAuthenticated(true);
        
        // Trigger config sync after manual login (only once)
        // Check ref BEFORE any async operations to prevent race conditions
        if (hasSyncedAfterLoginRef.current) {
          return response; // Already syncing or synced
        }
        hasSyncedAfterLoginRef.current = true;
        
        try {
          const configured = await profileSyncService.isSyncConfigured();
          if (configured) {
            console.log('Manual login successful, triggering config and system prompts sync...');
            // Sync config
            const configResult = await profileSyncService.syncConfig();
            if (configResult.success) {
              console.log('Config synced after manual login:', configResult.message);
            } else {
              console.error('Config sync failed after manual login:', configResult.message);
            }
            // Sync system prompts
            const promptsResult = await profileSyncService.syncSystemPrompts();
            if (promptsResult.success) {
              console.log('System prompts synced after manual login:', promptsResult.message);
            } else {
              console.error('System prompts sync failed after manual login:', promptsResult.message);
            }
          } else {
            console.log('OneDrive sync not configured yet, skipping sync');
          }
        } catch (err) {
          console.error('Error syncing after manual login:', err);
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
