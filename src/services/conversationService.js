/**
 * Conversation service
 * Handles conversation CRUD operations and export/import functionality
 */

/**
 * Appends a message to the conversation
 * Ensures all parts have timestamps
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Object} message - Message to append
 * @returns {Array} Updated conversation array
 */
export const appendMessage = (conversation, message) => {
  const latestConversation = conversation || [];
  const messageTimestamp = message.timestamp || Date.now();
  
  // Ensure all parts have timestamps
  const messageWithTimestamps = {
    ...message,
    timestamp: messageTimestamp,
    parts: (message.parts || []).map(part => {
      // If part doesn't have timestamp, use message timestamp
      // If part doesn't have lastUpdate, use timestamp as lastUpdate
      const partTimestamp = part.timestamp || messageTimestamp;
      const lastUpdate = part.lastUpdate || partTimestamp;
      return {
        ...part,
        timestamp: partTimestamp,
        lastUpdate: lastUpdate
      };
    })
  };
  
  return [...latestConversation, messageWithTimestamps];
};

/**
 * Filters out deleted messages from conversation
 * 
 * @param {Array} conversation - Current conversation array
 * @returns {Array} Conversation array with deleted messages filtered out
 */
export const filterDeletedMessages = (conversation) => {
  const safeConversation = Array.isArray(conversation) ? conversation : [];
  return safeConversation.filter(message => !message.deleted);
};

/**
 * Deletes messages at specified indices by marking them as deleted
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Array} indicesToDelete - Array of indices to delete
 * @returns {Array} Updated conversation array with deleted messages marked
 */
export const deleteMessages = (conversation, indicesToDelete) => {
  const safeConversation = Array.isArray(conversation) ? conversation : [];
  const now = Date.now();
  return safeConversation.map((message, index) => {
    if (indicesToDelete.includes(index)) {
      return {
        ...message,
        deleted: true,
        lastUpdate: now
      };
    }
    return message;
  });
};

/**
 * Updates a specific part of a message in the conversation
 * Adds timestamp to part if missing, and adds lastUpdate timestamp
 * 
 * @param {Array} conversation - Current conversation array
 * @param {number} messageIndex - Index of the message to update
 * @param {number} partIndex - Index of the part to update
 * @param {string} newText - New text content
 * @returns {Array} Updated conversation array
 */
export const updateMessagePart = (conversation, messageIndex, partIndex, newText) => {
  const safeConversation = Array.isArray(conversation) ? conversation : [];
  const now = Date.now();
  return safeConversation.map((message, index) => {
    if (index === messageIndex) {
      return {
        ...message,
        parts: message.parts.map((part, pIndex) => {
          if (pIndex === partIndex) {
            // Ensure part has timestamp (use message timestamp if missing)
            const partTimestamp = part.timestamp || message.timestamp || now;
            return { 
              ...part, 
              text: newText,
              timestamp: partTimestamp,
              lastUpdate: now
            };
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
