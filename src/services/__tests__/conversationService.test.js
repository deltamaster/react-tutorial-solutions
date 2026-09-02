import {
  appendMessage,
  upsertMessage,
  deleteMessages,
  updateMessagePart,
  isFunctionResponseMessage,
  findFunctionResponseIndices,
  mergeAdjacentThoughtParts,
  getCurrentConversation,
  getLongestConversation,
} from "../conversationService";

describe("conversationService", () => {
  describe("getCurrentConversation", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should prefer localStorage when ref is empty but storage has history", () => {
      const history = [
        { role: "user", timestamp: 1, parts: [{ text: "old" }] },
        { role: "model", timestamp: 2, parts: [{ text: "reply" }] },
      ];
      localStorage.setItem("conversation", JSON.stringify(history));

      const result = getCurrentConversation({ ref: { current: [] } });
      expect(result).toHaveLength(2);
      expect(result[0].parts[0].text).toBe("old");
    });

    it("should return the longest available source", () => {
      const refConversation = [{ role: "user", timestamp: 1, parts: [{ text: "a" }] }];
      const snapshot = [
        { role: "user", timestamp: 1, parts: [{ text: "a" }] },
        { role: "model", timestamp: 2, parts: [{ text: "b" }] },
      ];

      const result = getCurrentConversation({
        ref: { current: refConversation },
        snapshot,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("getLongestConversation", () => {
    it("should pick the array with the most messages", () => {
      const result = getLongestConversation([], [{ role: "user" }], [{ role: "user" }, { role: "model" }]);
      expect(result).toHaveLength(2);
    });
  });

  describe("mergeAdjacentThoughtParts", () => {
    it("should merge consecutive thought parts into one", () => {
      const parts = [
        { thought: true, text: "**Assessing** start with `" },
        { thought: true, text: "`\nI've confirmed this." },
        { thought: false, text: "Hello!" },
      ];

      const result = mergeAdjacentThoughtParts(parts);
      expect(result).toHaveLength(2);
      expect(result[0].thought).toBe(true);
      expect(result[0].text).toBe("**Assessing** start with ``\nI've confirmed this.");
      expect(result[1].text).toBe("Hello!");
    });

    it("should not merge thought parts separated by response text", () => {
      const parts = [
        { thought: true, text: "First thought" },
        { thought: false, text: "Answer" },
        { thought: true, text: "Second thought" },
      ];

      const result = mergeAdjacentThoughtParts(parts);
      expect(result).toHaveLength(3);
    });
  });

  describe("appendMessage", () => {
    it("should append message to conversation", () => {
      const conversation = [{ role: "user", text: "Hello" }];
      const newMessage = { role: "model", text: "Hi there" };
      const result = appendMessage(conversation, newMessage);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newMessage);
    });

    it("should handle null conversation", () => {
      const newMessage = { role: "user", text: "Hello" };
      const result = appendMessage(null, newMessage);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newMessage);
    });

    it("should handle empty conversation", () => {
      const newMessage = { role: "user", text: "Hello" };
      const result = appendMessage([], newMessage);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newMessage);
    });
  });

  describe("upsertMessage", () => {
    it("should update model message without replacing user message that shares timestamp", () => {
      const conversation = [
        { role: "user", timestamp: 100, parts: [{ text: "test" }] },
      ];
      const modelMessage = {
        role: "model",
        timestamp: 100,
        parts: [{ text: "reply" }],
      };
      const result = upsertMessage(conversation, modelMessage);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("user");
      expect(result[0].parts[0].text).toBe("test");
      expect(result[1].role).toBe("model");
      expect(result[1].parts[0].text).toBe("reply");
    });

    it("should upsert by stable message id", () => {
      const conversation = [
        {
          id: "model-1",
          role: "model",
          timestamp: 100,
          parts: [{ text: "partial" }],
        },
      ];
      const updated = upsertMessage(conversation, {
        id: "model-1",
        role: "model",
        timestamp: 100,
        parts: [{ text: "final" }],
      });
      expect(updated).toHaveLength(1);
      expect(updated[0].parts[0].text).toBe("final");
    });
  });

  describe("deleteMessages", () => {
    it("should delete messages at specified indices", () => {
      const conversation = [
        { role: "user", text: "Message 1" },
        { role: "model", text: "Message 2" },
        { role: "user", text: "Message 3" },
      ];
      const result = deleteMessages(conversation, [0, 2]);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Message 2");
    });

    it("should handle empty indices array", () => {
      const conversation = [{ role: "user", text: "Message 1" }];
      const result = deleteMessages(conversation, []);
      expect(result).toEqual(conversation);
    });

    it("should handle null conversation", () => {
      const result = deleteMessages(null, [0]);
      expect(result).toEqual([]);
    });

    it("should handle non-array conversation", () => {
      const result = deleteMessages("not an array", [0]);
      expect(result).toEqual([]);
    });
  });

  describe("updateMessagePart", () => {
    it("should update specific part of a message", () => {
      const conversation = [
        {
          role: "model",
          parts: [{ text: "Part 1" }, { text: "Part 2" }],
        },
      ];
      const result = updateMessagePart(conversation, 0, 1, "Updated Part 2");
      expect(result[0].parts[1].text).toBe("Updated Part 2");
      expect(result[0].parts[0].text).toBe("Part 1");
    });

    it("should preserve other message properties", () => {
      const conversation = [
        {
          role: "model",
          name: "Adrien",
          parts: [{ text: "Part 1" }],
        },
      ];
      const result = updateMessagePart(conversation, 0, 0, "Updated");
      expect(result[0].name).toBe("Adrien");
      expect(result[0].role).toBe("model");
    });

    it("should not modify other messages", () => {
      const conversation = [
        { role: "user", parts: [{ text: "Message 1" }] },
        { role: "model", parts: [{ text: "Message 2" }] },
      ];
      const result = updateMessagePart(conversation, 0, 0, "Updated");
      expect(result[1].parts[0].text).toBe("Message 2");
    });

    it("should handle null conversation", () => {
      const result = updateMessagePart(null, 0, 0, "Text");
      expect(result).toEqual([]);
    });

    it("should handle non-array conversation", () => {
      const result = updateMessagePart("not an array", 0, 0, "Text");
      expect(result).toEqual([]);
    });
  });

  describe("isFunctionResponseMessage", () => {
    it("should return true for functionResponse message", () => {
      const message = {
        role: "user",
        parts: [{ functionResponse: { name: "test" } }],
      };
      expect(isFunctionResponseMessage(message)).toBe(true);
    });

    it("should return false for non-user message", () => {
      const message = {
        role: "model",
        parts: [{ functionResponse: { name: "test" } }],
      };
      expect(isFunctionResponseMessage(message)).toBe(false);
    });

    it("should return false for message without parts", () => {
      const message = { role: "user" };
      expect(isFunctionResponseMessage(message)).toBe(false);
    });

    it("should return false for message with non-functionResponse parts", () => {
      const message = {
        role: "user",
        parts: [{ text: "Hello" }],
      };
      expect(isFunctionResponseMessage(message)).toBe(false);
    });

    it("should return false for message with mixed parts", () => {
      const message = {
        role: "user",
        parts: [
          { functionResponse: { name: "test" } },
          { text: "Hello" },
        ],
      };
      expect(isFunctionResponseMessage(message)).toBe(false);
    });

    it("should return false for null message", () => {
      expect(isFunctionResponseMessage(null)).toBe(false);
    });

    it("should return false for empty parts array", () => {
      const message = { role: "user", parts: [] };
      expect(isFunctionResponseMessage(message)).toBe(false);
    });
  });

  describe("findFunctionResponseIndices", () => {
    it("should find consecutive functionResponse messages", () => {
      const conversation = [
        { role: "model", text: "Model response" },
        {
          role: "user",
          parts: [{ functionResponse: { name: "func1" } }],
        },
        {
          role: "user",
          parts: [{ functionResponse: { name: "func2" } }],
        },
        { role: "user", text: "Regular message" },
      ];
      const result = findFunctionResponseIndices(conversation, 0);
      expect(result).toEqual([0, 1, 2]);
    });

    it("should return only model index if no functionResponse messages follow", () => {
      const conversation = [
        { role: "model", text: "Model response" },
        { role: "user", text: "Regular message" },
      ];
      const result = findFunctionResponseIndices(conversation, 0);
      expect(result).toEqual([0]);
    });

    it("should stop at first non-functionResponse message", () => {
      const conversation = [
        { role: "model", text: "Model response" },
        {
          role: "user",
          parts: [{ functionResponse: { name: "func1" } }],
        },
        { role: "user", text: "Regular message" },
        {
          role: "user",
          parts: [{ functionResponse: { name: "func2" } }],
        },
      ];
      const result = findFunctionResponseIndices(conversation, 0);
      expect(result).toEqual([0, 1]);
    });
  });
});
