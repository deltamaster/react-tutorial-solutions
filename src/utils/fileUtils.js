/**
 * File validation and utility functions
 * Centralized file type validation and size checking
 */

/**
 * Valid image MIME types
 */
export const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Valid PDF MIME type
 */
export const VALID_PDF_TYPE = "application/pdf";

/**
 * Maximum file size in bytes (20MB)
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Validates if a file is a valid image type
 * 
 * @param {File} file - File to validate
 * @returns {boolean} - True if file is a valid image type
 */
export const isValidImageType = (file) => {
  if (!file || !file.type) return false;
  return VALID_IMAGE_TYPES.includes(file.type);
};

/**
 * Validates if a file is a PDF
 * 
 * @param {File} file - File to validate
 * @returns {boolean} - True if file is a PDF
 */
export const isValidPdfType = (file) => {
  if (!file || !file.type) return false;
  return file.type === VALID_PDF_TYPE;
};

/**
 * Validates if a file size is within the allowed limit
 * 
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum size in bytes (default: MAX_FILE_SIZE)
 * @returns {boolean} - True if file size is within limit
 */
export const isValidFileSize = (file, maxSize = MAX_FILE_SIZE) => {
  if (!file || !file.size) return false;
  return file.size <= maxSize;
};

/**
 * Validates an image file (type and size)
 * 
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (!isValidImageType(file)) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload PNG, JPEG, WEBP, HEIC, or HEIF.",
    };
  }

  if (!isValidFileSize(file)) {
    return {
      valid: false,
      error: "File size exceeds 20MB limit.",
    };
  }

  return { valid: true };
};

/**
 * Validates a PDF file (type and size)
 * 
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export const validatePdfFile = (file) => {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (!isValidPdfType(file)) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload PDF files only.",
    };
  }

  if (!isValidFileSize(file)) {
    return {
      valid: false,
      error: "File size exceeds 20MB limit.",
    };
  }

  return { valid: true };
};

/**
 * Checks if a MIME type represents an image
 * 
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} - True if MIME type is an image
 */
export const isImageMimeType = (mimeType) => {
  return mimeType && mimeType.startsWith("image/");
};

/**
 * Checks if a MIME type represents a PDF
 * 
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} - True if MIME type is a PDF
 */
export const isPdfMimeType = (mimeType) => {
  return mimeType === VALID_PDF_TYPE;
};
