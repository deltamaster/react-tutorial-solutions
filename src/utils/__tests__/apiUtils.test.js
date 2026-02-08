import { postProcessModelResponse } from "../../services/api/geminiService";

describe("postProcessModelResponse", () => {
  describe("impersonation removal", () => {
    it("removes impersonation attempt when Adrien tries to impersonate Charlie", () => {
      const text = "This is my response. $$$ Charlie BEGIN $$$ This should be removed.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is my response.");
    });

    it("removes impersonation attempt when Belinda tries to impersonate Adrien", () => {
      const text = "Here's the answer. $$$ Adrien BEGIN $$$ More text here.";
      const result = postProcessModelResponse(text, "Belinda");
      expect(result).toBe("Here's the answer.");
    });

    it("removes impersonation attempt when Charlie tries to impersonate Diana", () => {
      const text = "Content here. $$$ Diana BEGIN $$$ Should be removed.";
      const result = postProcessModelResponse(text, "Charlie");
      expect(result).toBe("Content here.");
    });

    it("does not remove own persona marker", () => {
      const text = "My response. $$$ Adrien BEGIN $$$ This should stay.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toContain("This should stay");
    });

    it("handles case-insensitive impersonation detection", () => {
      const text = "Text here. $$$ charlie BEGIN $$$ Removed content.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Text here.");
    });

    it("handles impersonation with extra whitespace", () => {
      const text = "Content. $$$   Belinda   BEGIN   $$$ Removed.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Content.");
    });

    it("removes everything after first impersonation attempt", () => {
      const text = "First part. $$$ Charlie BEGIN $$$ Second part. $$$ Belinda BEGIN $$$ Third part.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("First part.");
    });

    it("handles multiple persona impersonations correctly", () => {
      const text = "Start. $$$ Xaiver BEGIN $$$ Middle. $$$ Belinda BEGIN $$$ End.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Start.");
    });
  });

  describe("markdown formatting - bold text", () => {
    it("adds spaces before and after bold text when missing", () => {
      const text = "This is**bold text**here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is **bold text** here.");
    });

    it("adds space before bold when missing", () => {
      const text = "Text**bold** here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Text **bold** here.");
    });

    it("adds space after bold when missing", () => {
      const text = "Here is **bold**text.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Here is **bold** text.");
    });

    it("does not add spaces when they already exist", () => {
      const text = "This is **bold text** here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is **bold text** here.");
    });

    it("handles multiple bold patterns in one line", () => {
      const text = "First**bold**second**bold**third.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("First **bold** second **bold** third.");
    });

    it("handles bold at start of line", () => {
      const text = "**bold**text";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe(" **bold** text");
    });

    it("handles bold at end of line", () => {
      const text = "text**bold**";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("text **bold** ");
    });

    it("handles bold with punctuation correctly", () => {
      const text = "See**bold**, and**more**.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("See **bold**, and **more**.");
    });

    it("removes spaces inside asterisks", () => {
      const text = " ** 168 ** ";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe(" **168** ");
    });

    it("removes spaces inside bold asterisks while preserving outer spacing", () => {
      const text = "text ** 168 ** more";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("text **168** more");
    });
  });

  describe("markdown formatting - italic text", () => {
    it("adds spaces before and after italic text when missing", () => {
      const text = "This is*italic text*here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is *italic text* here.");
    });

    it("adds space before italic when missing", () => {
      const text = "Text*italic* here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Text *italic* here.");
    });

    it("adds space after italic when missing", () => {
      const text = "Here is *italic*text.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Here is *italic* text.");
    });

    it("does not add spaces when they already exist", () => {
      const text = "This is *italic text* here.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is *italic text* here.");
    });

    it("handles multiple italic patterns in one line", () => {
      const text = "First*italic*second*italic*third.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("First *italic* second *italic* third.");
    });

    it("does not break bold patterns when processing italic", () => {
      const text = "This is**bold**and*italic*text.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is **bold** and *italic* text.");
    });

    it("removes spaces inside italic asterisks", () => {
      const text = " * 168 * ";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe(" *168* ");
    });
  });

  describe("line-by-line processing", () => {
    it("processes formatting within each line separately", () => {
      const text = "Line 1**bold**text\nLine 2*italic*text";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Line 1 **bold** text\nLine 2 *italic* text");
    });

    it("does not add spaces across line breaks", () => {
      const text = "Line 1**bold**\n*italic**Line 2";
      const result = postProcessModelResponse(text, "Adrien");
      // Should process each line independently
      expect(result).toContain("Line 1 **bold**");
      expect(result).toContain("\n");
    });

    it("handles multiple lines with mixed formatting", () => {
      const text = "First**bold**line\nSecond*italic*line\nThird**bold**and*italic*line";
      const result = postProcessModelResponse(text, "Adrien");
      const lines = result.split("\n");
      expect(lines[0]).toBe("First **bold** line");
      expect(lines[1]).toBe("Second *italic* line");
      expect(lines[2]).toBe("Third **bold** and *italic* line");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = postProcessModelResponse("", "Adrien");
      expect(result).toBe("");
    });

    it("handles null input", () => {
      const result = postProcessModelResponse(null, "Adrien");
      expect(result).toBe("");
    });

    it("handles undefined input", () => {
      const result = postProcessModelResponse(undefined, "Adrien");
      expect(result).toBe("");
    });

    it("handles text with no formatting", () => {
      const text = "This is just plain text with no formatting.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This is just plain text with no formatting.");
    });

    it("handles text with only impersonation, no other content", () => {
      const text = "$$$ Charlie BEGIN $$$ Some content.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("");
    });

    it("handles text with only formatting, no other content", () => {
      const text = "**bold**";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe(" **bold** ");
    });

    it("handles nested formatting correctly", () => {
      const text = "Text with**bold**and*italic*formatting.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Text with **bold** and *italic* formatting.");
    });

    it("handles unpaired asterisks (does not break)", () => {
      const text = "Text with*unpaired asterisk.";
      const result = postProcessModelResponse(text, "Adrien");
      // Should not crash, may or may not process unpaired asterisks
      expect(typeof result).toBe("string");
    });
  });

  describe("combined scenarios", () => {
    it("handles impersonation and formatting together", () => {
      const text = "This has**bold**text. $$$ Charlie BEGIN $$$ Removed**bold**text.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("This has **bold** text.");
    });

    it("processes formatting after impersonation removal", () => {
      const text = "Start**bold**middle. $$$ Belinda BEGIN $$$ End*italic*text.";
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toBe("Start **bold** middle.");
    });

    it("handles complex multi-line response", () => {
      const text = `Line 1 with**bold**text.
Line 2 with*italic*text.
Line 3**bold**and*italic*.
$$$ Charlie BEGIN $$$
Line 4 should be removed.`;
      const result = postProcessModelResponse(text, "Adrien");
      expect(result).toContain("Line 1 with **bold** text.");
      expect(result).toContain("Line 2 with *italic* text.");
      // Note: space before punctuation is not added
      expect(result).toContain("Line 3 **bold** and *italic*");
      expect(result).not.toContain("Line 4 should be removed");
    });
  });
});
