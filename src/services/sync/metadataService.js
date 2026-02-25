/**
 * Metadata Service
 * Handles conversation metadata generation (title, summary, next questions)
 */

import { generateConversationMetadata } from '../api/geminiService';

/**
 * Generate conversation metadata (title, summary, tags, and next questions) using combined API call
 * @param {Array} conversation - The conversation array
 * @param {Object} options - Optional parameters for existing metadata
 * @param {string} [options.currentTitle] - The current conversation title (model should preserve if still suitable)
 * @param {string[]} [options.currentTags] - The current conversation tags
 * @returns {Promise<Object>} - Object with { title, summary, tags, nextQuestions }
 */
export async function generateConversationMetadataFromConversation(conversation, options = {}) {
  try {
    // Prepare contents - filter out thoughts and hidden parts, keep only text
    const finalContents = conversation
      .filter(content => content.parts && content.parts.length > 0)
      .map(content => ({
        role: content.role,
        parts: content.parts
          .filter(part => !part.thought && part.hide !== true && part.text)
          .map(part => ({ text: part.text }))
      }))
      .filter(content => content.parts.length > 0);
    
    if (finalContents.length === 0) {
      return {
        title: "New Conversation",
        summary: "",
        tags: [],
        nextQuestions: []
      };
    }
    
    // Use the combined metadata generation function from geminiService
    const metadata = await generateConversationMetadata(finalContents, {
      currentTitle: options.currentTitle,
      currentTags: options.currentTags || []
    });
    return metadata;
  } catch (error) {
    console.error("Error generating conversation metadata:", error);
    return {
      title: "New Conversation",
      summary: "",
      tags: [],
      nextQuestions: []
    };
  }
}

/**
 * Generate conversation title using question prediction feature
 * @deprecated Use generateConversationMetadataFromConversation instead for better efficiency
 */
export async function generateConversationTitle(conversation) {
  try {
    const metadata = await generateConversationMetadataFromConversation(conversation);
    return metadata.title || "New Conversation";
  } catch (error) {
    console.error("Error generating conversation title:", error);
    return "New Conversation";
  }
}
