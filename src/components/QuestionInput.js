import { useState, useEffect, useRef, memo, useCallback } from "react";
import * as Icon from "react-bootstrap-icons";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { getThinkingEnabled, setThinkingEnabled } from "../utils/settingsService";

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
            textareaRef.current.style.height = "";
            // Get the accurate scrollHeight without forcing a full layout recalculation
            const scrollHeight = textareaRef.current.scrollHeight;
            const newHeight = scrollHeight + "px";
            textareaRef.current.style.height = newHeight;
            window.scrollTo({ 
              top: document.body.scrollHeight, 
              behavior: 'instant' 
            });
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

  const processImageFile = (file) => {
    if (!file) return false;
    // Reset error state
    setUploadError("");

    // Validate file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    if (!validTypes.includes(file.type)) {
      setUploadError(
        "Unsupported file format. Please upload PNG, JPEG, WEBP, HEIC, or HEIF."
      );
      return false;
    }

    // Validate file size (20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxSize) {
      setUploadError("File size exceeds 20MB limit.");
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

    // Validate file type
    if (file.type !== "application/pdf") {
      setUploadError("Unsupported file format. Please upload PDF files only.");
      return;
    }

    // Validate file size (20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxSize) {
      setUploadError("File size exceeds 20MB limit.");
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
                overflow: "hidden",
                height: "auto",
              }}
              // onInput={adjustHeight}
              // onKeyDown={adjustHeight}
            />
          </Col>
        </Row>
        <Row>
          <Col className="d-flex justify-content-end gap-2">
            {/* Thinking Toggle */}
            <div className="relative thinking-toggle">
              <input
                type="checkbox"
                id="thinking-toggle"
                checked={isThinkingEnabled}
                onChange={toggleThinking}
                disabled={disabled}
                className="toggle-checkbox"
                style={{ display: "none" }}
              />
              <label
                htmlFor="thinking-toggle"
                className={`toggle-label ${isThinkingEnabled ? "toggle-on" : "toggle-off"}`}
                style={{
                  cursor: disabled ? "not-allowed" : "pointer",
                  border: "1px solid #dee2e6",
                }}
              >
                <Icon.Lightbulb size={16} className="mr-1" />
                <span className="toggle-text">Thinking</span>
              </label>
            </div>

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
              <button
                type="button"
                onClick={() => !disabled && pdfInputRef.current.click()}
                disabled={disabled}
                className="toggle-label toggle-on"
                style={{
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <Icon.FileEarmarkPdf size={16} className="mr-1" />
                <span className="d-none d-md-inline">PDF</span>
              </button>
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
              <button
                type="button"
                onClick={() => !disabled && fileInputRef.current.click()}
                disabled={disabled}
                className="toggle-label toggle-on"
                style={{
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <Icon.Image size={16} className="mr-1" />
                <span className="d-none d-md-inline">Image</span>
              </button>
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
