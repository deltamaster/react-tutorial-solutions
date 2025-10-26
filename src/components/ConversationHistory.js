import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Icon from "react-bootstrap-icons";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import mermaid from "mermaid";

// Initialize mermaid configuration
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose" // Allow more features
});


// Reusable function to render a single mermaid diagram
const renderMermaidDiagram = async (element) => {
  try {
    const graphCode = element.getAttribute('data-mermaid-content') || element.textContent.trim();
    const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const {svg} = await mermaid.render(uniqueId, graphCode);
    element.innerHTML = svg;
  } catch (err) {
    console.error('Error rendering individual mermaid diagram:', err);
    element.innerHTML = `<div style="color: red; padding: 10px; background-color: #fee; border-radius: 4px;">Error rendering mermaid diagram: ${err.message}</div>`;
  }
};

// Reusable component: Mermaid diagram component
const MermaidDiagram = ({ content }) => {
  return (
    <div className="mermaid" data-mermaid-content={content}>
      {content}
    </div>
  );
};

// Reusable component: Code block component
const CodeBlock = ({ language, code }) => {
  return (
    <SyntaxHighlighter 
      language={language} 
      style={vscDarkPlus}
      className="code-syntax-highlighter"
    >
      {code}
    </SyntaxHighlighter>
  );
};

// Reusable component: Edit button
const EditButton = ({ onClick, position = 'right' }) => {
  return (
    <button
      onClick={onClick}
      className={`edit-button ${position === 'left' ? 'edit-button-left' : 'edit-button-right'}`}
      title="Edit"
    >
      <Icon.Pencil size={14} />
    </button>
  );
};

// Reusable component: Edit form
const EditForm = ({ value, onChange, onSave, onCancel, isItalic = false }) => {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`edit-textarea ${isItalic ? 'edit-textarea-italic' : ''}`}
        placeholder="Edit your content here..."
      />
      <div className="button-group">
        <button onClick={onSave} className="save-button">
          Save
        </button>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Reusable component: Grounding data component
