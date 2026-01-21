import React, { useState, useEffect, useRef, memo } from "react";
import * as Icon from "react-bootstrap-icons";
import { formatTimestamp } from "../utils/timestampUtils";
import { getAvatarPath, getSpeakerVoice } from "../utils/avatarUtils";
import { useMermaid } from "../hooks/useMermaid";
import CodeBlock from "./conversation/CodeBlock";
import CodeExecutionResult from "./conversation/CodeExecutionResult";
import GroundingData from "./conversation/GroundingData";
import InlineImage from "./conversation/InlineImage";
import PdfPlaceholder from "./conversation/PdfPlaceholder";
import TextPart from "./conversation/TextPart";

// Components are now imported from ./conversation directory

// Conversation history component
function ConversationHistory({
  history,
  onDelete,
  onEdit,
  editingIndex,
  editingPartIndex,
  editingText,
  onEditingTextChange,
  onSave,
  onCancel,
}) {
  // Ref to the conversation history container for auto-scrolling
  const conversationContainerRef = useRef(null);
  // Add state to track avatar changes
  const [userAvatar, setUserAvatar] = useState(
    localStorage.getItem("userAvatar") || "male"
  );

  // Update avatar state when localStorage changes or avatarChange event is triggered
  useEffect(() => {
    const handleAvatarChange = () => {
      setUserAvatar(localStorage.getItem("userAvatar") || "male");
    };

    // Listen for both custom avatarChange event and storage events
    window.addEventListener("avatarChange", handleAvatarChange);
    window.addEventListener("storage", handleAvatarChange);

    return () => {
      window.removeEventListener("avatarChange", handleAvatarChange);
      window.removeEventListener("storage", handleAvatarChange);
    };
  }, []);

  // Scroll to bottom ONLY when conversation container visibility changes
  useEffect(() => {
    const scrollToBottom = () => {
      // Scroll the entire window to the bottom
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'instant'
      });
      // Force immediate scroll to ensure we reach the bottom
      window.scrollTop = document.body.scrollHeight;
    };

    // Set up Intersection Observer to detect when the conversation container becomes visible
    let observer = null;

    if (conversationContainerRef.current.parentElement) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // ONLY WHEN the container becomes visible, scroll WINDOW to bottom
            setTimeout(scrollToBottom, 10);
          }
        });
      }, {
        threshold: 0
      });

      observer.observe(conversationContainerRef.current.parentElement);
    }

    // Clean up observer
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []); // No dependencies - only set up once when component mounts

  // Use Mermaid hook for rendering diagrams
  useMermaid([history, editingIndex, editingPartIndex]);

  return (
    <div className="conversation-history" ref={conversationContainerRef}>
      {history.map((content, index) => {
        // Check if there are elements with text property or image data in content.parts
        const hasValidParts =
          content.parts &&
          Array.isArray(content.parts) &&
          content.parts.some(
            (part) =>
              part.text ||
              part.executableCode ||
              part.codeExecutionResult ||
              (part.inlineData &&
                part.inlineData.data &&
                part.inlineData.mimeType) ||
              (part.inline_data &&
                part.inline_data.data &&
                part.inline_data.mime_type) ||
              (part.file_data &&
                part.file_data.file_uri &&
                part.file_data.mime_type)
          );
        if (!hasValidParts) {
          return null;
        }

        const formattedTime = content.timestamp
          ? formatTimestamp(content.timestamp)
          : "";

        const isUserMessage = content.role === "user";
        const avatarSrc = getAvatarPath(userAvatar, isUserMessage, content.name);
        const speakerVoice = getSpeakerVoice(userAvatar, isUserMessage, content.name);

        const renderedParts =
          content.parts &&
          Array.isArray(content.parts) &&
          content.parts
            .map((part, partIndex) => {
                // Skip parts marked with hide: true
                if (part.hide === true) {
                  return null;
                }

                // Check if this part contains thoughts
                const isThought = part.thought === true;

                // Thoughts are now handled with expandable UI instead of being hidden completely

                // Check if this part is being edited
                const isEditing =
                  editingIndex === index && editingPartIndex === partIndex;

                // For bot responses, display thoughts, code, execution results and regular responses differently
                if (content.role === "model") {
                  // Handle executable code
                  if (part.executableCode) {
                    return (
                      <div key={partIndex} className="code-part">
                        <div className="code-block">
                          <div className="code-block-title">
                            <Icon.Code size={16} className="mr-2" />
                            Code ({part.executableCode.language})
                          </div>
                          <CodeBlock
                            language={
                              part.executableCode.language.toLowerCase() ||
                              "javascript"
                            }
                            code={part.executableCode.code}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Handle code execution results
                  if (part.codeExecutionResult) {
                    return (
                      <div key={partIndex} className="execution-result-part">
                        <CodeExecutionResult
                          result={part.codeExecutionResult}
                        />
                      </div>
                    );
                  }

                  // Check if the part contains image data (model response format - camelCase)
                  else if (
                    part.inlineData &&
                    part.inlineData.data &&
                    part.inlineData.mimeType
                  ) {
                    // For images, create data URL and display
                    const imageSrc = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    return (
                      <div key={partIndex} className="image-container-wrapper">
                        <div className="code-block">
                          <div className="code-block-title">
                            <Icon.Image size={16} className="mr-2" />
                            Generated Image
                          </div>
                          <InlineImage
                            dataUrl={imageSrc}
                            alt="Model generated image"
                          />
                        </div>
                      </div>
                    );
                  }
                  // Check if the part contains image data (user upload format - snake_case)

                  if (isThought) {
                    return (
                      <div key={partIndex} className="thought-part">
                        <div className="thought-block">
                          <TextPart
                            text={part.text}
                            isEditing={isEditing}
                            editingText={editingText}
                            onEditingTextChange={onEditingTextChange}
                            onSave={onSave}
                            onCancel={onCancel}
                            onEdit={() => onEdit(index, partIndex, part.text)}
                            isThought={true}
                            position="right"
                            speakerVoice={speakerVoice}
                          />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={partIndex} className="response-part">
                        <TextPart
                          text={part.text}
                          isEditing={isEditing}
                          editingText={editingText}
                          onEditingTextChange={onEditingTextChange}
                          onSave={onSave}
                          onCancel={onCancel}
                          onEdit={() => onEdit(index, partIndex, part.text)}
                          isThought={false}
                          position="right"
                          speakerVoice={speakerVoice}
                        />
                      </div>
                    );
                  }
                } else if (
                  part.inline_data &&
                  part.inline_data.data &&
                  part.inline_data.mime_type
                ) {
                  // Handle inline_data with base64 data (prioritize for immediate display)
                  // If it's a PDF, show a placeholder instead of the actual content
                  if (part.inline_data.mime_type === "application/pdf") {
                    return (
                      <div key={partIndex} className="pdf-container">
                        <PdfPlaceholder />
                      </div>
                    );
                  }
                  // For images, create data URL and display
                  else {
                    const imageSrc = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                    return (
                      <InlineImage
                        key={partIndex}
                        dataUrl={imageSrc}
                        alt="User uploaded image"
                      />
                    );
                  }
                } else if (
                  part.file_data &&
                  part.file_data.file_uri &&
                  part.file_data.mime_type
                ) {
                  // Handle file_data with file URI (fallback if inline_data not available)
                  // If it's a PDF, show a placeholder instead of the actual content
                  if (part.file_data.mime_type === "application/pdf") {
                    return (
                      <div key={partIndex} className="pdf-container">
                        <PdfPlaceholder />
                      </div>
                    );
                  }
                  // For images, use the file URI directly
                  else {
                    return (
                      <InlineImage
                        key={partIndex}
                        dataUrl={part.file_data.file_uri}
                        alt="User uploaded image"
                      />
                    );
                  }
                }
                // For user messages with text, display normally
                else if (part.text) {
                  return (
                    <div key={partIndex} className="response-part">
                      <TextPart
                        text={part.text}
                        isEditing={isEditing}
                        editingText={editingText}
                        onEditingTextChange={onEditingTextChange}
                        onSave={onSave}
                        onCancel={onCancel}
                        onEdit={() => onEdit(index, partIndex, part.text)}
                        isThought={false}
                        position="left"
                        speakerVoice={speakerVoice}
                      />
                    </div>
                  );
                }
                return null;
              })
            .filter(Boolean);

        return (
          <div
            key={index}
            className={`conversation-container ${
              isUserMessage ? "user" : "model"
            }`}
          >
            <div className="message-wrapper">
              <div className="message-avatar">
                <img
                  src={avatarSrc}
                  alt={isUserMessage ? "You" : content.name || "Assistant"}
                />
              </div>

              <div className="message-content">
                <div className="message-meta">
                  {!isUserMessage && (
                    <span className="message-author">
                      {content.name || "Adrien"}
                    </span>
                  )}
                  <span className="message-time">{formattedTime}</span>
                </div>

                <div
                  className={`message-bubble-wrapper ${
                    isUserMessage ? "user" : "model"
                  }`}
                >
                  <button
                    onClick={() => onDelete(index)}
                    className="delete-button"
                    title="Delete message"
                  >
                    <Icon.X size={14} />
                  </button>
                  <div
                    className={`message-bubble ${
                      isUserMessage ? "user" : "model"
                    }`}
                  >
                    {renderedParts}
                    {content.role === "model" && (
                      <GroundingData
                        groundingChunks={content.groundingChunks}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Memoize ConversationHistory to prevent unnecessary re-renders
// Only re-render when history, editingIndex, editingPartIndex, or editingText changes
export default memo(ConversationHistory, (prevProps, nextProps) => {
  return (
    prevProps.history === nextProps.history &&
    prevProps.editingIndex === nextProps.editingIndex &&
    prevProps.editingPartIndex === nextProps.editingPartIndex &&
    prevProps.editingText === nextProps.editingText &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onEditingTextChange === nextProps.onEditingTextChange &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onCancel === nextProps.onCancel
  );
});
