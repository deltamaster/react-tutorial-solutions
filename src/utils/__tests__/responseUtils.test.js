import { normalizeBeginMarker } from "../responseUtils";

describe("normalizeBeginMarker", () => {
  it("returns original parts when persona name is missing", () => {
    const parts = [{ text: "Hello world" }];
    expect(normalizeBeginMarker(parts)).toBe(parts);
  });

  it("removes duplicate markers and places one at the beginning", () => {
    const parts = [
      { text: "First line"                                                                                                                                                                                                                      },
      { text: "\n$$$ Adrien BEGIN $$$\nSecond line" },
      { text: "Third line $$$ Adrien BEGIN $$$" },
    ];

    const result = normalizeBeginMarker(parts, "Adrien");

    expect(result[0].text).toBe("$$$ Adrien BEGIN $$$\nFirst line");
    expect(result[1].text).toBe("Second line");
    expect(result[2].text).toBe("Third line ");
  });

  it("handles marker variations with extra whitespace and casing", () => {
    const parts = [
      { text: "Intro" },
      { text: "$$$   adrien begin   $$$\n\nDetails" },
    ];

    const result = normalizeBeginMarker(parts, "Adrien");

    expect(result[0].text).toBe("$$$ Adrien BEGIN $$$\nIntro");
    expect(result[1].text).toBe("Details");
  });

  it("leaves parts unchanged if no marker is found", () => {
    const parts = [
      { text: "Just text" },
      { text: "More text" },
    ];

    const result = normalizeBeginMarker(parts, "Adrien");

    expect(result).toEqual(parts);
  });

  it("skips thought parts when inserting the marker", () => {
    const parts = [
      { text: "$$$ Adrien BEGIN $$$\nInternal note", thought: true },
      { text: "Visible answer" },
    ];

    const result = normalizeBeginMarker(parts, "Adrien");

    expect(result[0].text).toBe("Internal note");
    expect(result[0].thought).toBe(true);
    expect(result[1].text).toBe("$$$ Adrien BEGIN $$$\nVisible answer");
  });

  it("returns parts unchanged when no text entries exist", () => {
    const parts = [
      { inlineData: { mimeType: "image/png", data: "abc" } },
    ];

    expect(normalizeBeginMarker(parts, "Adrien")).toEqual(parts);
  });
});


