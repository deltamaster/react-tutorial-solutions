### **LLM Chatbot Context Management Strategy: Dynamic Memory Compression**

**1. Problem Statement:**
As conversations with the LLM chatbot grow in length, the token consumption per request significantly increases, leading to higher operational costs and potential performance degradation. A more efficient mechanism for context management is required.

**2. Proposed Solution: Dynamic Memory Compression**
To simulate human memory, the chatbot will implement a dynamic memory compression strategy. This involves:
*   Maintaining the full, exact content of the most recent conversation turns (short-term memory).
*   Compressing and summarizing older conversation turns into concise summaries (long-term memory).
*   Only sending the summarized older turns, along with the exact content of the latest turns, to the LLM.

**3. Compression Trigger Mechanism:**
Compression will be initiated based on a combination of factors:
*   **Token Count:** When the total token count of the conversation history (or a specific segment) exceeds a predefined threshold (e.g., 100,000 tokens).
*   **Time:** The duration since earlier parts of the conversation.

**4. Role of Xaiver (Memory Manager):**
A dedicated, hidden role named "Xaiver" will be responsible for managing the memory compression process. Xaiver will:
*   Monitor conversation length and token usage.
*   Identify segments of the conversation history that need summarization based on the defined triggers.
*   Generate concise summaries of these older turns.
*   Present these summaries in a structured format within the conversation history.

**5. Message Structure Examples:**

**A. Standard Conversation Message (e.g., from Adrien):**
```json
{
  "role": "model",
  "name": "Adrien",
  "parts": [
    {
      "text": "this is bot thinking",
      "thought": true
    },
    {
      "text": "bot response",
      "thoughtSignature": "don't care"
    }
  ],
  "timestamp": 1761743607868,
  "groundingChunks": [],
  "groundingSupports": []
}
```

**B. Summarized Memory Message (from Xaiver):**
```json
{
  "role": "model",
  "name": "Xaiver",
  "parts": [
    {
      "text": "here goes the summary of earlier conversation turns.",
    }
  ],
  "timestamp": time_of_the_last_message_summarized,
}
```
(The `timestamp` here indicates the last point in time covered by the summary.)
