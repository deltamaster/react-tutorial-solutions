/**
 * API Utils - Re-exports from refactored services
 * 
 * This file maintains backward compatibility by re-exporting functions
 * from the new service modules. All functionality has been moved to:
 * - src/services/api/geminiService.js - Gemini API calls and utilities
 * - src/services/api/financialService.js - Financial API calls and toolbox
 * - src/services/api/fileUploadService.js - File upload functionality
 * - src/services/api/generationConfig.js - Generation configurations
 * - src/services/api/apiClient.js - Base API client utilities
 * - src/services/api/apiCache.js - API caching logic
 * 
 * @deprecated Import directly from the service modules instead
 */

// Re-export from geminiService
export {
  fetchFromApi,
  fetchFromApiCore,
  generateFollowUpQuestions,
  generateConversationMetadata,
  extractTextFromResponse,
  postProcessModelResponse,
  MEMORY_COMPRESSION_CONFIG,
} from '../services/api/geminiService';

// Re-export from apiClient
export { ApiError } from '../services/api/apiClient';

// Re-export from financialService
export { toolbox } from '../services/api/financialService';

// Re-export from fileUploadService
export { uploadFile } from '../services/api/fileUploadService';

// Re-export from generationConfig
export { getGenerationConfig, safetySettings } from '../services/api/generationConfig';
