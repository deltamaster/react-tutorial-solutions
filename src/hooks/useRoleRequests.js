import { useState, useRef, useCallback, useMemo } from "react";
import { roleDefinition } from "../utils/roleConfig";
import { appendMessage, upsertMessage, readConversationFromStorage } from "../services/conversationService";
import {
  processRoleRequest,
  createRoleRequestTask,
  MAX_CONCURRENT_ROLE_REQUESTS,
} from "../services/roleRequestService";
import { ApiError } from "../services/api/apiClient";
import { markFileExpired, extractFileIdFromError, removeExpiredFilesFromContents } from "../utils/fileTrackingService";

/**
 * Custom hook for managing role request queue
 * Handles request queuing, processing, cancellation, and state management
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.conversationRef - Ref to current conversation
 * @param {Function} options.setConversation - Function to update conversation
 * @param {Function} options.appendMessage - Function to append message to conversation
 * @param {Function} options.onError - Error handler callback
 * @param {Function} options.onAllRequestsComplete - Callback when all requests complete
 * @param {Object} options.mentionRoleMap - Mention role mapping
 * @param {boolean} [options.isOneDriveAvailable] - When true, Adrien's API tools include saved cloud conversation search
 * @returns {Object} Role request management functions and state
 */
export const useRoleRequests = ({
  conversationRef,
  setConversation,
  appendMessage,
  onError,
  onAllRequestsComplete,
  mentionRoleMap,
  isOneDriveAvailable = false,
}) => {
  const [activeTypers, setActiveTypers] = useState([]);

  const requestQueueRef = useRef([]);
  const activeRequestsRef = useRef(new Map());
  const scheduledRequestsRef = useRef(new Set());

  const updateLoadingState = useCallback(() => {
    const rolesInFlight = new Set();
    activeRequestsRef.current.forEach((task) => {
      if (!task?.cancelled) {
        rolesInFlight.add(task.role);
      }
    });
    requestQueueRef.current.forEach((task) => {
      if (!task?.cancelled) {
        rolesInFlight.add(task.role);
      }
    });

    const typingNames = Array.from(rolesInFlight)
      .map((roleKey) => roleDefinition[roleKey]?.name || roleKey)
      .sort();

    setActiveTypers(typingNames);
  }, []);

  const handleRoleRequestError = useCallback(
    (error, task) => {
      // Handle 403 errors (expired files) - update conversation immediately
      if (error instanceof ApiError && error.status === 403) {
        const errorMessage = error.message || "";
        const fileId = extractFileIdFromError(errorMessage);

        if (fileId) {
          console.warn(`File ${fileId} expired (403 error), updating conversation`);
          markFileExpired(fileId);

          // Update conversation to remove expired files
          setConversation((prevConversation) => {
            const cleanedConversation = removeExpiredFilesFromContents(prevConversation || []);
            return cleanedConversation;
          });
        }
      }

      if (onError) {
        onError(error);
      }
    },
    [setConversation, conversationRef, onError]
  );

  const startRoleRequest = useCallback(
    (task) => {
      if (task.cancelled) {
        return;
      }

      activeRequestsRef.current.set(task.id, task);
      updateLoadingState();

      const callbacks = {
        onMessageAppended: (message) => {
          appendMessage(message);
        },
        onMessageUpdated: (message, options = {}) => {
          setConversation((currentConversation) => {
            const snapshot = Array.isArray(task.conversationSnapshot)
              ? task.conversationSnapshot
              : [];
            let base = currentConversation || [];
            if (snapshot.length > base.length) {
              base = snapshot;
            }
            const triggerMessageId = task.context?.triggerMessageId;
            if (triggerMessageId) {
              const hasTriggerUserMessage = base.some(
                (entry) =>
                  entry.role === "user" && entry.timestamp === triggerMessageId
              );
              if (!hasTriggerUserMessage) {
                const snapshotUserMessage = snapshot.find(
                  (entry) =>
                    entry.role === "user" && entry.timestamp === triggerMessageId
                );
                if (snapshotUserMessage) {
                  base = appendMessage(base, snapshotUserMessage);
                }
              }
            }
            if (options.isNew) {
              return appendMessage(base, message);
            }
            return upsertMessage(base, message);
          });
        },
        onError: (error) => {
          handleRoleRequestError(error, task);
        },
        onMentionedRolesFound: (mentionedRoles, context) => {
          enqueueRoleRequests(mentionedRoles, context);
        },
        onRequestComplete: () => {
          // Request completed
        },
        getConversationSnapshot: () => [...(conversationRef.current || [])],
        isOneDriveAvailable,
      };

      processRoleRequest(task, callbacks, mentionRoleMap)
        .catch((error) => {
          console.error(`Role request failed for ${task.role}:`, error);
        })
        .finally(() => {
          activeRequestsRef.current.delete(task.id);
          if (task.dedupeKey) {
            scheduledRequestsRef.current.delete(task.dedupeKey);
          }
          updateLoadingState();
          processRoleRequestQueue();

          if (
            activeRequestsRef.current.size === 0 &&
            requestQueueRef.current.length === 0
          ) {
            if (onAllRequestsComplete) {
              onAllRequestsComplete();
            }
          }
        });
    },
    [
      updateLoadingState,
      appendMessage,
      setConversation,
      handleRoleRequestError,
      mentionRoleMap,
      conversationRef,
      onAllRequestsComplete,
      isOneDriveAvailable,
    ]
  );

  const processRoleRequestQueue = useCallback(() => {
    while (
      activeRequestsRef.current.size < MAX_CONCURRENT_ROLE_REQUESTS &&
      requestQueueRef.current.length > 0
    ) {
      const nextTask = requestQueueRef.current.shift();
      if (!nextTask) {
        continue;
      }
      if (nextTask.cancelled) {
        continue;
      }
      startRoleRequest(nextTask);
    }
  }, [startRoleRequest]);

  const cancelRoleRequestsForRole = useCallback(
    (role) => {
      let queueModified = false;

      if (requestQueueRef.current.length > 0) {
        const retainedTasks = [];
        for (const task of requestQueueRef.current) {
          if (task.role === role) {
            task.cancelled = true;
            if (task.dedupeKey) {
              scheduledRequestsRef.current.delete(task.dedupeKey);
            }
            queueModified = true;
          } else {
            retainedTasks.push(task);
          }
        }
        requestQueueRef.current = retainedTasks;
      }

      const tasksToRemove = [];
      activeRequestsRef.current.forEach((task, id) => {
        if (task.role === role) {
          task.cancelled = true;
          if (task.dedupeKey) {
            scheduledRequestsRef.current.delete(task.dedupeKey);
          }
          tasksToRemove.push(id);
          queueModified = true;
        }
      });

      for (const id of tasksToRemove) {
        activeRequestsRef.current.delete(id);
      }

      if (queueModified) {
        updateLoadingState();
        processRoleRequestQueue();
      }
    },
    [updateLoadingState, processRoleRequestQueue]
  );

  const enqueueRoleRequests = useCallback(
    (roles, context = {}) => {
      const uniqueRoles = Array.from(new Set(roles)).filter(Boolean);
      if (uniqueRoles.length === 0) {
        return;
      }

      const providedSnapshot = Array.isArray(context.conversationSnapshot)
        ? context.conversationSnapshot
        : null;
      const refSnapshot = conversationRef.current || [];
      const storedSnapshot = readConversationFromStorage("conversation");
      const sourceSnapshot =
        providedSnapshot ||
        (storedSnapshot.length > refSnapshot.length ? storedSnapshot : refSnapshot);
      // Copy so API/stream work cannot mutate the live conversation array.
      const conversationSnapshot = sourceSnapshot.slice();

      let tasksAdded = false;

      uniqueRoles.forEach((role) => {
        cancelRoleRequestsForRole(role);

        const triggerMessageId = context?.triggerMessageId;
        const dedupeKey = triggerMessageId
          ? `${triggerMessageId}:${role}`
          : undefined;

        if (
          dedupeKey &&
          (scheduledRequestsRef.current.has(dedupeKey) ||
            Array.from(activeRequestsRef.current.values()).some(
              (activeTask) => activeTask.dedupeKey === dedupeKey
            ))
        ) {
          return;
        }

        if (dedupeKey) {
          scheduledRequestsRef.current.add(dedupeKey);
        }

        const task = createRoleRequestTask(role, context, conversationSnapshot);
        requestQueueRef.current.push(task);
        tasksAdded = true;
      });

      if (tasksAdded) {
        updateLoadingState();
        processRoleRequestQueue();
      }
    },
    [
      conversationRef,
      cancelRoleRequestsForRole,
      updateLoadingState,
      processRoleRequestQueue,
    ]
  );

  return {
    activeTypers,
    enqueueRoleRequests,
    cancelRoleRequestsForRole,
    hasActiveRequests: useMemo(
      () =>
        activeRequestsRef.current.size > 0 ||
        requestQueueRef.current.length > 0,
      []
    ),
  };
};
