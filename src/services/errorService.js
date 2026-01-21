import { ApiError } from "../utils/apiUtils";

/**
 * Error handling service
 * Centralized error message formatting and error handling utilities
 */

/**
 * Builds a user-facing error message from an error object
 * 
 * @param {Error|ApiError} error - The error object
 * @returns {string} - User-friendly error message
 */
export const buildUserFacingErrorMessage = (error) => {
  if (error instanceof ApiError) {
    const { statusCode, errorType, message, details } = error;
    let userMessage = "";

    switch (errorType) {
      case "validation_error":
        userMessage = `Invalid input: ${message}`;
        break;
      case "file_processing_error":
        userMessage = `File processing error: ${message} (MIME type: ${
          details?.mimeType || "unknown"
        })`;
        break;
      case "api_response_error":
        userMessage = `Service error: ${message}`;
        if (statusCode === 401 || statusCode === 403) {
          userMessage += " - Please check your API key";
        }
        break;
      case "network_error":
        userMessage = `Network error: ${
          message || "Please check your internet connection"
        }`;
        break;
      default:
        userMessage = message;
    }

    if (statusCode && statusCode !== "Unknown") {
      userMessage += ` (Status: ${statusCode})`;
    }

    return userMessage;
  }

  const statusCode = error?.statusCode || error?.status || "Unknown";
  const errorMsg = error?.message || "Failed to send message";
  return `${errorMsg} (Status: ${statusCode})`;
};
