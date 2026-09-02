import { useRef, useState, useCallback } from "react";
import { useConversationSync } from "./useConversationSync";
import { readConversationFromStorage } from "../services/conversationService";

/**
 * Conversation store.
 *
 * Writes go through setConversation. Functional updaters run against the ref
 * immediately (not inside React's setState updater).
 *
 * Accidental shrinks (empty/short replacements) are ignored unless `{ replace: true }`
 * is passed — that is only for reset, switch, import, and failed-send rollback.
 */
export const useConversation = (storageKey = "conversation") => {
  const conversationRef = useRef(null);

  const [conversation, setConversationState] = useState(() => {
    const stored = readConversationFromStorage(storageKey);
    conversationRef.current = stored;
    return stored;
  });

  if (conversationRef.current === null) {
    conversationRef.current = conversation;
  }

  if (
    Array.isArray(conversation) &&
    conversation.length > (conversationRef.current?.length || 0)
  ) {
    conversationRef.current = conversation;
  }

  const setConversation = useCallback(
    (value, options = {}) => {
      const { replace = false } = options;
      const previous = Array.isArray(conversationRef.current)
        ? conversationRef.current
        : [];
      const next = typeof value === "function" ? value(previous) : value;
      let convArray = Array.isArray(next) ? next : [];

      if (!replace && convArray.length < previous.length) {
        const incoming = convArray[convArray.length - 1];
        const alreadyPresent =
          incoming &&
          previous.some(
            (entry) =>
              (incoming.id && entry.id === incoming.id) ||
              (incoming.timestamp &&
                entry.timestamp === incoming.timestamp &&
                entry.role === incoming.role)
          );
        if (incoming && !alreadyPresent) {
          convArray = [...previous, incoming];
        } else {
          console.warn("[useConversation] Ignored shrinking conversation update", {
            previousLength: previous.length,
            nextLength: next?.length,
          });
          return;
        }
      }

      conversationRef.current = convArray;

      try {
        localStorage.setItem(storageKey, JSON.stringify(convArray));
      } catch (error) {
        console.error("[useConversation] Error updating localStorage:", error);
      }

      setConversationState(convArray);
    },
    [storageKey]
  );

  const syncHelpers = useConversationSync(conversationRef, setConversation);

  const result = [conversation, setConversation, conversationRef];

  if (syncHelpers) {
    result.push(syncHelpers);
  }

  return result;
};
