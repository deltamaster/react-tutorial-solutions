import React, { useState, useRef, useEffect } from 'react';
import * as Icon from 'react-bootstrap-icons';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import { formatTimestamp } from '../utils/timestampUtils';

/**
 * ConversationSelector component
 * Displays a dropdown list of conversations and allows user to switch between them
 */
function ConversationSelector({ 
  conversations = [],
  currentConversationId,
  onSwitchConversation,
  isSyncing = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sort conversations by updatedAt (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0);
    const dateB = new Date(b.updatedAt || b.createdAt || 0);
    return dateB - dateA;
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (conversationId) => {
    if (conversationId === currentConversationId) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    if (onSwitchConversation) {
      await onSwitchConversation(conversationId);
    }
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div className={`conversation-selector ${className}`} ref={dropdownRef}>
      <Dropdown show={isOpen} onToggle={setIsOpen}>
        <Dropdown.Toggle
          as={Button}
          variant="outline-secondary"
          size="sm"
          disabled={isSyncing || conversations.length === 0}
          className="d-flex align-items-center gap-2"
        >
          <Icon.Folder size={14} />
          <span className="d-none d-md-inline">
            {currentConversation?.name || 'Select Conversation'}
          </span>
          <span className="d-md-none">
            {currentConversation?.name || 'Select'}
          </span>
          {isSyncing && (
            <span className="spinner-border spinner-border-sm ms-1" role="status" aria-hidden="true" />
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu style={{ maxHeight: '400px', overflowY: 'auto', minWidth: '300px' }}>
          {sortedConversations.length === 0 ? (
            <Dropdown.Item disabled>
              <div className="text-muted text-center py-2">
                No conversations found
              </div>
            </Dropdown.Item>
          ) : (
            sortedConversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const updatedAt = conv.updatedAt || conv.createdAt;
              const formattedDate = updatedAt ? formatTimestamp(new Date(updatedAt)) : 'Unknown date';

              return (
                <Dropdown.Item
                  key={conv.id}
                  active={isActive}
                  onClick={() => handleSelect(conv.id)}
                  className="d-flex flex-column align-items-start py-2"
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#e7f3ff' : 'transparent',
                    color: isActive ? '#000000' : 'inherit' // Black text for selected item
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <span
                      className="fw-semibold text-truncate"
                      style={{ 
                        maxWidth: '200px',
                        color: isActive ? '#000000' : 'inherit' // Black text for selected item
                      }}
                      title={conv.name}
                    >
                      {conv.name || 'Untitled Conversation'}
                    </span>
                    {isActive && (
                      <Icon.CheckCircleFill size={14} className="text-primary ms-2" />
                    )}
                  </div>
                  <div className="d-flex justify-content-between align-items-center w-100 mt-1">
                    <small style={{ color: isActive ? '#666666' : undefined }}>
                      {conv.messageCount || 0} messages
                    </small>
                    <small style={{ color: isActive ? '#666666' : undefined }}>
                      {formattedDate}
                    </small>
                  </div>
                </Dropdown.Item>
              );
            })
          )}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

export default ConversationSelector;
