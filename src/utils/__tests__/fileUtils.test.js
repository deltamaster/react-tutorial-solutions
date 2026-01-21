import {
  isValidImageType,
  isValidPdfType,
  isValidFileSize,
  validateImageFile,
  validatePdfFile,
  isImageMimeType,
  isPdfMimeType,
  VALID_IMAGE_TYPES,
  VALID_PDF_TYPE,
  MAX_FILE_SIZE,
} from "../fileUtils";

describe("fileUtils", () => {
  describe("isValidImageType", () => {
    it("should return true for valid image types", () => {
      VALID_IMAGE_TYPES.forEach((type) => {
        const file = { type };
        expect(isValidImageType(file)).toBe(true);
      });
    });

    it("should return false for invalid image types", () => {
      const file = { type: "image/gif" };
      expect(isValidImageType(file)).toBe(false);
    });

    it("should return false for non-image files", () => {
      const file = { type: "application/pdf" };
      expect(isValidImageType(file)).toBe(false);
    });

    it("should return false for files without type", () => {
      expect(isValidImageType({})).toBe(false);
      expect(isValidImageType(null)).toBe(false);
      expect(isValidImageType(undefined)).toBe(false);
    });
  });

  describe("isValidPdfType", () => {
    it("should return true for PDF files", () => {
      const file = { type: VALID_PDF_TYPE };
      expect(isValidPdfType(file)).toBe(true);
    });

    it("should return false for non-PDF files", () => {
      const file = { type: "image/png" };
      expect(isValidPdfType(file)).toBe(false);
    });

    it("should return false for files without type", () => {
      expect(isValidPdfType({})).toBe(false);
      expect(isValidPdfType(null)).toBe(false);
      expect(isValidPdfType(undefined)).toBe(false);
    });
  });

  describe("isValidFileSize", () => {
    it("should return true for files within size limit", () => {
      const file = { size: MAX_FILE_SIZE };
      expect(isValidFileSize(file)).toBe(true);
    });

    it("should return true for files smaller than limit", () => {
      const file = { size: MAX_FILE_SIZE - 1 };
      expect(isValidFileSize(file)).toBe(true);
    });

    it("should return false for files exceeding size limit", () => {
      const file = { size: MAX_FILE_SIZE + 1 };
      expect(isValidFileSize(file)).toBe(false);
    });

    it("should accept custom max size", () => {
      const file = { size: 1000 };
      expect(isValidFileSize(file, 500)).toBe(false);
      expect(isValidFileSize(file, 2000)).toBe(true);
    });

    it("should return false for files without size", () => {
      expect(isValidFileSize({})).toBe(false);
      expect(isValidFileSize(null)).toBe(false);
      expect(isValidFileSize(undefined)).toBe(false);
    });
  });

  describe("validateImageFile", () => {
    it("should return valid for valid image file", () => {
      const file = { type: "image/png", size: 1000 };
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error for missing file", () => {
      const result = validateImageFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    it("should return error for invalid image type", () => {
      const file = { type: "image/gif", size: 1000 };
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported file format");
    });

    it("should return error for file exceeding size limit", () => {
      const file = { type: "image/png", size: MAX_FILE_SIZE + 1 };
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("20MB limit");
    });
  });

  describe("validatePdfFile", () => {
    it("should return valid for valid PDF file", () => {
      const file = { type: VALID_PDF_TYPE, size: 1000 };
      const result = validatePdfFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error for missing file", () => {
      const result = validatePdfFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    it("should return error for non-PDF file", () => {
      const file = { type: "image/png", size: 1000 };
      const result = validatePdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("PDF files only");
    });

    it("should return error for PDF exceeding size limit", () => {
      const file = { type: VALID_PDF_TYPE, size: MAX_FILE_SIZE + 1 };
      const result = validatePdfFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("20MB limit");
    });
  });

  describe("isImageMimeType", () => {
    it("should return true for image MIME types", () => {
      expect(isImageMimeType("image/png")).toBe(true);
      expect(isImageMimeType("image/jpeg")).toBe(true);
      expect(isImageMimeType("image/webp")).toBe(true);
    });

    it("should return false for non-image MIME types", () => {
      expect(isImageMimeType("application/pdf")).toBe(false);
      expect(isImageMimeType("text/plain")).toBe(false);
    });

    it("should return false for falsy values", () => {
      expect(isImageMimeType(null)).toBe(false);
      expect(isImageMimeType(undefined)).toBe(false);
      expect(isImageMimeType("")).toBe(false);
    });
  });

  describe("isPdfMimeType", () => {
    it("should return true for PDF MIME type", () => {
      expect(isPdfMimeType(VALID_PDF_TYPE)).toBe(true);
    });

    it("should return false for non-PDF MIME types", () => {
      expect(isPdfMimeType("image/png")).toBe(false);
      expect(isPdfMimeType("text/plain")).toBe(false);
    });

    it("should return false for falsy values", () => {
      expect(isPdfMimeType(null)).toBe(false);
      expect(isPdfMimeType(undefined)).toBe(false);
      expect(isPdfMimeType("")).toBe(false);
    });
  });
});
