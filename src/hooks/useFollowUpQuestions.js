import { useState, useRef, useCallback } from "react";
import { generateFollowUpQuestions, generateConversationMetadata } from "../services/api/geminiService";

/**
 * Custom hook for managing follow-up questions
 * Handles queue management, generation, and state for follow-up questions
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.conversationRef - Ref to current conversation
 * @param {Array} options.activeTypers - Array of active typers (to check if requests are active)
 * @returns {Object} Follow-up questions state and control functions
 */
export const useFollowUpQuestions = ({ conversationRef, activeTypers = [] }) => {
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [nextQuestionLoading, setNextQuestionLoading] = useState(false);

  const followUpQueueRef = useRef([]);
  const followUpActiveRef = useRef(false);
  const followUpRequestIdRef = useRef(0);

  const cancelPendingFollowUpQuestions = useCallback(() => {
    followUpRequestIdRef.current += 1;
    followUpQueueRef.current = [];
    followUpActiveRef.current = false;
    setNextQuestionLoading(false);
  }, []);

  const processFollowUpQueue = useCallback(() => {
    if (followUpActiveRef.current) {
      return;
    }

    // Check if there are active role requests
    if (activeTypers.length > 0) {
      return;
    }

    if (followUpQueueRef.current.length === 0) {
      return;
    }

    const task = followUpQueueRef.current.shift();
    if (!task) {
      return;
    }

    const { id, conversationSnapshot } = task;

    if (id !== followUpRequestIdRef.current) {
      processFollowUpQueue();
      return;
    }

    followUpActiveRef.current = true;
    setNextQuestionLoading(true);

    (async () => {
      try {
        // Use combined metadata generation function (generates title, summary, and next questions)
        // Prepare contents - filter out thoughts and hidden parts, keep only text
        const finalContents = conversationSnapshot
          .filter(content => content.parts && content.parts.length > 0)
          .map(content => ({
            role: content.role,
            parts: content.parts
              .filter(part => !part.thought && part.hide !== true && part.text)
              .map(part => ({ text: part.text }))
          }))
          .filter(content => content.parts.length > 0);
        
        if (finalContents.length === 0) {
          setFollowUpQuestions([]);
          return;
        }
        
        const metadata = await generateConversationMetadata(finalContents);
        if (id !== followUpRequestIdRef.current) {
          return;
        }

        // Extract nextQuestions from metadata
        if (metadata.nextQuestions && Array.isArray(metadata.nextQuestions)) {
          // Filter out empty strings and limit to 3
          const validQuestions = metadata.nextQuestions
            .filter((q) => typeof q === "string" && q.trim())
            .slice(0, 3);
          setFollowUpQuestions(validQuestions);
        } else {
          setFollowUpQuestions([]);
        }
      } catch (error) {
        if (id === followUpRequestIdRef.current) {
          console.error("Error generating follow-up questions:", error);
          setFollowUpQuestions([]);
        }
      } finally {
        if (id === followUpRequestIdRef.current) {
          followUpActiveRef.current = false;
          setNextQuestionLoading(false);
        }
        if (followUpQueueRef.current.length > 0) {
          processFollowUpQueue();
        }
      }
    })();
  }, [activeTypers]);

  const scheduleFollowUpQuestions = useCallback(() => {
    if (
      followUpActiveRef.current ||
      followUpQueueRef.current.length > 0 ||
      activeTypers.length > 0
    ) {
      return;
    }

    const conversationSnapshot = conversationRef.current;
    if (!conversationSnapshot || conversationSnapshot.length === 0) {
      return;
    }

    const requestId = followUpRequestIdRef.current + 1;
    followUpRequestIdRef.current = requestId;
    followUpQueueRef.current = [{ id: requestId, conversationSnapshot }];
    processFollowUpQueue();
  }, [conversationRef, activeTypers, processFollowUpQueue]);

  return {
    followUpQuestions,
    setFollowUpQuestions,
    nextQuestionLoading,
    cancelPendingFollowUpQuestions,
    scheduleFollowUpQuestions,
  };
};
