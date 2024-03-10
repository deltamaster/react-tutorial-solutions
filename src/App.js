import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import * as Icon from "react-bootstrap-icons";
import "bootstrap/dist/css/bootstrap.min.css"; // Import Bootstrap CSS

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

// Conversation history component
function ConversationHistory1({ history }) {
  return (
    <div>
      {history.map((content, index) => (
        <div key={index} className={content.role}>
          {content.role === "Me" ? (
            <p style={{ fontWeight: "bold" }}>You: </p>
          ) : (
            <p style={{ fontWeight: "bold" }}>Bot: </p>
          )}
          <Markdown remarkPlugins={[remarkGfm]}>{content.text}</Markdown>
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

const DownloadButton = ({ storageKey, fileName }) => {
  const handleDownload = () => {
    // Retrieve the item from localStorage
    const data = localStorage.getItem(storageKey);
    if (data) {
      // Create a Blob from the data
      const blob = new Blob([data], { type: "text/plain" });
      // Create an object URL for the blob
      const url = URL.createObjectURL(blob);
      // Create a temporary anchor element and trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "data.txt";
      document.body.appendChild(a); // Append the anchor to the body
      a.click(); // Trigger a click on the element
      document.body.removeChild(a); // Remove the anchor from the body
      URL.revokeObjectURL(url); // Clean up the object URL
    } else {
      console.error(`No data found in localStorage for key: ${storageKey}`);
    }
  };

  return (
    <Button variant="light" onClick={handleDownload} className="w-100">
      <Icon.Download />
    </Button>
  );
};

const UploadButton = ({ storageKey, restoreHandler }) => {
  const handleFileChosen = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const fileContents = e.target.result;
        localStorage.setItem(storageKey, fileContents);
        restoreHandler(fileContents);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="input-group w-100">
      <div className="custom-file w-100">
        <input
          type="file"
          className="custom-file-input"
          id="inputGroupFile02"
          onChange={handleFileChosen}
          style={{ display: "none" }} // Hide the actual input element
        />
        <label className="btn btn-light w-100" htmlFor="inputGroupFile02">
          <Icon.Upload />
        </label>
      </div>
    </div>
  );
};

const PictureUploader = ({ onImageUpload }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.match("image.*")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Image = e.target.result;
        onImageUpload(base64Image); // Call the passed-in callback function with the base64 image data
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please select an image file.");
    }
  };

  return (
    <div className="mb-3">
      <input
        type="file"
        className="form-control"
        id="upload-button"
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept="image/*" // Accept images only
      />
      <label className="btn btn-primary" htmlFor="upload-button">
        Upload Picture
      </label>
    </div>
  );
};

function QnAApp() {
  const initialPrompt = `You are a professional assistant. You should be helpful, accurate, analytical and well-formatted when answering serious questions. Always include citation when referencing sources. Ask probing question when appropriate.
  You should be creative and relaxed when answering other questions and can be more chatty and conversational.`;
  const initialResponse = "OK. I will do my best.";
  const nextQuestionPrompt = `Ignore the language I use in this particular question.
  Use the same language you used in your above response.
  请使用与你上一条回复相同的语言来回答下面的问题。
  What should I ask next if you were me?
  Ignore the probing question if you asked one in your above response.
  Respond with your predicted question in plaintext ONLY without any other information.
  回复仅包含问题本身的纯文本，不要包含其他任何内容。
  No markdown. Be extremely concise.
  The next questions may be （下一个问题可能是）: `;
  const [question, setQuestion] = useState("");
  const [question1, setQuestion1] = useState("");
  const [conversation1, setConversation1] = useState([]);
  const [response1, setResponse1] = useState("");
  const [apiKey, setApiKey] = useLocalStorage("geminiApiKey", "");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoading1, setIsLoading1] = useState(false);
  const [error, setError] = useState(null);
  const [error1, setError1] = useState(null);
  const [nextQuestion, setNextQuestion] = useState("");
  const [imageBase64, setImageBase64] = useState({ mime_type: "", data: "" });
  const [imagePreview, setImagePreview] = useState(null);

  const dateTimeFuncDecl = {
    name: "get_current_datetime",
    description:
      'Get the string representation of current date and time in ISO 8601 format (e.g., "2024-03-10T12:34:56.789Z").',
  };

  const toolbox = {
    get_current_datetime: () => {
      const now = new Date();
      return now.toISOString(); // Returns the date in ISO 8601 format (e.g., "2024-03-10T12:34:56.789Z")
    },
  };

  const handleImageUpload = (base64Image) => {
    // Split the base64 string into parts using a regex pattern
    const matches = base64Image.match(/^data:(.+);base64,(.*)$/);
    if (matches.length !== 3) {
      throw new Error("Invalid base64 image data!");
    }

    // Extract the MIME type and base64 data from the matches
    const mimeType = matches[1];
    const data = matches[2];

    // Construct the JSON object
    const imageJson = {
      mime_type: mimeType,
      data: data,
    };

    setImageBase64(imageJson); // Store the JSON object in the parent component's state
    setImagePreview(base64Image); // Update image preview in the parent component
  };

  const MAX_QUESTION_LENGTH = 30000; // Maximum allowed question length

  const [conversationHistory, setConversationHistory] = useLocalStorage(
    "conversationHistory",
    [],
  );
  const conversationHistoryRef = useRef(conversationHistory); // Ref to store previous questions

  // Reset conversation history
  const resetConversation = () => {
    conversationHistoryRef.current = [];
    setConversationHistory([]);
    setNextQuestion("");
    console.log("Conversation history reset.");
  };

  const resetConversation1 = () => {
    setConversation1([]);
  };

  const restoreConversation = (text) => {
    conversationHistoryRef.current = JSON.parse(text);
    setConversationHistory(conversationHistoryRef.current);
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
        `Question length exceeds maximum of ${MAX_QUESTION_LENGTH} characters.`,
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
        },
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
        temperature: 0.5,
        topP: 0.8, // Adjusted topP value for better balance
        topK: 10,
      };
      const generationConfigForNextQuestion = {
        stopSequences: [],
        maxOutputTokens: 30,
        temperature: 1,
        topP: 0.8, // Adjusted topP value for better balance
        topK: 5,
      };
      let apiResponse = await fetch(apiRequestUrl, {
        method: "POST",
        headers: requestHeader,
        body: JSON.stringify({
          contents: conversationIncludingPrompt,
          tools: { function_declarations: [dateTimeFuncDecl] },
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
          `API request failed with status ${apiResponse.status} and type ${apiResponse.type} (${errMsg})`,
        );
      }

      let responseData = await apiResponse.json();
      let functionResponses = [];

      for (let responsePartIdx in responseData.candidates[0].content.parts) {
        let responsePart =
          responseData.candidates[0].content.parts[responsePartIdx];
        if (responsePart["functionCall"]) {
          let functionName = responsePart["functionCall"].name;
          let retVal = toolbox[functionName]();
          let functionResponse = {
            functionResponse: {
              name: functionName,
              response: {
                name: functionName,
                content: retVal,
              },
            },
          };
          functionResponses.push(functionResponse);
        }
      }
      if (functionResponses.length != 0) {
        // There is a function response to send
        conversationIncludingPrompt.push(responseData.candidates[0].content);
        conversationIncludingPrompt.push({
          role: "function",
          parts: functionResponses,
        });
        apiResponse = await fetch(apiRequestUrl, {
          method: "POST",
          headers: requestHeader,
          body: JSON.stringify({
            contents: conversationIncludingPrompt,
            tools: { function_declarations: [dateTimeFuncDecl] },
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
            `API request failed with status ${apiResponse.status} and type ${apiResponse.type} (${errMsg})`,
          );
        }
        responseData = await apiResponse.json();
      }

      // Use the actual response text
      let responseText = responseData.candidates[0].content.parts[0].text;
      responseText = responseText.replace(/：\*\*/g, ":** ");

      conversationHistoryRef.current.push({
        role: "model",
        parts: [{ text: responseText }],
      });
      setConversationHistory(conversationHistoryRef.current);
      conversationIncludingPrompt.push({
        role: "model",
        parts: [{ text: responseText }],
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
          generationConfig: generationConfigForNextQuestion,
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
        let myNextQuestion = responseData.candidates[0].content.parts[0].text;
        myNextQuestion = myNextQuestion.replace(/[\*\r\n]/g, "");
        let parts = myNextQuestion.split(/[:：]/);
        myNextQuestion = parts[parts.length - 1];
        setNextQuestion(myNextQuestion);
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

  const handleSubmit1 = async (e) => {
    e.preventDefault();
    try {
      if (!apiKey) throw new Error("Please enter your API key.");
      if (!question1) throw new Error("Where's your question?");
      if (!imageBase64.mime_type)
        throw new Error("Please upload an image first.");
    } catch (error) {
      console.error(error);
      setError1(`An error occurred. ${error}`);
      return;
    }

    setIsLoading1(true);
    setError1(null);

    try {
      const apiRequestUrl = `https://jp-gw.azure-api.net/gemini-pro/gemini-pro-vision:generateContent?key=${apiKey}`;
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
        temperature: 0.8,
        topP: 1, // Adjusted topP value for better balance
        topK: 5,
      };

      let prompt1 = `"Me:" represents the beginning of my question （我的问题）. "You:" represents the beginning of your previous response （你先前的回复）.
      Analyze the content in the picture first.
      Here starts the dialog （下面是对话正文）. Use the language in the dialog （请使用对话正文的语言）.`;
      let conversationTmp = [...conversation1];
      conversationTmp.push({ role: "Me", text: question1 });
      setConversation1(conversationTmp);
      let conversationArr = conversationTmp.map(
        (item) => `${item.role}: ${item.text}`,
      );
      conversationArr.unshift(prompt1);
      conversationArr.push("You: ");
      let conversationStr = conversationArr.join("\n");
      let apiResponse = await fetch(apiRequestUrl, {
        method: "POST",
        headers: requestHeader,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: conversationStr }, { inline_data: imageBase64 }],
            },
          ],
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
          `API request failed with status ${apiResponse.status} and type ${apiResponse.type} (${errMsg})`,
        );
      }

      let responseData = await apiResponse.json();
      let responseText = responseData.candidates[0].content.parts[0].text;
      setResponse1(responseText);
      conversationTmp.push({ role: "You", text: responseText });
      setConversation1(conversationTmp);
      setQuestion1("");
    } catch (error) {
      console.error(error);
      setError1(`An error occurred. ${error}`);
    } finally {
      setIsLoading1(false);
    }
  };

  return (
    <Container>
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
        </Col>
      </Row>
      <Tabs
        defaultActiveKey="chatbot"
        transition={false}
        id="maintabs"
        className="mb-3"
      >
        <Tab eventKey="chatbot" title="Chatbot">
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
              <NextQuestion
                nextQuestion={nextQuestion}
                setQuestion={setQuestion}
              />
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
            <Col xs={2} className="h-auto">
              <Button onClick={resetConversation} className="w-100">
                <Icon.ArrowCounterclockwise />
              </Button>
            </Col>
            <Col xs={2} className="h-auto">
              <DownloadButton
                storageKey="conversationHistory"
                fileName="conversationHistory.txt"
              />
            </Col>
            <Col xs={2} className="h-auto">
              <UploadButton
                storageKey="conversationHistory"
                restoreHandler={restoreConversation}
              />
            </Col>
          </Row>
        </Tab>
        <Tab eventKey="picture" title="Picture">
          <PictureUploader onImageUpload={handleImageUpload} />
          {imagePreview && (
            <div className="mt-3">
              <img
                src={imagePreview}
                alt="Preview"
                className="img-thumbnail"
                style={{ maxWidth: "300px" }}
              />
            </div>
          )}
          <Row>
            <Col xs={12}>
              <LoadingSpinner isLoading={isLoading1} />
              <ConversationHistory1 history={conversation1} />
            </Col>
          </Row>
          <Row>
            <Col xs={10}>
              <QuestionInput
                question={question1}
                setQuestion={setQuestion1}
                MAX_QUESTION_LENGTH={MAX_QUESTION_LENGTH}
              />
              <ErrorAlert error={error1} />
            </Col>
            <Col xs={2} className="h-auto align-bottom">
              <Button onClick={handleSubmit1} className="w-100">
                <Icon.Send />
              </Button>
            </Col>
            <Col xs={2} className="h-auto">
              <Button onClick={resetConversation1} className="w-100">
                <Icon.ArrowCounterclockwise />
              </Button>
            </Col>
          </Row>
        </Tab>
      </Tabs>
    </Container>
  );
}

export default QnAApp;
