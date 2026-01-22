import { useState, useEffect, useRef, memo, useCallback } from "react";
import * as Icon from "react-bootstrap-icons";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import { getThinkingEnabled, setThinkingEnabled } from "../utils/settingsService";
import { validateImageFile, validatePdfFile } from "../utils/fileUtils";

// Question input component
function QuestionInput({ onSubmit, disabled = false, value = "", onChange }) {
  const [localQuestion, setLocalQuestion] = useState(value);
  // 使用settingsService获取思考模式设置
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(getThinkingEnabled());
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const adjustHeightTimeoutRef = useRef(null);
  
  // Optimized function to adjust the height of the textarea
  // Debounced to avoid excessive layout recalculations
  const adjustHeight = useCallback(() => {
    // Clear any pending height adjustment
    if (adjustHeightTimeoutRef.current) {
      clearTimeout(adjustHeightTimeoutRef.current);
    }
    
    // Debounce the height adjustment to avoid excessive reflows
    adjustHeightTimeoutRef.current = setTimeout(() => {
      if (textareaRef.current) {
        // Use requestAnimationFrame to batch DOM updates
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            // Check cursor position BEFORE making any DOM changes
            const cursorPosition = textareaRef.current.selectionStart;
            const textLength = textareaRef.current.value.length;
            const isCursorAtEnd = cursorPosition === textLength;
            
            // Save window scroll position BEFORE any DOM manipulation
            // This prevents browser from scrolling when we manipulate the textarea
            const savedWindowScrollY = window.scrollY || window.pageYOffset;
            
            // Calculate max height as 80% of viewport height
            const maxHeight = window.innerHeight * 0.8;
            
            // Preserve the textarea's scroll position to prevent jumping to top
            const scrollTop = textareaRef.current.scrollTop;
            
            textareaRef.current.style.height = "";
            // Get the accurate scrollHeight without forcing a full layout recalculation
            const scrollHeight = textareaRef.current.scrollHeight;
            
            // Set max-height and overflow-y
            textareaRef.current.style.maxHeight = maxHeight + "px";
            textareaRef.current.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
            
            // Set height: use scrollHeight if less than maxHeight, otherwise use maxHeight to keep it at 80% of screen
            const newHeight = scrollHeight <= maxHeight ? scrollHeight : maxHeight;
            textareaRef.current.style.height = newHeight + "px";
            
            // Restore the textarea's scroll position to prevent jumping to top
            textareaRef.current.scrollTop = scrollTop;
            
            // CRITICAL: If cursor is NOT at the end, NEVER scroll the window
            // Restore window scroll position to prevent any unwanted scrolling
            if (!isCursorAtEnd) {
              // Immediately restore scroll position to prevent browser's default behavior
              window.scrollTo({ 
                top: savedWindowScrollY, 
                behavior: 'instant' 
              });
              // Also restore in next frame to catch any delayed browser scroll behavior
              requestAnimationFrame(() => {
                window.scrollTo({ 
                  top: savedWindowScrollY, 
                  behavior: 'instant' 
                });
              });
            } else {
              // Smart scrolling: only scroll if necessary to keep the textarea in view
              // Only scroll if:
              // 1. Cursor is at the end (user is typing at the end)
              // 2. Textarea would go out of view
              const textareaRect = textareaRef.current.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              const textareaBottom = textareaRect.bottom;
              
              // Check if textarea bottom is below viewport (would be hidden)
              // Add some padding to account for virtual keyboard on mobile
              const padding = 100; // Extra padding for mobile keyboard
              if (textareaBottom > viewportHeight - padding) {
                // Calculate how much we need to scroll to keep textarea visible
                const scrollAmount = textareaBottom - (viewportHeight - padding);
                
                // Only scroll if we need to
                if (scrollAmount > 0) {
                  window.scrollTo({ 
                    top: savedWindowScrollY + scrollAmount, 
                    behavior: 'instant' 
                  });
                }
              }
            }
          }
        });
      }
    }, 16); // ~60fps debounce
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (adjustHeightTimeoutRef.current) {
        clearTimeout(adjustHeightTimeoutRef.current);
      }
    };
  }, []);

  // Sync external value with local state
  useEffect(() => {
    // value is expected to be a string from AppContent's setQuestion
    // (used for follow-up questions)
    setLocalQuestion(value);
    // Adjust the height when the external value changes
    setTimeout(adjustHeight, 0); // Use setTimeout to ensure the DOM has been updated
  }, [value]);

  // Initialize the height when the component mounts
  useEffect(() => {
    adjustHeight();
  }, []);

  // Handle window resize to update max-height
  useEffect(() => {
    const handleResize = () => {
      if (textareaRef.current) {
        const maxHeight = window.innerHeight * 0.8;
        textareaRef.current.style.maxHeight = maxHeight + "px";
        adjustHeight();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [adjustHeight]);

  const processImageFile = (file) => {
    if (!file) return false;
    // Reset error state
    setUploadError("");

    // Validate file using utility function
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return false;
    }

    // Set selected image
    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    processImageFile(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset error state
    setUploadError("");

    // Validate file using utility function
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }

    // Set selected PDF
    setSelectedPdf(file);
  };

  const removeSelectedPdf = () => {
    setSelectedPdf(null);
    setUploadError("");
    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }
  };

  const submitQuestion = () => {
    if ((localQuestion.trim() || selectedImage) && !disabled) {
      // Set thinkingBudget to -1 if thinking is enabled, else 0
      const thinkingBudget = isThinkingEnabled ? -1 : 0;

      // Prepare content parts for the API call
      const contentParts = [];

      // Add image part first if there is an image
      if (selectedImage) {
        // We'll handle the base64 conversion in the parent component or API utils
        contentParts.push({
          inline_data: {
            mime_type: selectedImage.type,
            // We'll convert the image to base64 in the parent or API utils
            // For now, we'll just pass the file object
            file: selectedImage,
          },
        });
      }

      // Add PDF part if there is a PDF
      if (selectedPdf) {
        // We'll handle the base64 conversion in the parent component or API utils
        contentParts.push({
          inline_data: {
            mime_type: "application/pdf",
            // We'll convert the PDF to base64 in the parent or API utils
            // For now, we'll just pass the file object
            file: selectedPdf,
          },
        });
      }

      // Add text part if there is text
      if (localQuestion.trim()) {
        contentParts.push({ text: localQuestion.trim() });
      }

      onSubmit(contentParts, thinkingBudget);

      // Clear local state
      setLocalQuestion("");
      removeSelectedImage();
      removeSelectedPdf();

      // Notify parent if onChange is provided
      if (onChange) {
        onChange("");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitQuestion();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && event.ctrlKey && !disabled) {
      event.preventDefault();
      submitQuestion();
    }
  };

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalQuestion(newValue);
    adjustHeight();
    if (onChange) {
      onChange(newValue);
    }
  }, [onChange, adjustHeight]);

  const handlePaste = (event) => {
    if (!event.clipboardData || disabled) {
      return;
    }

    const items = event.clipboardData.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file && processImageFile(file)) {
          event.preventDefault();
        }
        break;
      }
    }
  };

  const toggleThinking = () => {
    const newValue = !isThinkingEnabled;
    setIsThinkingEnabled(newValue);
    // 使用settingsService保存到localStorage
    setThinkingEnabled(newValue);
  };

  return (
    <form onSubmit={handleSubmit} className="question-form">
      <Container className="question-input-container">
        <Row>
          <Col>
            {/* Image preview */}
            {imagePreview && (
              <div
                className="image-preview-container"
                style={{
                  marginBottom: "10px",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  position: "relative",
                  maxWidth: "300px",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "200px",
                    objectFit: "contain",
                  }}
                />
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    background: "#f8d7da",
                    color: "#dc3545",
                    border: "1px solid #f5c6cb",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Icon.X size={12} />
                </button>
                <div
                  style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}
                >
                  {selectedImage.name}
                </div>
              </div>
            )}

            {/* PDF preview */}
            {selectedPdf && (
              <div
                className="pdf-preview-container"
                style={{
                  marginBottom: "10px",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  position: "relative",
                  maxWidth: "300px",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Icon.FileEarmarkPdf size={32} color="#dc3545" />
                  <div style={{ marginLeft: "10px", overflow: "hidden" }}>
                    <div style={{ fontWeight: "500", marginBottom: "2px" }}>
                      PDF Document
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", wordBreak: "break-all" }}>
                      {selectedPdf.name}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedPdf}
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    background: "#f8d7da",
                    color: "#dc3545",
                    border: "1px solid #f5c6cb",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Icon.X size={12} />
                </button>
              </div>
            )}

            {/* Upload error message */}
            {uploadError && (
              <div
                style={{
                  color: "#dc3545",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                {uploadError}
              </div>
            )}
          </Col>
        </Row>
        <Row>
          <Col className="d-flex justify-content-end">
            <img
              src="/horse-mini.png"
              alt="Year of Horse"
              style={{
                height: "60px",
                width: "auto",
                objectFit: "contain",
                marginBottom: "0",
              }}
            />
          </Col>
        </Row>
        <Row style={{ marginTop: "-10px" }}>
          <Col>
            <textarea
              ref={textareaRef}
              value={localQuestion}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Enter your question"
              disabled={disabled}
              className="question-input"
              style={{
                resize: "none",
                minHeight: "60px",
                overflowY: "hidden",
                height: "auto",
                maxHeight: `${window.innerHeight * 0.8}px`,
              }}
              // onInput={adjustHeight}
              // onKeyDown={adjustHeight}
            />
          </Col>
        </Row>
        <Row>
          <Col className="d-flex justify-content-end align-items-center gap-2">
            {/* Thinking Toggle */}
            <Form.Check
              type="switch"
                id="thinking-toggle"
              label="Thinking"
                checked={isThinkingEnabled}
                onChange={toggleThinking}
                disabled={disabled}
              title="Enable thinking mode for more detailed responses"
            />

            {/* PDF Upload Button */}
            <div className="pdf-upload-container">
              <input
                type="file"
                ref={pdfInputRef}
                accept="application/pdf"
                onChange={handlePdfUpload}
                style={{ display: "none" }}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => !disabled && pdfInputRef.current.click()}
                disabled={disabled}
                className="pdf-image-button"
              >
                <Icon.FileEarmarkPdf size={14} />
                <span className="d-none d-md-inline ms-1">PDF</span>
              </Button>
            </div>

            {/* Image Upload Button */}
            <div className="image-upload-container">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => !disabled && fileInputRef.current.click()}
                disabled={disabled}
                className="pdf-image-button"
              >
                <Icon.Image size={14} />
                <span className="d-none d-md-inline ms-1">Image</span>
              </Button>
            </div>

            {/* Send Button */}
            <Button
              type="submit"
              disabled={disabled || (!localQuestion.trim() && !selectedImage)}
              className="send-button"
              variant="primary"
              style={{
                padding: "8px 12px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "500",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "36px",
              }}
            >
              <Icon.Send size={16} className="mr-1" />
              <span className="d-none d-md-inline">Send</span>
            </Button>
          </Col>
        </Row>
      </Container>{" "}
    </form>
  );
}

// Memoize QuestionInput to prevent unnecessary re-renders
export default memo(QuestionInput);
