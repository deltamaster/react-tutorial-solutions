/**
 * File Upload Service
 * Handles file uploads to Gemini API using the 2-step resumable upload protocol
 */

import { ApiError } from './apiClient';

/**
 * Upload a file using the 2-step resumable upload protocol
 * @param {File} file - The file to upload
 * @param {string} subscriptionKey - The subscription key for authentication
 * @returns {Promise<string>} - The file URI from the upload response
 * @throws {ApiError} - If the upload fails
 */
export const uploadFile = async (file, subscriptionKey) => {
  const uploadApiUrl = "https://jp-gw2.azure-api.net/gemini/files";
  const fileSize = file.size;
  const mimeType = file.type;

  try {
    // Step 1: Prepare the upload
    const prepareResponse = await fetch(uploadApiUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": fileSize.toString(),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (!prepareResponse.ok) {
      const errorText = await prepareResponse.text();
      throw new ApiError(`Failed to prepare file upload: ${errorText}`, {
        status: prepareResponse.status,
        errorType: "file_upload_error",
        details: { step: "prepare" },
      });
    }

    // Extract the upload URL from the response header
    const uploadUrlHeader = prepareResponse.headers.get("x-goog-upload-url");
    if (!uploadUrlHeader) {
      throw new ApiError("Upload URL not found in response headers", {
        errorType: "file_upload_error",
        details: { step: "prepare" },
      });
    }

    // Extract query parameters from the upload URL header value
    // Only use the query parameters, not the entire URL
    let queryParams;
    if (uploadUrlHeader.startsWith("http://") || uploadUrlHeader.startsWith("https://")) {
      // Full URL provided, extract only the query parameters
      const urlObj = new URL(uploadUrlHeader);
      queryParams = urlObj.search;
    } else {
      // Already just query parameters
      queryParams = uploadUrlHeader.startsWith("?") ? uploadUrlHeader : `?${uploadUrlHeader}`;
    }

    // Step 2: Upload the actual file content using base API URL with query parameters
    const fileArrayBuffer = await file.arrayBuffer();
    const uploadResponse = await fetch(`${uploadApiUrl}${queryParams}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
      body: fileArrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new ApiError(`Failed to upload file: ${errorText}`, {
        status: uploadResponse.status,
        errorType: "file_upload_error",
        details: { step: "upload" },
      });
    }

    // Parse the response to get the file URI
    const responseData = await uploadResponse.json();
    if (responseData.file && responseData.file.uri) {
      return responseData.file.uri;
    } else {
      throw new ApiError("File URI not found in upload response", {
        errorType: "file_upload_error",
        details: { step: "upload", response: responseData },
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`File upload failed: ${error.message}`, {
      errorType: "file_upload_error",
      originalError: error,
    });
  }
};
