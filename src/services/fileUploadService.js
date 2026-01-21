/**
 * File upload service
 * Handles file compression and base64 conversion for uploads
 */

/**
 * Compresses an image file for display
 * Resizes image to fit within max dimensions while maintaining aspect ratio
 * 
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width in pixels (default: 720)
 * @param {number} maxHeight - Maximum height in pixels (default: 720)
 * @param {number} quality - Compression quality 0-1 (default: 0.7)
 * @returns {Promise<string>} - Promise resolving to base64 string of compressed image
 */
export const compressImageForDisplay = (file, maxWidth = 720, maxHeight = 720, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression
        const mimeType = file.type || 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        const base64String = compressedDataUrl.split(",")[1];
        resolve(base64String);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a file to base64 string
 * Used for non-images or when compression is not needed
 * 
 * @param {File} file - File to convert
 * @returns {Promise<string>} - Promise resolving to base64 string
 */
export const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
