/**
 * TTS Player component
 * Displays TTS progress and error messages
 * 
 * @param {Array} audioSegments - Array of audio segments
 * @param {number} currentSegmentIndex - Current playing segment index
 * @param {boolean} isPlayingAudio - Whether audio is currently playing
 * @param {boolean} isWaitingForNextSegment - Whether waiting for next segment
 * @param {string} audioError - Error message if any
 */
const TtsPlayer = ({
  audioSegments,
  currentSegmentIndex,
  isPlayingAudio,
  isWaitingForNextSegment,
  audioError,
}) => {
  return (
    <>
      {audioSegments.length > 1 && isPlayingAudio && (
        <div className="tts-progress">
          Segment {Math.min(currentSegmentIndex + 1, audioSegments.length)} of{" "}
          {audioSegments.length}
          {isWaitingForNextSegment ? " (loading next...)" : ""}
        </div>
      )}
      {audioError && <div className="tts-error">{audioError}</div>}
    </>
  );
};

export default TtsPlayer;
