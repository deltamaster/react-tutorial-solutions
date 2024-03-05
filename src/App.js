import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import * as Icon from "react-bootstrap-icons";
import "bootstrap/dist/css/bootstrap.min.css"; // Import Bootstrap CSS

function QnAApp() {
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const MAX_QUESTION_LENGTH = 30000; // Maximum allowed question length

  const fullConvsersationHistoryRef = useRef([]); // Ref to store previous questions
  const [conversationHistory, setConversationHistory] = useState([]);

  useEffect(() => {
    // Retrieve stored API key and conversation history from local storage
    const storedApiKey = localStorage.getItem("geminiApiKey");
    const storedConversationHistory = localStorage.getItem(
      "conversationHistory",
    );

    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    if (storedConversationHistory) {
      const history = JSON.parse(storedConversationHistory);
      fullConvsersationHistoryRef.current = history;
      setConversationHistory(history); // Update the state with the stored history
    }
  }, []);

  const resetConversation = (e) => {
    e.preventDefault();
    fullConvsersationHistoryRef.current = [];
    setConversationHistory(fullConvsersationHistoryRef.current);
    console.log("Conversation history reset.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey) {
      setError("Please enter your API key.");
      return;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      setError(
        `Question length exceeds maximum of ${MAX_QUESTION_LENGTH} characters.`,
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
      setConversationHistory(fullConvsersationHistoryRef.current);
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
            safety_settings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
            generationConfig: {
              stopSequences: [],
              temperature: 1.0,
              topP: 0.8, // Adjusted topP value for better balance
              topK: 10,
            },
          }),
        },
      );

      if (!apiResponse.ok) {
        let lastQuestion = fullConvsersationHistoryRef.current.pop();
        console.log(lastQuestion);
        setQuestion(lastQuestion.parts[0].text);
        setConversationHistory(fullConvsersationHistoryRef.current);
        const errorBody = await apiResponse.json().catch(() => null);
        let errMsg = "";
        console.log(errorBody.error);
        if (errorBody && errorBody.error.message) {
          errMsg = errorBody.error.message;
        }
        throw new Error(
          `API request failed with status ${apiResponse.status} and type ${apiResponse.type} (${errMsg})`,
        );
      }

      const responseData = await apiResponse.json();

      fullConvsersationHistoryRef.current.push({
        role: "model",
        parts: [{ text: responseData.candidates[0].content.parts[0].text }],
      });
      setConversationHistory(fullConvsersationHistoryRef.current);
      localStorage.setItem(
        "conversationHistory",
        JSON.stringify(conversationHistory),
      );
    } catch (error) {
      console.error(error);
      setError(`An error occurred. ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    // Store API key in local storage (optional)
    localStorage.setItem("geminiApiKey", apiKey);
  };

  return (
    <Container>
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API Key"
            onBlur={handleSaveApiKey} // Store API key on blur (optional)
          />
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <Alert variant="primary">
            <Icon.ShieldExclamation />
            &nbsp; There is no filter on offending response. Use the tool at
            your own risk.
          </Alert>
        </Col>
      </Row>
      <Row>
        <div>
          {conversationHistory.map((content, index) => (
            <div key={index} className={content.role}>
              {content.role === "user" ? (
                <p style={{ fontWeight: "bold" }}>You: </p>
              ) : (
                <p style={{ fontWeight: "bold" }}>Bot: </p>
              )}
              <Markdown remarkPlugins={[remarkGfm]}>
                {content.parts[0].text}
              </Markdown>
            </div>
          ))}
        </div>
      </Row>
      <Row>
        {isLoading ? (
          <Col xs={12}>
            <div className="spinner-border text-secondary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </Col>
        ) : (
          <p></p>
        )}
      </Row>
      <Row>
        <Col xs={10}>
          <textarea
            rows={5}
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question (max 30000 characters)"
            className="w-100"
          />
          {error && <Alert variant="warning">{error}</Alert>}
        </Col>
        <Col xs={2} className="h-auto align-bottom">
          <Button onClick={handleSubmit} className="w-100">
            <Icon.Send />
          </Button>
        </Col>
        <Col xs={2} className="h-auto align-bottom">
          <Button onClick={resetConversation} className="w-100">
            <Icon.ArrowCounterclockwise />
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

export default QnAApp;
