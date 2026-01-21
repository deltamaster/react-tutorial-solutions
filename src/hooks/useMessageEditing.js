import { useState, useCallback } from "react";
import { updateMessagePart } from "../services/conversationService";

/**
 * Custom hook for managing message editing state and operations
 * 
 * @param {Function} setConversation - Function to update conversation state
 * @returns {Object} Editing state and control functions
 */
export const useMessageEditing = (setConversation) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [editingText, setEditingText] = useState("");

  // Start editing a conversation part
  const startEditing = useCallback((index, partIndex, text) => {
    setEditingIndex(index);
    setEditingPartIndex(partIndex);
    setEditingText(text);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingIndex(null);
    setEditingPartIndex(null);
    setEditingText("");
  }, []);

  // Save edited conversation part
  const saveEditing = useCallback(() => {
    if (editingIndex !== null && editingPartIndex !== null) {
      setConversation((prev) =>
        updateMessagePart(prev, editingIndex, editingPartIndex, editingText)
      );
      cancelEditing();
    }
  }, [editingIndex, editingPartIndex, editingText, setConversation, cancelEditing]);

  return {
    editingIndex,
    editingPartIndex,
    editingText,
    setEditingText,
    startEditing,
    cancelEditing,
    saveEditing,
  };
};
