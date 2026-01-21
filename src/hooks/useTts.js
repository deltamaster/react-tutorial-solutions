import { useState, useEffect, useRef } from "react";
import { requestSpeechAudio, sanitizeTextForSpeech } from "../utils/ttsUtils";

/**
 * Custom hook for Text-to-Speech functionality
 * Manages audio generation, playback, and state
 * 
 * @param {string} text - The text to convert to speech
 * @param {string|null} speakerVoice - Optional voice name for TTS
 * @returns {Object} TTS state and control functions
 */
export const useTts = (text, speakerVoice = null) => {
  const [audioSegments, setAudioSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isWaitingForNextSegment, setIsWaitingForNextSegment] = useState(false);
  const [audioError, setAudioError] = useState("");

  const audioRef = useRef(null);
  const audioSegmentsRef = useRef([]);
  const currentSegmentIndexRef = useRef(0);
  const isPlayingAudioRef = useRef(false);
  const waitingForNextRef = useRef(false);
  const generationCancelledRef = useRef(false);
  const isGeneratingAudioRef = useRef(false);

  const normalizedText = typeof text === "string" ? text : "";
  const speakableText = sanitizeTextForSpeech(normalizedText);
  const hasSpeakableText = speakableText.length > 0;

  const updateGeneratingState = (value) => {
    setIsGeneratingAudio(value);
    isGeneratingAudioRef.current = value;
    if (!value) {
      waitingForNextRef.current = false;
      setIsWaitingForNextSegment(false);
    }
  };

  const stopAudio = ({ clearSegments = false, cancelGeneration = false } = {}) => {
    if (cancelGeneration) {
      generationCancelledRef.current = true;
      updateGeneratingState(false);
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    isPlayingAudioRef.current = false;
    waitingForNextRef.current = false;
    setIsWaitingForNextSegment(false);
    setCurrentSegmentIndex(0);
    currentSegmentIndexRef.current = 0;
    if (clearSegments) {
      audioSegmentsRef.current = [];
      setAudioSegments([]);
    }
  };

  const playSegmentAtIndex = (index) => {
    const segments = audioSegmentsRef.current;
    currentSegmentIndexRef.current = index;
    setCurrentSegmentIndex(index);

    if (index >= segments.length) {
      if (isGeneratingAudioRef.current) {
        waitingForNextRef.current = true;
        setIsWaitingForNextSegment(true);
        setIsPlayingAudio(true);
        isPlayingAudioRef.current = true;
      } else {
        stopAudio();
      }
      return;
    }

    const segment = segments[index];
    const segmentUrl =
      typeof segment === "string"
        ? segment
        : segment?.url || segment?.audioUrl || "";

    if (!segmentUrl) {
      playSegmentAtIndex(index + 1);
      return;
    }

    waitingForNextRef.current = false;
    setIsWaitingForNextSegment(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }

    const audio = new Audio(segmentUrl);
    audioRef.current = audio;

    audio.onended = () => {
      playSegmentAtIndex(index + 1);
    };

    audio.onerror = () => {
      setAudioError("Audio playback failed.");
      stopAudio({ cancelGeneration: true, clearSegments: true });
    };

    audio
      .play()
      .then(() => {
        setIsPlayingAudio(true);
        isPlayingAudioRef.current = true;
      })
      .catch((error) => {
        console.error("Audio playback failed:", error);
        setAudioError("Audio playback failed.");
        stopAudio({ cancelGeneration: true, clearSegments: true });
      });
  };

  const handleSpeakerClick = async () => {
    if (!hasSpeakableText) {
      setAudioError("No text to convert to speech.");
      return;
    }

    if (isGeneratingAudioRef.current && !isPlayingAudioRef.current) {
      stopAudio({ cancelGeneration: true, clearSegments: true });
      return;
    }

    if (isGeneratingAudioRef.current) {
      return;
    }

    if (isPlayingAudio) {
      stopAudio({ cancelGeneration: true });
      return;
    }

    setAudioError("");

    if (audioSegmentsRef.current.length > 0) {
      playSegmentAtIndex(currentSegmentIndexRef.current || 0);
      return;
    }

    updateGeneratingState(true);
    generationCancelledRef.current = false;
    audioSegmentsRef.current = [];
    setAudioSegments([]);
    currentSegmentIndexRef.current = 0;
    setCurrentSegmentIndex(0);
    waitingForNextRef.current = false;
    setIsWaitingForNextSegment(false);

    const handleSegmentGenerated = (segment) => {
      if (generationCancelledRef.current) {
        return;
      }

      audioSegmentsRef.current = [...audioSegmentsRef.current, segment];
      setAudioSegments(audioSegmentsRef.current);

      if (!isPlayingAudioRef.current || waitingForNextRef.current) {
        playSegmentAtIndex(currentSegmentIndexRef.current || 0);
      }
    };

    try {
      const options = {};
      if (speakerVoice) {
        options.voice = speakerVoice;
      }

      await requestSpeechAudio(
        speakableText,
        options,
        handleSegmentGenerated
      );

      if (!generationCancelledRef.current && audioSegmentsRef.current.length === 0) {
        setAudioError("Failed to generate audio for this message.");
      }
    } catch (error) {
      if (!generationCancelledRef.current) {
        console.error("Failed to generate speech audio:", error);
        setAudioError(
          error?.message || "Failed to generate audio for this message."
        );
        stopAudio({ cancelGeneration: true, clearSegments: true });
      }
    } finally {
      if (!generationCancelledRef.current) {
        updateGeneratingState(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      generationCancelledRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Reset when text changes
  useEffect(() => {
    generationCancelledRef.current = true;
    stopAudio({ clearSegments: true, cancelGeneration: true });
    updateGeneratingState(false);
  }, [text]);

  return {
    hasSpeakableText,
    isGeneratingAudio,
    isPlayingAudio,
    isWaitingForNextSegment,
    audioError,
    audioSegments,
    currentSegmentIndex,
    handleSpeakerClick,
    stopAudio,
  };
};