const GroundingData = ({ groundingChunks }) => {
  if (!groundingChunks || groundingChunks.length === 0) {
    return null;
  }

  return (
    <div className="grounding-container">
      <div className="grounding-title">Sources:</div>
      <div className="grounding-links">
        {groundingChunks.map((chunk, idx) => (
          <div key={idx}>
            {chunk.web?.uri ? (
              <a
                href={chunk.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="grounding-link"
              >
                {idx + 1}: {chunk.web?.title}
              </a>
            ) : (
              <span className="grounding-link-disabled">
                {idx + 1}: {chunk.web?.title}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Reusable component: Code execution result component
const CodeExecutionResult = ({ result }) => {
  const isSuccess = result.outcome === "OUTCOME_OK";
  
  return (
    <div className="code-block">
      <div className="code-block-title">
        <Icon.Terminal size={16} className="mr-2" />
        Execution Result ({isSuccess ? "Success" : "Error"})
      </div>
      <pre className={isSuccess ? 'execution-result' : 'execution-error'}>
        {result.output}
      </pre>
    </div>
  );
};

// Reusable component: Inline image component
const InlineImage = ({ dataUrl, alt = "Generated image" }) => {
  return (
    <div className="image-container">
      <img
        src={dataUrl}
        alt={alt}
        className="conversation-image"
      />
    </div>
  );
};

// Reusable component: PDF placeholder component
const PdfPlaceholder = () => {
  return (
    <div className="pdf-placeholder">
      <Icon.FileEarmarkPdf
        size={32}
        color="#dc3545"
      />
      <div>
        <div className="pdf-title">PDF Document Uploaded</div>
        <div className="pdf-description">
          A PDF file has been uploaded here.
        </div>
      </div>
    </div>
  );
};

// Reusable component: Text part component
const TextPart = ({ text, isEditing, editingText, onEditingTextChange, onSave, onCancel, onEdit, isThought = false, position = 'right' }) => {
  if (isEditing) {
    return (
      <EditForm
        value={editingText}
        onChange={onEditingTextChange}
        onSave={onSave}
        onCancel={onCancel}
        isItalic={isThought}
      />
    );
  }
  
  return (
    <>
      <EditButton
        onClick={onEdit}
        position={position}
      />
      <div className="markdown-content">
        {renderTextContent(text)}
      </div>
    </>
  );
};

// Unified function for rendering text content - supports mixed content
const renderTextContent = (text) => {
  if (!text) return null;
  
  // Process mixed content: Split text by code blocks and render separately
  // Use regular expressions to match all code blocks (including mermaid and regular code blocks)
  const parts = [];
  const codeBlockRegex = /```(mermaid|\w+)[\s\S]*?```/g;
  let lastIndex = 0;
  let match;
  
  // Find all code blocks and split text
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add regular text before code block (if any)
    if (match.index > lastIndex) {
      const markdownText = text.slice(lastIndex, match.index).trim();
      if (markdownText) {
        parts.push(
          <Markdown key={`md-${parts.length}`} remarkPlugins={[remarkGfm]}>
            {markdownText}
          </Markdown>
        );
      }
    }
    
    // Process code block
    const fullCodeBlock = match[0];
    const language = match[1];
    
    if (language === 'mermaid') {
      // Extract mermaid content
      const mermaidMatch = fullCodeBlock.match(/```mermaid([\s\S]*?)```/);
      if (mermaidMatch && mermaidMatch[1]) {
        parts.push(
          <div key={`mermaid-${parts.length}`} className="mermaid" data-mermaid-content={mermaidMatch[1].trim()}>
            {mermaidMatch[1].trim()}
          </div>
        );
      }
    } else {
      // Extract regular code block content
      const codeMatch = fullCodeBlock.match(/```\w+([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        parts.push(
          <SyntaxHighlighter key={`code-${parts.length}`} language={language} style={vscDarkPlus}>
            {codeMatch[1].trim()}
          </SyntaxHighlighter>
        );
      }
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add regular text after the last code block (if any)
  if (lastIndex < text.length) {
    const markdownText = text.slice(lastIndex).trim();
    if (markdownText) {
      parts.push(
        <Markdown key={`md-${parts.length}`} remarkPlugins={[remarkGfm]}>
          {markdownText}
        </Markdown>
      );
    }
  }
  
  // If no code blocks are found, use default Markdown rendering
  if (parts.length === 0) {
    return <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;
  }
  
  // Return combination of all parts
  return <div className="mixed-content">{parts}</div>;
};

// Conversation history component
function ConversationHistory({ history, onDelete, onEdit, editingIndex, editingPartIndex, editingText, onEditingTextChange, onSave, onCancel }) {
    // Add state to track avatar changes
    const [userAvatar, setUserAvatar] = useState(localStorage.getItem('userAvatar') || 'male');
    
    // Update avatar state when localStorage changes or avatarChange event is triggered
    useEffect(() => {
      const handleAvatarChange = () => {
        setUserAvatar(localStorage.getItem('userAvatar') || 'male');
      };
      
      // Listen for both custom avatarChange event and storage events
      window.addEventListener('avatarChange', handleAvatarChange);
      window.addEventListener('storage', handleAvatarChange);
      
      return () => {
        window.removeEventListener('avatarChange', handleAvatarChange);
        window.removeEventListener('storage', handleAvatarChange);
      };
    }, []);
    
    // Render mermaid diagrams when the component updates
    useEffect(() => {
    // Debug log
    console.log('useEffect for mermaid rendering triggered');
    
    // Initialize mermaid
    if (mermaid && document) {
      console.log('Mermaid library available, starting rendering process');
      let timer;
      
      // Use setTimeout to delay rendering to ensure DOM is fully loaded
      timer = setTimeout(() => {
        try {
          // Select all mermaid elements
          const allMermaidElements = document.querySelectorAll('.mermaid');
          console.log('Found total mermaid elements:', allMermaidElements.length);
          
          // Set data-mermaid-content attribute for elements that don't have it
          allMermaidElements.forEach((element) => {
            if (!element.hasAttribute('data-mermaid-content')) {
              const graphCode = element.textContent.trim();
              element.setAttribute('data-mermaid-content', graphCode);
            }
          });
          
          // Render all mermaid elements uniformly
          allMermaidElements.forEach((element) => {
            renderMermaidDiagram(element);
          });
        } catch (error) {
          console.error('Error in mermaid rendering process:', error);
        }
      }, 200); // Slightly increased delay to ensure DOM is fully updated
      
      // Clean up timer
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [history, editingIndex, editingPartIndex]); // Keep original dependencies;

  return (
    <div className="conversation-history">
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
                part.inline_data.mime_type)
          );
        if (!hasValidParts) {
          return null;
        }

        return (
          <div
            key={index}
            className={`${content.role} conversation-container`}
          >
            {/* Delete button - light red, becomes darker on hover */}
            <button
              onClick={() => onDelete(index)}
              className="delete-button"
              title="Delete message"
            >
              <Icon.X size={14} />
            </button>

            {content.role === "user" ? (
              <div className="message-header" style={{display: 'flex', alignItems: 'flex-end', marginBottom: '8px'}}>
                <img src={userAvatar === 'female' ? '/avatar-user-female.jpg' : '/avatar-user-male.jpg'} alt="You" className="avatar" style={{width: '48px', height: '48px', borderRadius: '25%', marginRight: '8px'}} />
              </div>
            ) : (
              <div className="message-header" style={{display: 'flex', alignItems: 'flex-end', marginBottom: '8px'}}>
                <img src="/avator-adrien.jpg" alt="Adrien" className="avatar" style={{width: '48px', height: '48px', borderRadius: '25%', marginRight: '8px'}} />
                <p style={{margin: '0', fontWeight: '500'}}>Adrien: </p>
              </div>
            )}

            {content.parts &&
              Array.isArray(content.parts) &&
              content.parts.map((part, partIndex) => {
                // Check if this part contains thoughts
                const isThought = part.thought === true;

                // Check if this part is being edited
                const isEditing =
                  editingIndex === index && editingPartIndex === partIndex;

                // For bot responses, display thoughts, code, execution results and regular responses differently
                if (content.role === "model") {
                  // Handle executable code
                  if (part.executableCode) {
                    return (
                      <div
                        key={partIndex}
                        className="code-part"
                      >
                        <div className="code-block">
                          <div className="code-block-title">
                            <Icon.Code size={16} className="mr-2" />
                            Code ({part.executableCode.language})
                          </div>
                          <CodeBlock
                            language={part.executableCode.language.toLowerCase() || "javascript"}
                            code={part.executableCode.code}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Handle code execution results
                  if (part.codeExecutionResult) {
                    return (
                      <div
                        key={partIndex}
                        className="execution-result-part"
                      >
                        <CodeExecutionResult result={part.codeExecutionResult} />
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
                      <div
                        key={partIndex}
                        className="image-container-wrapper"
                      >
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
                          <span className="thought-label">Thought:</span>
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
                          />
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={partIndex}
                        className="response-part"
                      >
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
                        />
                      </div>
                    );
                  }
                } else if (
                  part.inline_data &&
                  part.inline_data.data &&
                  part.inline_data.mime_type
                ) {
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
                      />
                    </div>
                  );
                }
                return null;
              })}
            {/* Render grounding data (if exists) */}
            {content.role === "model" && <GroundingData groundingChunks={content.groundingChunks} />}
          </div>
        );
      })}
    </div>
  );
}

export default ConversationHistory;
