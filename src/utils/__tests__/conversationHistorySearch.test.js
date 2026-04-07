import {
  listConversationTitles,
  searchConversationTitles,
  getConversationMessages,
  searchConversationPartsByKeyword,
  searchConversationPartsByTimeRange,
  getConversationPart,
} from "../conversationHistorySearch";

describe("conversationHistorySearch", () => {
  const index = {
    version: "1.0",
    conversations: [
      { id: "c1", name: "Alpha project", tags: ["work", "dev"] },
      { id: "c2", name: "Notes", tags: ["personal"] },
    ],
  };

  const exportBody = {
    version: "1.2",
    id: "c1",
    conversation: [
      {
        role: "user",
        parts: [{ text: "hello world", uuid: "p1", timestamp: 100 }],
        timestamp: 100,
      },
      {
        role: "model",
        name: "Adrien",
        parts: [
          { text: "world peace and world hunger", uuid: "p2", timestamp: 200 },
        ],
        timestamp: 200,
      },
      { role: "user", deleted: true, parts: [{ text: "gone", uuid: "pX" }], timestamp: 300 },
    ],
  };

  it("listConversationTitles maps name -> title and id -> conversationUuid", () => {
    expect(listConversationTitles(index)).toEqual([
      { title: "Alpha project", tags: ["work", "dev"], conversationUuid: "c1" },
      { title: "Notes", tags: ["personal"], conversationUuid: "c2" },
    ]);
  });

  it("searchConversationTitles matches title or tag", () => {
    expect(searchConversationTitles(index, "alpha").map((r) => r.conversationUuid)).toEqual(["c1"]);
    expect(searchConversationTitles(index, "personal").map((r) => r.conversationUuid)).toEqual(["c2"]);
    expect(searchConversationTitles(index, "").length).toBe(2);
  });

  it("getConversationMessages accepts array or export object", () => {
    expect(getConversationMessages(exportBody.conversation).length).toBe(3);
    expect(getConversationMessages(exportBody).length).toBe(3);
  });

  it("searchConversationPartsByKeyword combines multiple matches in the same part into parts[]", () => {
    const hits = searchConversationPartsByKeyword(exportBody, "world");
    expect(hits.length).toBe(2);
    expect(hits[0].role).toBe("user");
    expect(hits[0].parts).toEqual([expect.stringContaining("world")]);
    expect(hits[1].name).toBe("Adrien");
    expect(hits[1].partUuid).toBe("p2");
    expect(hits[1].parts.length).toBe(2);
    expect(hits[1].parts.every((s) => s.includes("world"))).toBe(true);
  });

  it("searchConversationPartsByKeyword respects conversationUuid when file id mismatches", () => {
    expect(searchConversationPartsByKeyword(exportBody, "world", { conversationUuid: "other" })).toEqual([]);
  });

  it("searchConversationPartsByTimeRange returns partUuid without text", () => {
    const rows = searchConversationPartsByTimeRange(exportBody, 150, 250);
    expect(rows).toEqual([
      { role: "model", name: "Adrien", partUuid: "p2", timestamp: 200 },
    ]);
  });

  it("getConversationPart returns full text in parts", () => {
    const detail = getConversationPart(exportBody, "p2");
    expect(detail).toEqual({
      role: "model",
      name: "Adrien",
      parts: "world peace and world hunger",
      timestamp: 200,
    });
  });

  it("getConversationPart returns null when conversationUuid mismatches", () => {
    expect(getConversationPart(exportBody, "p2", { conversationUuid: "x" })).toBeNull();
  });
});
