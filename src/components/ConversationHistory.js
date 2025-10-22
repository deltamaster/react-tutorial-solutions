import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Icon from 'react-bootstrap-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
  // 渲染 grounding 数据的组件
  const renderGroundingData = (content) => {
    if (!content.groundingChunks || content.groundingChunks.length === 0) {
      return null;
    }

    return (
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        fontSize: '0.9em'
      }}>
        <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '8px' }}>
          Sources:
        </div>
        <div style={{ marginLeft: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {content.groundingChunks.map((chunk, idx) => (
            <div key={idx}>
              {chunk.web?.uri ? (
                <a 
                  href={chunk.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{
                    color: '#0d6efd',
                    textDecoration: 'none',
                    padding: '4px 8px',
                    border: '1px solid #0d6efd',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                    display: 'inline-block',
                    transition: 'all 0.2s ease',
                    fontSize: '0.85em'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#0d6efd';
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.color = '#0d6efd';
                  }}
                >
                  {(idx + 1)}: {chunk.web?.title}
                </a>
              ) : (
                <span style={{ color: '#6c757d', fontSize: '0.85em' }}>
                  {(idx + 1)}: {chunk.web?.title}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

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
              
              // For bot responses, display thoughts, code, execution results and regular responses differently
              if (content.role === "model") {
                
                // Handle executable code
                if (part.executableCode) {
                  return (
                    <div key={partIndex} className="code-part" style={{ marginTop: '8px' }}>
                      <div style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        padding: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                          <Icon.Code size={16} className="mr-2" />
                          Code ({part.executableCode.language})
                        </div>
                        <SyntaxHighlighter 
                          language={part.executableCode.language.toLowerCase() || 'javascript'}
                          style={vscDarkPlus}
                          customStyle={{
                            borderRadius: '4px',
                            margin: 0,
                            fontSize: '0.9em',
                            padding: '12px'
                          }}
                        >
                          {part.executableCode.code}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  );
                }
                
                // Handle code execution results
                if (part.codeExecutionResult) {
                  return (
                    <div key={partIndex} className="execution-result-part" style={{ marginTop: '8px' }}>
                      <div style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        padding: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#495057', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                          <Icon.Terminal size={16} className="mr-2" />
                          Execution Result ({part.codeExecutionResult.outcome === 'OUTCOME_OK' ? 'Success' : 'Error'})
                        </div>
                        <pre style={{
                          backgroundColor: part.codeExecutionResult.outcome === 'OUTCOME_OK' ? '#f8fff8' : '#fff8f8',
                          color: '#495057',
                          padding: '12px',
                          borderRadius: '4px',
                          overflowX: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.9em',
                          border: `1px solid ${part.codeExecutionResult.outcome === 'OUTCOME_OK' ? '#d4edda' : '#f5c6cb'}`,
                          margin: 0
                        }}>
                          {part.codeExecutionResult.output}
                        </pre>
                      </div>
                    </div>
                  );
                }
                
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
                // If it's a PDF, show a placeholder instead of the actual content
                if (part.inline_data.mime_type === 'application/pdf') {
                  return (
                    <div key={partIndex} style={{ margin: '10px 0' }}>
                      <div 
                        style={{
                          padding: '16px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: '#f8f9fa',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Icon.FileEarmarkPdf size={32} color="#dc3545" style={{ marginRight: '12px' }} />
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>PDF Document Uploaded</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>A PDF file has been uploaded here.</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                // For images, create data URL and display
                else {
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
            {/* 渲染 grounding 数据（如果存在） */}
            {content.role === 'model' && renderGroundingData(content)}
          </div>
        );
      })}
    </div>
  );
}

export default ConversationHistory;