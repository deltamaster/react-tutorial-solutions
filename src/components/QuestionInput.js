import { useState } from 'react';
import * as Icon from "react-bootstrap-icons";
import Button from "react-bootstrap/Button";

// Question input component
function QuestionInput({ onSubmit, disabled = false }) {
  const [question, setQuestion] = useState('');
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim() && !disabled) {
      // Set thinkingBudget to -1 if thinking is enabled, else 0
      const thinkingBudget = isThinkingEnabled ? -1 : 0;
      onSubmit(question, thinkingBudget);
      setQuestion('');
    }
  };
  
  const toggleThinking = () => {
    setIsThinkingEnabled(!isThinkingEnabled);
  };
  
  return (
    <form onSubmit={handleSubmit} className="question-form">
      <div className="question-input-container">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter your question (max 30000 characters)"
          disabled={disabled}
          className="question-input"
          maxLength={30000}
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
      <Button type="submit" disabled={disabled || !question.trim()} className="send-button">
        <Icon.Send size={18} />
      </Button>
    </form>
  );
}

export default QuestionInput;