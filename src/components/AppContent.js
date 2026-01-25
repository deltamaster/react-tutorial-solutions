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
import ConversationSelector from "./ConversationSelector";
import QuestionInput from "./QuestionInput";
import Settings from "./Settings";
import FollowUpQuestions from "./FollowUpQuestions";
import Memory from "./Memory";
import MarkdownEditor from "./MarkdownEditor";
import LoginButton from "./LoginButton";
import ConversationTitle from "./ConversationTitle";
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
import { findFunctionResponseIndices, deleteMessages, filterDeletedMessages, appendMessage } from "../services/conversationService";

// Main application content component
function AppContent() {
  // State for floating menu
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false);
  const [isConversationSelectorOpen, setIsConversationSelectorOpen] = useState(false);
  const floatingMenuRef = useRef(null);
  const conversationContainerRef = useRef(null);

  // Detect scroll to show/hide floating menu
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // Show floating menu when scrolled down more than 100px
      setShowFloatingMenu(scrollY > 100);
      // Close menu when scrolling back to top
      if (scrollY <= 100) {
        setIsFloatingMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close floating menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (floatingMenuRef.current && !floatingMenuRef.current.contains(event.target)) {
        setIsFloatingMenuOpen(false);
      }
    };

    if (isFloatingMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFloatingMenuOpen]);

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
  const conversationHookResult = useConversation("conversation");
  const [conversation, setConversation, conversationRef, syncHelpers] = conversationHookResult;
  
  // Extract sync helpers if OneDrive is available
  const currentConversationTitle = syncHelpers?.currentConversationTitle || 'New Conversation';
  const isSyncing = syncHelpers?.isSyncing || false;
  const isGeneratingTitle = syncHelpers?.isGeneratingTitle || false;
  const updateConversationTitle = syncHelpers?.updateConversationTitle || (() => {});
  const isOneDriveAvailable = syncHelpers?.isOneDriveAvailable || false;
  const conversations = syncHelpers?.conversations || [];
  const currentConversationId = syncHelpers?.currentConversationId;
  
  // Debug: Log OneDrive status
  useEffect(() => {
    console.log('[AppContent] OneDrive status:', {
      hasSyncHelpers: !!syncHelpers,
      isOneDriveAvailable,
      currentConversationId,
      conversationLength: conversation?.length,
      syncConversationLength: syncHelpers?.conversation?.length
    });
  }, [syncHelpers, isOneDriveAvailable, currentConversationId, conversation?.length]);

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
    saveEditing: originalSaveEditing,
  } = useMessageEditing(setConversation);

  // Wrap saveEditing to trigger sync after part edits
  const saveEditing = useCallback(() => {
    originalSaveEditing();
    // Trigger sync after editing parts
    if (syncHelpers?.syncCurrentConversation) {
      setTimeout(() => {
        console.log('[AppContent] Triggering sync after part edit...');
        syncHelpers.syncCurrentConversation().catch(err => {
          console.error('[AppContent] Error syncing conversation after part edit:', err);
        });
      }, 500);
    }
  }, [originalSaveEditing, syncHelpers]);

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
      // setConversation wrapper already updates conversationRef.current immediately
      // Use appendMessage service to ensure timestamps are added to parts
      setConversation((prevConversation) => {
        return appendMessage(prevConversation || [], message);
      });
    },
    onError: (error) => {
      const userMessage = buildUserFacingErrorMessage(error);
      setErrorMessage(userMessage);
    },
    onAllRequestsComplete: () => {
      // Trigger auto-save and title generation after model responses
      // generateAndUpdateTitle now generates title, summary, and next questions in ONE API call
      console.log('[AppContent] onAllRequestsComplete called', {
        hasSyncHelpers: !!syncHelpers,
        isOneDriveAvailable: syncHelpers?.isOneDriveAvailable,
        conversationLength: conversation?.length
      });
      
      // CRITICAL: Always sync when model response is received (both user request and model response)
      // Add a small delay to ensure conversationRef.current is updated with the latest model response
      console.log('[AppContent] Model response complete, triggering OneDrive sync...', {
        conversationLength: conversation?.length,
        conversationRefLength: conversationRef?.current?.length
      });
      if (syncHelpers?.syncCurrentConversation) {
        // Small delay to ensure conversationRef.current is updated with latest model response
        // This handles race conditions where onAllRequestsComplete fires before appendMessage completes
        setTimeout(() => {
          console.log('[AppContent] Delayed sync - ensuring conversationRef is up-to-date', {
            conversationRefLength: conversationRef?.current?.length
          });
          // Sync first, then generate metadata (title, summary, next questions) after sync completes
          syncHelpers.syncCurrentConversation()
            .then(() => {
              // Generate metadata (title, summary, next questions) after sync completes successfully
              // This ensures conversation ID is created before metadata generation
              if (syncHelpers?.generateAndUpdateTitle) {
                console.log('[AppContent] Sync completed, triggering combined metadata generation (title, summary, next questions)...');
                // Small delay to ensure state is updated
                setTimeout(() => {
                  console.log('[AppContent] Calling generateAndUpdateTitle (combined API call)...');
                  syncHelpers.generateAndUpdateTitle()
                    .then((metadata) => {
                      // Use the nextQuestions from the combined API call
                      if (metadata && metadata.nextQuestions && Array.isArray(metadata.nextQuestions)) {
                        const validQuestions = metadata.nextQuestions
                          .filter((q) => typeof q === "string" && q.trim())
                          .slice(0, 3);
                        setFollowUpQuestions(validQuestions);
                        console.log('[AppContent] Set follow-up questions from combined metadata:', validQuestions);
                      }
                    })
                    .catch(err => {
                      console.error('[AppContent] Error generating metadata:', err);
                    });
                }, 500);
              }
            })
            .catch(err => {
              console.error('[AppContent] Error syncing conversation:', err);
              // Still try to generate metadata even if sync fails (might have existing ID)
              if (syncHelpers?.generateAndUpdateTitle) {
                setTimeout(() => {
                  console.log('[AppContent] Sync failed, but trying metadata generation anyway...');
                  syncHelpers.generateAndUpdateTitle()
                    .then((metadata) => {
                      // Use the nextQuestions from the combined API call
                      if (metadata && metadata.nextQuestions && Array.isArray(metadata.nextQuestions)) {
                        const validQuestions = metadata.nextQuestions
                          .filter((q) => typeof q === "string" && q.trim())
                          .slice(0, 3);
                        setFollowUpQuestions(validQuestions);
                        console.log('[AppContent] Set follow-up questions from combined metadata:', validQuestions);
                      }
                    })
                    .catch(titleErr => {
                      console.error('[AppContent] Error generating metadata:', titleErr);
                    });
                }, 500);
              }
            });
        }, 300); // Small delay to ensure conversationRef.current is updated
      } else {
        // No sync helpers available, try metadata generation anyway
        if (syncHelpers?.generateAndUpdateTitle) {
          setTimeout(() => {
            console.log('[AppContent] No sync helpers, calling generateAndUpdateTitle directly...');
            syncHelpers.generateAndUpdateTitle()
              .then((metadata) => {
                // Use the nextQuestions from the combined API call
                if (metadata && metadata.nextQuestions && Array.isArray(metadata.nextQuestions)) {
                  const validQuestions = metadata.nextQuestions
                    .filter((q) => typeof q === "string" && q.trim())
                    .slice(0, 3);
                  setFollowUpQuestions(validQuestions);
                  console.log('[AppContent] Set follow-up questions from combined metadata:', validQuestions);
                }
              })
              .catch(err => {
                console.error('[AppContent] Error generating metadata:', err);
              });
          }, 500);
        }
      }
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

    // Update conversation - setConversation wrapper will update ref and localStorage immediately
    const latestConversation = conversationRef.current || [];
    const updatedConversation = [...latestConversation, newUserMessage];
    
    console.log('[AppContent] handleSubmit - updating conversation', {
      conversationLength: updatedConversation.length,
      hasSyncHelpers: !!syncHelpers,
      isOneDriveAvailable: syncHelpers?.isOneDriveAvailable
    });
    
    // Update conversation state (this updates localStorage and ref immediately via wrapper)
    setConversation(updatedConversation);
    
    // Explicitly trigger OneDrive sync after user sends message
    // Let syncCurrentConversation handle availability check internally
    // Delay sync to ensure conversation state and localStorage are updated first
    if (syncHelpers?.syncCurrentConversation) {
      setTimeout(() => {
        syncHelpers.syncCurrentConversation().catch(err => {
          console.error('[AppContent] Error syncing conversation:', err);
        });
      }, 500);
    }
    
    // Auto-save is handled automatically by useConversationSync hook via useEffect
    // It will create a conversation automatically if OneDrive is available and no conversation exists

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
            // setConversation wrapper will update ref automatically
            console.log('[AppContent] Updated conversation with file_data', {
              conversationLength: updatedConversation.length
            });
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
          // setConversation wrapper will update ref automatically
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
    // IMMEDIATELY reset UI and localStorage first (user sees instant feedback)
    setConversation([]);
    setFollowUpQuestions([]); // Clear predicted questions
    
    // Clear conversation summaries from localStorage
    try {
      localStorage.removeItem("conversation_summaries");
      console.log("Conversation summaries cleared");
    } catch (error) {
      console.error("Error clearing conversation summaries:", error);
    }
    
    // Reset OneDrive conversation ID and title immediately
    if (syncHelpers?.resetCurrentConversation) {
      // Reset immediately (saves old conversation to OneDrive in background)
      syncHelpers.resetCurrentConversation().catch(err => {
        console.error('[AppContent] Error saving old conversation during reset:', err);
      });
      console.log('[AppContent] Reset OneDrive conversation ID and title');
    } else {
      // Fallback: clear localStorage directly if reset function not available
      try {
        localStorage.removeItem("onedrive_latest_conversation_id");
        localStorage.removeItem("onedrive_latest_conversation_title");
        console.log('[AppContent] Cleared OneDrive conversation ID and title from localStorage (fallback)');
      } catch (error) {
        console.error("Error clearing OneDrive conversation ID:", error);
      }
    }
    
    console.log('[AppContent] Conversation reset complete - UI and localStorage cleared immediately');
  };

  // Use conversation export hook
  const { downloadConversation, uploadConversation } = useConversationExport(
    conversation,
    setConversation,
    setFollowUpQuestions
  );

  // Delete a conversation message
  const deleteConversationMessage = useCallback((filteredIndex) => {
    // Get the filtered conversation (without deleted messages) to find the message at filteredIndex
    const filteredConversation = filterDeletedMessages(conversationRef.current || []);
    const messageToDelete = filteredConversation[filteredIndex];
    
    if (!messageToDelete || !messageToDelete.timestamp) {
      console.warn('[deleteConversationMessage] Message not found at filtered index:', filteredIndex);
      return;
    }
    
    // Find the actual index in the full conversation array using timestamp
    const currentConversation = conversationRef.current || [];
    const actualIndex = currentConversation.findIndex(msg => 
      msg.timestamp === messageToDelete.timestamp && !msg.deleted
    );
    
    if (actualIndex === -1) {
      console.warn('[deleteConversationMessage] Message not found in full conversation:', messageToDelete.timestamp);
      return;
    }
    
    let indicesToDelete = [actualIndex];
    let confirmMessage = "Are you sure you want to delete this message?";
    
    // If deleting a model response, also find following functionResponse messages
    if (messageToDelete.role === "model") {
      indicesToDelete = findFunctionResponseIndices(currentConversation, actualIndex);
      
      // Update confirmation message if functionResponse messages will also be deleted
      const functionResponseCount = indicesToDelete.length - 1;
      if (functionResponseCount > 0) {
        confirmMessage = `Are you sure you want to delete this model response and ${functionResponseCount} associated function response${functionResponseCount > 1 ? 's' : ''}?`;
      }
    }
    
    // Show confirmation and delete if confirmed
    if (window.confirm(confirmMessage)) {
      // Use conversationRef.current directly to ensure we're working with the latest state
      const updatedConversation = deleteMessages(currentConversation, indicesToDelete);
      console.log('[deleteConversationMessage] Deleting messages at indices:', indicesToDelete, {
        filteredIndex,
        actualIndex,
        beforeLength: currentConversation.length,
        afterLength: updatedConversation.length,
        messageTimestamp: messageToDelete.timestamp
      });
      setConversation(updatedConversation);
      
      // Trigger sync after deleting messages
      if (syncHelpers?.syncCurrentConversation) {
        setTimeout(() => {
          console.log('[AppContent] Triggering sync after message deletion...');
          syncHelpers.syncCurrentConversation().catch(err => {
            console.error('[AppContent] Error syncing conversation after deletion:', err);
          });
        }, 500);
      }
    }
  }, [setConversation, syncHelpers]);

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

      {/* Upload input - always available */}
      <input
        id="upload-conversation"
        type="file"
        accept=".json"
        onChange={uploadConversation}
        style={{ display: "none" }}
      />

      <div ref={tabsRef}>
        <Tabs
          activeKey={currentTab}
          onSelect={(tab) => setCurrentTab(tab)}
          className="mb-3"
          style={{ borderBottom: "2px solid #E2E8F0" }}
        >
          <Tab eventKey="chatbot" title="Chatbot">
            <Row className="mb-3">
              <Col xs={12} className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-2">
                {/* Conversation Title and Selector - Left side */}
                {isOneDriveAvailable && !showFloatingMenu && (
                  <div className="flex-grow-1 d-flex flex-column gap-2" style={{ minWidth: 0, maxWidth: '100%' }}>
                    <ConversationTitle
                      title={currentConversationTitle}
                      isAutoTitle={conversations.find(c => c.id === currentConversationId)?.autoTitle !== false}
                      isGeneratingTitle={isGeneratingTitle}
                      onTitleChange={updateConversationTitle}
                    />
                    <div style={{ position: 'relative', zIndex: 1050, overflow: 'visible' }}>
                      <ConversationSelector
                        conversations={conversations}
                        currentConversationId={currentConversationId}
                        onSwitchConversation={syncHelpers?.switchConversation}
                        onDeleteConversation={syncHelpers?.deleteConversation}
                        isSyncing={isSyncing}
                      />
                    </div>
                  </div>
                )}
                
                {/* Action Buttons - Right side (wraps to next line on small screens, aligned right) */}
                {!showFloatingMenu && (
                  <div className="d-flex gap-2 ms-md-auto align-self-md-center" style={{ alignSelf: 'flex-end' }}>
                    {/* Sync indicator - Left of buttons */}
                    {isOneDriveAvailable && isSyncing && (
                      <div className="d-flex align-items-center">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      </div>
                    )}
                    
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
                    </div>

                    <div className="relative">
                      <Button
                        id="reset-conversation"
                        variant="primary"
                        onClick={resetConversation}
                        size="sm"
                        style={{ display: conversation.length > 0 ? "inline-flex" : "none" }}
                      >
                        <Icon.PlusCircle size={14} />
                        <span className="d-none d-md-inline ms-1">New Conversation</span>
                      </Button>
                    </div>
                  </div>
                )}
              </Col>
            </Row>
            <Row>
              <Col>
                {/* Floating Hamburger Menu */}
                {showFloatingMenu && (
                  <div
                    ref={floatingMenuRef}
                    style={{
                      position: 'fixed',
                      top: '20px',
                      left: '20px',
                      zIndex: 1050,
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      width: isFloatingMenuOpen ? '450px' : 'auto',
                      maxWidth: isFloatingMenuOpen ? '95vw' : 'auto',
                      padding: isFloatingMenuOpen ? '16px' : '0',
                      transition: 'all 0.3s ease',
                      overflow: 'visible',
                      overflowY: 'visible',
                      overflowX: 'visible'
                    }}
                  >
                    {/* Hamburger Button */}
                    <Button
                      variant="outline-secondary"
                      onClick={() => setIsFloatingMenuOpen(!isFloatingMenuOpen)}
                      style={{
                        border: 'none',
                        borderRadius: isFloatingMenuOpen ? '12px 12px 0 0' : '12px',
                        padding: '10px 14px',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <Icon.List size={20} />
                      {isFloatingMenuOpen && <span className="ms-2">Menu</span>}
                    </Button>

                    {/* Expanded Menu */}
                    {isFloatingMenuOpen && (
                      <div
                        style={{
                          padding: '16px',
                          // borderTop: '1px solid rgba(255, 255, 255, 0.18)',
                          overflow: 'visible',
                          overflowY: 'visible',
                          overflowX: 'visible',
                          width: '100%',
                          boxSizing: 'border-box',
                          position: 'relative',
                          minWidth: 0,
                        }}
                      >
                        {/* Conversation Title */}
                        {isOneDriveAvailable && (
                          <div className="mb-3" style={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                            <ConversationTitle
                              title={currentConversationTitle}
                              isAutoTitle={conversations.find(c => c.id === currentConversationId)?.autoTitle !== false}
                              isGeneratingTitle={isGeneratingTitle}
                              onTitleChange={updateConversationTitle}
                            />
                          </div>
                        )}

                        {/* Conversation Selector */}
                        {isOneDriveAvailable && (
                          <div className="mb-3" style={{ width: '100%', minWidth: 0, maxWidth: '100%', position: 'relative', zIndex: 1052, overflow: 'visible' }}>
                            <ConversationSelector
                              conversations={conversations}
                              currentConversationId={currentConversationId}
                              onSwitchConversation={syncHelpers?.switchConversation}
                              onDeleteConversation={syncHelpers?.deleteConversation}
                              isSyncing={isSyncing}
                              onDropdownToggle={setIsConversationSelectorOpen}
                            />
                          </div>
                        )}

                        {/* Sync indicator */}
                        {isOneDriveAvailable && isSyncing && (
                          <div className="d-flex align-items-center mb-3">
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            <span className="ms-2">Syncing...</span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="d-flex flex-row gap-2 justify-content-center">
                          <Button
                            variant="primary"
                            onClick={downloadConversation}
                            size="sm"
                            style={{ 
                              display: conversation.length > 0 ? "inline-flex" : "none",
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '40px'
                            }}
                            title="Download"
                          >
                            <Icon.Download size={16} />
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => document.getElementById('upload-conversation').click()}
                            style={{
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '40px'
                            }}
                            title="Upload"
                          >
                            <Icon.Upload size={16} />
                          </Button>

                          <Button
                            variant="primary"
                            onClick={resetConversation}
                            size="sm"
                            style={{ 
                              display: conversation.length > 0 ? "inline-flex" : "none",
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '40px'
                            }}
                            title="New Conversation"
                          >
                            <Icon.PlusCircle size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <ConversationHistory
                  history={filterDeletedMessages(conversation)}
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
                  isLoading={isGeneratingTitle}
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
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "8px",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            gap: "8px"
          }}
        >
          <Button
            variant={currentTab === "chatbot" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("chatbot")}
            style={{
              backgroundColor: currentTab === "chatbot" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(255, 255, 255, 0.5)",
              borderColor: currentTab === "chatbot" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(13, 110, 253, 0.3)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              color: currentTab === "chatbot" ? "white" : "rgba(13, 110, 253, 0.9)"
            }}
          >
            Chatbot
          </Button>
          <Button
            variant={currentTab === "markdown" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("markdown")}
            style={{
              backgroundColor: currentTab === "markdown" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(255, 255, 255, 0.5)",
              borderColor: currentTab === "markdown" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(13, 110, 253, 0.3)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              color: currentTab === "markdown" ? "white" : "rgba(13, 110, 253, 0.9)"
            }}
          >
            Co-Edit
          </Button>
          <Button
            variant={currentTab === "memory" ? "primary" : "outline-primary"}
            size="sm"
            onClick={() => setCurrentTab("memory")}
            style={{
              backgroundColor: currentTab === "memory" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(255, 255, 255, 0.5)",
              borderColor: currentTab === "memory" 
                ? "rgba(13, 110, 253, 0.8)" 
                : "rgba(13, 110, 253, 0.3)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              transition: "all 0.3s ease",
              color: currentTab === "memory" ? "white" : "rgba(13, 110, 253, 0.9)"
            }}
          >
            Memory
          </Button>
        </div>
      )}
    </Container>
  );
}

export default AppContent;
