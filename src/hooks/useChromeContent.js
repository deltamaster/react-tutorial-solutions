import { useState, useEffect } from "react";

/**
 * Custom hook for retrieving content from Chrome storage or URL parameters
 * Used for populating question input from Chrome extension context menu or URL params
 * 
 * @returns {Object} Content state and setter
 */
export const useChromeContent = () => {
  const [question, setQuestion] = useState("");

  // Retrieve content from Chrome storage API and fill into question input
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contentStored = urlParams.get("content") === "stored";

    if (contentStored && typeof chrome !== "undefined" && chrome.storage) {
      // Get content from Chrome storage
      chrome.storage.local.get(
        ["pageContent", "contentTimestamp"],
        (result) => {
          if (result.pageContent && result.contentTimestamp) {
            // Check if content is stored within last 5 minutes to avoid using expired content
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (now - result.contentTimestamp < fiveMinutes) {
              // Use stored content
              setQuestion(result.pageContent.content);

              // Clean up storage after using content to avoid reuse on next open
              chrome.storage.local.remove(["pageContent", "contentTimestamp"]);
            } else {
              console.log("Stored content is too old, ignoring");
            }
          }
        }
      );
    } else {
      // Fallback: if not opened from context menu or chrome.storage not supported
      // still try to get content from URL parameters (for testing or other cases)
      const markdownContent = urlParams.get("markdown");
      const htmlContent = urlParams.get("html");

      // Prefer markdown content, fallback to html content
      let content = markdownContent || htmlContent;

      if (content) {
        try {
          // Decode URL-encoded content
          const decodedContent = decodeURIComponent(content);
          setQuestion(decodedContent);
        } catch (error) {
          console.error("Error decoding content from URL:", error);
        }
      }
    }
  }, []);

  return { question, setQuestion };
};
