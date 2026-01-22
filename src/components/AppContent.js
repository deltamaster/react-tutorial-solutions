import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import Settings from "./Settings";
import FollowUpQuestions from "./FollowUpQuestions";
import Memory from "./Memory";
import MarkdownEditor from "./MarkdownEditor";
import LoginButton from "./LoginButton";
import { roleDefinition } from "../utils/roleConfig";
import { buildUserFacingErrorMessage } from "../services/errorService";
import { extractMentionedRolesFromParts } from "../utils/textProcessing/mentionUtils";
import { useConversation } from "../hooks/useConversation";
import { useConversationExport } from "../hooks/useConversationExport";
import { useRoleRequests } from "../hooks/useRoleRequests";
import { useFileUpload } from "../hooks/useFileUpload";
import { useFollowUpQuestions } from "../hooks/useFollowUpQuestions";
import { useSettings } from "../hooks/useSettings";
import { useChromeContent } from "../hooks/useChromeContent";
import { useMessageEditing } from "../hooks/useMessageEditing";
import { findFunctionResponseIndices, deleteMessages } from "../services/conversationService";

// Main application content component
function AppContent() {
  // Use settings hook for managing application settings
  const {
    subscriptionKey,
    systemPrompt,
    userAvatar,
    model,
    handleSubscriptionKeyChange,
    handleSystemPromptChange,
    handleUserAvatarChange,
    handleModelChange,
  } = useSettings();

  const mentionRoleMap = useMemo(() => {
    const map = {};
    Object.entries(roleDefinition).forEach(([roleKey, config]) => {
      if (config?.hidden) {
        return;
      }
      map[roleKey.toLowerCase()] = roleKey;
      if (config?.name) {
        map[config.name.toLowerCase()] = roleKey;
      }
    });
    return map;
  }, []);

  // Use conversation hook for state management
  const [conversation, setConversation, conversationRef] = useConversation("conversation");

  // Use Chrome content hook for retrieving content from Chrome storage or URL
  const { question, setQuestion } = useChromeContent();

  // Use message editing hook
  const {
    editingIndex,
    editingPartIndex,
    editingText,
    setEditingText,
    startEditing,
    cancelEditing,
    saveEditing,
  } = useMessageEditing(setConversation);

  const [currentTab, setCurrentTab] = useState("chatbot");
  const [errorMessage, setErrorMessage] = useState("");

  // State for controlling visibility of top settings
  const [showTopSettings, setShowTopSettings] = useState(false);

  // State for floating tabs visibility
  const [showFloatingTabs, setShowFloatingTabs] = useState(false);
  const tabsRef = useRef(null);

  // Use role requests hook for managing request queue
  const { activeTypers, enqueueRoleRequests } = useRoleRequests({
    conversationRef,
    setConversation,
    appendMessage: (message) => {
      setConversation((prevConversation) => {
        const updatedConversation = [...(prevConversation || []), message];
        conversationRef.current = updatedConversation;
        return updatedConversation;
      });
    },
    onError: (error) => {
      const userMessage = buildUserFacingErrorMessage(error);
      setErrorMessage(userMessage);
    },
    onAllRequestsComplete: () => {
      scheduleFollowUpQuestions();
    },
    mentionRoleMap,
  });

  // Use follow-up questions hook (needs activeTypers from useRoleRequests)
  const {
    followUpQuestions,
    setFollowUpQuestions,
    nextQuestionLoading,
    cancelPendingFollowUpQuestions,
    scheduleFollowUpQuestions,
  } = useFollowUpQuestions({
    conversationRef,
    activeTypers,
  });

  // Use file upload hook for file processing and upload
  const { processFilesForUpload, uploadFiles, updatePartsWithFileUris } = useFileUpload(subscriptionKey);

  // Role request logic is now handled by useRoleRequests hook

  // Handle chatbot question submission
  const handleSubmit = useCallback(async (contentParts) => {
    if (!subscriptionKey) {
      alert("Please input Subscription key");
      return;
    }

    cancelPendingFollowUpQuestions();
    setFollowUpQuestions([]);
    setErrorMessage("");

    // Step 1: Prepare user message with inline_data for immediate display
    // File processing is now handled by useFileUpload hook
    const { displayContentParts, filesToUpload } = await processFilesForUpload(contentParts);

    // Step 2: Show user message immediately with inline_data
    const newUserMessage = {
      role: "user",
      parts: [{ text: "$$$ USER BEGIN $$$\n", hide: true }, ...displayContentParts],
      timestamp: Date.now(),
    };

    // Update conversation synchronously to ensure it's available for parallel requests
    const latestConversation = conversationRef.current || [];
    const updatedConversation = [...latestConversation, newUserMessage];
    conversationRef.current = updatedConversation;
    setConversation(updatedConversation);

    // Step 3: Extract roles and prepare for API request
    const mentionedRoles = extractMentionedRolesFromParts(displayContentParts, mentionRoleMap);
    const rolesToProcess = mentionedRoles.length > 0 
      ? mentionedRoles 
      : ["general"];

    // Step 4: Upload files asynchronously, then send API request
    (async () => {
      try {
        // Upload all files using useFileUpload hook
        const uploadedFiles = await uploadFiles(filesToUpload);

        // Update message parts with file_data using useFileUpload hook
        const updatedParts = updatePartsWithFileUris(displayContentParts, filesToUpload, uploadedFiles);

        // Update the user message in conversation with file_data
        setConversation((prevConversation) => {
          const latestConversation = prevConversation || [];
          const messageIndex = latestConversation.findIndex(
            msg => msg.timestamp === newUserMessage.timestamp
          );
          if (messageIndex >= 0) {
            const updatedConversation = [...latestConversation];
            updatedConversation[messageIndex] = {
              ...updatedConversation[messageIndex],
              parts: [{ text: "$$$ USER BEGIN $$$\n", hide: true }, ...updatedParts],
            };
            conversationRef.current = updatedConversation;
            return updatedConversation;
          }
          return latestConversation;
        });

        // Step 5: Send API request with file_data
        enqueueRoleRequests(rolesToProcess, {
          source: "user",
          triggerMessageId: newUserMessage.timestamp,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file. Please try again.");
        // Remove the user message on error
        setConversation((prevConversation) => {
          const latestConversation = prevConversation || [];
          const filteredConversation = latestConversation.filter(
            msg => msg.timestamp !== newUserMessage.timestamp
          );
          conversationRef.current = filteredConversation;
          return filteredConversation;
        });
      }
    })();
  }, [subscriptionKey, conversationRef, mentionRoleMap, processFilesForUpload, uploadFiles, updatePartsWithFileUris]);

  // Handle follow-up question click
  const handleFollowUpClick = useCallback((question) => {
    // For follow-up questions, we just set the question text directly
    // since follow-up questions don't include images
    setQuestion(question);
  }, []);

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

  // Use conversation export hook
  const { downloadConversation, uploadConversation } = useConversationExport(
    conversation,
    setConversation,
    setFollowUpQuestions
  );

  // Delete a conversation message
  const deleteConversationMessage = useCallback((index) => {
    const currentConversation = conversationRef.current || [];
    const messageToDelete = currentConversation[index];
    
    if (!messageToDelete) {
      return;
    }
    
    let indicesToDelete = [index];
    let confirmMessage = "Are you sure you want to delete this message?";
    
    // If deleting a model response, also find following functionResponse messages
    if (messageToDelete.role === "model") {
      indicesToDelete = findFunctionResponseIndices(currentConversation, index);
      
      // Update confirmation message if functionResponse messages will also be deleted
      const functionResponseCount = indicesToDelete.length - 1;
      if (functionResponseCount > 0) {
        confirmMessage = `Are you sure you want to delete this model response and ${functionResponseCount} associated function response${functionResponseCount > 1 ? 's' : ''}?`;
      }
    }
    
    // Show confirmation and delete if confirmed
    if (window.confirm(confirmMessage)) {
      setConversation((prev) => deleteMessages(prev, indicesToDelete));
    }
  }, [setConversation]);

  // Message editing functions are now provided by useMessageEditing hook

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
      {/* Login button at the top */}
      <Row>
        <Col xs={12} className="mb-2 mt-3">
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", minHeight: "40px" }}>
            <LoginButton />
          </div>
        </Col>
      </Row>

      <Row>
        <Col xs={12} className="mb-3">
          {/* Settings toggle button */}
          <div
            onClick={() => setShowTopSettings(!showTopSettings)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              backgroundColor: "#FFFFFF",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F1F5F9";
              e.currentTarget.style.borderColor = "#2563EB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#FFFFFF";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowTopSettings(!showTopSettings);
              }
            }}
            tabIndex={0}
            role="button"
            aria-expanded={showTopSettings}
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
              model={model}
              setModel={handleModelChange}
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
          style={{ borderBottom: "2px solid #E2E8F0" }}
        >
          <Tab eventKey="chatbot" title="Chatbot">
            <Row className="mb-3">
              <Col xs={12} className="d-flex justify-content-end gap-2">
                <div className="relative">
                  <Button
                    id="download-conversation"
                    variant="primary"
                    onClick={downloadConversation}
                    size="sm"
                    style={{ display: conversation.length > 0 ? "inline-flex" : "none" }}
                  >
                    <Icon.Download size={14} />
                    <span className="d-none d-md-inline ms-1">Download</span>
                  </Button>
                </div>

                <div className="relative">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => document.getElementById('upload-conversation').click()}
                  >
                    <Icon.Upload size={14} />
                    <span className="d-none d-md-inline ms-1">Upload</span>
                  </Button>
                  <input
                    id="upload-conversation"
                    type="file"
                    accept=".json"
                    onChange={uploadConversation}
                    style={{ display: "none" }}
                  />
                </div>

                <div className="relative">
                  <Button
                    id="reset-conversation"
                    variant="danger"
                    onClick={resetConversation}
                    size="sm"
                    style={{ display: conversation.length > 0 ? "inline-flex" : "none" }}
                  >
                    <Icon.ArrowClockwise size={14} />
                    <span className="d-none d-md-inline ms-1">Reset</span>
                  </Button>
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

                {activeTypers.length > 0 && (
                  <div className="mb-3 typing-indicator">
                    {activeTypers.length === 1
                      ? `${activeTypers[0]} is typing ...`
                      : `${activeTypers.join(", ")} are typing ...`}
                  </div>
                )}
                <QuestionInput
                  onSubmit={handleSubmit}
                  value={question}
                  onChange={setQuestion}
                />
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
          className="floating-tabs-container"
          style={{
            position: "fixed",
            top: "16px",
            left: "16px",
            right: "16px",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            maxWidth: "fit-content",
            margin: "0 auto",
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
