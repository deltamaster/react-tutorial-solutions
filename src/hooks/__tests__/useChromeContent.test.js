import { renderHook, waitFor, act } from "@testing-library/react";
import { useChromeContent } from "../useChromeContent";

// Mock chrome storage
const mockChromeStorage = {
  local: {
    get: jest.fn((keys, callback) => {
      callback({
        pageContent: { content: "Stored content" },
        contentTimestamp: Date.now() - 60000, // 1 minute ago
      });
    }),
    remove: jest.fn(),
  },
};

global.chrome = mockChromeStorage;

describe("useChromeContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset URL
    delete window.location;
    window.location = { search: "" };
  });

  it("should initialize with empty question", () => {
    const { result } = renderHook(() => useChromeContent());
    expect(result.current.question).toBe("");
  });

  it("should load content from Chrome storage when content=stored", async () => {
    window.location.search = "?content=stored";
    
    const { result } = renderHook(() => useChromeContent());
    
    await waitFor(() => {
      expect(result.current.question).toBe("Stored content");
    });
    
    expect(mockChromeStorage.local.remove).toHaveBeenCalledWith([
      "pageContent",
      "contentTimestamp",
    ]);
  });

  it("should load content from URL markdown parameter", async () => {
    window.location.search = "?markdown=Hello%20World";
    
    const { result } = renderHook(() => useChromeContent());
    
    await waitFor(() => {
      expect(result.current.question).toBe("Hello World");
    });
  });

  it("should load content from URL html parameter", async () => {
    window.location.search = "?html=Hello%20HTML";
    
    const { result } = renderHook(() => useChromeContent());
    
    await waitFor(() => {
      expect(result.current.question).toBe("Hello HTML");
    });
  });

  it("should prefer markdown over html parameter", async () => {
    window.location.search = "?markdown=Markdown&html=HTML";
    
    const { result } = renderHook(() => useChromeContent());
    
    await waitFor(() => {
      expect(result.current.question).toBe("Markdown");
    });
  });

  it("should ignore expired Chrome storage content", async () => {
    window.location.search = "?content=stored";
    mockChromeStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        pageContent: { content: "Old content" },
        contentTimestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
      });
    });
    
    const { result } = renderHook(() => useChromeContent());
    
    // Wait a bit to ensure the effect runs
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    expect(result.current.question).toBe("");
  });

  it("should allow setting question", () => {
    const { result } = renderHook(() => useChromeContent());
    
    act(() => {
      result.current.setQuestion("New question");
    });
    
    expect(result.current.question).toBe("New question");
  });
});
