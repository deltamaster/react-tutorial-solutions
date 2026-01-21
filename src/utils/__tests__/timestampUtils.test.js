import { formatTimestamp } from "../timestampUtils";

describe("timestampUtils", () => {
  describe("formatTimestamp", () => {
    beforeEach(() => {
      // Mock current date to ensure consistent tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-15T14:30:00"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return empty string for falsy input", () => {
      expect(formatTimestamp(null)).toBe("");
      expect(formatTimestamp(undefined)).toBe("");
      expect(formatTimestamp("")).toBe("");
      expect(formatTimestamp(0)).toBe("");
    });

    it("should format today's timestamp as time only", () => {
      const today = new Date("2024-01-15T10:30:00").getTime();
      const result = formatTimestamp(today);
      expect(result).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/);
    });

    it("should format this year's timestamp with date and time", () => {
      const thisYear = new Date("2024-01-10T10:30:00").getTime();
      const result = formatTimestamp(thisYear);
      expect(result).toMatch(/Jan \d{1,2} \d{1,2}:\d{2}\s(AM|PM)$/);
    });

    it("should format previous year's timestamp with full date", () => {
      const lastYear = new Date("2023-12-25T10:30:00").getTime();
      const result = formatTimestamp(lastYear);
      expect(result).toMatch(/Dec 25, 2023 \d{1,2}:\d{2}\s(AM|PM)$/);
    });

    it("should handle string timestamps", () => {
      const timestamp = "2024-01-10T10:30:00";
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/Jan \d{1,2} \d{1,2}:\d{2}\s(AM|PM)$/);
    });

    it("should handle Date objects", () => {
      const date = new Date("2024-01-10T10:30:00");
      const result = formatTimestamp(date);
      expect(result).toMatch(/Jan \d{1,2} \d{1,2}:\d{2}\s(AM|PM)$/);
    });
  });
});
