/**
 * Conversation service
 * Handles conversation CRUD operations and export/import functionality
 */

/**
 * Appends a message to the conversation
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Object} message - Message to append
 * @returns {Array} Updated conversation array
 */
export const appendMessage = (conversation, message) => {
  const latestConversation = conversation || [];
  return [...latestConversation, message];
};

/**
 * Deletes messages at specified indices
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Array} indicesToDelete - Array of indices to delete
 * @returns {Array} Updated conversation array
 */
export const deleteMessages = (conversation, indicesToDelete) => {
  const safeConversation = Array.isArray(conversation) ? conversation : [];
  return safeConversation.filter((_, i) => !indicesToDelete.includes(i));
};

/**
 * Updates a specific part of a message in the conversation
 * 
 * @param {Array} conversation - Current conversation array
 * @param {number} messageIndex - Index of the message to update
 * @param {number} partIndex - Index of the part to update
 * @param {string} newText - New text content
 * @returns {Array} Updated conversation array
 */
export const updateMessagePart = (conversation, messageIndex, partIndex, newText) => {
  const safeConversation = Array.isArray(conversation) ? conversation : [];
  return safeConversation.map((message, index) => {
    if (index === messageIndex) {
      return {
        ...message,
        parts: message.parts.map((part, pIndex) => {
          if (pIndex === partIndex) {
            return { ...part, text: newText };
          }
          return part;
        }),
      };
    }
    return message;
  });
};

/**
 * Checks if a message is a functionResponse message
 * 
 * @param {Object} message - Message to check
 * @returns {boolean} True if message is a functionResponse message
 */
export const isFunctionResponseMessage = (message) => {
  if (!message || message.role !== "user" || !message.parts || !Array.isArray(message.parts)) {
    return false;
  }
  // A functionResponse message has parts that all contain functionResponse
  return message.parts.length > 0 && 
         message.parts.every(part => part && part.functionResponse);
};

/**
 * Finds indices of functionResponse messages following a model response
 * 
 * @param {Array} conversation - Current conversation array
 * @param {number} modelMessageIndex - Index of the model message
 * @returns {Array} Array of indices to delete (including the model message)
 */
export const findFunctionResponseIndices = (conversation, modelMessageIndex) => {
  const indicesToDelete = [modelMessageIndex];
  
  // Find all consecutive functionResponse messages following this model response
  for (let i = modelMessageIndex + 1; i < conversation.length; i++) {
    if (isFunctionResponseMessage(conversation[i])) {
      indicesToDelete.push(i);
    } else {
      // Stop at the first non-functionResponse message
      break;
    }
  }
  
  return indicesToDelete;
};

/**
 * Creates export data structure for conversation
 * 
 * @param {Array} conversation - Conversation array
 * @param {Array} summaries - Conversation summaries
 * @param {Object} trackedFiles - Tracked files object
 * @returns {Object} Export data structure
 */
export const createExportData = (conversation, summaries = [], trackedFiles = {}) => {
  return {
    version: "1.2", // Version marker - updated to include file tracking
    conversation: conversation,
    conversation_summaries: summaries,
    uploaded_files: trackedFiles,
  };
};

/**
 * Parses uploaded conversation data (supports old and new formats)
 * 
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} Parsed data with conversation, summaries, and trackedFiles
 */
export const parseConversationData = (jsonString) => {
  const uploadedData = JSON.parse(jsonString);
  
  // Check if it's the new format with version
  if (uploadedData.version && uploadedData.conversation) {
    return {
      conversation: Array.isArray(uploadedData.conversation) 
        ? uploadedData.conversation 
        : [],
      summaries: uploadedData.conversation_summaries || [],
      trackedFiles: uploadedData.uploaded_files || {},
    };
  } else {
    // Old format: just the conversation (assuming the entire file is conversation data)
    return {
      conversation: Array.isArray(uploadedData) ? uploadedData : [],
      summaries: [],
      trackedFiles: {},
    };
  }
};
