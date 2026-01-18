import React, { createContext, useContext, useState, useEffect } from "react";
import { msalInstance, loginRequest, onedriveScopes, isMsalConfigured } from "../config/msalConfig";
import * as msal from "@azure/msal-browser";

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

  useEffect(() => {
    // Check if MSAL is configured
    const configured = isMsalConfigured();
    setIsConfigured(configured);

    if (!configured || !msalInstance) {
      setIsLoading(false);
      return;
    }

    // Initialize MSAL
    msalInstance
      .initialize()
      .then(() => {
        // Check if user is already logged in
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          setUser(accounts[0]);
          setIsAuthenticated(true);
        }
        setIsLoading(false);
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
    try {
      const response = await msalInstance.loginPopup(loginRequest);
      setUser(response.account);
      setIsAuthenticated(true);
      return response;
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
