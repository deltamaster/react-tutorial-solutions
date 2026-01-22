import React, { useState, useRef, useEffect } from 'react';
import * as Icon from 'react-bootstrap-icons';
import Button from 'react-bootstrap/Button';

/**
 * ConversationTitle component
 * Displays and allows editing of conversation title
 * Shows auto-title indicator when autoTitle is enabled
 */
function ConversationTitle({ 
  title, 
  isAutoTitle, 
  isGeneratingTitle,
  onTitleChange,
  className = ''
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef(null);
  
  // Update editValue when title changes externally
  useEffect(() => {
    setEditValue(title);
  }, [title]);
  
  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };
  
  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      onTitleChange(trimmedValue);
    } else {
      setEditValue(title);
    }
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };
  
  if (isEditing) {
    return (
      <div className={`d-flex align-items-center gap-2 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="form-control form-control-sm"
          style={{ 
            minWidth: '200px',
            maxWidth: '400px'
          }}
          placeholder="Conversation title"
        />
        <Button
          variant="link"
          size="sm"
          onClick={handleSave}
          className="p-0"
          style={{ minWidth: 'auto' }}
        >
          <Icon.Check size={16} />
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={handleCancel}
          className="p-0"
          style={{ minWidth: 'auto' }}
        >
          <Icon.X size={16} />
        </Button>
      </div>
    );
  }
  
  return (
    <div 
      className={`d-flex align-items-center gap-2 ${className}`}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      <span 
        className="text-truncate"
        style={{ 
          maxWidth: '300px',
          fontWeight: '500'
        }}
        title={title}
      >
        {title || 'New Conversation'}
      </span>
      {isGeneratingTitle && (
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      )}
      {isAutoTitle && !isGeneratingTitle && (
        <span 
          className="badge bg-secondary"
          style={{ fontSize: '0.65rem' }}
          title="Title is auto-generated"
        >
          Auto
        </span>
      )}
      <Icon.Pencil 
        size={12} 
        className="text-muted"
        style={{ opacity: 0.6 }}
      />
    </div>
  );
}

export default ConversationTitle;
