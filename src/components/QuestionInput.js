import { useState, useEffect, useRef } from 'react';
import * as Icon from "react-bootstrap-icons";
import Button from "react-bootstrap/Button";

// Question input component
function QuestionInput({ onSubmit, disabled = false, value = '', onChange }) {
  const [localQuestion, setLocalQuestion] = useState(value);
  // 从localStorage获取设置，如果没有则默认为true
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(() => {
    const savedSetting = localStorage.getItem('thinkingEnabled');
    return savedSetting === null ? true : savedSetting === 'true';
  });
  const textareaRef = useRef(null);
  // Function to automatically adjust the height of the textarea
  const adjustHeight = () => {
    if (textareaRef.current) {
      // Remove all inline styles that may limit the height
      textareaRef.current.style.height = '';
      textareaRef.current.style.maxHeight = '1000px';
      // Force a layout recalculation
      textareaRef.current.scrollTop = 0;
      // Get the accurate scrollHeight
      const scrollHeight = textareaRef.current.scrollHeight;
      // Set the height directly to ensure there's enough space to display the content
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  };
  
  // Sync external value with local state
  useEffect(() => {
    setLocalQuestion(value);
    // Adjust the height when the external value changes
    setTimeout(adjustHeight, 0); // Use setTimeout to ensure the DOM has been updated
  }, [value]);
  
  // Initialize the height when the component mounts
  useEffect(() => {
    adjustHeight();
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (localQuestion.trim() && !disabled) {
      // Set thinkingBudget to -1 if thinking is enabled, else 0
      const thinkingBudget = isThinkingEnabled ? -1 : 0;
      onSubmit(localQuestion, thinkingBudget);
      // Clear local state
      setLocalQuestion('');
      // Notify parent if onChange is provided
      if (onChange) {
        onChange('');
      }
    }
  };
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalQuestion(newValue);
    adjustHeight();
    if (onChange) {
      onChange(newValue);
    }
  };
  
  const toggleThinking = () => {
    const newValue = !isThinkingEnabled;
    setIsThinkingEnabled(newValue);
    // 保存到localStorage
    localStorage.setItem('thinkingEnabled', newValue.toString());
  };
  
  return (
    <form onSubmit={handleSubmit} className="question-form">
      <div className="question-input-container">
        <textarea
          ref={textareaRef}
          value={localQuestion}
          onChange={handleChange}
          placeholder="Enter your question (max 30000 characters)"
          disabled={disabled}
          className="question-input"
          maxLength={30000}
          style={{
            resize: 'none',
            minHeight: '60px',
            overflow: 'hidden',
            height: 'auto'
          }}
          onInput={adjustHeight}
          onKeyDown={adjustHeight}
        />
        <div className="thinking-toggle">
          <input
            type="checkbox"
            id="thinking-toggle"
            checked={isThinkingEnabled}
            onChange={toggleThinking}
            disabled={disabled}
            className="toggle-checkbox"
          />
          <label
            htmlFor="thinking-toggle"
            className={`toggle-label ${isThinkingEnabled ? 'toggle-on' : 'toggle-off'}`}
          >
            <Icon.Lightbulb size={16} />
            <span className="toggle-text">Thinking</span>
          </label>
        </div>
      </div>
      <Button type="submit" disabled={disabled || !localQuestion.trim()} className="send-button">
        <Icon.Send size={18} />
      </Button>
    </form>
  );
}

export default QuestionInput;