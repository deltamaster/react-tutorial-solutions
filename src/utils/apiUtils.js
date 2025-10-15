// Helper function to extract text from API response data
export function extractTextFromResponse(responseData) {
  let text = '';
  if (responseData.candidates && responseData.candidates[0] && 
      responseData.candidates[0].content && 
      responseData.candidates[0].content.parts) {
    // Iterate through all parts and concatenate text
    for (let part of responseData.candidates[0].content.parts) {
      if (part.text) {
        text += part.text;
      }
    }
  }
  return text;
}

// Helper function for API requests
export const fetchFromApi = async (contents, generationConfig, apiKey, includeTools = false) => {
  const apiRequestUrl = `https://jp-gw2.azure-api.net/gemini/models/gemini-2.5-flash:generateContent`;
  const requestHeader = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": "2efec23ae3d249c9991e068ca726581c",
    "x-goog-api-key": apiKey
  };
  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  ];
  
  const requestBody = {
    contents,
    safety_settings: safetySettings,
    generationConfig,
  };
  
  if (includeTools) {
    requestBody.tools = { function_declarations: [dateTimeFuncDecl] };
  }
  
  try {
    const response = await fetch(apiRequestUrl, {
      method: "POST",
      headers: requestHeader,
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      let errMsg = "";
      if (errorBody && errorBody.error.message) {
        errMsg = errorBody.error.message;
      }
      throw new Error(
        `API request failed with status ${response.status} and type ${response.type} (${errMsg})`
      );
    }
    
    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// DateTime function declaration for API tool calls
export const dateTimeFuncDecl = {
  name: "get_current_datetime",
  description:
    'Get the string representation of current date and time in ISO 8601 format in UTC timezone (e.g., "2024-03-10T12:34:56.789Z").',
};

// Toolbox implementation for API function calls
export const toolbox = {
  get_current_datetime: () => {
    const now = new Date();
    return now.toISOString(); // Returns the date in ISO 8601 format (e.g., "2024-03-10T12:34:56.789Z")
  },
};