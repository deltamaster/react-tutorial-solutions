import {
  listConversationTitlesFromOneDrive,
  searchConversationTitlesFromOneDrive,
  searchConversationPartsByKeywordFromOneDrive,
  searchConversationPartsByTimeRangeFromOneDrive,
  getConversationPartFromOneDrive,
} from "../conversationHistoryOneDrive";

jest.mock("../../services/sync/onedriveClient", () => ({
  getOneDriveAccessToken: jest.fn(),
}));

jest.mock("../../services/sync/fileService", () => ({
  fetchConversationsIndex: jest.fn(),
  fetchConversation: jest.fn(),
}));

import { getOneDriveAccessToken } from "../../services/sync/onedriveClient";
import { fetchConversationsIndex, fetchConversation } from "../../services/sync/fileService";

describe("conversationHistoryOneDrive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("listConversationTitlesFromOneDrive uses token and index", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversationsIndex.mockResolvedValue({
      conversations: [{ id: "c1", name: "Hi", tags: ["a"] }],
    });

    const rows = await listConversationTitlesFromOneDrive();
    expect(fetchConversationsIndex).toHaveBeenCalledWith("tok");
    expect(rows).toEqual([{ title: "Hi", tags: ["a"], conversationUuid: "c1" }]);
  });

  it("uses explicit accessToken when provided", async () => {
    getOneDriveAccessToken.mockResolvedValue("ignored");
    fetchConversationsIndex.mockResolvedValue({ conversations: [] });

    await listConversationTitlesFromOneDrive("explicit");
    expect(fetchConversationsIndex).toHaveBeenCalledWith("explicit");
    expect(getOneDriveAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no token and getOneDriveAccessToken returns null", async () => {
    getOneDriveAccessToken.mockResolvedValue(null);
    await expect(listConversationTitlesFromOneDrive()).rejects.toThrow(/OneDrive access token unavailable/);
  });

  it("searchConversationTitlesFromOneDrive filters by keyword", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversationsIndex.mockResolvedValue({
      conversations: [
        { id: "a", name: "Alpha", tags: [] },
        { id: "b", name: "Beta", tags: ["findme"] },
      ],
    });

    const rows = await searchConversationTitlesFromOneDrive("beta");
    expect(rows.map((r) => r.conversationUuid)).toEqual(["b"]);
  });

  const sampleExport = {
    id: "c1",
    conversation: [
      {
        role: "user",
        parts: [{ text: "hello planet", uuid: "p1", timestamp: 100 }],
        timestamp: 100,
      },
    ],
  };

  it("searchConversationPartsByKeywordFromOneDrive loads file and searches", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversation.mockResolvedValue(sampleExport);

    const hits = await searchConversationPartsByKeywordFromOneDrive("c1", "planet");
    expect(fetchConversation).toHaveBeenCalledWith("tok", "c1");
    expect(hits.length).toBe(1);
    expect(hits[0].parts).toEqual([expect.stringContaining("planet")]);
  });

  it("searchConversationPartsByKeywordFromOneDrive returns [] when file missing", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversation.mockResolvedValue(null);
    const hits = await searchConversationPartsByKeywordFromOneDrive("missing", "x");
    expect(hits).toEqual([]);
  });

  it("searchConversationPartsByTimeRangeFromOneDrive", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversation.mockResolvedValue(sampleExport);

    const rows = await searchConversationPartsByTimeRangeFromOneDrive("c1", 50, 150);
    expect(rows).toEqual([{ role: "user", partUuid: "p1", timestamp: 100 }]);
  });

  it("getConversationPartFromOneDrive", async () => {
    getOneDriveAccessToken.mockResolvedValue("tok");
    fetchConversation.mockResolvedValue(sampleExport);

    const part = await getConversationPartFromOneDrive("c1", "p1");
    expect(part).toEqual({ role: "user", parts: "hello planet", timestamp: 100 });
  });
});
