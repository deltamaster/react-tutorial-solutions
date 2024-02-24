import React, { useState } from "react";
import Markdown from "react-markdown";

function QnAApp() {
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Replace with your actual API call logic
    const apiResponse = await fetch(
      "https://jp-gw.azure-api.net/gemini-pro/gemini-pro:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": "2eec3840203f4c518565172ad1c50050",
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: question }] }] }),
      }
    );

    const responseData = await apiResponse.json();
    console.log(responseData);
    setResponse(responseData.candidates[0].content.parts[0].text);
    setIsLoading(false);
  };

  return (
    <div>
      <p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API Key"
        />
      </p>
      <p>
        <textarea
          rows={5} // Adjust rows as needed for starting height
          maxLength={1000} // Set max characters
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter your question (max 1000 characters)"
        />
      </p>

      <button onClick={handleSubmit}>Submit Question</button>
      <Markdown>{isLoading ? "Loading..." : response}</Markdown>
    </div>
  );
}

export default QnAApp;
