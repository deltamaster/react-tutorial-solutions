/**
 * Generation Configuration Service
 * Centralized configuration for API generation settings
 */

import { getThinkingEnabled } from '../../utils/settingsService';

/**
 * Safety settings for API requests
 */
export const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

/**
 * Generation configurations for different contexts
 */
const generationConfigs = {
  default: {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    responseMimeType: "text/plain",
    thinkingConfig: {
      includeThoughts: true,
      thinkingBudget: -1, // -1 means adaptive; 0 means no thinking
    },
  },
  followUpQuestions: {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "array",
      items: {
        type: "string"
      },
      maxItems: 3
    },
    thinkingConfig: {
      includeThoughts: false,
      thinkingBudget: 0,
    },
  },
  summarization: {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    responseMimeType: "text/plain",
    thinkingConfig: {
      includeThoughts: false,
      thinkingBudget: 0,
    },
  },
  conversationMetadata: {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        nextQuestions: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        }
      },
      required: ["title", "summary", "nextQuestions"]
    },
    thinkingConfig: {
      includeThoughts: false,
      thinkingBudget: 0,
    },
  },
};

/**
 * Get the appropriate generation configuration based on request type and thinking enabled state
 * @param {string} requestType - The type of request (e.g., 'default', 'followUpQuestions', 'summarization')
 * @returns {Object} The appropriate generation configuration
 */
export const getGenerationConfig = (requestType = "default") => {
  const baseConfig = generationConfigs[requestType] || generationConfigs.default;
  if (requestType !== 'default') {
    return baseConfig;
  }

  if (!getThinkingEnabled()) {
    return {
      ...baseConfig,
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: 0,
      },
    };
  }

  return baseConfig;
};
