import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "../useSettings";
import * as settingsService from "../../utils/settingsService";

// Mock the settingsService
jest.mock("../../utils/settingsService", () => ({
  getSubscriptionKey: jest.fn(() => "test-key"),
  setSubscriptionKey: jest.fn(),
  getSystemPrompt: jest.fn(() => "test-prompt"),
  setSystemPrompt: jest.fn(),
  getUserAvatar: jest.fn(() => "male"),
  setUserAvatar: jest.fn(),
  getModel: jest.fn(() => "gpt-4"),
  setModel: jest.fn(),
}));

// Mock chrome storage
const mockChromeStorage = {
  sync: {
    get: jest.fn((keys, callback) => callback({ apiKey: "chrome-key" })),
    set: jest.fn(),
  },
};

global.chrome = mockChromeStorage;

describe("useSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with default settings", () => {
    const { result } = renderHook(() => useSettings());
    
    expect(result.current.subscriptionKey).toBe("test-key");
    expect(result.current.systemPrompt).toBe("test-prompt");
    expect(result.current.userAvatar).toBe("male");
    expect(result.current.model).toBe("gpt-4");
  });

  it("should update subscription key", () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.handleSubscriptionKeyChange("new-key");
    });

    expect(settingsService.setSubscriptionKey).toHaveBeenCalledWith("new-key");
    expect(result.current.subscriptionKey).toBe("new-key");
  });

  it("should update system prompt", () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.handleSystemPromptChange("new-prompt");
    });

    expect(settingsService.setSystemPrompt).toHaveBeenCalledWith("new-prompt");
    expect(result.current.systemPrompt).toBe("new-prompt");
  });

  it("should update user avatar", () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.handleUserAvatarChange("female");
    });

    expect(settingsService.setUserAvatar).toHaveBeenCalledWith("female");
    expect(result.current.userAvatar).toBe("female");
  });

  it("should update model", () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.handleModelChange("gpt-3.5-turbo");
    });

    expect(settingsService.setModel).toHaveBeenCalledWith("gpt-3.5-turbo");
    expect(result.current.model).toBe("gpt-3.5-turbo");
  });

  it("should sync subscription key to Chrome storage when changed", async () => {
    const { result } = renderHook(() => useSettings());
    
    act(() => {
      result.current.handleSubscriptionKeyChange("chrome-synced-key");
    });

    await waitFor(() => {
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        apiKey: "chrome-synced-key",
      });
    });
  });
});
