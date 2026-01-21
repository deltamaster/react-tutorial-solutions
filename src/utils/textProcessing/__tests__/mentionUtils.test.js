import { extractMentionedRolesFromParts } from "../mentionUtils";

describe("mentionUtils", () => {
  describe("extractMentionedRolesFromParts", () => {
    const mentionRoleMap = {
      adrien: "Adrien",
      belinda: "Belinda",
      charlie: "Charlie",
      diana: "Diana",
    };

    it("should extract mentioned roles from text parts", () => {
      const parts = [
        { text: "Hello @adrien" },
        { text: "Ask @belinda about it" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Adrien", "Belinda"]);
    });

    it("should return unique roles only", () => {
      const parts = [
        { text: "@adrien hello" },
        { text: "Also @adrien" },
        { text: "And @belinda" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Adrien", "Belinda"]);
    });

    it("should ignore hidden parts", () => {
      const parts = [
        { text: "@adrien", hide: true },
        { text: "@belinda" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Belinda"]);
    });

    it("should ignore thought parts", () => {
      const parts = [
        { text: "@adrien", thought: true },
        { text: "@charlie" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Charlie"]);
    });

    it("should ignore parts without text", () => {
      const parts = [
        { inline_data: { data: "base64" } },
        { text: "@diana" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Diana"]);
    });

    it("should handle empty parts array", () => {
      const result = extractMentionedRolesFromParts([], mentionRoleMap);
      expect(result).toEqual([]);
    });

    it("should handle non-array input", () => {
      expect(extractMentionedRolesFromParts(null, mentionRoleMap)).toEqual([]);
      expect(extractMentionedRolesFromParts(undefined, mentionRoleMap)).toEqual([]);
      expect(extractMentionedRolesFromParts("not an array", mentionRoleMap)).toEqual([]);
    });

    it("should handle parts with no mentions", () => {
      const parts = [
        { text: "Just regular text" },
        { text: "No mentions here" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual([]);
    });

    it("should be case insensitive for mentions", () => {
      const parts = [
        { text: "@ADRIEN" },
        { text: "@Belinda" },
        { text: "@charlie" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Adrien", "Belinda", "Charlie"]);
    });

    it("should ignore mentions not in the role map", () => {
      const parts = [
        { text: "@adrien" },
        { text: "@unknown" },
        { text: "@belinda" },
      ];
      const result = extractMentionedRolesFromParts(parts, mentionRoleMap);
      expect(result).toEqual(["Adrien", "Belinda"]);
    });
  });
});
