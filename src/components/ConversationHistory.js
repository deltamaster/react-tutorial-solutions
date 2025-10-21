import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Icon from 'react-bootstrap-icons';

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
  onCancel 
}) {
  return (
    <div className="conversation-history">
      {history.map((content, index) => {
        // Check if there are elements with text property or image data in content.parts
        const hasValidParts = content.parts && Array.isArray(content.parts) && 
          content.parts.some(part => part.text || (part.inline_data && part.inline_data.data && part.inline_data.mime_type));
        if (!hasValidParts) {
          return null;
        }

        return (
          <div key={index} className={content.role} style={{ position: 'relative', marginBottom: '16px' }}>
            {/* Delete button - light red, becomes darker on hover */}
            <button 
              onClick={() => onDelete(index)}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#f8d7da',
                color: '#dc3545',
                border: '1px solid #f5c6cb',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s ease',
                padding: 0,
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.borderColor = '#c82333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8d7da';
                e.currentTarget.style.color = '#dc3545';
                e.currentTarget.style.borderColor = '#f5c6cb';
              }}
              title="Delete message"
            >
              <Icon.X size={14} />
            </button>
            
            {content.role === "user" ? (
              <p style={{ fontWeight: "bold" }}>You: </p>
            ) : (
              <p style={{ fontWeight: "bold" }}>Bot: </p>
            )}
            
            {content.parts && Array.isArray(content.parts) && content.parts.map((part, partIndex) => {
              // Check if this part contains thoughts
              const isThought = part.thought === true;
              
              // Check if this part is being edited
              const isEditing = editingIndex === index && editingPartIndex === partIndex;
              
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
                        {isEditing ? (
                          <div>
                            <textarea
                              value={editingText}
                              onChange={(e) => onEditingTextChange(e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '80px',
                                maxWidth: '100%',
                                minWidth: '100%',
                                border: '1px solid #007bff',
                                borderRadius: '4px',
                                padding: '8px',
                                fontSize: '0.9em',
                                fontStyle: 'italic',
                                fontFamily: 'inherit'
                              }}
                              placeholder="Edit your content here..."
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button
                                onClick={onSave}
                                style={{
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={onCancel}
                                style={{
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => onEdit(index, partIndex, part.text)}
                              style={{
                                float: 'right',
                                backgroundColor: '#e3f2fd',
                                color: '#1976d2',
                                border: '1px solid #bbdefb',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginLeft: '8px',
                                fontSize: '12px',
                                padding: '4px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '28px',
                                height: '28px',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#bbdefb';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#e3f2fd';
                              }}
                              title="Edit"
                            >
                              <Icon.Pencil size={14} />
                            </button>
                            <Markdown remarkPlugins={[remarkGfm]}>
                              {part.text}
                            </Markdown>
                          </>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={partIndex} className="response-part" style={{ position: 'relative' }}>
                      {isEditing ? (
                        <div>
                          <textarea
                            value={editingText}
                            onChange={(e) => onEditingTextChange(e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              maxWidth: '100%',
                              minWidth: '100%',
                              border: '1px solid #007bff',
                              borderRadius: '4px',
                              padding: '8px',
                              fontSize: '0.9em',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Edit your content here..."
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              onClick={onSave}
                              style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={onCancel}
                              style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => onEdit(index, partIndex, part.text)}
                            style={{
                              float: 'right',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              border: '1px solid #bbdefb',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginLeft: '8px',
                              fontSize: '12px',
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '28px',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#bbdefb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#e3f2fd';
                            }}
                            title="Edit"
                          >
                            <Icon.Pencil size={14} />
                          </button>
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {part.text}
                          </Markdown>
                        </>
                      )}
                    </div>
                  );
                }
              } 
              // Check if the part contains image data
              else if (part.inline_data && part.inline_data.data && part.inline_data.mime_type) {
                // Create data URL for the image
                const imageSrc = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                return (
                  <div key={partIndex} style={{ margin: '10px 0', textAlign: 'center' }}>
                    <img 
                      src={imageSrc} 
                      alt="User uploaded image" 
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }} 
                    />
                  </div>
                );
              }
              // For user messages with text, display normally
              else if (part.text) {
                return (
                  <div key={partIndex} style={{ position: 'relative' }}>
                    {isEditing ? (
                      <div>
                        <textarea
                          value={editingText}
                          onChange={(e) => onEditingTextChange(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            maxWidth: '100%',
                            minWidth: '100%',
                            border: '1px solid #007bff',
                            borderRadius: '4px',
                            padding: '8px',
                            fontSize: '0.9em',
                            fontFamily: 'inherit'
                          }}
                          placeholder="Edit your content here..."
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={onSave}
                            style={{
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={onCancel}
                            style={{
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button 
                            onClick={() => onEdit(index, partIndex, part.text)}
                            style={{
                              float: 'left',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              border: '1px solid #bbdefb',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginRight: '8px',
                              fontSize: '12px',
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '28px',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#bbdefb';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#e3f2fd';
                            }}
                            title="Edit"
                          >
                            <Icon.Pencil size={14} />
                          </button>
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {part.text}
                        </Markdown>
                      </>
                    )}
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