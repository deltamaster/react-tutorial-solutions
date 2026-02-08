import { useCallback } from "react";
import { compressImageForDisplay } from "../services/fileUploadService";
import { uploadFile } from "../services/api/fileUploadService";
import { trackFile } from "../utils/fileTrackingService";

/**
 * Custom hook for file upload functionality
 * Handles file processing, compression, and upload
 * 
 * @param {string} subscriptionKey - API subscription key for file uploads
 * @returns {Object} File upload functions
 */
export const useFileUpload = (subscriptionKey) => {
  /**
   * Process content parts to prepare display parts and files for upload
   * Separates files from other content and prepares them for display and upload
   * 
   * @param {Array} contentParts - Array of content parts (may include inline_data with files)
   * @returns {Promise<Object>} Object with displayContentParts and filesToUpload array
   */
  const processFilesForUpload = useCallback(async (contentParts) => {
    const displayContentParts = [];
    const filesToUpload = [];

    for (const part of contentParts) {
      if (part.inline_data && part.inline_data.file) {
        const file = part.inline_data.file;
        const mimeType = part.inline_data.mime_type;
        const isImage = mimeType.startsWith("image/");

        // Create display part with inline_data base64 for images
        const displayPart = {};
        if (isImage) {
          // Compress image for display (reduces localStorage size)
          const compressedBase64Data = await compressImageForDisplay(file);
          displayPart.inline_data = {
            mime_type: mimeType,
            data: compressedBase64Data,
          };
        }
        // For PDFs, we don't need inline_data for display

        // Store file info for async upload
        filesToUpload.push({
          partIndex: displayContentParts.length,
          file: file,
          mimeType: mimeType,
          isImage: isImage,
        });

        displayContentParts.push(displayPart);
      } else {
        displayContentParts.push(part);
      }
    }

    return { displayContentParts, filesToUpload };
  }, []);

  /**
   * Upload files and return file URIs
   * 
   * @param {Array} filesToUpload - Array of file upload info objects
   * @returns {Promise<Array>} Array of uploaded file info with mimeType and fileUri
   */
  const uploadFiles = useCallback(async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) {
      return [];
    }

    if (!subscriptionKey) {
      throw new Error("Subscription key is required for file uploads");
    }

    const uploadedFiles = await Promise.all(
      filesToUpload.map(async ({ file, mimeType }) => {
        const fileUri = await uploadFile(file, subscriptionKey);
        // Track the uploaded file
        trackFile(fileUri);
        return { mimeType, fileUri };
      })
    );

    return uploadedFiles;
  }, [subscriptionKey]);

  /**
   * Update content parts with file URIs after upload
   * 
   * @param {Array} displayContentParts - Original display content parts
   * @param {Array} filesToUpload - Array of file upload info objects
   * @param {Array} uploadedFiles - Array of uploaded file info with mimeType and fileUri
   * @returns {Array} Updated content parts with file_data
   */
  const updatePartsWithFileUris = useCallback(
    (displayContentParts, filesToUpload, uploadedFiles) => {
      const updatedParts = [...displayContentParts];
      filesToUpload.forEach(({ partIndex, mimeType }, uploadIndex) => {
        const uploadedFile = uploadedFiles[uploadIndex];
        updatedParts[partIndex] = {
          ...updatedParts[partIndex],
          file_data: {
            mime_type: mimeType,
            file_uri: uploadedFile.fileUri,
          },
          // Keep inline_data for images (already set above)
        };
      });
      return updatedParts;
    },
    []
  );

  return {
    processFilesForUpload,
    uploadFiles,
    updatePartsWithFileUris,
  };
};
