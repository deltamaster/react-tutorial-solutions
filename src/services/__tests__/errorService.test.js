import { buildUserFacingErrorMessage } from "../errorService";
import { ApiError } from "../../services/api/apiClient";

describe("errorService", () => {
  describe("buildUserFacingErrorMessage", () => {
    it("should format validation_error correctly", () => {
      const error = new ApiError("Invalid input", "validation_error", 400);
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Invalid input: Invalid input (Status: 400)");
    });

    it("should format file_processing_error with MIME type", () => {
      const error = new ApiError(
        "File too large",
        "file_processing_error",
        400,
        { mimeType: "image/png" }
      );
      const result = buildUserFacingErrorMessage(error);
      expect(result).toContain("File processing error");
      expect(result).toContain("image/png");
      expect(result).toContain("Status: 400");
    });

    it("should format api_response_error with 401 status", () => {
      const error = new ApiError("Unauthorized", "api_response_error", 401);
      const result = buildUserFacingErrorMessage(error);
      expect(result).toContain("Service error");
      expect(result).toContain("check your API key");
      expect(result).toContain("Status: 401");
    });

    it("should format api_response_error with 403 status", () => {
      const error = new ApiError("Forbidden", "api_response_error", 403);
      const result = buildUserFacingErrorMessage(error);
      expect(result).toContain("Service error");
      expect(result).toContain("check your API key");
      expect(result).toContain("Status: 403");
    });

    it("should format network_error", () => {
      const error = new ApiError(
        "Connection timeout",
        "network_error",
        "Unknown"
      );
      const result = buildUserFacingErrorMessage(error);
      expect(result).toContain("Network error");
      expect(result).toContain("Connection timeout");
    });

    it("should format network_error with default message", () => {
      const error = new ApiError("", "network_error", "Unknown");
      const result = buildUserFacingErrorMessage(error);
      expect(result).toContain("Network error");
      expect(result).toContain("check your internet connection");
    });

    it("should handle default error type", () => {
      const error = new ApiError("Something went wrong", "unknown_type", 500);
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Something went wrong (Status: 500)");
    });

    it("should handle non-ApiError objects", () => {
      const error = { message: "Generic error", statusCode: 500 };
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Generic error (Status: 500)");
    });

    it("should handle errors with status property", () => {
      const error = { message: "Error", status: 404 };
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Error (Status: 404)");
    });

    it("should handle errors without message", () => {
      const error = { statusCode: 500 };
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Failed to send message (Status: 500)");
    });

    it("should handle errors without status", () => {
      const error = { message: "Error occurred" };
      const result = buildUserFacingErrorMessage(error);
      expect(result).toBe("Error occurred (Status: Unknown)");
    });
  });
});
