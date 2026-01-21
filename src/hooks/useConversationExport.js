import { useCallback } from "react";
import { getAllTrackedFiles, setTrackedFiles } from "../utils/fileTrackingService";
import { createExportData, parseConversationData } from "../services/conversationService";

/**
 * Custom hook for conversation export/import functionality
 * 
 * @param {Array} conversation - Current conversation array
 * @param {Function} setConversation - Function to update conversation
 * @param {Function} setFollowUpQuestions - Function to clear follow-up questions
 * @returns {Object} Export and import functions
 */
export const useConversationExport = (
  conversation,
  setConversation,
  setFollowUpQuestions
) => {
  /**
   * Downloads conversation history as JSON file
   */
  const downloadConversation = useCallback(() => {
    try {
      // Get conversation_summaries from localStorage
      const summaries = JSON.parse(
        localStorage.getItem("conversation_summaries") || "[]"
      );

      // Get tracked files
      const trackedFiles = getAllTrackedFiles();

      // Create export data
      const exportData = createExportData(conversation, summaries, trackedFiles);

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = "conversation_history.json";

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error("Error downloading conversation:", error);
      alert("Failed to download conversation history.");
    }
  }, [conversation]);

  /**
   * Uploads and imports conversation history from JSON file
   * 
   * @param {Event} event - File input change event
   */
  const uploadConversation = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { conversation: conversationData, summaries, trackedFiles } = 
          parseConversationData(e.target.result);

        // Set conversation
        setConversation(conversationData);

        // Restore conversation_summaries if present
        if (summaries.length > 0) {
          try {
            localStorage.setItem(
              "conversation_summaries",
              JSON.stringify(summaries)
            );
            console.log("Conversation summaries restored from upload");
          } catch (error) {
            console.error("Error restoring conversation summaries:", error);
          }
        } else {
          // Clear summaries for old format uploads
          try {
            localStorage.removeItem("conversation_summaries");
          } catch (error) {
            console.error("Error clearing summaries:", error);
          }
        }

        // Restore tracked files if present (version 1.2+)
        if (Object.keys(trackedFiles).length > 0) {
          try {
            setTrackedFiles(trackedFiles);
            console.log("Uploaded files tracking restored from upload");
          } catch (error) {
            console.error("Error restoring uploaded files tracking:", error);
          }
        } else {
          // If no tracked files in upload, clear existing ones
          setTrackedFiles({});
        }

        setFollowUpQuestions([]); // Clear predicted questions when uploading new conversation
        event.target.value = "";
      } catch (error) {
        alert(
          "Failed to upload conversation history. Please provide a valid JSON file."
        );
        console.error("Error parsing uploaded file:", error);
      }
    };
    reader.readAsText(file);
  }, [setConversation, setFollowUpQuestions]);

  return {
    downloadConversation,
    uploadConversation,
  };
};
