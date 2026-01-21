import { escapeCurrencyDollars, removeBeginMarker, replaceMentions } from "../textTransform";

describe("textTransform utilities", () => {
  describe("escapeCurrencyDollars", () => {
    it("should escape dollar signs followed by digits", () => {
      expect(escapeCurrencyDollars("Price is $100")).toBe("Price is \\$100");
      expect(escapeCurrencyDollars("Cost: $884.10")).toBe("Cost: \\$884.10");
      expect(escapeCurrencyDollars("Total: $879.00")).toBe("Total: \\$879.00");
    });

    it("should not escape dollar signs in math expressions", () => {
      expect(escapeCurrencyDollars("Math: $x + y$")).toBe("Math: $x + y$");
      expect(escapeCurrencyDollars("Formula: $\\alpha$")).toBe("Formula: $\\alpha$");
    });

    it("should handle multiple currency amounts", () => {
      expect(escapeCurrencyDollars("Prices: $100, $200, $300")).toBe(
        "Prices: \\$100, \\$200, \\$300"
      );
    });

    it("should handle empty or null input", () => {
      expect(escapeCurrencyDollars("")).toBe("");
      expect(escapeCurrencyDollars(null)).toBe(null);
      expect(escapeCurrencyDollars(undefined)).toBe(undefined);
    });

    it("should not escape already escaped dollar signs", () => {
      expect(escapeCurrencyDollars("Price: \\$100")).toBe("Price: \\$100");
    });
  });

  describe("removeBeginMarker", () => {
    it("should remove BEGIN marker from the beginning", () => {
      const input = "$$$ USER BEGIN $$$\nHello world";
      expect(removeBeginMarker(input)).toBe("Hello world");
    });

    it("should handle markers with extra whitespace", () => {
      const input = "$$$   Adrien BEGIN   $$$\n\nContent here";
      expect(removeBeginMarker(input)).toBe("\nContent here");
    });

    it("should not remove markers in the middle", () => {
      const input = "Some text\n$$$ USER BEGIN $$$\nMore text";
      expect(removeBeginMarker(input)).toBe(input);
    });

    it("should handle empty or null input", () => {
      expect(removeBeginMarker("")).toBe("");
      expect(removeBeginMarker(null)).toBe(null);
      expect(removeBeginMarker(undefined)).toBe(undefined);
    });

    it("should handle text without markers", () => {
      const input = "Just regular text";
      expect(removeBeginMarker(input)).toBe(input);
    });
  });

  describe("replaceMentions", () => {
    it("should replace @mentions with markdown links", () => {
      expect(replaceMentions("Hello @adrien")).toBe("Hello [@adrien](##)");
      expect(replaceMentions("Ask @belinda about it")).toBe("Ask [@belinda](##) about it");
    });

    it("should be case insensitive", () => {
      expect(replaceMentions("Hi @ADRIEN")).toBe("Hi [@ADRIEN](##)");
      expect(replaceMentions("Talk to @Belinda")).toBe("Talk to [@Belinda](##)");
    });

    it("should handle multiple mentions", () => {
      expect(replaceMentions("@adrien and @charlie")).toBe(
        "[@adrien](##) and [@charlie](##)"
      );
    });

    it("should not replace invalid mentions", () => {
      expect(replaceMentions("@invalid @user")).toBe("@invalid @user");
    });

    it("should handle empty or null input", () => {
      expect(replaceMentions("")).toBe("");
      expect(replaceMentions(null)).toBe(null);
      expect(replaceMentions(undefined)).toBe(undefined);
    });

    it("should handle text without mentions", () => {
      const input = "Just regular text";
      expect(replaceMentions(input)).toBe(input);
    });
  });
});
