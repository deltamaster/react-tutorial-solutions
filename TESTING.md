# Testing Guide

This document provides information about the test suite for the refactored codebase.

## Test Framework

The project uses:
- **Jest** (included with react-scripts)
- **@testing-library/react** (for React component and hook testing)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run a specific test file
npm test -- src/utils/__tests__/timestampUtils.test.js
```

## Test Structure

Tests are organized in `__tests__` directories next to the code they test:

```
src/
├── utils/
│   ├── __tests__/
│   │   ├── timestampUtils.test.js
│   │   ├── avatarUtils.test.js
│   │   └── fileUtils.test.js
│   └── textProcessing/
│       └── __tests__/
│           ├── textTransform.test.js
│           └── mentionUtils.test.js
├── services/
│   └── __tests__/
│       ├── errorService.test.js
│       └── conversationService.test.js
└── hooks/
    └── __tests__/
        ├── useMessageEditing.test.js
        ├── useSettings.test.js
        ├── useChromeContent.test.js
        └── useFollowUpQuestions.test.js
```

## Test Coverage

### Utilities (✅ Complete)
- ✅ `textTransform.js` - Text transformation functions
- ✅ `mentionUtils.js` - Mention extraction
- ✅ `timestampUtils.js` - Timestamp formatting
- ✅ `avatarUtils.js` - Avatar and voice mapping
- ✅ `fileUtils.js` - File validation

### Services (✅ Complete)
- ✅ `errorService.js` - Error message formatting
- ✅ `conversationService.js` - Conversation CRUD operations

### Hooks (✅ Complete)
- ✅ `useMessageEditing.js` - Message editing state management
- ✅ `useSettings.js` - Settings management
- ✅ `useChromeContent.js` - Chrome storage content retrieval
- ✅ `useFollowUpQuestions.js` - Follow-up questions management

## Writing New Tests

### Testing Utilities

For pure utility functions, use standard Jest tests:

```javascript
import { myFunction } from "../myUtils";

describe("myFunction", () => {
  it("should handle normal case", () => {
    expect(myFunction("input")).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(myFunction(null)).toBe("");
    expect(myFunction(undefined)).toBe("");
  });
});
```

### Testing Hooks

For React hooks, use `renderHook` from `@testing-library/react`:

```javascript
import { renderHook, act } from "@testing-library/react";
import { useMyHook } from "../useMyHook";

describe("useMyHook", () => {
  it("should initialize correctly", () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(initialValue);
  });

  it("should update state", () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.updateValue("new value");
    });

    expect(result.current.value).toBe("new value");
  });
});
```

## Notes

- **React 18 Compatibility**: All hook tests use `@testing-library/react` (not the deprecated `@testing-library/react-hooks`)
- **Mocking**: Use Jest mocks for external dependencies (Chrome APIs, services, etc.)
- **Async Testing**: Use `waitFor` for async operations in hooks
- **Act**: Always wrap state updates in `act()` when testing hooks

## Common Issues

### Issue: `renderHook is not defined`
**Solution**: Ensure `@testing-library/react` is installed:
```bash
npm install --save-dev @testing-library/react
```

### Issue: Tests fail with Chrome API errors
**Solution**: Mock Chrome APIs in your test file:
```javascript
global.chrome = {
  storage: {
    sync: { get: jest.fn(), set: jest.fn() },
    local: { get: jest.fn(), remove: jest.fn() }
  }
};
```
