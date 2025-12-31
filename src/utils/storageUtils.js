import React, { useState, useEffect } from 'react';

// Custom hook for Chrome extension storage
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);

  // Load value from Chrome storage on component mount
  useEffect(() => {
    const loadValue = async () => {
      try {
        // Check if we're in a Chrome extension environment
        if (typeof chrome !== 'undefined' && chrome.storage) {
          // Use Chrome's storage API
          const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get([key], (items) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(items);
              }
            });
          });
          
          if (key in result && result[key] !== undefined) {
            const value = result[key];
            // Check if value is invalid (e.g., string "undefined" or not the expected type)
            if (value === "undefined" || (key === "conversation" && !Array.isArray(value))) {
              // Delete corrupted data and use initial value
              chrome.storage.local.remove([key]);
              setStoredValue(initialValue);
            } else {
              setStoredValue(value);
            }
          }
        } else {
          // Fallback to localStorage if not in Chrome extension
          const item = localStorage.getItem(key);
          if (item !== null) {
            try {
              const parsed = JSON.parse(item);
              // Check if parsed value is invalid (e.g., string "undefined" or not the expected type)
              if (parsed === "undefined" || (key === "conversation" && !Array.isArray(parsed))) {
                // Delete corrupted data and use initial value
                localStorage.removeItem(key);
                setStoredValue(initialValue);
              } else {
                setStoredValue(parsed);
              }
            } catch (e) {
              // If parsing fails or value is invalid, delete corrupted data
              if (item === "undefined" || (key === "conversation" && item !== null)) {
                localStorage.removeItem(key);
                setStoredValue(initialValue);
              } else {
                setStoredValue(item);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading from storage:', error);
      }
    };

    loadValue();
  }, [key]);

  const setValue = async (value) => {
    try {
      // Use functional update to get the current value, not stale closure value
      let valueToStore;
      setStoredValue((currentStoredValue) => {
        valueToStore = value instanceof Function ? value(currentStoredValue) : value;
        
        // Prevent setting undefined values - they get converted to string "undefined"
        if (valueToStore === undefined) {
          console.warn(`Attempted to save undefined value for key "${key}". Keeping current value.`);
          return currentStoredValue; // Return current value instead of undefined
        }
        
        // For conversation key, ensure it's always an array
        if (key === "conversation" && !Array.isArray(valueToStore)) {
          console.warn(`Attempted to save non-array value for conversation. Using empty array instead.`);
          valueToStore = [];
          return valueToStore;
        }
        
        return valueToStore;
      });
      
      // If valueToStore is undefined after the functional update, skip saving
      if (valueToStore === undefined) {
        return;
      }
      
      // Save to storage asynchronously after state update
      // Check if we're in a Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Use Chrome's storage API
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: valueToStore }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Fallback to localStorage if not in Chrome extension
        // JSON.stringify(undefined) returns undefined, which localStorage converts to "undefined"
        const stringified = JSON.stringify(valueToStore);
        if (stringified === undefined) {
          // If stringify returns undefined, remove the item instead
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, stringified);
        }
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  };

  return [storedValue, setValue];
}

// Helper function to download data from storage
export function downloadFromLocalStorage(storageKey, fileName = 'data.txt') {
  const getFromStorage = async () => {
    try {
      let data;
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Use Chrome's storage API
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get([storageKey], (items) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(items);
            }
          });
        });
        data = result[storageKey] ? JSON.stringify(result[storageKey], null, 2) : null;
      } else {
        // Fallback to localStorage
        data = localStorage.getItem(storageKey);
      }
      
      if (data) {
        // Create a Blob from the data
        const blob = new Blob([data], { type: "application/json" });
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
        console.error(`No data found in storage for key: ${storageKey}`);
      }
    } catch (error) {
      console.error('Error downloading from storage:', error);
    }
  };
  
  getFromStorage();
}

// Helper function to upload data to storage
export function uploadToLocalStorage(storageKey, file, restoreHandler) {
  if (file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const fileContents = e.target.result;
        
        // Check if we're in a Chrome extension environment
        if (typeof chrome !== 'undefined' && chrome.storage) {
          // Parse JSON first
          const parsedData = JSON.parse(fileContents);
          
          // Use Chrome's storage API
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ [storageKey]: parsedData }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
                restoreHandler(parsedData);
              }
            });
          });
        } else {
          // Fallback to localStorage
          localStorage.setItem(storageKey, fileContents);
          restoreHandler(fileContents);
        }
      } catch (error) {
        console.error('Error uploading to storage:', error);
      }
    };
    reader.readAsText(file);
  }
}