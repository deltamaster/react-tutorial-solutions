import { useState } from "react";
import { renderTextContent } from "../../utils/textProcessing/markdownUtils";
import { useTts } from "../../hooks/useTts";
import EditForm from "./EditForm";
import EditButton from "./EditButton";
import SpeakerButton from "../tts/SpeakerButton";
import TtsPlayer from "../tts/TtsPlayer";
import ExpandableHtmlBlock from "./ExpandableHtmlBlock";

/**
 * Text part component for rendering text content in messages
 * Handles editing, TTS, and thought content display
 */
const TextPart = ({
  text,
  isEditing,
  editingText,
  onEditingTextChange,
  onSave,
  onCancel,
  onEdit,
  isThought = false,
  position = "right",
  speakerVoice = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedText = typeof text === "string" ? text : "";

  // Use TTS hook for all audio-related functionality
  const {
    hasSpeakableText,
    isGeneratingAudio,
    isPlayingAudio,
    isWaitingForNextSegment,
    audioError,
    audioSegments,
    currentSegmentIndex,
    handleSpeakerClick,
  } = useTts(text, speakerVoice);

  if (isEditing) {
    return (
      <EditForm
        value={editingText}
        onChange={onEditingTextChange}
        onSave={onSave}
        onCancel={onCancel}
        isItalic={isThought}
      />
    );
  }

  const actionButtons = (
    <>
      <EditButton onClick={onEdit} position={position} />
      {hasSpeakableText && (
        <SpeakerButton
          onClick={handleSpeakerClick}
          position={position}
          status={
            isGeneratingAudio
              ? "loading"
              : isPlayingAudio
              ? "playing"
              : "idle"
          }
        />
      )}
    </>
  );

  if (isThought) {
    const safeText = normalizedText;
    const firstLine = safeText.split("\n")[0];
    const hasMoreContent = safeText.includes("\n");

    const toggleExpand = () => {
      setIsExpanded(!isExpanded);
    };

    return (
      <>
        {actionButtons}
        <div
          className="markdown-content thought-content"
          onClick={hasMoreContent ? toggleExpand : undefined}
          style={{ cursor: hasMoreContent ? "pointer" : "default" }}
        >
          {!isExpanded && hasMoreContent ? (
            <>
              <div className="thought-first-line">
                {renderTextContent(firstLine, ExpandableHtmlBlock)}
              </div>
              <div className="thought-fade-effect"></div>
              <div className="thought-expand-hint">Click to expand...</div>
            </>
          ) : (
            renderTextContent(safeText, ExpandableHtmlBlock)
          )}
        </div>
        <TtsPlayer
          audioSegments={audioSegments}
          currentSegmentIndex={currentSegmentIndex}
          isPlayingAudio={isPlayingAudio}
          isWaitingForNextSegment={isWaitingForNextSegment}
          audioError={audioError}
        />
      </>
    );
  }

  return (
    <>
      {actionButtons}
      <div className="markdown-content">
        {renderTextContent(normalizedText, ExpandableHtmlBlock)}
      </div>
      <TtsPlayer
        audioSegments={audioSegments}
        currentSegmentIndex={currentSegmentIndex}
        isPlayingAudio={isPlayingAudio}
        isWaitingForNextSegment={isWaitingForNextSegment}
        audioError={audioError}
      />
    </>
  );
};

export default TextPart;
