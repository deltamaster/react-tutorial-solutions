import { useState, useEffect } from "react";
import {
  getSubscriptionKey,
  setSubscriptionKey,
  getSystemPrompt,
  setSystemPrompt,
  getUserAvatar,
  setUserAvatar,
  getModel,
  setModel,
} from "../utils/settingsService";

/**
 * Custom hook for managing application settings
 * Handles subscription key, system prompt, user avatar, and model settings
 * 
 * @returns {Object} Settings state and handlers
 */
export const useSettings = () => {
  const [subscriptionKey, setLocalSubscriptionKey] = useState(getSubscriptionKey());
  const [systemPrompt, setLocalSystemPrompt] = useState(getSystemPrompt());
  const [userAvatar, setLocalUserAvatar] = useState(getUserAvatar());
  const [model, setLocalModel] = useState(getModel());

  // Retrieve API key from Chrome storage (config sync is handled by AuthContext after login)
  useEffect(() => {
    // Check if running in Chrome extension environment
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.get(["apiKey"], (result) => {
        if (result.apiKey) {
          setSubscriptionKey(result.apiKey); // Use settingsService to save
          setLocalSubscriptionKey(result.apiKey); // Update local state
        }
      });
    }
  }, []); // Empty deps ensures this runs only once on mount

  // Update Chrome storage when subscriptionKey changes
  useEffect(() => {
    if (subscriptionKey && typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ apiKey: subscriptionKey });
    }
  }, [subscriptionKey]);

  // Wrapper functions to ensure settings are saved through settingsService
  const handleSubscriptionKeyChange = (key) => {
    setSubscriptionKey(key); // Save to localStorage via settingsService
    setLocalSubscriptionKey(key); // Update local state
  };

  const handleSystemPromptChange = (prompt) => {
    setSystemPrompt(prompt); // Save to localStorage via settingsService
    setLocalSystemPrompt(prompt); // Update local state
  };

  const handleUserAvatarChange = (avatar) => {
    setUserAvatar(avatar); // Save to localStorage via settingsService
    setLocalUserAvatar(avatar); // Update local state
  };

  const handleModelChange = (model) => {
    setModel(model); // Save to localStorage via settingsService
    setLocalModel(model); // Update local state
  };

  return {
    subscriptionKey,
    systemPrompt,
    userAvatar,
    model,
    handleSubscriptionKeyChange,
    handleSystemPromptChange,
    handleUserAvatarChange,
    handleModelChange,
  };
};
