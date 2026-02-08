/**
 * Conversation Container Component
 * Container for conversation history with floating menu support
 */

import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import * as Icon from "react-bootstrap-icons";
import ConversationHistory from "./ConversationHistory";
import ConversationTitle from "./ConversationTitle";
import ConversationSelector from "./ConversationSelector";
import ConversationActions from "./ConversationActions";
import { filterDeletedMessages } from "../services/conversationService";

/**
 * ConversationContainer component
 * @param {Object} props
 * @param {Array} props.conversation - Current conversation array
 * @param {Function} props.onDelete - Delete message handler
 * @param {Function} props.onEdit - Edit message handler
 * @param {Object} props.editingState - Editing state object
 * @param {Function} props.onSave - Save edit handler
 * @param {Function} props.onCancel - Cancel edit handler
 * @param {boolean} props.showFloatingMenu - Whether to show floating menu
 * @param {boolean} props.isFloatingMenuOpen - Whether floating menu is open
 * @param {Function} props.setIsFloatingMenuOpen - Set floating menu open state
 * @param {Object} props.floatingMenuRef - Ref for floating menu
 * @param {boolean} props.isOneDriveAvailable - Whether OneDrive is available
 * @param {Array} props.conversations - List of conversations
 * @param {string} props.currentConversationId - Current conversation ID
 * @param {Function} props.onSwitchConversation - Switch conversation handler
 * @param {Function} props.onDeleteConversation - Delete conversation handler
 * @param {boolean} props.isSyncing - Whether sync is in progress
 * @param {boolean} props.isGeneratingTitle - Whether title is being generated
 * @param {string} props.currentConversationTitle - Current conversation title
 * @param {Function} props.updateConversationTitle - Update title handler
 * @param {Function} props.onDownload - Download handler
 * @param {Function} props.onUpload - Upload handler
 * @param {Function} props.onReset - Reset handler
 * @param {Function} props.setIsConversationSelectorOpen - Set conversation selector open state
 */
export default function ConversationContainer({
  conversation,
  onDelete,
  onEdit,
  editingState,
  onSave,
  onCancel,
  showFloatingMenu,
  isFloatingMenuOpen,
  setIsFloatingMenuOpen,
  floatingMenuRef,
  isOneDriveAvailable,
  conversations,
  currentConversationId,
  onSwitchConversation,
  onDeleteConversation,
  isSyncing,
  isGeneratingTitle,
  currentConversationTitle,
  updateConversationTitle,
  onDownload,
  onUpload,
  onReset,
  setIsConversationSelectorOpen,
}) {
  const {
    editingIndex,
    editingPartIndex,
    editingText,
    setEditingText,
  } = editingState || {};

  return (
    <Row>
      <Col>
        {/* Floating Hamburger Menu */}
        {showFloatingMenu && (
          <div
            ref={floatingMenuRef}
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              zIndex: 1050,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              width: isFloatingMenuOpen ? '450px' : 'auto',
              maxWidth: isFloatingMenuOpen ? '95vw' : 'auto',
              padding: isFloatingMenuOpen ? '16px' : '0',
              transition: 'all 0.3s ease',
              overflow: 'visible',
              overflowY: 'visible',
              overflowX: 'visible'
            }}
          >
            {/* Hamburger Button */}
            <Button
              variant="outline-secondary"
              onClick={() => setIsFloatingMenuOpen(!isFloatingMenuOpen)}
              style={{
                border: 'none',
                borderRadius: isFloatingMenuOpen ? '12px 12px 0 0' : '12px',
                padding: '10px 14px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              <Icon.List size={20} />
              {isFloatingMenuOpen && <span className="ms-2">Menu</span>}
            </Button>

            {/* Expanded Menu */}
            {isFloatingMenuOpen && (
              <div
                style={{
                  padding: '16px',
                  overflow: 'visible',
                  overflowY: 'visible',
                  overflowX: 'visible',
                  width: '100%',
                  boxSizing: 'border-box',
                  position: 'relative',
                  minWidth: 0,
                }}
              >
                {/* Conversation Title */}
                {isOneDriveAvailable && (
                  <div className="mb-3" style={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <ConversationTitle
                      title={currentConversationTitle}
                      isAutoTitle={conversations.find(c => c.id === currentConversationId)?.autoTitle !== false}
                      isGeneratingTitle={isGeneratingTitle}
                      onTitleChange={updateConversationTitle}
                    />
                  </div>
                )}

                {/* Conversation Selector */}
                {isOneDriveAvailable && (
                  <div className="mb-3" style={{ width: '100%', minWidth: 0, maxWidth: '100%', position: 'relative', zIndex: 1052, overflow: 'visible' }}>
                    <ConversationSelector
                      conversations={conversations}
                      currentConversationId={currentConversationId}
                      onSwitchConversation={onSwitchConversation}
                      onDeleteConversation={onDeleteConversation}
                      isSyncing={isSyncing}
                      onDropdownToggle={setIsConversationSelectorOpen}
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <ConversationActions
                  onDownload={onDownload}
                  onUpload={onUpload}
                  onReset={onReset}
                  conversation={conversation}
                  isSyncing={isSyncing}
                  isOneDriveAvailable={isOneDriveAvailable}
                  variant="floating"
                />
              </div>
            )}
          </div>
        )}

        <ConversationHistory
          history={filterDeletedMessages(conversation)}
          onDelete={onDelete}
          onEdit={onEdit}
          editingIndex={editingIndex}
          editingPartIndex={editingPartIndex}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onSave={onSave}
          onCancel={onCancel}
        />
      </Col>
    </Row>
  );
}
