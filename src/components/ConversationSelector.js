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
  onDeleteConversation,
  isSyncing = false,
  className = '',
  onDropdownToggle
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Notify parent when dropdown state changes
  useEffect(() => {
    if (onDropdownToggle) {
      onDropdownToggle(isOpen);
    }
  }, [isOpen, onDropdownToggle]);

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

  const handleDelete = async (e, conversationId) => {
    e.stopPropagation(); // Prevent dropdown item click
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      if (onDeleteConversation) {
        await onDeleteConversation(conversationId);
      }
    }
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <>
      <style>{`
        .delete-icon-wrapper:hover {
          background-color: #ffebee !important;
        }
        .delete-icon-wrapper:hover svg {
          color: #d32f2f !important;
          transform: scale(1.15);
        }
      `}</style>
      <div 
        className={`conversation-selector ${className}`} 
        ref={dropdownRef}
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          position: 'relative',
          zIndex: 1052
        }}
      >
        <Dropdown show={isOpen} onToggle={setIsOpen}>
        <Dropdown.Toggle
          as={Button}
          variant="outline-secondary"
          size="sm"
          disabled={isSyncing || conversations.length === 0}
          className="d-flex align-items-center gap-2"
          id="conversation-selector-toggle"
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden'
          }}
        >
          <Icon.Folder size={14} className="flex-shrink-0" />
          <span 
            className="d-none d-md-inline text-truncate"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={currentConversation?.name || 'Select Conversation'}
          >
            {currentConversation?.name || 'Select Conversation'}
          </span>
          <span 
            className="d-md-none text-truncate"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={currentConversation?.name || 'Select'}
          >
            {currentConversation?.name || 'Select'}
          </span>
          {isSyncing && (
            <span className="spinner-border spinner-border-sm ms-1 flex-shrink-0" role="status" aria-hidden="true" />
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu 
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            overflowX: 'hidden',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            marginTop: '4px',
            zIndex: 1053,
            boxSizing: 'border-box'
          }}
          popperConfig={{
            strategy: 'fixed',
            modifiers: [
              {
                name: 'preventOverflow',
                options: {
                  boundary: 'viewport',
                  padding: 10,
                  altBoundary: true,
                  rootBoundary: 'viewport',
                  tether: false
                }
              },
              {
                name: 'flip',
                options: {
                  boundary: 'viewport',
                  padding: 10,
                  fallbackPlacements: ['top', 'bottom'],
                  rootBoundary: 'viewport'
                }
              },
              {
                name: 'computeStyles',
                options: {
                  gpuAcceleration: false,
                  adaptive: false
                }
              },
              {
                name: 'offset',
                options: {
                  offset: [0, 4]
                }
              },
              {
                name: 'size',
                enabled: true,
                phase: 'beforeWrite',
                requires: ['preventOverflow'],
                fn({ state }) {
                  // Match dropdown width to toggle button width
                  const toggleElement = document.getElementById('conversation-selector-toggle');
                  if (toggleElement) {
                    const toggleWidth = toggleElement.getBoundingClientRect().width;
                    state.styles.popper.width = `${toggleWidth}px`;
                    state.styles.popper.maxWidth = `${toggleWidth}px`;
                  }
                  // Ensure it doesn't exceed viewport
                  const viewportWidth = window.innerWidth;
                  const maxWidth = Math.min(toggleElement ? toggleElement.getBoundingClientRect().width : viewportWidth, viewportWidth - 20);
                  state.styles.popper.maxWidth = `${maxWidth}px`;
                }
              }
            ]
          }}
        >
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
                    backgroundColor: isActive 
                      ? 'rgba(13, 110, 253, 0.5)' 
                      : 'transparent',
                    backdropFilter: isActive ? 'blur(10px)' : 'none',
                    WebkitBackdropFilter: isActive ? 'blur(10px)' : 'none',
                    border: isActive 
                      ? '1px solid rgba(13, 110, 253, 0.5)' 
                      : '1px solid transparent',
                    borderRadius: isActive ? '8px' : '0',
                    color: isActive ? '#000000' : 'inherit',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <div className="d-flex align-items-center w-100" style={{ gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                    <span
                      className="fw-semibold"
                      style={{ 
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isActive ? '#000000' : 'inherit'
                      }}
                      title={conv.name}
                    >
                      {conv.name || 'Untitled Conversation'}
                    </span>
                    <div
                      className="delete-icon-wrapper"
                      onClick={(e) => handleDelete(e, conv.id)}
                      title="Delete conversation"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Icon.X
                        size={14}
                        className="text-danger flex-shrink-0"
                        style={{
                          transition: 'all 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end align-items-center w-100 mt-1" style={{ minWidth: 0, overflow: 'hidden' }}>
                    <small 
                      style={{ 
                        color: isActive ? '#666666' : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%'
                      }}
                      title={formattedDate}
                    >
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
    </>
  );
}

export default ConversationSelector;
