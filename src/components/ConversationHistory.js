import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Conversation history component
function ConversationHistory({ history }) {
  return (
    <div>
      {history.map((content, index) => {
        // Extract text from parts
        let displayText = '';
        if (content.parts && Array.isArray(content.parts)) {
          for (let part of content.parts) {
            if (part.text) {
              displayText += part.text;
            }
          }
        }
        
        return (
          <div key={index} className={content.role}>
            {content.role === "user" ? (
              <p style={{ fontWeight: "bold" }}>You: </p>
            ) : (
              <p style={{ fontWeight: "bold" }}>Bot: </p>
            )}
            <Markdown remarkPlugins={[remarkGfm]}>
              {displayText || (content.parts && content.parts[0] && content.parts[0].text)}
            </Markdown>
          </div>
        );
      })}
    </div>
  );
}

export default ConversationHistory;