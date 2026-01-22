// Follow-up questions component
function FollowUpQuestions({ questions, onQuestionClick, isLoading = false }) {
  if (isLoading) {
    return <div className="follow-up-loading">...</div>;
  }
  
  if (!questions || questions.length === 0) {
    return null;
  }
  
  return (
    <div className="follow-up-questions">
      <div>You may want to ask:</div>
      <div className="question-list">
        {questions.map((question, index) => (
          <button
            key={index}
            className="follow-up-button"
            onClick={() => onQuestionClick(question)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onQuestionClick(question);
              }
            }}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

export default FollowUpQuestions;