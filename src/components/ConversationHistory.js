import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Conversation history component
function ConversationHistory({ history }) {
  return (
    <div className="conversation-history">
      {history.map((content, index) => {
        // Check if there are elements with the text property in content.parts
        const hasTextParts = content.parts && Array.isArray(content.parts) && content.parts.some(part => part.text);
        if (!hasTextParts) {
          return null;
        }

        return (
          <div key={index} className={content.role}>
            {content.role === "user" ? (
              <p style={{ fontWeight: "bold" }}>You: </p>
            ) : (
              <p style={{ fontWeight: "bold" }}>Bot: </p>
            )}
            
            {content.parts && Array.isArray(content.parts) && content.parts.map((part, partIndex) => {
              // Check if this part contains thoughts
              const isThought = part.thought === true;
              
              // For bot responses, display thoughts and regular responses differently
              if (content.role === "model") {
                if (isThought) {
                  return (
                    <div key={partIndex} className="thought-part">
                      <div style={{ 
                        background: "#f8f9fa", 
                        border: "1px dashed #adb5bd", 
                        borderRadius: "4px", 
                        padding: "8px 12px", 
                        marginBottom: "8px",
                        fontSize: "0.9em",
                        fontStyle: "italic"
                      }}>
                        <span style={{ color: "#6c757d", fontWeight: "bold" }}>Thought:</span> 
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </Markdown>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={partIndex} className="response-part">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {part.text}
                      </Markdown>
                    </div>
                  );
                }
              } 
              // For user messages, just display the text normally
              else if (part.text) {
                return (
                  <div key={partIndex}>
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {part.text}
                    </Markdown>
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}

export default ConversationHistory;