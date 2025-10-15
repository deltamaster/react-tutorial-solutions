import { useState } from 'react';
import * as Icon from "react-bootstrap-icons";
import Button from "react-bootstrap/Button";

// Question input component
function QuestionInput({ onSubmit, disabled = false }) {
  const [question, setQuestion] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim() && !disabled) {
      onSubmit(question);
      setQuestion('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="question-form">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Enter your question (max 30000 characters)"
        disabled={disabled}
        className="question-input"
        maxLength={30000}
      />
      <Button type="submit" disabled={disabled || !question.trim()} className="send-button">
        <Icon.Send size={18} />
      </Button>
    </form>
  );
}

export default QuestionInput;