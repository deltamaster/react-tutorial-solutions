import {
  appendMessage,
  deleteMessages,
  updateMessagePart,
  isFunctionResponseMessage,
  findFunctionResponseIndices,
} from "../conversationService";

describe("conversationService", () => {
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
