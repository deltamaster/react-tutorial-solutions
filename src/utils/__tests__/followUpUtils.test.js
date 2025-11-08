import { sanitizeFollowUpResponse } from "../followUpUtils";

describe("sanitizeFollowUpResponse", () => {
  it("returns empty string for falsy input", () => {
    expect(sanitizeFollowUpResponse("")).toBe("");
    expect(sanitizeFollowUpResponse(null)).toBe("");
    expect(sanitizeFollowUpResponse(undefined)).toBe("");
  });

  it("removes $$$ NAME BEGIN/END $$$ markers", () => {
    const input = `
$$$ USER BEGIN $$$
What should I ask next?
$$$ USER END $$$
`;
    expect(sanitizeFollowUpResponse(input)).toBe("What should I ask next?");
  });

  it("strips markdown bullets and numbering", () => {
    const input = `
1. First question?
- Second question?
* Third question?
> - Nested question?
`;
    expect(sanitizeFollowUpResponse(input)).toBe(
      ["First question?", "Second question?", "Third question?", "Nested question?"].join("\n")
    );
  });

  it("trims whitespace-only lines", () => {
    const input = `

  What is the deadline?

`;
    expect(sanitizeFollowUpResponse(input)).toBe("What is the deadline?");
  });

  it("keeps plain text untouched apart from trimming", () => {
    const input = "Should we schedule a follow-up?";
    expect(sanitizeFollowUpResponse(input)).toBe("Should we schedule a follow-up?");
  });
});

