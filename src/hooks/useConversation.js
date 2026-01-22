import { useRef, useEffect, useState, useCallback } from "react";
import { useLocalStorage } from "../utils/storageUtils";
import { useConversationSync } from "./useConversationSync";
import conversationSyncService from "../utils/conversationSyncService";

/**
 * Custom hook for conversation state management
 * Manages conversation state and ref synchronization
 * Supports both OneDrive sync and localStorage fallback
 * 
 * @param {string} storageKey - localStorage key for conversation
 * @returns {Array} [conversation, setConversation, conversationRef, syncHelpers]
 */
export const useConversation = (storageKey = "conversation") => {
  // Always call hooks unconditionally (Rules of Hooks)
  const [localConversation, setLocalConversation] = useLocalStorage(storageKey, []);
  
  const [oneDriveAvailable, setOneDriveAvailable] = useState(false);
  const [checkingOneDrive, setCheckingOneDrive] = useState(true);
  const localConversationRef = useRef(localConversation || []);
  
  // setConversation wrapper that ensures localStorage and ref are updated IMMEDIATELY and SYNCHRONOUSLY
  // MUST be defined BEFORE useConversationSync so it can be passed to it
  const setConversation = useCallback((value) => {
    // CRITICAL: Calculate new value IMMEDIATELY (synchronously)
    const newValue = typeof value === 'function' 
      ? value(localConversationRef.current || [])
      : value;
    const convArray = Array.isArray(newValue) ? newValue : [];
    
    // CRITICAL: Update localStorage IMMEDIATELY and SYNCHRONOUSLY (before React state update)
    // This ensures localStorage is always up-to-date when user sends request or model responds
    try {
      const stringified = JSON.stringify(convArray);
      localStorage.setItem(storageKey, stringified);
      console.log('[useConversation] localStorage updated IMMEDIATELY (synchronously)', {
        conversationLength: convArray.length,
        storageKey
      });
    } catch (error) {
      console.error('[useConversation] Error updating localStorage synchronously:', error);
    }
    
    // CRITICAL: Update ref IMMEDIATELY (before React re-render)
    // This ensures conversationRef.current is always up-to-date for sync operations
    localConversationRef.current = convArray;
    
    // Update React state (triggers re-render, but localStorage already updated above)
    // This also triggers useLocalStorage's async Chrome storage save if needed
    setLocalConversation(convArray);
    
    console.log('[useConversation] setConversation complete - localStorage and ref updated immediately', {
      conversationLength: convArray.length
    });
  }, [setLocalConversation, storageKey]);
  
  // Pass the wrapped setConversation to useConversationSync (not setLocalConversation)
  // This ensures all conversation updates go through the synchronous localStorage update
  const syncHelpers = useConversationSync(localConversation, setConversation);
  
  // Check OneDrive availability and sync with syncHelpers
  useEffect(() => {
    const checkOneDriveAvailability = async () => {
      try {
        console.log('[useConversation] Checking OneDrive availability...');
        const available = await conversationSyncService.isConversationSyncConfigured();
        console.log('[useConversation] OneDrive available:', available);
        setOneDriveAvailable(available);
      } catch (error) {
        console.error('[useConversation] Error checking OneDrive availability:', error);
        setOneDriveAvailable(false);
      } finally {
        setCheckingOneDrive(false);
      }
    };
    
    checkOneDriveAvailability();
  }, []);
  
  // localStorage is ALWAYS the source of truth
  const conversation = localConversation;
  
  const conversationRef = localConversationRef;
  
  useEffect(() => {
    // Ensure conversationRef always has a valid array, never undefined
    // This keeps conversationRef in sync with localStorage conversation state
    const convArray = Array.isArray(conversation) ? conversation : [];
    // Only update if different to avoid unnecessary updates
    if (JSON.stringify(conversationRef.current) !== JSON.stringify(convArray)) {
      conversationRef.current = convArray;
      console.log('[useConversation] Conversation state updated, ref synced', {
        conversationLength: convArray.length
      });
    }
  }, [conversation]);
  
  // Return conversation state and sync helpers
  const result = [conversation, setConversation, conversationRef];
  
  // Always add sync helpers (may be inactive if OneDrive not available)
  if (syncHelpers) {
    result.push(syncHelpers);
  }
  
  return result;
};
