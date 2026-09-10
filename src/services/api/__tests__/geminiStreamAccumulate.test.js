import {
  applyStreamChunk,
  buildStreamResponse,
  createStreamAccumulator,
} from "../geminiStreamAccumulate";

function accumulate(chunks) {
  const accumulator = createStreamAccumulator();
  chunks.forEach((chunk) => applyStreamChunk(accumulator, chunk));
  return buildStreamResponse(accumulator);
}

describe("geminiStreamAccumulate", () => {
  it("keeps a functionCall that arrives with thoughtSignature and no text", () => {
    const response = accumulate([
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "finnhub_get_stock_data",
                    args: { data_type: "quote", symbol: "AAPL" },
                  },
                  thoughtSignature: "abc123",
                },
              ],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: { parts: [{ text: "" }], role: "model" },
            finishReason: "STOP",
          },
        ],
      },
    ]);

    expect(response.candidates[0].finishReason).toBe("STOP");
    expect(response.candidates[0].content.parts).toEqual([
      {
        functionCall: {
          name: "finnhub_get_stock_data",
          args: { data_type: "quote", symbol: "AAPL" },
        },
        thoughtSignature: "abc123",
      },
    ]);
  });

  it("does not merge a functionCall into an earlier thought part", () => {
    const response = accumulate([
      {
        candidates: [
          {
            content: {
              parts: [{ thought: true, text: "Looking this up." }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "finnhub_get_stock_data",
                    args: { data_type: "quote" },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      },
    ]);

    const parts = response.candidates[0].content.parts;
    expect(parts[0]).toMatchObject({ thought: true, text: "Looking this up." });
    expect(parts[0].functionCall).toBeUndefined();
    expect(parts[1].functionCall).toEqual({
      name: "finnhub_get_stock_data",
      args: { data_type: "quote" },
    });
  });

  it("merges incremental functionCall args without dropping the name", () => {
    const response = accumulate([
      {
        candidates: [
          {
            content: {
              parts: [{ functionCall: { name: "finnhub_get_stock_data", args: {} } }],
            },
          },
        ],
      },
      {
        candidates: [
          {
            content: {
              parts: [{ functionCall: { args: { data_type: "quote" } } }],
            },
            finishReason: "STOP",
          },
        ],
      },
    ]);

    expect(response.candidates[0].content.parts[0].functionCall).toEqual({
      name: "finnhub_get_stock_data",
      args: { data_type: "quote" },
    });
  });
});
