/**
 * Conversation Actions Component
 * Displays action buttons for conversation management (download, upload, reset)
 */

import Button from "react-bootstrap/Button";
import * as Icon from "react-bootstrap-icons";

/**
 * ConversationActions component
 * @param {Object} props
 * @param {Function} props.onDownload - Download conversation handler
 * @param {Function} props.onUpload - Upload conversation handler
 * @param {Function} props.onReset - Reset conversation handler
 * @param {Array} props.conversation - Current conversation array
 * @param {boolean} props.isSyncing - Whether sync is in progress
 * @param {boolean} props.isOneDriveAvailable - Whether OneDrive is available
 * @param {string} props.variant - Layout variant: 'inline' (default) or 'floating'
 */
export default function ConversationActions({
  onDownload,
  onUpload,
  onReset,
  conversation = [],
  isSyncing = false,
  isOneDriveAvailable = false,
  variant = 'inline',
}) {
  const hasConversation = conversation.length > 0;

  if (variant === 'floating') {
    return (
      <div className="d-flex flex-row gap-2 justify-content-center">
        {/* Sync indicator */}
        {isOneDriveAvailable && isSyncing && (
          <div className="d-flex align-items-center mb-3">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span className="ms-2">Syncing...</span>
          </div>
        )}

        {/* Action Buttons */}
        <Button
          variant="primary"
          onClick={onDownload}
          size="sm"
          style={{ 
            display: hasConversation ? "inline-flex" : "none",
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '40px'
          }}
          title="Download"
        >
          <Icon.Download size={16} />
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onUpload}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '40px'
          }}
          title="Upload"
        >
          <Icon.Upload size={16} />
        </Button>

        <Button
          variant="primary"
          onClick={onReset}
          size="sm"
          style={{ 
            display: hasConversation ? "inline-flex" : "none",
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '40px'
          }}
          title="New Conversation"
        >
          <Icon.PlusCircle size={16} />
        </Button>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div className="d-flex gap-2 ms-md-auto align-self-md-center" style={{ alignSelf: 'flex-end' }}>
      {/* Sync indicator - Left of buttons */}
      {isOneDriveAvailable && isSyncing && (
        <div className="d-flex align-items-center">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        </div>
      )}
      
      <div className="relative">
        <Button
          id="download-conversation"
          variant="primary"
          onClick={onDownload}
          size="sm"
          style={{ display: hasConversation ? "inline-flex" : "none" }}
        >
          <Icon.Download size={14} />
          <span className="d-none d-md-inline ms-1">Download</span>
        </Button>
      </div>

      <div className="relative">
        <Button
          variant="primary"
          size="sm"
          onClick={onUpload}
        >
          <Icon.Upload size={14} />
          <span className="d-none d-md-inline ms-1">Upload</span>
        </Button>
      </div>

      <div className="relative">
        <Button
          id="reset-conversation"
          variant="primary"
          onClick={onReset}
          size="sm"
          style={{ display: hasConversation ? "inline-flex" : "none" }}
        >
          <Icon.PlusCircle size={14} />
          <span className="d-none d-md-inline ms-1">New Conversation</span>
        </Button>
      </div>
    </div>
  );
}
