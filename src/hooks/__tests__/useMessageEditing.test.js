import { renderHook, act } from "@testing-library/react";
import { useMessageEditing } from "../useMessageEditing";

describe("useMessageEditing", () => {
  const mockSetConversation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with null editing state", () => {
    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    expect(result.current.editingIndex).toBe(null);
    expect(result.current.editingPartIndex).toBe(null);
    expect(result.current.editingText).toBe("");
  });

  it("should start editing when startEditing is called", () => {
    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    
    act(() => {
      result.current.startEditing(0, 1, "Test text");
    });

    expect(result.current.editingIndex).toBe(0);
    expect(result.current.editingPartIndex).toBe(1);
    expect(result.current.editingText).toBe("Test text");
  });

  it("should cancel editing when cancelEditing is called", () => {
    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    
    act(() => {
      result.current.startEditing(0, 1, "Test text");
    });

    act(() => {
      result.current.cancelEditing();
    });

    expect(result.current.editingIndex).toBe(null);
    expect(result.current.editingPartIndex).toBe(null);
    expect(result.current.editingText).toBe("");
  });

  it("should update editing text when setEditingText is called", () => {
    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    
    act(() => {
      result.current.startEditing(0, 1, "Initial text");
    });

    act(() => {
      result.current.setEditingText("Updated text");
    });

    expect(result.current.editingText).toBe("Updated text");
  });

  it("should save editing and update conversation", () => {
    const mockConversation = [
      {
        role: "model",
        parts: [{ text: "Part 1" }, { text: "Part 2" }],
      },
    ];
    mockSetConversation.mockImplementation((updater) => {
      return updater(mockConversation);
    });

    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    
    act(() => {
      result.current.startEditing(0, 1, "New text");
    });

    act(() => {
      result.current.saveEditing();
    });

    expect(mockSetConversation).toHaveBeenCalled();
    expect(result.current.editingIndex).toBe(null);
    expect(result.current.editingPartIndex).toBe(null);
    expect(result.current.editingText).toBe("");
  });

  it("should not save if editingIndex is null", () => {
    const { result } = renderHook(() => useMessageEditing(mockSetConversation));
    
    act(() => {
      result.current.saveEditing();
    });

    expect(mockSetConversation).not.toHaveBeenCalled();
  });
});
