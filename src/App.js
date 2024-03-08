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
import { Next } from "react-bootstrap/esm/PageItem";

// Custom hook for local storage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    const item = localStorage.getItem(key);
    try {
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // Not JSON
      return item;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // Not JSON
    }
  };

  return [storedValue, setValue];
}

// API key input component
function ApiKeyInput({ apiKey, setApiKey }) {
  const handleSaveApiKey = () => {
    localStorage.setItem("geminiApiKey", apiKey);
  };

  return (
    <input
      type="password"
      value={apiKey}
      onChange={(e) => setApiKey(e.target.value)}
      placeholder="Enter API Key"
      onBlur={handleSaveApiKey} // Store API key on blur (optional)
    />
  );
}

// Conversation history component
function ConversationHistory({ history }) {
  return (
    <div>
      {history.map((content, index) => (
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
  );
}

// Question input component
function QuestionInput({ question, setQuestion, MAX_QUESTION_LENGTH }) {
  return (
    <textarea
      rows={5}
      maxLength={MAX_QUESTION_LENGTH}
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      placeholder="Enter your question (max 30000 characters)"
      className="w-100"
    />
  );
}

// Loading spinner component
function LoadingSpinner({ isLoading }) {
  return isLoading ? (
    <div className="spinner-border text-secondary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  ) : null;
}

// Next question component
function NextQuestion({ nextQuestion, setQuestion }) {
  if (nextQuestion) {
    return (
      <Alert variant="info">
        <Icon.Magic />
        &nbsp; You may want to ask:
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setQuestion(nextQuestion);
          }}
        >
          {nextQuestion}
        </a>
      </Alert>
    );
  } else {
    return <div />;
  }
}

// Error alert component
function ErrorAlert({ error }) {
  return error ? <Alert variant="warning">{error}</Alert> : null;
}

function QnAApp() {
  const initialPrompt = `You are a professional assistant. You should be helpful, accurate, analytical and well-formatted when answering serious questions. Always include citation when referencing sources. Ask probing question when appropriate.
  You should be creative and relaxed when answering other questions and can be more chatty and conversational.`;
  const initialResponse = "OK. I will do my best.";
  const nextQuestionPrompt = `Ignore the language I use in this particular question.
  Use the same language you used in your above response.
  请使用与你之前的对话相同的语言来回答下面的问题。
  Based on your above response, please predict a short follow up question that I may ask.
  基于你之前的对话，预测我可能提出的问题。
  Ignore the probing question if you asked one in your above response.
  Respond with your predicted question in plaintext ONLY without any other information.
  回复仅包含问题本身的纯文本，不要包含其他任何内容。
  No markdown. Be extremely concise.`;
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useLocalStorage("geminiApiKey", "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextQuestion, setNextQuestion] = useState("");

  const MAX_QUESTION_LENGTH = 30000; // Maximum allowed question length

  const [conversationHistory, setConversationHistory] = useLocalStorage(
    "conversationHistory",
    []
  );
  const conversationHistoryRef = useRef(conversationHistory); // Ref to store previous questions

  // Reset conversation history
  const resetConversation = () => {
    conversationHistoryRef.current = [];
    setConversationHistory([]);
    setNextQuestion("");
    console.log("Conversation history reset.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setNextQuestion("");
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
      conversationHistoryRef.current.push({
        role: "user",
        parts: [{ text: question }],
      });
      setConversationHistory(conversationHistoryRef.current);
      setQuestion("");

      let conversationIncludingPrompt = [...conversationHistoryRef.current];
      conversationIncludingPrompt.unshift(
        {
          role: "user",
          parts: [{ text: initialPrompt }],
        },
        {
          role: "model",
          parts: [{ text: initialResponse }],
        }
      );
      const apiRequestUrl = `https://jp-gw.azure-api.net/gemini-pro/gemini-pro:generateContent?key=${apiKey}`;
      const requestHeader = {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "2eec3840203f4c518565172ad1c50050", // Replace with your subscription key
      };
      const safetySettings = [
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
      ];
      const generationConfig = {
        stopSequences: [],
        temperature: 1.0,
        topP: 0.8, // Adjusted topP value for better balance
        topK: 10,
      };
      let apiResponse = await fetch(apiRequestUrl, {
        method: "POST",
        headers: requestHeader,
        body: JSON.stringify({
          contents: conversationIncludingPrompt,
          safety_settings: safetySettings,
          generationConfig: generationConfig,
        }),
      });

      if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => null);
        let errMsg = "";
        console.log(errorBody.error);
        if (errorBody && errorBody.error.message) {
          errMsg = errorBody.error.message;
        }
        throw new Error(
          `API request failed with status ${apiResponse.status} and type ${apiResponse.type} (${errMsg})`
        );
      }

      let responseData = await apiResponse.json();

      conversationHistoryRef.current.push({
        role: "model",
        parts: [{ text: responseData.candidates[0].content.parts[0].text }],
      });
      setConversationHistory(conversationHistoryRef.current);
      conversationIncludingPrompt.push({
        role: "model",
        parts: [{ text: responseData.candidates[0].content.parts[0].text }],
      });

      // Predict follow-up question
      conversationIncludingPrompt.push({
        role: "user",
        parts: [{ text: nextQuestionPrompt }],
      });
      apiResponse = await fetch(apiRequestUrl, {
        method: "POST",
        headers: requestHeader,
        body: JSON.stringify({
          contents: conversationIncludingPrompt,
          safety_settings: safetySettings,
          generationConfig: generationConfig,
        }),
      });
      if (!apiResponse.ok) {
        const errorBody = await apiResponse.json().catch(() => null);
        let errMsg = "";
        console.log(errorBody.error);
        if (errorBody && errorBody.error.message) {
          errMsg = errorBody.error.message;
        }
        return; // siliently ignore error
      }
      try {
        responseData = await apiResponse.json();
        setNextQuestion(responseData.candidates[0].content.parts[0].text);
      } catch (error) {
        console.log(error);
      }
    } catch (error) {
      console.error(error);
      setError(`An error occurred. ${error}`);
      let lastQuestion = conversationHistoryRef.current.pop();
      setQuestion(lastQuestion.parts[0].text);
      setConversationHistory(conversationHistoryRef.current);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
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
        <ConversationHistory history={conversationHistory} />
      </Row>
      <Row>
        <Col xs={12}>
          <LoadingSpinner isLoading={isLoading} />
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <NextQuestion nextQuestion={nextQuestion} setQuestion={setQuestion} />
        </Col>
      </Row>
      <Row>
        <Col xs={10}>
          <QuestionInput
            question={question}
            setQuestion={setQuestion}
            MAX_QUESTION_LENGTH={MAX_QUESTION_LENGTH}
          />
          <ErrorAlert error={error} />
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
