import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function QnAApp() {
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const MAX_QUESTION_LENGTH = 30000; // Maximum allowed question length

  const fullConvsersationHistoryRef = useRef([]); // Ref to store previous questions

  useEffect(() => {
    // Retrieve stored API key from local storage (optional)
    const storedApiKey = localStorage.getItem("geminiApiKey");
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey) {
      setError("Please enter your API key.");
      return;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      setError(
        `Question length exceeds maximum of ${MAX_QUESTION_LENGTH} characters.`
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      fullConvsersationHistoryRef.current.push({
        role: "user",
        parts: [{ text: question }],
      });

      setQuestion("");

      const apiResponse = await fetch(
        "https://jp-gw.azure-api.net/gemini-pro/gemini-pro:generateContent?key=" +
          apiKey,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": "2eec3840203f4c518565172ad1c50050", // Replace with your subscription key
          },
          body: JSON.stringify({
            contents: fullConvsersationHistoryRef.current,
            generationConfig: {
              stopSequences: [],
              temperature: 1.0,
              topP: 0.8, // Adjusted topP value for better balance
              topK: 10,
            },
          }),
        }
      );

      if (!apiResponse.ok) {
        throw new Error(`API request failed with status ${apiResponse.status}`);
      }

      const responseData = await apiResponse.json();

      fullConvsersationHistoryRef.current.push({
        role: "model",
        parts: [{ text: responseData.candidates[0].content.parts[0].text }],
      });
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    // Store API key in local storage (optional)
    localStorage.setItem("geminiApiKey", apiKey);
  };

  return (
    <div>
      <p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API Key"
          onBlur={handleSaveApiKey} // Store API key on blur (optional)
        />
        {error && <span className="error">{error}</span>}
      </p>

      <div>
        {fullConvsersationHistoryRef.current.map((content, index) => (
          <div key={index} class={content.role}>
            <Markdown remarkPlugins={[remarkGfm]}>
              {content.parts[0].text}
            </Markdown>
          </div>
        ))}
      </div>

      <div style={{ float: "left", width: "100%", clear: "both" }}>
        {isLoading ? <p>Loading...</p> : <p></p>}
      </div>

      <div style={{ float: "left", width: "100%", clear: "both" }}>
        <p>
          <textarea
            rows={5}
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question (max 30000 characters)"
            style={{ float: "left", width: "100%", clear: "both" }}
          />
          {error && <span className="error">{error}</span>}
        </p>
        <button onClick={handleSubmit}>Send</button>
      </div>
    </div>
  );
}

export default QnAApp;
