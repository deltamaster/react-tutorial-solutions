import React, { useState } from 'react';

// Custom hook for local storage
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    const item = localStorage.getItem(key);
    try {
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // Not JSON
      return item;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // Not JSON
    }
  };

  return [storedValue, setValue];
}

// Helper function to download data from localStorage
export function downloadFromLocalStorage(storageKey, fileName = 'data.txt') {
  // Retrieve the item from localStorage
  const data = localStorage.getItem(storageKey);
  if (data) {
    // Create a Blob from the data
    const blob = new Blob([data], { type: "text/plain" });
    // Create an object URL for the blob
    const url = URL.createObjectURL(blob);
    // Create a temporary anchor element and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a); // Append the anchor to the body
    a.click(); // Trigger a click on the element
    document.body.removeChild(a); // Remove the anchor from the body
    URL.revokeObjectURL(url); // Clean up the object URL
  } else {
    console.error(`No data found in localStorage for key: ${storageKey}`);
  }
}

// Helper function to upload data to localStorage
export function uploadToLocalStorage(storageKey, file, restoreHandler) {
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const fileContents = e.target.result;
      localStorage.setItem(storageKey, fileContents);
      restoreHandler(fileContents);
    };
    reader.readAsText(file);
  }
}