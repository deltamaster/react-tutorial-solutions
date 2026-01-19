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
import {
  fetchFromApi,
  generateFollowUpQuestions,
  toolbox,
  ApiError,
  uploadFile,
} from "../utils/apiUtils";
import { trackFile, getAllTrackedFiles, setTrackedFiles, removeExpiredFilesFromContents, markFileExpired, extractFileIdFromError } from "../utils/fileTrackingService";
import { useLocalStorage } from "../utils/storageUtils";
import { roleDefinition, roleUtils } from "../utils/roleConfig";
import { getSubscriptionKey, setSubscriptionKey, getSystemPrompt, setSystemPrompt, getUserAvatar, setUserAvatar, getModel, setModel } from "../utils/settingsService";
import { normalizeBeginMarker } from "../utils/responseUtils";
import profileSyncService from "../utils/profileSyncService";

const MAX_CONCURRENT_ROLE_REQUESTS = 3;

// Main application content component
function AppContent() {
  // 使用settingsService获取和设置API密钥、系统提示和用户头像
  const [subscriptionKey, setLocalSubscriptionKey] = useState(getSubscriptionKey());
  const [systemPrompt, setLocalSystemPrompt] = useState(getSystemPrompt());
  const [userAvatar, setLocalUserAvatar] = useState(getUserAvatar());
  const [model, setLocalModel] = useState(getModel());

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

  const handleModelChange = (model) => {
    setModel(model); // 使用settingsService保存到localStorage
    setLocalModel(model); // 更新本地状态
  };

  // Retrieve API key from Chrome storage (config sync is handled by AuthContext after login)
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
  }, []); // Empty deps ensures this runs only once on mount

  // Update Chrome storage when subscriptionKey changes
  useEffect(() => {
    if (subscriptionKey && typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ apiKey: subscriptionKey });
    }
  }, [subscriptionKey]);

  // No subscription key format validation required


  const [conversation, setConversation] = useLocalStorage("conversation", []);
  const conversationRef = useRef(conversation || []);
  useEffect(() => {
    // Ensure conversationRef always has a valid array, never undefined
    conversationRef.current = Array.isArray(conversation) ? conversation : [];
  }, [conversation]);
  const [activeTypers, setActiveTypers] = useState([]);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [question, setQuestion] = useState("");

  const requestQueueRef = useRef([]);
  const activeRequestsRef = useRef(new Map());
  const scheduledRequestsRef = useRef(new Set());

  const followUpQueueRef = useRef([]);
  const followUpActiveRef = useRef(false);
  const followUpRequestIdRef = useRef(0);

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


  const updateLoadingState = () => {
    const rolesInFlight = new Set();
    activeRequestsRef.current.forEach((task) => {
      if (!task?.cancelled) {
        rolesInFlight.add(task.role);
      }
    });
    requestQueueRef.current.forEach((task) => {
      if (!task?.cancelled) {
        rolesInFlight.add(task.role);
      }
    });

    const typingNames = Array.from(rolesInFlight)
      .map((roleKey) => roleDefinition[roleKey]?.name || roleKey)
      .sort();

    setActiveTypers(typingNames);
  };

  const appendMessageToConversation = (message) => {
    setConversation((prevConversation) => {
      const latestConversation = prevConversation || [];
      const updatedConversation = [...latestConversation, message];
      // Update ref to keep it in sync with state
      conversationRef.current = updatedConversation;
      return updatedConversation;
    });
  };

  const extractMentionedRolesFromParts = (parts) => {
    const roles = new Set();
    if (!Array.isArray(parts)) {
      return [];
    }

    parts.forEach((part) => {
      if (!part || part.hide || part.thought) {
        return;
      }

      if (!part.text) {
        return;
      }

      const mentionRegex = /@([a-z0-9_]+)/gi;
      let match;
      while ((match = mentionRegex.exec(part.text))) {
        const mentioned = match[1].toLowerCase();
        const mappedRole = mentionRoleMap[mentioned];
        if (mappedRole) {
          roles.add(mappedRole);
        }
      }
    });

    return Array.from(roles);
  };

  const buildUserFacingErrorMessage = (error) => {
    if (error instanceof ApiError) {
      const { statusCode, errorType, message, details } = error;
      let userMessage = "";

      switch (errorType) {
        case "validation_error":
          userMessage = `Invalid input: ${message}`;
          break;
        case "file_processing_error":
          userMessage = `File processing error: ${message} (MIME type: ${
            details?.mimeType || "unknown"
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

      if (statusCode && statusCode !== "Unknown") {
        userMessage += ` (Status: ${statusCode})`;
      }

      return userMessage;
    }

    const statusCode = error?.statusCode || error?.status || "Unknown";
    const errorMsg = error?.message || "Failed to send message";
    return `${errorMsg} (Status: ${statusCode})`;
  };

  const handleRoleRequestError = (error) => {
    const userMessage = buildUserFacingErrorMessage(error);
    setErrorMessage(userMessage);
  };

  const reorderResponseParts = (parts = []) => {
    const regularParts = [];
    const deferredParts = [];

    parts.forEach((part) => {
      if (part?.executableCode || part?.inlineData || part?.inline_data) {
        deferredParts.push(part);
      } else {
        regularParts.push(part);
      }
    });

    return [...regularParts, ...deferredParts];
  };

  function cancelPendingFollowUpQuestions() {
    followUpRequestIdRef.current += 1;
    followUpQueueRef.current = [];
    followUpActiveRef.current = false;
    setNextQuestionLoading(false);
  }

  function processFollowUpQueue() {
    if (followUpActiveRef.current) {
      return;
    }

    if (
      activeRequestsRef.current.size > 0 ||
      requestQueueRef.current.length > 0
    ) {
      return;
    }

    if (followUpQueueRef.current.length === 0) {
      return;
    }

    const task = followUpQueueRef.current.shift();
    if (!task) {
      return;
    }

    const { id, conversationSnapshot } = task;

    if (id !== followUpRequestIdRef.current) {
      processFollowUpQueue();
      return;
    }

    followUpActiveRef.current = true;
    setNextQuestionLoading(true);

    (async () => {
      try {
        const nextQuestionResponseData = await generateFollowUpQuestions(
          conversationSnapshot
        );
        if (id !== followUpRequestIdRef.current) {
          return;
        }

        // Extract JSON array from structured output
        const candidate = nextQuestionResponseData?.candidates?.[0];
        if (candidate?.content?.parts?.[0]?.text) {
          try {
            const jsonText = candidate.content.parts[0].text;
            const questions = JSON.parse(jsonText);
            if (Array.isArray(questions)) {
              // Filter out empty strings and limit to 3
              const validQuestions = questions
                .filter((q) => typeof q === "string" && q.trim())
                .slice(0, 3);
              setFollowUpQuestions(validQuestions);
            } else {
              setFollowUpQuestions([]);
            }
          } catch (error) {
            console.error("Error parsing follow-up questions JSON:", error);
            setFollowUpQuestions([]);
          }
        } else {
          setFollowUpQuestions([]);
        }
      } catch (error) {
        if (id === followUpRequestIdRef.current) {
          console.error("Error generating follow-up questions:", error);
        }
      } finally {
        if (id === followUpRequestIdRef.current) {
          followUpActiveRef.current = false;
          setNextQuestionLoading(false);
        }
        if (followUpQueueRef.current.length > 0) {
          processFollowUpQueue();
        }
      }
    })();
  }

  function scheduleFollowUpQuestions() {
    if (followUpActiveRef.current || followUpQueueRef.current.length > 0) {
      return;
    }

    const conversationSnapshot = conversationRef.current;
    if (!conversationSnapshot || conversationSnapshot.length === 0) {
      return;
    }

    const requestId = followUpRequestIdRef.current + 1;
    followUpRequestIdRef.current = requestId;
    followUpQueueRef.current = [
      { id: requestId, conversationSnapshot },
    ];
    processFollowUpQueue();
  }

  async function runRoleRequest(task) {
    const { role } = task;
    let continueProcessing = true;

    while (continueProcessing) {
      if (task.cancelled) {
        return;
      }
      continueProcessing = false;
      let responseData;

      try {
        // Use conversation snapshot from task if available, otherwise fall back to ref
        // This ensures parallel requests see consistent conversation state
        const conversationSnapshot = task.conversationSnapshot || conversationRef.current || [];
        responseData = await fetchFromApi(
          conversationSnapshot,
          "default",
          true,
          role
        );
      } catch (error) {
        // Handle 403 errors (expired files) - update conversation immediately
        if (error instanceof ApiError && error.status === 403) {
          const errorMessage = error.message || "";
          const fileId = extractFileIdFromError(errorMessage);
          
          if (fileId) {
            console.warn(`File ${fileId} expired (403 error), updating conversation`);
            markFileExpired(fileId);
            
            // Update conversation to remove expired files
            setConversation((prevConversation) => {
              const currentConversation = prevConversation || [];
              const cleanedConversation = removeExpiredFilesFromContents(currentConversation);
              conversationRef.current = cleanedConversation;
              return cleanedConversation;
            });
          }
        }
        
        handleRoleRequestError(error);
        throw error;
      }

      if (task.cancelled) {
        return;
      }

      const candidate = responseData?.candidates?.[0];
      if (!candidate || !candidate.content) {
        const contentError = new Error("No content in candidates[0]");
        handleRoleRequestError(contentError);
        throw contentError;
      }

      const responseParts = candidate.content.parts || [];

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

      if (textParts.length > 0) {
        if (task.cancelled) {
          return;
        }
        const orderedParts = reorderResponseParts(textParts);
        const normalizedParts = normalizeBeginMarker(
          orderedParts,
          roleDefinition[role]?.name
        );
        const botResponse = {
          role: "model",
          name: roleDefinition[role]?.name || "Adrien",
          parts: normalizedParts,
          timestamp: Date.now(),
          groundingChunks:
            candidate?.groundingMetadata?.groundingChunks || [],
          groundingSupports:
            candidate?.groundingMetadata?.groundingSupports || [],
        };

        appendMessageToConversation(botResponse);

        const mentionedRoles = extractMentionedRolesFromParts(
          normalizedParts
        ).filter(
          (roleKey) => roleKey !== role
        );

        if (mentionedRoles.length > 0) {
          if (task.cancelled) {
            return;
          }
          enqueueRoleRequests(mentionedRoles, {
            source: "model",
            triggerMessageId: botResponse.timestamp,
            parentRequestId: task.id,
          });
        }
      }

      if (
        functionCallParts.length > 0 &&
        roleUtils.canRoleUseFunctions(role)
      ) {
        const functionResults = [];

        for (const functionCallPart of functionCallParts) {
          if (task.cancelled) {
            return;
          }
          const { name, args } = functionCallPart.functionCall;

          if (toolbox[name]) {
            try {
              const result = await Promise.resolve(toolbox[name](args));
              functionResults.push({ name, result });
            } catch (error) {
              console.error(`Error executing function ${name}:`, error);
              // Return error response to LLM
              functionResults.push({
                name,
                result: {
                  success: false,
                  error: `Error executing function ${name}: ${error.message || error}`,
                },
              });
            }
          } else {
            console.error(`Function ${name} not found in toolbox`);
            // Return standard error response to LLM when function is not found
            functionResults.push({
              name,
              result: {
                success: false,
                error: `Function '${name}' not found in toolbox. This function may be unavailable or require a premium subscription.`,
              },
            });
          }
        }

        if (functionResults.length > 0) {
          if (task.cancelled) {
            return;
          }
          const functionResponseMessage = {
            role: "user",
            parts: functionResults.map((result) => ({
              functionResponse: {
                name: result.name,
                response: { result: result.result },
              },
            })),
            timestamp: Date.now(),
          };

          appendMessageToConversation(functionResponseMessage);
          continueProcessing = true;
        }
      } else if (functionCallParts.length > 0) {
        console.warn(
          `Role ${role} requested function calls but is not permitted to execute them.`
        );
      }
    }
  }

  function startRoleRequest(task) {
    if (task.cancelled) {
      return;
    }

    activeRequestsRef.current.set(task.id, task);
    updateLoadingState();

    runRoleRequest(task)
      .catch((error) => {
        console.error(`Role request failed for ${task.role}:`, error);
      })
      .finally(() => {
        activeRequestsRef.current.delete(task.id);
        if (task.dedupeKey) {
          scheduledRequestsRef.current.delete(task.dedupeKey);
        }
        updateLoadingState();
        processRoleRequestQueue();

        if (
          activeRequestsRef.current.size === 0 &&
          requestQueueRef.current.length === 0
        ) {
          scheduleFollowUpQuestions();
        }
      });
  }

  function processRoleRequestQueue() {
    while (
      activeRequestsRef.current.size < MAX_CONCURRENT_ROLE_REQUESTS &&
      requestQueueRef.current.length > 0
    ) {
      const nextTask = requestQueueRef.current.shift();
      if (!nextTask) {
        continue;
      }
      if (nextTask.cancelled) {
        continue;
      }
      startRoleRequest(nextTask);
    }
  }

  function cancelRoleRequestsForRole(role) {
    let queueModified = false;

    if (requestQueueRef.current.length > 0) {
      const retainedTasks = [];
      for (const task of requestQueueRef.current) {
        if (task.role === role) {
          task.cancelled = true;
          if (task.dedupeKey) {
            scheduledRequestsRef.current.delete(task.dedupeKey);
          }
          queueModified = true;
        } else {
          retainedTasks.push(task);
        }
      }
      requestQueueRef.current = retainedTasks;
    }

    const tasksToRemove = [];
    activeRequestsRef.current.forEach((task, id) => {
      if (task.role === role) {
        task.cancelled = true;
        if (task.dedupeKey) {
          scheduledRequestsRef.current.delete(task.dedupeKey);
        }
        tasksToRemove.push(id);
        queueModified = true;
      }
    });

    for (const id of tasksToRemove) {
      activeRequestsRef.current.delete(id);
    }

    if (queueModified) {
      updateLoadingState();
      processRoleRequestQueue();
    }
  }

  function enqueueRoleRequests(roles, context = {}) {
    const uniqueRoles = Array.from(new Set(roles)).filter(Boolean);
    if (uniqueRoles.length === 0) {
      return;
    }

    // Capture conversation snapshot synchronously to avoid race conditions
    // This ensures all parallel requests see the same conversation state
    const conversationSnapshot = conversationRef.current || [];

    let tasksAdded = false;

    uniqueRoles.forEach((role) => {
      cancelRoleRequestsForRole(role);

      const triggerMessageId = context?.triggerMessageId;
      const dedupeKey = triggerMessageId
        ? `${triggerMessageId}:${role}`
        : undefined;

      if (
        dedupeKey &&
        (scheduledRequestsRef.current.has(dedupeKey) ||
          Array.from(activeRequestsRef.current.values()).some(
            (activeTask) => activeTask.dedupeKey === dedupeKey
          ))
      ) {
        return;
      }

      if (dedupeKey) {
        scheduledRequestsRef.current.add(dedupeKey);
      }

      const taskId = `${Date.now()}-${role}-${Math.random()
        .toString(16)
        .slice(2)}`;

      requestQueueRef.current.push({
        id: taskId,
        role,
        context,
        dedupeKey,
        cancelled: false,
        conversationSnapshot, // Pass snapshot to avoid race conditions
      });
      tasksAdded = true;
    });

    if (tasksAdded) {
      updateLoadingState();
      processRoleRequestQueue();
    }
  }

  // Handle chatbot question submission
  const handleSubmit = useCallback(async (contentParts) => {
    if (!subscriptionKey) {
      alert("Please input Subscription key");
      return;
    }

    cancelPendingFollowUpQuestions();
    setFollowUpQuestions([]);
    setErrorMessage("");

    // Helper function to compress image for display
    const compressImageForDisplay = (file, maxWidth = 720, maxHeight = 720, quality = 0.7) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with compression
            const mimeType = file.type || 'image/jpeg';
            const compressedDataUrl = canvas.toDataURL(mimeType, quality);
            const base64String = compressedDataUrl.split(",")[1];
            resolve(base64String);
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    // Helper function to convert file to base64 (for non-images or when compression not needed)
    const convertFileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    // Step 1: Prepare user message with inline_data for immediate display
    const displayContentParts = [];
    const filesToUpload = [];
    
    for (const part of contentParts) {
      if (part.inline_data && part.inline_data.file) {
        const file = part.inline_data.file;
        const mimeType = part.inline_data.mime_type;
        const isImage = mimeType.startsWith("image/");

        // Create display part with inline_data base64 for images
        const displayPart = {};
        if (isImage) {
          // Compress image for display (reduces localStorage size)
          const compressedBase64Data = await compressImageForDisplay(file);
          displayPart.inline_data = {
            mime_type: mimeType,
            data: compressedBase64Data,
          };
        }
        // For PDFs, we don't need inline_data for display

        // Store file info for async upload
        filesToUpload.push({
          partIndex: displayContentParts.length,
          file: file,
          mimeType: mimeType,
          isImage: isImage,
        });

        displayContentParts.push(displayPart);
      } else {
        displayContentParts.push(part);
      }
    }

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
    appendMessageToConversation(newUserMessage);

    // Step 3: Extract roles and prepare for API request
    const mentionedRoles = extractMentionedRolesFromParts(displayContentParts);
    const rolesToProcess = mentionedRoles.length > 0 
      ? mentionedRoles 
      : ["general"];

    // Step 4: Show typing indicator immediately by adding a temporary typing task
    // This will show "... is typing ..." even before upload completes
    if (filesToUpload.length > 0) {
      // Add temporary typing indicators for the roles
      rolesToProcess.forEach((role, index) => {
        const taskId = `uploading-${Date.now()}-${role}-${index}`;
        activeRequestsRef.current.set(taskId, {
          id: taskId,
          role,
          cancelled: false,
        });
      });
      updateLoadingState();
    }

    // Step 5: Upload files asynchronously, then send API request
    (async () => {
      try {
        // Upload all files
        const uploadedFiles = filesToUpload.length > 0
          ? await Promise.all(
              filesToUpload.map(async ({ file, mimeType }) => {
                const fileUri = await uploadFile(file, subscriptionKey);
                // Track the uploaded file
                trackFile(fileUri);
                return { mimeType, fileUri };
              })
            )
          : [];

        // Update message parts with file_data
        const updatedParts = [...displayContentParts];
        filesToUpload.forEach(({ partIndex, mimeType, isImage }, uploadIndex) => {
          const uploadedFile = uploadedFiles[uploadIndex];
          updatedParts[partIndex] = {
            ...updatedParts[partIndex],
            file_data: {
              mime_type: mimeType,
              file_uri: uploadedFile.fileUri,
            },
            // Keep inline_data for images (already set above)
          };
        });

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

        // Remove temporary typing indicators
        if (filesToUpload.length > 0) {
          rolesToProcess.forEach(role => {
            Array.from(activeRequestsRef.current.keys()).forEach(key => {
              if (key.startsWith(`uploading-`) && activeRequestsRef.current.get(key)?.role === role) {
                activeRequestsRef.current.delete(key);
              }
            });
          });
          updateLoadingState();
        }

        // Step 6: Send API request with file_data
        enqueueRoleRequests(rolesToProcess, {
          source: "user",
          triggerMessageId: newUserMessage.timestamp,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        
        // Remove temporary typing indicators on error
        if (filesToUpload.length > 0) {
          rolesToProcess.forEach(role => {
            Array.from(activeRequestsRef.current.keys()).forEach(key => {
              if (key.startsWith(`uploading-`) && activeRequestsRef.current.get(key)?.role === role) {
                activeRequestsRef.current.delete(key);
              }
            });
          });
          updateLoadingState();
        }
        
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
  }, [subscriptionKey, conversationRef, mentionRoleMap]);

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

  // Download conversation history - now includes conversation_summaries
  const downloadConversation = () => {
    try {
      // Get conversation_summaries from localStorage
      const summaries = JSON.parse(
        localStorage.getItem("conversation_summaries") || "[]"
      );

      // Get tracked files
      const trackedFiles = getAllTrackedFiles();

      // Create new format with conversation, summaries, and tracked files
      const exportData = {
        version: "1.2", // Version marker - updated to include file tracking
        conversation: conversation,
        conversation_summaries: summaries,
        uploaded_files: trackedFiles,
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

  // Upload conversation history - compatible with old and new formats
  const uploadConversation = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploadedData = JSON.parse(e.target.result);

        // Check if it's the new format with version
        if (uploadedData.version && uploadedData.conversation) {
          // New format: set conversation, summaries, and tracked files
          const conversationData = Array.isArray(uploadedData.conversation) 
            ? uploadedData.conversation 
            : [];
          setConversation(conversationData);

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

          // Restore tracked files if present (version 1.2+)
          if (uploadedData.uploaded_files) {
            try {
              setTrackedFiles(uploadedData.uploaded_files);
              console.log("Uploaded files tracking restored from upload");
            } catch (error) {
              console.error("Error restoring uploaded files tracking:", error);
            }
          } else {
            // If no tracked files in upload, clear existing ones
            setTrackedFiles({});
          }
        } else {
          // Old format: just set the conversation (assuming the entire file is conversation data)
          const conversationData = Array.isArray(uploadedData) ? uploadedData : [];
          setConversation(conversationData);
          // Clear summaries and tracked files for old format uploads
          try {
            localStorage.removeItem("conversation_summaries");
            setTrackedFiles({});
            console.log("Conversation summaries and file tracking cleared for old format upload");
          } catch (error) {
            console.error("Error clearing summaries and file tracking:", error);
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
  const deleteConversationMessage = useCallback((index) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      setConversation((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((_, i) => i !== index);
      });
    }
  }, []);

  // Start editing a conversation part
  const startEditing = useCallback((index, partIndex, text) => {
    setEditingIndex(index);
    setEditingPartIndex(partIndex);
    setEditingText(text);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingIndex(null);
    setEditingPartIndex(null);
    setEditingText("");
  }, []);

  // Save edited conversation part
  const saveEditing = useCallback(() => {
    if (editingIndex !== null && editingPartIndex !== null) {
      setConversation((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map((message, index) => {
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
        });
      });
      cancelEditing();
    }
  }, [editingIndex, editingPartIndex, editingText, cancelEditing]);

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

                {activeTypers.length > 0 && (
                  <div className="mb-3 text-muted typing-indicator">
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
