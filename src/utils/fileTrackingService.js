/**
 * File Tracking Service
 * Manages uploaded file tracking with expiration (12 hours)
 */

const STORAGE_KEY = 'uploaded_files';
const EXPIRATION_HOURS = 12;

/**
 * Extract file ID from file URI
 * @param {string} fileUri - The file URI (e.g., "https://generativelanguage.googleapis.com/v1beta/files/prsxstwp6anr")
 * @returns {string|null} - The file ID or null if not found
 */
export const extractFileId = (fileUri) => {
  if (!fileUri) return null;
  try {
    // Extract the file ID from URI (last part after /files/)
    const match = fileUri.match(/\/files\/([^\/\?]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Error extracting file ID:", error);
    return null;
  }
};

/**
 * Get all tracked files from storage
 * @returns {Object} - Object mapping file_id to { uploadTime, fileUri }
 */
const getTrackedFiles = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Error getting tracked files:", error);
    return {};
  }
};

/**
 * Save tracked files to storage
 * @param {Object} files - Object mapping file_id to { uploadTime, fileUri }
 */
const saveTrackedFiles = (files) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (error) {
    console.error("Error saving tracked files:", error);
  }
};

/**
 * Track a newly uploaded file
 * @param {string} fileUri - The file URI returned from upload
 */
export const trackFile = (fileUri) => {
  const fileId = extractFileId(fileUri);
  if (!fileId) {
    console.warn("Could not extract file ID from URI:", fileUri);
    return;
  }

  const files = getTrackedFiles();
  files[fileId] = {
    uploadTime: Date.now(),
    fileUri: fileUri,
  };
  saveTrackedFiles(files);
};

/**
 * Check if a file is expired (older than 12 hours)
 * @param {string} fileId - The file ID to check
 * @returns {boolean} - True if expired, false otherwise
 */
export const isFileExpired = (fileId) => {
  const files = getTrackedFiles();
  const file = files[fileId];
  if (!file) {
    // If not tracked, assume expired to be safe
    return true;
  }

  const expirationTime = EXPIRATION_HOURS * 60 * 60 * 1000; // 12 hours in milliseconds
  const age = Date.now() - file.uploadTime;
  return age > expirationTime;
};

/**
 * Mark a file as expired (remove from tracking)
 * @param {string} fileId - The file ID to mark as expired
 */
export const markFileExpired = (fileId) => {
  const files = getTrackedFiles();
  delete files[fileId];
  saveTrackedFiles(files);
};

/**
 * Clean expired files from tracking
 * @returns {Array<string>} - Array of expired file IDs that were removed
 */
export const cleanExpiredFiles = () => {
  const files = getTrackedFiles();
  const expiredIds = [];
  const expirationTime = EXPIRATION_HOURS * 60 * 60 * 1000;

  Object.keys(files).forEach(fileId => {
    const file = files[fileId];
    const age = Date.now() - file.uploadTime;
    if (age > expirationTime) {
      expiredIds.push(fileId);
      delete files[fileId];
    }
  });

  if (expiredIds.length > 0) {
    saveTrackedFiles(files);
  }

  return expiredIds;
};

/**
 * Remove expired file_data from conversation parts and replace with text
 * @param {Array} contents - Conversation contents to clean
 * @returns {Array} - Cleaned contents with expired files replaced
 */
export const removeExpiredFilesFromContents = (contents) => {
  if (!Array.isArray(contents)) return contents;

  return contents.map(content => {
    if (!content.parts || !Array.isArray(content.parts)) {
      return content;
    }

    const cleanedParts = content.parts.map(part => {
      if (part.file_data && part.file_data.file_uri) {
        const fileId = extractFileId(part.file_data.file_uri);
        if (fileId && isFileExpired(fileId)) {
          // Replace expired file with text part
          return {
            text: "expired content"
          };
        }
      }
      return part;
    });

    return {
      ...content,
      parts: cleanedParts,
    };
  });
};

/**
 * Extract file ID from 403 error message
 * @param {string} errorMessage - The error message
 * @returns {string|null} - The file ID or null if not found
 */
export const extractFileIdFromError = (errorMessage) => {
  if (!errorMessage) return null;
  // Error format: "You do not have permission to access the File 3pkmvw1slxx8 or it may not exist."
  const match = errorMessage.match(/File\s+([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

/**
 * Get all tracked files (for export)
 * @returns {Object} - Object mapping file_id to { uploadTime, fileUri }
 */
export const getAllTrackedFiles = () => {
  return getTrackedFiles();
};

/**
 * Set tracked files (for import)
 * @param {Object} files - Object mapping file_id to { uploadTime, fileUri }
 */
export const setTrackedFiles = (files) => {
  if (files && typeof files === 'object') {
    saveTrackedFiles(files);
  }
};

