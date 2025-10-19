// Helper function to extract text from API response data
export function extractTextFromResponse(responseData) {
  let fullText = '';
  let responseText = '';
  let thoughtsText = '';
  
  if (responseData.candidates && responseData.candidates[0] && 
      responseData.candidates[0].content && 
      responseData.candidates[0].content.parts) {
    // Iterate through all parts and separate text based on whether it's a thought
    for (let part of responseData.candidates[0].content.parts) {
      if (part.text) {
        fullText += part.text;
        
        if (part.thought === true) {
          thoughtsText += part.text;
        } else {
          responseText += part.text;
        }
      }
    }
  }
  
  // Return an object with different text versions for flexibility
  return {
    fullText,        // All text including thoughts
    responseText,    // Only non-thought text
    thoughtsText,    // Only thought text
    hasThoughts: thoughtsText.length > 0
  };
}

// Helper function for API requests
export const fetchFromApi = async (contents, generationConfig, includeTools = false, subscriptionKey = '') => {
  const apiRequestUrl = `https://jp-gw2.azure-api.net/gemini/models/gemini-2.5-flash:generateContent`;
  const requestHeader = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": subscriptionKey
  };
  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  ];
  // put a "model" part as system prompt at the beginning of the contents
  // 提取 localStorage 中的所有记忆并包含在提示中。
  const SYSTEM_PROMPT = `
I am a helpful assistant that can answer questions and perform tasks.

Use memory tools wisely to remember important user facts and preference. Avoid blindly saving the exact input into the memory:
- Analyze the user's intention and summarize the information before saving.
- Avoid saving relative date and time, always translate to absolute date and time before saving.

I never need to get any memory from the functionCall. The full memory is always carried with the request.

The memory I have access to is as follows (in the format of "memoryKey: memoryValue"):
{{memories}}`;
  const memories = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("memory-")) {
      memories[key.substring("memory-".length)] = localStorage.getItem(key);
    }
  }
  const memoryText = Object.entries(memories).map(([key, value]) => `Memory ${key}: ${value}`).join('\n');
  let contentsWithSystemPrompt = [{
    "role": "model",
    "parts": [{
      "text": SYSTEM_PROMPT.replace('{{memories}}', memoryText)
    }]
  }, ...contents]
  // Filter out thought contents before sending the request
  const filteredContents = [];
  for (const content of contents) {
    if (content.parts) {
      const filteredParts = content.parts.filter(part => !part.thought);
      if (filteredParts.length > 0) {
        filteredContents.push({
          ...content,
          parts: filteredParts
        });
      }
    } else {
      filteredContents.push(content);
    }
  }
  contentsWithSystemPrompt = [{
    "role": "model",
    "parts": [{
      "text": SYSTEM_PROMPT.replace('{{memories}}', memoryText)
    }]
  }, ...filteredContents];
  const requestBody = {
    contents: contentsWithSystemPrompt,
    safety_settings: safetySettings,
    generationConfig,
  };
  
  if (includeTools) {
    // I don't need to expose get_memory and get_all_memories function to the model, because the full memory is alway carried with the request.
    requestBody.tools = { function_declarations: [dateTimeFuncDecl, setMemory, deleteMemory] };
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

export const getMemory = {
  name: "get_memory",
  description: "Get the value of a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to retrieve.",
      },
    },
    required: ["memoryKey"],
  },
}

export const getAllMemories = {
  name: "get_all_memories",
  description: "Get all memories stored in localStorage.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
}

export const setMemory = {
  name: "set_memory",
  description: "Set the value of a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to set. Generate a UUID as the key.",
      },
      memoryValue: {
        type: "string",
        description: "The fact in string that you summarize and store in the memory.",
      },
    },
    required: ["memoryKey", "memoryValue"],
  },
}

export const deleteMemory = {
  name: "delete_memory",
  description: "Delete a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to delete.",
      },
    },
    required: ["memoryKey"],
  },
}

// Toolbox implementation for API function calls
export const toolbox = {
  get_current_datetime: () => {
    const now = new Date();
    return now.toISOString(); // Returns the date in ISO 8601 format (e.g., "2024-03-10T12:34:56.789Z")
  },
  get_memory: (args) => {
    const memoryKey = args.memoryKey;
    // log in the console output the memoryKey
    console.log("get_memory", memoryKey);
    return localStorage.getItem("memory-" + memoryKey);
  },
  get_all_memories: () => {
    const memories = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("memory-")) {
        memories[key.substring("memory-".length)] = localStorage.getItem(key);
      }
    }
    return memories;
  },
  set_memory: (args) => {
    const memoryKey = args.memoryKey;
    const memoryValue = args.memoryValue;
    // log in the console output the memoryKey and memoryValue
    console.log("set_memory", memoryKey, memoryValue);
    localStorage.setItem("memory-" + memoryKey, memoryValue);
    return {"status": "OK", "memoryKey": memoryKey, "memoryValue": memoryValue}
  },
  delete_memory: (args) => {
    const memoryKey = args.memoryKey;
    // log in the console output the memoryKey
    console.log("delete_memory", memoryKey);
    localStorage.removeItem("memory-" + memoryKey);
    return {"status": "OK", "memoryKey": memoryKey}
  },
};