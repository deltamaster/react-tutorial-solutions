import memoryService from './memoryService';

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

// Helper function to convert file to base64 (works for both images and PDFs)
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove the data:xxx/xxx;base64, prefix to get just the base64 data
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Role configuration for different bot personalities
const ROLE_CONFIGS = {
  general: {
    systemPrompt: `
I am a helpful assistant that can answer questions and perform tasks.

I am now in "general" role.

If the user requests any search or information retrieval, provides a specific URL, or asking about recent events, please switch to "searcher" role.

If the user requests any coding or programming tasks, please also switch to "searcher" role.

Use memory tools wisely to remember important user facts and preference. Avoid blindly saving the exact input into the memory:
- Analyze the user's intention and summarize the information before saving.
- Avoid saving relative date and time, always translate to absolute date and time before saving.

I never need to get any memory from the functionCall. The full memory is always carried with the request.

The memory I have access to is as follows (in the format of "memoryKey: memoryValue"):
{{memories}}`
  }, 
  searcher: {
    systemPrompt: `
I am a helpful assistant that can answer questions and search for information.

I am also capable of executing Python code. When given code in other programming languages, translate it to Python and execute it.

I am now in "searcher" role. I can see existing memory, but cannot update any of them.

The memory I have access to is as follows (in the format of "memoryKey: memoryValue"):
{{memories}}`
  },
};

// Helper function for API requests
export const fetchFromApi = async (contents, generationConfig, includeTools = false, subscriptionKey = '', userDefinedSystemPrompt = '', role='general') => {
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
  
  // Extract all memories from localStorage and include them in the prompt.
  const memories = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("memory-")) {
      memories[key.substring("memory-".length)] = localStorage.getItem(key);
    }
  }
  const memoryText = Object.entries(memories).map(([key, value]) => `Memory ${key}: ${value}`).join('\n');
  
  // Get the system prompt for the specified role, defaulting to 'general'
  const roleConfig = ROLE_CONFIGS[role] || ROLE_CONFIGS.general;
  const systemPrompt = roleConfig.systemPrompt.replace('{{memories}}', memoryText);
  // filter contents first: for each content in contents, keep only "role" and "parts"
  contents = contents.map(content => ({
    role: content.role,
    parts: content.parts
  }));

  let contentsWithSystemPrompt = [{
    "role": "model",
    "parts": [{
      "text": systemPrompt
    }]
  }, ...contents]
  // Filter out thought contents before sending the request and process any image files
  const filteredContents = [];
  for (const content of contents) {
    if (content.parts) {
      // Process each part to handle image files and filter out thoughts
      const processedParts = [];
      for (const part of content.parts) {
        // Skip thought parts
        if (part.thought) continue;

        // Process files if any (works for both images and PDFs)
        if (part.inline_data && part.inline_data.file) {
          try {
            // Convert file to base64
            const base64Data = await convertFileToBase64(part.inline_data.file);
            // Create new part with base64 data instead of file object
            processedParts.push({
              inline_data: {
                mime_type: part.inline_data.mime_type,
                data: base64Data
              }
            });
          } catch (error) {
            console.error('Error converting file to base64:', error);
            throw new Error('Failed to process file');
          }
        } else {
          // Just add the part as is if it's not a thought or an image file
          processedParts.push(part);
        }
      }
      
      if (processedParts.length > 0) {
        filteredContents.push({
          ...content,
          parts: processedParts
        });
      }
    } else {
      filteredContents.push(content);
    }
  }
  contentsWithSystemPrompt = [{
    "role": "model",
    "parts": [{
      "text": systemPrompt.replace('{{memories}}', memoryText)
    }]
  }, {
    "role": "user",
    "parts": [{
      "text": userDefinedSystemPrompt
    }]
  }, ...filteredContents];
  const requestBody = {
    contents: contentsWithSystemPrompt,
    safety_settings: safetySettings,
    generationConfig,
  };
  
  if (includeTools) {
    // For searcher role, include google_search, url_context, and code_execution tools instead of function declarations
    if (role === 'searcher') {
      requestBody.tools = {
        google_search: {},
        url_context: {},
        code_execution: {}
      };
    } else {
      // For general role, include regular function declarations
      // I don't need to expose get_memory and get_all_memories function to the model, because the full memory is alway carried with the request.
      requestBody.tools = { function_declarations: [dateTimeFuncDecl, createMemory, updateMemory, deleteMemory, switch_role] };
    }
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
    'Get the current date and time, including ISO 8601 format string in UTC timezone, user local timezone name, and user local timezone offset (e.g., { dateTime: "2024-03-10T12:34:56.789Z", timezone: "Asia/Shanghai", timezoneOffset: -480 }). Apply the offset when calculating user local time. The offset is in minutes.',
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

export const updateMemory = {
  name: "update_memory",
  description: "Update the value of a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to set.",
      },
      memoryValue: {
        type: "string",
        description: "The fact in string that you summarize and store in the memory.",
      },
    },
    required: ["memoryKey", "memoryValue"],
  },
}

export const createMemory = {
  name: "create_memory",
  description: "Create a memory stored in localStorage. The key will be generated automatically.",
  parameters: {
    type: "object",
    properties: {
      memoryValue: {
        type: "string",
        description: "The fact in string that you summarize and store in the memory.",
      },
    },
    required: ["memoryValue"],
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

export const switch_role = {
  // This is a special function that does not invoke any actual function.
  name: "switch_role",
  description: "Switch the role of the model. Only \"general\" or \"searcher\" are allowed.",
  parameters: {
    type: "object",
    properties: {
      role: {
        type: "string",
        description: "The role to switch to. Only \"general\" or \"searcher\" are allowed.",
      },
    },
    required: ["role"],
  },
}

// Toolbox implementation for API function calls
export const toolbox = {
  get_current_datetime: () => {
    const now = new Date();
    const dateTimeFormat = Intl.DateTimeFormat().resolvedOptions();
    const timezoneOffset = now.getTimezoneOffset();
    return {
      dateTime: now.toISOString(), 
      timezone: dateTimeFormat.timeZone, 
      timezoneOffset: timezoneOffset
    }; // Returns the date in ISO 8601 format (e.g., "2024-03-10T12:34:56.789Z")
  },
  get_memory: (args) => {
    const memoryKey = args.memoryKey;
    // log in the console output the memoryKey
    console.log("get_memory", memoryKey);
    return memoryService.getMemory(memoryKey);
  },
  get_all_memories: () => {
    return memoryService.getAllMemories();
  },
  update_memory: (args) => {
    const memoryKey = args.memoryKey;
    const memoryValue = args.memoryValue;
    // Use memoryService to update memory item, maintaining encapsulation
    return memoryService.setMemory(memoryKey, memoryValue);
  },
  delete_memory: (args) => {
    const memoryKey = args.memoryKey;
    // Use memoryService to delete memory item, maintaining encapsulation
    return memoryService.deleteMemory(memoryKey);
  },
  create_memory: (args) => {
    const memoryKey = crypto.randomUUID();
    const memoryValue = args.memoryValue;
    // Use memoryService to create memory item, maintaining encapsulation
    return memoryService.setMemory(memoryKey, memoryValue);
  }
};