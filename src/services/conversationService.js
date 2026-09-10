/**
 * Conversation service
 * Handles conversation CRUD operations and export/import functionality
 */

export const readConversationFromStorage = (storageKey = "conversation") => {
  try {
    const item = localStorage.getItem(storageKey);
    if (!item) {
      return [];
    }
    const parsed = JSON.parse(item);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getLongestConversation = (...candidates) => {
  return candidates
    .filter((candidate) => Array.isArray(candidate))
    .reduce(
      (longest, current) =>
        current.length > longest.length ? current : longest,
      []
    );
};

/**
 * Resolve the most complete conversation from ref, React state, snapshot, and localStorage.
 * localStorage wins ties because setConversation writes it synchronously.
 */
export const getCurrentConversation = ({
  storageKey = "conversation",
  ref = null,
  state = null,
  snapshot = null,
} = {}) => {
  const fromStorage = readConversationFromStorage(storageKey);
  const fromRef = ref?.current ?? (Array.isArray(ref) ? ref : null);
  const fromState = Array.isArray(state) ? state : null;
  const fromSnapshot = Array.isArray(snapshot) ? snapshot : null;

  const longestLength = getLongestConversation(
    fromStorage,
    fromRef,
    fromState,
    fromSnapshot
  ).length;

  if (longestLength === 0) {
    return [];
  }

  if (fromStorage.length === longestLength) {
    return fromStorage;
  }
  if (fromRef && fromRef.length === longestLength) {
    return fromRef;
  }
  if (fromSnapshot && fromSnapshot.length === longestLength) {
    return fromSnapshot;
  }
  if (fromState && fromState.length === longestLength) {
    return fromState;
  }

  return getLongestConversation(fromStorage, fromRef, fromState, fromSnapshot);
};

/**
 * Generate a UUID for conversation parts
 * Uses crypto.randomUUID if available, otherwise falls back to a simple implementation
 * 
 * @returns {string} UUID string
 */
export const generatePartUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Merge consecutive thought parts into one. Streaming models often emit
 * multiple thought chunks as separate parts that belong in a single block.
 *
 * @param {Array} parts - Message parts
 * @returns {Array} Parts with adjacent thoughts collapsed
 */
export const mergeAdjacentThoughtParts = (parts = []) => {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [];
  }

  const merged = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const isThought = part.thought === true;
    const previous = merged[merged.length - 1];
    const previousIsThought = previous && previous.thought === true;

    if (isThought && previousIsThought) {
      merged[merged.length - 1] = {
        ...previous,
        ...part,
        text: `${previous.text || ""}${part.text || ""}`,
        thought: true,
        thoughtSignature: part.thoughtSignature || previous.thoughtSignature,
        uuid: previous.uuid || part.uuid,
      };
      continue;
    }

    merged.push({ ...part });
  }

  return merged;
};

/**
 * Like mergeAdjacentThoughtParts, but preserves the first original part index
 * for each rendered group (used by the conversation UI for edit callbacks).
 *
 * @param {Array} parts - Message parts
 * @returns {Array<{part: Object, partIndex: number}>}
 */
export const mergeAdjacentThoughtPartsForRender = (parts = []) => {
  const result = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part || part.hide === true) {
      continue;
    }

    const last = result[result.length - 1];
    if (part.thought === true && last && last.part.thought === true) {
      last.part = {
        ...last.part,
        text: `${last.part.text || ""}${part.text || ""}`,
        thoughtSignature: part.thoughtSignature || last.part.thoughtSignature,
      };
      continue;
    }

    result.push({ part: { ...part }, partIndex: index });
  }

  return result;
};

const normalizeMessageParts = (message, messageTimestamp) => {
  return (message.parts || []).map((part) => {
    const partTimestamp = part.timestamp || messageTimestamp;
    const lastUpdate = part.lastUpdate || partTimestamp;
    const uuid = part.uuid || generatePartUUID();
    return {
      ...part,
      timestamp: partTimestamp,
      lastUpdate,
      uuid,
    };
  });
};

/**
 * Appends a message to the conversation
 * Ensures all parts have timestamps and UUIDs
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Object} message - Message to append
 * @returns {Array} Updated conversation array
 */
export const appendMessage = (conversation, message) => {
  const latestConversation = conversation || [];
  const messageTimestamp = message.timestamp || Date.now();

  const messageWithTimestamps = {
    ...message,
    timestamp: messageTimestamp,
    parts: normalizeMessageParts(
      { ...message, parts: mergeAdjacentThoughtParts(message.parts) },
      messageTimestamp
    ),
  };

  return [...latestConversation, messageWithTimestamps];
};

/**
 * Updates an existing message by timestamp, or appends if not found.
 *
 * @param {Array} conversation - Current conversation array
 * @param {Object} message - Message to upsert
 * @returns {Array} Updated conversation array
 */
export const upsertMessage = (conversation, message) => {
  const latestConversation = conversation || [];
  const messageTimestamp = message.timestamp || Date.now();
  const messageWithTimestamps = {
    ...message,
    timestamp: messageTimestamp,
    parts: normalizeMessageParts(
      { ...message, parts: mergeAdjacentThoughtParts(message.parts) },
      messageTimestamp
    ),
  };

  let existingIndex = -1;
  if (message.id) {
    existingIndex = latestConversation.findIndex((entry) => entry.id === message.id);
  }
  if (existingIndex === -1) {
    existingIndex = latestConversation.findIndex(
      (entry) =>
        entry.timestamp === messageTimestamp && entry.role === message.role
    );
  }
  if (existingIndex === -1) {
    return [...latestConversation, messageWithTimestamps];
  }

  if (latestConversation[existingIndex].role !== message.role) {
    return [...latestConversation, messageWithTimestamps];
  }

  const updatedConversation = [...latestConversation];
  updatedConversation[existingIndex] = messageWithTimestamps;
  return updatedConversation;
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
            // Ensure part has timestamp and uuid (use message timestamp if missing)
            const partTimestamp = part.timestamp || message.timestamp || now;
            const uuid = part.uuid || generatePartUUID();
            return { 
              ...part, 
              text: newText,
              timestamp: partTimestamp,
              lastUpdate: now,
              uuid: uuid
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
