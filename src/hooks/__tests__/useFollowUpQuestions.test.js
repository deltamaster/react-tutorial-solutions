import { renderHook, act, waitFor } from "@testing-library/react";
import { useFollowUpQuestions } from "../useFollowUpQuestions";
import { generateFollowUpQuestions } from "../../utils/apiUtils";

// Mock the API utility
jest.mock("../../utils/apiUtils", () => ({
  generateFollowUpQuestions: jest.fn(),
}));

describe("useFollowUpQuestions", () => {
  const mockConversationRef = { current: [{ role: "user", text: "Hello" }] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with empty questions and not loading", () => {
    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: [],
      })
    );

    expect(result.current.followUpQuestions).toEqual([]);
    expect(result.current.nextQuestionLoading).toBe(false);
  });

  it("should cancel pending questions", () => {
    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: [],
      })
    );

    act(() => {
      result.current.cancelPendingFollowUpQuestions();
    });

    expect(result.current.nextQuestionLoading).toBe(false);
  });

  it("should not schedule questions when activeTypers exist", () => {
    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: ["Adrien"],
      })
    );

    act(() => {
      result.current.scheduleFollowUpQuestions();
    });

    expect(generateFollowUpQuestions).not.toHaveBeenCalled();
  });

  it("should not schedule questions when conversation is empty", () => {
    const emptyRef = { current: [] };
    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: emptyRef,
        activeTypers: [],
      })
    );

    act(() => {
      result.current.scheduleFollowUpQuestions();
    });

    expect(generateFollowUpQuestions).not.toHaveBeenCalled();
  });

  it("should generate follow-up questions when scheduled", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '["Question 1?", "Question 2?", "Question 3?"]',
              },
            ],
          },
        },
      ],
    };

    generateFollowUpQuestions.mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: [],
      })
    );

    act(() => {
      result.current.scheduleFollowUpQuestions();
    });

    await waitFor(() => {
      expect(result.current.followUpQuestions.length).toBeGreaterThan(0);
    });

    expect(result.current.followUpQuestions).toHaveLength(3);
    expect(result.current.nextQuestionLoading).toBe(false);
  });

  it("should handle invalid JSON response", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Invalid JSON" }],
          },
        },
      ],
    };

    generateFollowUpQuestions.mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: [],
      })
    );

    act(() => {
      result.current.scheduleFollowUpQuestions();
    });

    await waitFor(() => {
      expect(result.current.nextQuestionLoading).toBe(false);
    });

    expect(result.current.followUpQuestions).toEqual([]);
  });

  it("should filter out empty questions", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '["Valid question?", "", "Another question?"]',
              },
            ],
          },
        },
      ],
    };

    generateFollowUpQuestions.mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useFollowUpQuestions({
        conversationRef: mockConversationRef,
        activeTypers: [],
      })
    );

    act(() => {
      result.current.scheduleFollowUpQuestions();
    });

    await waitFor(() => {
      expect(result.current.followUpQuestions.length).toBeGreaterThan(0);
    });

    expect(result.current.followUpQuestions).toHaveLength(2);
    expect(result.current.followUpQuestions).not.toContain("");
  });
});
