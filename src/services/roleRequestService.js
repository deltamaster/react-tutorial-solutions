import { roleDefinition, roleUtils } from "../utils/roleConfig";
import { normalizeBeginMarker } from "../utils/responseUtils";
import { extractMentionedRolesFromParts } from "../utils/textProcessing/mentionUtils";
import { fetchFromApi, toolbox, postProcessModelResponse } from "../utils/apiUtils";
import { generatePartUUID } from "../services/conversationService";

/**
 * Role Request Service
 * Handles role request queue management, execution, and deduplication
 */

const MAX_CONCURRENT_ROLE_REQUESTS = 3;

/**
 * Processes a role request task
 * Handles API calls, function execution, and response processing
 * 
 * @param {Object} task - Request task object
 * @param {Object} callbacks - Callback functions
 * @param {Object} mentionRoleMap - Mention role mapping
 * @returns {Promise} Promise that resolves when request is complete
 */
export const processRoleRequest = async (
  task,
  callbacks = {},
  mentionRoleMap = {}
) => {
  const {
    onMessageAppended,
    onError,
    onMentionedRolesFound,
    onRequestComplete,
  } = callbacks;

  const { role } = task;
  let continueProcessing = true;

  while (continueProcessing) {
    if (task.cancelled) {
      return;
    }
    continueProcessing = false;
    let responseData;

    try {
      const conversationSnapshot =
        task.conversationSnapshot || callbacks.getConversationSnapshot?.() || [];
      responseData = await fetchFromApi(
        conversationSnapshot,
        "default",
        true,
        role
      );
    } catch (error) {
      if (onError) {
        onError(error, task);
      }
      throw error;
    }

    if (task.cancelled) {
      return;
    }

    const candidate = responseData?.candidates?.[0];
    if (!candidate || !candidate.content) {
      const contentError = new Error("No content in candidates[0]");
      if (onError) {
        onError(contentError, task);
      }
      throw contentError;
    }

    const responseParts = candidate.content.parts || [];

    const textParts = responseParts.filter(
      (part) =>
        part.text ||
        part.executableCode ||
        part.codeExecutionResult ||
        (part.inlineData &&
          part.inlineData.data &&
          part.inlineData.mimeType)
    );
    const functionCallParts = responseParts.filter(
      (part) => part.functionCall
    );

    if (textParts.length > 0) {
      if (task.cancelled) {
        return;
      }
      const normalizedParts = normalizeBeginMarker(
        textParts,
        roleDefinition[role]?.name
      );
      
      // Post-process text parts to fix formatting issues
      // Skip processing for code blocks (executableCode, codeExecutionResult)
      const personaName = roleDefinition[role]?.name || "Adrien";
      const processedParts = normalizedParts.map((part) => {
        // Skip post-processing for code blocks
        if (part.executableCode || part.codeExecutionResult) {
          return part;
        }
        // Only process regular text parts
        if (part.text && typeof part.text === 'string') {
          return {
            ...part,
            text: postProcessModelResponse(part.text, personaName),
          };
        }
        return part;
      });
      
      // Ensure all parts have UUIDs
      const partsWithUUIDs = processedParts.map(part => ({
        ...part,
        uuid: part.uuid || generatePartUUID()
      }));
      
      const botResponse = {
        role: "model",
        name: personaName,
        parts: partsWithUUIDs,
        timestamp: Date.now(),
        groundingChunks:
          candidate?.groundingMetadata?.groundingChunks || [],
        groundingSupports:
          candidate?.groundingMetadata?.groundingSupports || [],
      };

      if (onMessageAppended) {
        onMessageAppended(botResponse);
      }

      const mentionedRoles = extractMentionedRolesFromParts(
        processedParts,
        mentionRoleMap
      ).filter((roleKey) => roleKey !== role);

      if (mentionedRoles.length > 0) {
        if (task.cancelled) {
          return;
        }
        if (onMentionedRolesFound) {
          onMentionedRolesFound(mentionedRoles, {
            source: "model",
            triggerMessageId: botResponse.timestamp,
            parentRequestId: task.id,
          });
        }
      }
    }

    if (
      functionCallParts.length > 0 &&
      roleUtils.canRoleUseFunctions(role)
    ) {
      const functionResults = [];

      for (const functionCallPart of functionCallParts) {
        if (task.cancelled) {
          return;
        }
        const { name, args } = functionCallPart.functionCall;

        if (toolbox[name]) {
          try {
            const result = await Promise.resolve(toolbox[name](args));
            // Ensure result is always an object with error information if it failed
            if (
              result &&
              typeof result === "object" &&
              result.success === false
            ) {
              // Function returned an error - ensure error message is included
              functionResults.push({
                name,
                result: {
                  success: false,
                  error:
                    result.error || "Function call failed with unknown error",
                  ...(result.status && { status: result.status }),
                  ...(result.statusCode && { statusCode: result.statusCode }),
                  ...(result.errorType && { errorType: result.errorType }),
                  ...(result.details && { details: result.details }),
                },
              });
            } else {
              // Success case - pass through as-is
              functionResults.push({ name, result });
            }
          } catch (error) {
            console.error(`Error executing function ${name}:`, error);
            // Return error response to LLM with full error details
            functionResults.push({
              name,
              result: {
                success: false,
                error: `Error executing function ${name}: ${
                  error.message || String(error)
                }`,
                ...(error.status && { status: error.status }),
                ...(error.statusCode && { statusCode: error.statusCode }),
                ...(error.errorType && { errorType: error.errorType }),
                ...(error.details && { details: error.details }),
              },
            });
          }
        } else {
          console.error(`Function ${name} not found in toolbox`);
          // Return standard error response to LLM when function is not found
          functionResults.push({
            name,
            result: {
              success: false,
              error: `Function '${name}' not found in toolbox. This function may be unavailable or require a premium subscription.`,
            },
          });
        }
      }

      if (functionResults.length > 0) {
        if (task.cancelled) {
          return;
        }
        const functionResponseMessage = {
          role: "user",
          parts: functionResults.map((result) => ({
            functionResponse: {
              name: result.name,
              response: { result: result.result },
            },
          })),
          timestamp: Date.now(),
        };

        if (onMessageAppended) {
          onMessageAppended(functionResponseMessage);
        }

        // Update task's conversationSnapshot to include the functionResponse message
        if (task.conversationSnapshot) {
          task.conversationSnapshot = [
            ...task.conversationSnapshot,
            functionResponseMessage,
          ];
        }

        continueProcessing = true;
      }
    } else if (functionCallParts.length > 0) {
      console.warn(
        `Role ${role} requested function calls but is not permitted to execute them.`
      );
    }
  }

  if (onRequestComplete) {
    onRequestComplete(task);
  }
};

/**
 * Creates a new role request task
 * 
 * @param {string} role - Role key
 * @param {Object} context - Request context
 * @param {Array} conversationSnapshot - Conversation snapshot
 * @returns {Object} Task object
 */
export const createRoleRequestTask = (role, context = {}, conversationSnapshot = []) => {
  const triggerMessageId = context?.triggerMessageId;
  const dedupeKey = triggerMessageId ? `${triggerMessageId}:${role}` : undefined;

  const taskId = `${Date.now()}-${role}-${Math.random()
    .toString(16)
    .slice(2)}`;

  return {
    id: taskId,
    role,
    context,
    dedupeKey,
    cancelled: false,
    conversationSnapshot,
  };
};

export { MAX_CONCURRENT_ROLE_REQUESTS };
