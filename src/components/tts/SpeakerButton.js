import * as Icon from "react-bootstrap-icons";

/**
 * Speaker button component for TTS playback
 * 
 * @param {Function} onClick - Click handler function
 * @param {string} position - Button position ("left" or "right")
 * @param {string} status - Current status ("idle", "loading", or "playing")
 */
const SpeakerButton = ({ onClick, position = "right", status = "idle" }) => {
  const isLoading = status === "loading";
  const isPlaying = status === "playing";
  const title = isLoading
    ? "Generating audio..."
    : isPlaying
      ? "Stop audio playback"
      : "Play audio";

  let icon = <Icon.VolumeUp size={14} />;
  if (isLoading) {
    icon = <Icon.HourglassSplit size={14} />;
  } else if (isPlaying) {
    icon = <Icon.StopFill size={14} />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`speaker-button ${position === "left" ? "speaker-button-left" : "speaker-button-right"
        }`}
      title={title}
      disabled={isLoading}
    >
      {icon}
    </button>
  );
};

export default SpeakerButton;
