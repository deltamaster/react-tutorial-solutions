import { useState, useRef, useCallback } from "react";
import { generateFollowUpQuestions } from "../utils/apiUtils";

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
        const nextQuestionResponseData = await generateFollowUpQuestions(
          conversationSnapshot
        );
        if (id !== followUpRequestIdRef.current) {
          return;
        }

        // Extract JSON array from structured output
        const candidate = nextQuestionResponseData?.candidates?.[0];
        if (candidate?.content?.parts?.[0]?.text) {
          try {
            const jsonText = candidate.content.parts[0].text;
            const questions = JSON.parse(jsonText);
            if (Array.isArray(questions)) {
              // Filter out empty strings and limit to 3
              const validQuestions = questions
                .filter((q) => typeof q === "string" && q.trim())
                .slice(0, 3);
              setFollowUpQuestions(validQuestions);
            } else {
              setFollowUpQuestions([]);
            }
          } catch (error) {
            console.error("Error parsing follow-up questions JSON:", error);
            setFollowUpQuestions([]);
          }
        } else {
          setFollowUpQuestions([]);
        }
      } catch (error) {
        if (id === followUpRequestIdRef.current) {
          console.error("Error generating follow-up questions:", error);
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
