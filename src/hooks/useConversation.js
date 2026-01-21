import { useRef, useEffect } from "react";
import { useLocalStorage } from "../utils/storageUtils";

/**
 * Custom hook for conversation state management
 * Manages conversation state and ref synchronization
 * 
 * @param {string} storageKey - localStorage key for conversation
 * @returns {Array} [conversation, setConversation, conversationRef]
 */
export const useConversation = (storageKey = "conversation") => {
  const [conversation, setConversation] = useLocalStorage(storageKey, []);
  const conversationRef = useRef(conversation || []);
  
  useEffect(() => {
    // Ensure conversationRef always has a valid array, never undefined
    conversationRef.current = Array.isArray(conversation) ? conversation : [];
  }, [conversation]);
  
  return [conversation, setConversation, conversationRef];
};
