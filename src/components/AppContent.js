import { useState, useEffect, useRef } from "react";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import * as Icon from "react-bootstrap-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles.css";
import ConversationHistory from "./ConversationHistory";
import QuestionInput from "./QuestionInput";
import LoadingSpinner from "./LoadingSpinner";
import Settings from "./Settings";
import FollowUpQuestions from "./FollowUpQuestions";
import Memory from "./Memory";
import MarkdownEditor from "./MarkdownEditor";
import {
  extractTextFromResponse,
  fetchFromApi,
  generateFollowUpQuestions,
  toolbox,
  ApiError,
} from "../utils/apiUtils";
import { useLocalStorage } from "../utils/storageUtils";
import { roleDefinition, roleUtils } from "../utils/roleConfig";
import { getSubscriptionKey, setSubscriptionKey, getSystemPrompt, setSystemPrompt, getUserAvatar, setUserAvatar } from "../utils/settingsService";

// Main application content component
function AppContent() {
  // 使用settingsService获取和设置API密钥、系统提示和用户头像
  const [subscriptionKey, setLocalSubscriptionKey] = useState(getSubscriptionKey());
  const [systemPrompt, setLocalSystemPrompt] = useState(getSystemPrompt());
  const [userAvatar, setLocalUserAvatar] = useState(getUserAvatar());
  
  // 包装setter函数以确保通过settingsService保存
  const handleSubscriptionKeyChange = (key) => {
    setSubscriptionKey(key); // 使用settingsService保存到localStorage
    setLocalSubscriptionKey(key); // 更新本地状态
  };
  
  const handleSystemPromptChange = (prompt) => {
    setSystemPrompt(prompt); // 使用settingsService保存到localStorage
    setLocalSystemPrompt(prompt); // 更新本地状态
  };

  const handleUserAvatarChange = (avatar) => {
    setUserAvatar(avatar); // 使用settingsService保存到localStorage
    setLocalUserAvatar(avatar); // 更新本地状态
  };

  // Retrieve API key from Chrome storage
  useEffect(() => {
    // Check if running in Chrome extension environment
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.get(["apiKey"], (result) => {
        if (result.apiKey) {
          setSubscriptionKey(result.apiKey); // 使用settingsService保存
          setLocalSubscriptionKey(result.apiKey); // 更新本地状态
        }
      });
    }
  }, []);

  // Update Chrome storage when subscriptionKey changes
  useEffect(() => {
    if (subscriptionKey && typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ apiKey: subscriptionKey });
    }
  }, [subscriptionKey]);

  // No subscription key format validation required


  const [conversation, setConversation] = useLocalStorage("conversation", []);
  const [loading, setLoading] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [question, setQuestion] = useState("");

  // Retrieve content from Chrome storage API and fill into question input
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contentStored = urlParams.get("content") === "stored";

    if (contentStored && typeof chrome !== "undefined" && chrome.storage) {
      // Get content from Chrome storage
      chrome.storage.local.get(
        ["pageContent", "contentTimestamp"],
        (result) => {
          if (result.pageContent && result.contentTimestamp) {
            // Check if content is stored within last 5 minutes to avoid using expired content
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (now - result.contentTimestamp < fiveMinutes) {
              // Use stored content
              setQuestion(result.pageContent.content);

              // Clean up storage after using content to avoid reuse on next open
              chrome.storage.local.remove(["pageContent", "contentTimestamp"]);
            } else {
              console.log("Stored content is too old, ignoring");
            }
          }
        }
      );
    } else {
      // Fallback: if not opened from context menu or chrome.storage not supported
      // still try to get content from URL parameters (for testing or other cases)
      const markdownContent = urlParams.get("markdown");
      const htmlContent = urlParams.get("html");

      // Prefer markdown content, fallback to html content
      let content = markdownContent || htmlContent;

      if (content) {
        try {
          // Decode URL-encoded content
          const decodedContent = decodeURIComponent(content);
          setQuestion(decodedContent);
        } catch (error) {
          console.error("Error decoding content from URL:", error);
        }
      }
    }
  }, []);
  const [nextQuestionLoading, setNextQuestionLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("chatbot");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // State for controlling visibility of top settings
  const [showTopSettings, setShowTopSettings] = useState(false);

  // State for floating tabs visibility
  const [showFloatingTabs, setShowFloatingTabs] = useState(false);
  const tabsRef = useRef(null);

  // Helper function to convert image file to base64
  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data:image/xxx;base64, prefix to get just the base64 data
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle chatbot question submission
  const handleSubmit = async (contentParts) => {
    if (!subscriptionKey) {
      alert("Please input Subscription key");
      return;
    }

    setLoading(true);
    setFollowUpQuestions([]);

    // Process content parts to convert image files to base64 for storing in conversation history
    const processedContentParts = [];
    for (const part of contentParts) {
      if (part.inline_data && part.inline_data.file) {
        try {
          // Convert image to base64 for storing in conversation history
          const base64Data = await convertImageToBase64(part.inline_data.file);
          processedContentParts.push({
            inline_data: {
              mime_type: part.inline_data.mime_type,
              data: base64Data,
            },
          });
        } catch (error) {
          console.error("Error converting image to base64:", error);
          alert("Failed to process image file");
          setLoading(false);
          return;
        }
      } else {
        // Keep text parts as is
        processedContentParts.push(part);
      }
    }

    // Create a new user message with the processed content parts
    const newUserMessage = {
      role: "user",
      parts: [{ text: "$$$ USER BEGIN $$$\n", hide: true }, ...processedContentParts],
      timestamp: Date.now(), // Add timestamp when user submits message
    };

    setConversation((prev) => [...prev, newUserMessage]);

    try {
      // Use system prompt as parameter, not as part of conversation
      let currentConversation = [...conversation, newUserMessage];

      // Use a loop to handle multiple function calls
      let hasFunctionCalls = true;
      let shouldSwitchRole = false;
      let currentRole = "general"; // default role

      // Check if user message contains an @mention to switch role
      // First, check if any text part contains an @mention
      for (const part of processedContentParts) {
        if (!part.text) {
          continue;
        }
  
        const text = part.text.toLowerCase();
        const mentionedRole = roleUtils.getRoleByMention(text);
        if (!mentionedRole) {
          continue;
        }
        currentRole = mentionedRole;
        const roleName = roleDefinition[currentRole]?.name;
        console.log(`${roleName} (${currentRole}) mentioned in user message`);
      }

      while (hasFunctionCalls || shouldSwitchRole) {
        // Make API request with current conversation state
        console.log("Current role:", currentRole);
        const responseData = await fetchFromApi(
          currentConversation,
          "default",
          true,
          currentRole
        );

        // Check if response data has valid content structure
        if (!responseData.candidates[0].content) {
          throw new Error("No content in candidates[0]");
        }

        // Process response data
        const responseParts = responseData.candidates[0].content.parts || [];

        // Separate text parts and function call parts
        const textParts = responseParts.filter(
          (part) =>
            part.text ||
            part.executableCode ||
            part.codeExecutionResult ||
            (part.inlineData &&
              part.inlineData.data &&
              part.inlineData.mimeType)
        );
        const functionCallParts = responseParts.filter(
          (part) => part.functionCall
        );

        // Always create a bot response with text parts (if any)
        if (textParts.length > 0) {
          // 创建 bot 响应，包含 groundingChunks 和 groundingSupports（如果存在）
          // 添加name字段以区分不同角色，但保持role为'model'以确保API兼容性
          const botResponse = {
            role: "model",
            name: roleDefinition[currentRole]?.name || "Adrien",
            parts: textParts,
            timestamp: Date.now(), // Add timestamp when receiving bot response
            // 添加 grounding 数据到响应中，但这些数据不会被传递到下次请求
            groundingChunks:
              responseData.candidates[0]?.groundingMetadata?.groundingChunks ||
              [],
            groundingSupports:
              responseData.candidates[0]?.groundingMetadata
                ?.groundingSupports || [],
          };
          currentConversation = [...currentConversation, botResponse];
          setConversation(currentConversation);
        }

        // Check if there are function calls to process
        if (functionCallParts.length > 0) {
          const functionResults = [];

          // Execute each function call
          for (const functionCallPart of functionCallParts) {
            const { name, args } = functionCallPart.functionCall;
            if (toolbox[name]) {
              const result = await toolbox[name](args);
              functionResults.push({ name, result });
            } else {
              console.error(`Function ${name} not found in toolbox`);
            }
          }
          if (functionResults.length > 0) {
            hasFunctionCalls = true;
            // Check if current role is configured to not allow function calls
            if (roleUtils.canRoleUseFunctions(currentRole)) {
              // Add function results to conversation
              const functionResponseMessage = {
                role: "user",
                parts: functionResults.map((result) => ({
                  functionResponse: {
                    name: result.name,
                    response: { result: result.result },
                  },
                })),
                timestamp: Date.now(), // Add timestamp for function response
              };
              currentConversation = [
                ...currentConversation,
                functionResponseMessage,
              ];
            }
          } else {
            // No more function calls, exit loop
            hasFunctionCalls = false;
            currentRole = "general";
          }
        } else {
          // No more function calls, exit loop
          hasFunctionCalls = false;
          currentRole = "general";
        }

        // 遍历所有文本部分，查找@userName格式的标记
        let prevRole = currentRole;
        textParts.forEach((part) => {
          if (shouldSwitchRole) {
            return; // Only handle one mention request
          }
          if (!part.text || part.thought) {
            return;
          }
          // Check for role mentions using centralized role configuration
          const mentionedRole = roleUtils.getRoleByMention(part.text);
          if (!mentionedRole) {
            return;
          }
          const roleName = roleDefinition[mentionedRole]?.name;
          console.log(`${roleName} (${mentionedRole}) mentioned`);
          currentRole = mentionedRole;

          if (prevRole !== currentRole) {
            shouldSwitchRole = true;
          }
        });
        if (prevRole == currentRole) {
          shouldSwitchRole = false;
        }

        // Default case if no function calls
        if (!hasFunctionCalls && !shouldSwitchRole) {
          console.log("No function calls or role switches needed");
        }
      }

      // After all function calls are processed, generate follow-up questions
      setNextQuestionLoading(true);
      try {
        const nextQuestionResponseData = await generateFollowUpQuestions(currentConversation);
        const nextQuestionResponseObj = extractTextFromResponse(
          nextQuestionResponseData
        );
        const nextQuestionResponseText = nextQuestionResponseObj.responseText;

        // Parse follow-up questions
        if (nextQuestionResponseText) {
          const lines = nextQuestionResponseText.split("\n");
          const questions = lines.slice(0, 3).filter((q) => q.trim());

          setFollowUpQuestions(questions);
        }
      } catch (error) {
        console.error("Error generating follow-up questions:", error);
      } finally {
        setNextQuestionLoading(false);
      }
    } catch (error) {
      console.error("API Error:", error);

      // Handle ApiError with structured information
      if (error instanceof ApiError) {
        const { statusCode, errorType, message, details } = error;

        // Create a more user-friendly error message based on error type
        let userMessage = "";

        switch (errorType) {
          case "validation_error":
            userMessage = `Invalid input: ${message}`;
            break;
          case "file_processing_error":
            userMessage = `File processing error: ${message} (MIME type: ${
              details.mimeType || "unknown"
            })`;
            break;
          case "api_response_error":
            userMessage = `Service error: ${message}`;
            if (statusCode === 401 || statusCode === 403) {
              userMessage += " - Please check your API key";
            }
            break;
          case "network_error":
            userMessage = `Network error: ${
              message || "Please check your internet connection"
            }`;
            break;
          default:
            userMessage = message;
        }

        // Include status code if available
        if (statusCode && statusCode !== "Unknown") {
          userMessage += ` (Status: ${statusCode})`;
        }

        setErrorMessage(userMessage);
      } else {
        // Handle generic errors
        const statusCode = error.statusCode || error.status || "Unknown";
        const errorMsg = error.message || "Failed to send message";
        setErrorMessage(`${errorMsg} (Status: ${statusCode})`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle follow-up question click
  const handleFollowUpClick = (question) => {
    // For follow-up questions, we just set the question text directly
    // since follow-up questions don't include images
    setQuestion(question);
  };

  // Reset conversation history, summaries and predicted questions
  const resetConversation = () => {
    if (
      window.confirm("Are you sure you want to reset the conversation history?")
    ) {
      setConversation([]);
      setFollowUpQuestions([]); // Clear predicted questions
      // Also clear conversation summaries from localStorage
      try {
        localStorage.removeItem("conversation_summaries");
        console.log("Conversation summaries cleared");
      } catch (error) {
        console.error("Error clearing conversation summaries:", error);
      }
    }
  };

  // Download conversation history - now includes conversation_summaries
  const downloadConversation = () => {
    try {
      // Get conversation_summaries from localStorage
      const summaries = JSON.parse(
        localStorage.getItem("conversation_summaries") || "[]"
      );

      // Create new format with both conversation and summaries
      const exportData = {
        version: "1.1", // Version marker for future compatibility
        conversation: conversation,
        conversation_summaries: summaries,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

      const exportFileDefaultName = "conversation_history.json";

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error("Error downloading conversation:", error);
      alert("Failed to download conversation history.");
    }
  };

  // Upload conversation history - compatible with both old and new format
  const uploadConversation = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploadedData = JSON.parse(e.target.result);

        // Check if it's the new format with version and summaries
        if (uploadedData.version && uploadedData.conversation) {
          // New format: set both conversation and summaries
          setConversation(uploadedData.conversation);

          // Restore conversation_summaries if present
          if (uploadedData.conversation_summaries) {
            try {
              localStorage.setItem(
                "conversation_summaries",
                JSON.stringify(uploadedData.conversation_summaries)
              );
              console.log("Conversation summaries restored from upload");
            } catch (error) {
              console.error("Error restoring conversation summaries:", error);
            }
          }
        } else {
          // Old format: just set the conversation (assuming the entire file is conversation data)
          setConversation(uploadedData);
          // Clear summaries for old format uploads (maintaining previous behavior)
          try {
            localStorage.removeItem("conversation_summaries");
            console.log("Conversation summaries cleared for old format upload");
          } catch (error) {
            console.error("Error clearing conversation summaries:", error);
          }
        }

        setFollowUpQuestions([]); // Clear predicted questions when uploading new conversation
        event.target.value = "";
      } catch (error) {
        alert(
          "Failed to upload conversation history. Please provide a valid JSON file."
        );
        console.error("Error parsing uploaded file:", error);
      }
    };
    reader.readAsText(file);
  };

  // Delete a conversation message
  const deleteConversationMessage = (index) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      setConversation((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Start editing a conversation part
  const startEditing = (index, partIndex, text) => {
    setEditingIndex(index);
    setEditingPartIndex(partIndex);
    setEditingText(text);
  };

  // Save edited conversation part
  const saveEditing = () => {
    if (editingIndex !== null && editingPartIndex !== null) {
      setConversation((prev) =>
        prev.map((message, index) => {
          if (index === editingIndex) {
            return {
              ...message,
              parts: message.parts.map((part, partIndex) => {
                if (partIndex === editingPartIndex) {
                  return { ...part, text: editingText };
                }
                return part;
              }),
            };
          }
          return message;
        })
      );
      cancelEditing();
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingPartIndex(null);
    setEditingText("");
  };

  // Handle scroll to show/hide floating tabs
  useEffect(() => {
    const handleScroll = () => {
      if (tabsRef.current) {
        const tabsRect = tabsRef.current.getBoundingClientRect();
        // Show floating tabs when tabs are not fully visible at the top
        setShowFloatingTabs(tabsRect.top < 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    // Initial check with timeout to ensure DOM is fully rendered
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Container className="App">
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          {/* Settings toggle button */}
          <div
            onClick={() => setShowTopSettings(!showTopSettings)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#e9ecef")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#f8f9fa")}
          >
            <h5 className="mb-0" style={{ fontWeight: "500" }}>
              Global Settings
            </h5>
            <div style={{ display: "flex", alignItems: "center" }}>
              {showTopSettings ? (
                <>
                  <span className="mr-1" style={{ fontSize: "0.9em" }}>
                    Hide
                  </span>
                  <Icon.ChevronUp size={16} />
                </>
              ) : (
                <>
                  <span className="mr-1" style={{ fontSize: "0.9em" }}>
                    Show
                  </span>
                  <Icon.ChevronDown size={16} />
                </>
              )}
            </div>
          </div>

          {/* Settings section - conditionally rendered */}
          {showTopSettings && (
            <Settings
              subscriptionKey={subscriptionKey}
              setSubscriptionKey={handleSubscriptionKeyChange}
              systemPrompt={systemPrompt}
              setSystemPrompt={handleSystemPromptChange}
              userAvatar={userAvatar}
              setUserAvatar={handleUserAvatarChange}
            />
          )}
        </Col>
      </Row>

      <Row>
        <Col xs={12}>
          <Alert variant="info" className="warning-alert">
            <Icon.ShieldExclamation size={16} className="mr-2" />
            There is no filter on offending response. Use the tool at your own
            risk.
          </Alert>
        </Col>
      </Row>

      <div ref={tabsRef}>
        <Tabs
          activeKey={currentTab}
          onSelect={(tab) => setCurrentTab(tab)}
          className="mb-3"
          style={{ borderBottom: "1px solid #e9ecef" }}
        >
          <Tab eventKey="chatbot" title="Chatbot">
            <Row className="mb-3">
              <Col xs={12} className="d-flex justify-content-end gap-2">
                <div className="relative">
                  <Button
                    id="reset-conversation"
                    variant="secondary"
                    onClick={resetConversation}
                    className="toggle-label"
                    style={{ display: "none" }} // Hide the actual input element
                  ></Button>
                  <label
                    htmlFor="reset-conversation"
                    className="toggle-label toggle-on"
                    style={{
                      display:
                        conversation.length > 0 ? "inline-block" : "none",
                    }}
                  >
                    <Icon.ArrowClockwise size={16} className="mr-2" />
                    <span className="toggle-text">
                      &nbsp;Reset Conversation
                    </span>
                  </label>
                </div>
                <div className="relative">
                  <Button
                    id="download-conversation"
                    variant="secondary"
                    onClick={downloadConversation}
                    style={{ display: "none" }} // Hide the actual input element
                  ></Button>
                  <label
                    htmlFor="download-conversation"
                    className="toggle-label toggle-on"
                    style={{
                      display:
                        conversation.length > 0 ? "inline-block" : "none",
                    }}
                  >
                    <Icon.Download size={16} className="mr-2" />
                    <span className="toggle-text">&nbsp;Download History</span>
                  </label>
                </div>

                <div className="relative">
                  <Button
                    variant="secondary"
                    style={{ display: "none" }} // Hide the actual input element
                  ></Button>
                  <input
                    id="upload-conversation"
                    type="file"
                    accept=".json"
                    onChange={uploadConversation}
                    style={{ display: "none" }} // Hide the actual input element
                  />
                  <label
                    htmlFor="upload-conversation"
                    className="toggle-label toggle-on"
                    style={{ display: "inline-block" }}
                  >
                    <Icon.Upload size={16} className="mr-2" />
                    <span className="toggle-text">&nbsp;Upload History</span>
                  </label>
                </div>
              </Col>
            </Row>
            <Row>
              <Col>
                <ConversationHistory
                  history={conversation}
                  onDelete={deleteConversationMessage}
                  onEdit={startEditing}
                  editingIndex={editingIndex}
                  editingPartIndex={editingPartIndex}
                  editingText={editingText}
                  onEditingTextChange={setEditingText}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <FollowUpQuestions
                  questions={followUpQuestions}
                  onQuestionClick={handleFollowUpClick}
                  isLoading={nextQuestionLoading}
                />

                {/* 错误消息显示，带关闭按钮 */}
                {errorMessage && (
                  <div
                    className="mb-3 alert alert-danger alert-dismissible fade show"
                    role="alert"
                  >
                    {errorMessage}
                    <button
                      type="button"
                      className="close-button"
                      data-dismiss="alert"
                      aria-label="Close"
                      onClick={() => setErrorMessage("")}
                    >
                      <Icon.X size={14} />
                    </button>
                  </div>
                )}

                {loading ? (
                  <LoadingSpinner />
                ) : (
                  <QuestionInput
                    onSubmit={handleSubmit}
                    disabled={loading}
                    value={question}
                    onChange={setQuestion}
                  />
                )}
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="markdown" title="Co-Edit">
            <Row>
              <Col>
                <MarkdownEditor />
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="memory" title="Memory">
            <Row>
              <Col>
                <Memory />
              </Col>
            </Row>
          </Tab>
        </Tabs>
      </div>

      {/* Floating tabs buttons - appear when original tabs are scrolled out of view */}
      {showFloatingTabs && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "10px 20px",
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <Button
            variant={currentTab === "chatbot" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("chatbot")}
          >
            Chatbot
          </Button>
          <Button
            variant={currentTab === "markdown" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("markdown")}
          >
            Co-Edit
          </Button>
          <Button
            variant={currentTab === "memory" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("memory")}
          >
            Memory
          </Button>
        </div>
      )}
    </Container>
  );
}

export default AppContent;
