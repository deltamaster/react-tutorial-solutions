// Service for managing co-edited document content

const CO_EDIT_STORAGE_KEY = 'coEditMarkdown';
const CO_EDIT_TIMESTAMP_KEY = 'coEditLastUpdate';

// Event subscribers array
let subscribers = [];

/**
 * Subscribe to document change events
 * @param {function} callback - Function to call when document changes
 * @returns {function} Unsubscribe function
 */
export const subscribe = (callback) => {
  subscribers.push(callback);
  
  // Return unsubscribe function
  return () => {
    subscribers = subscribers.filter(sub => sub !== callback);
  };
};

/**
 * Notify all subscribers of document changes
 * @param {string} action - Type of action performed (update, clear)
 */
const notifySubscribers = (action) => {
  subscribers.forEach(callback => {
    try {
      callback(action);
    } catch (error) {
      console.error('Error in document change subscriber:', error);
    }
  });
};

/**
 * Get the current co-edited document content
 * @returns {string} The document content
 */
export const getDocumentContent = () => {
  try {
    const content = localStorage.getItem(CO_EDIT_STORAGE_KEY);
    return content || '';
  } catch (error) {
    console.error('Error getting document content:', error);
    return '';
  }
};

/**
 * Set the co-edited document content
 * @param {string} content - The new document content
 * @returns {object} Result object with success status and content
 */
export const setDocumentContent = (content) => {
  try {
    localStorage.setItem(CO_EDIT_STORAGE_KEY, content);
    // Update the timestamp when content changes
    const timestamp = new Date().toISOString();
    localStorage.setItem(CO_EDIT_TIMESTAMP_KEY, timestamp);
    
    // Notify subscribers of the update
    notifySubscribers('update');
    
    return {
      success: true,
      content,
      lastUpdated: timestamp
    };
  } catch (error) {
    console.error('Error setting document content:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get the last update timestamp for the document
 * @returns {string|null} ISO timestamp string or null if not available
 */
export const getLastUpdateTimestamp = () => {
  try {
    return localStorage.getItem(CO_EDIT_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error getting last update timestamp:', error);
    return null;
  }
};

/**
 * Clear the co-edited document content
 * @returns {object} Result object with success status
 */
export const clearDocumentContent = () => {
  try {
    localStorage.removeItem(CO_EDIT_STORAGE_KEY);
    localStorage.removeItem(CO_EDIT_TIMESTAMP_KEY);
    
    // Notify subscribers of the clear action
    notifySubscribers('clear');
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error clearing document content:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get document metadata including content and last update time
 * @returns {object} Document metadata object
 */
export const getDocumentMetadata = () => {
  return {
    content: getDocumentContent(),
    lastUpdated: getLastUpdateTimestamp()
  };
};

export default {
  getDocumentContent,
  setDocumentContent,
  getLastUpdateTimestamp,
  clearDocumentContent,
  getDocumentMetadata,
  subscribe
};