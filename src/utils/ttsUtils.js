import { getSubscriptionKey } from "./settingsService";

const TTS_ENDPOINT =
  "https://jp-gw2.azure-api.net/services/aigc/multimodal-generation/services/aigc/multimodal-generation/generation";
const DEFAULT_TTS_MODEL = "qwen3-tts-flash";
const DEFAULT_VOICE = "Cherry";
export const MAX_TTS_INPUT_BYTES = 600;

const containsCJKCharacters = (text) => /[\u3400-\u9fff]/.test(text);

export const sanitizeTextForSpeech = (text = "") => {
  if (!text) {
    return "";
  }

  let sanitized = text;

  // Remove $$$ ROLE BEGIN $$$ / $$$ ROLE END $$$ markers
  sanitized = sanitized.replace(
    /\$\$\$\s*[A-Z0-9_\-\s]*\s*BEGIN\s*\$\$\$\s*/gi,
    ""
  );
  sanitized = sanitized.replace(/\$\$\$\s*[A-Z0-9_\-\s]*\s*END\s*\$\$\$\s*/gi, "");

  // Remove HTML tags
  sanitized = sanitized.replace(/<\/?[^>]+>/g, " ");

  // Replace Markdown images with alt text
  sanitized = sanitized.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Replace Markdown links with link text
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove blockquotes
  sanitized = sanitized.replace(/^\s{0,3}>\s?/gm, "");

  // Strip heading markers
  sanitized = sanitized.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // Strip list markers
  sanitized = sanitized.replace(/^\s{0,3}[-*+]\s+/gm, "\n");
  sanitized = sanitized.replace(/^\s{0,3}\d+\.\s+/gm, "\n");

  // Remove fenced code block markers but keep code content
  sanitized = sanitized.replace(/```([\s\S]*?)```/g, "");

  // Remove inline code markers
  sanitized = sanitized.replace(/`([^`]+)`/g, "$1");

  // Remove bold/italic/strikethrough markers
  sanitized = sanitized.replace(/(\*\*|__)(.*?)\1/g, "$2");
  sanitized = sanitized.replace(/(\*|_)(.*?)\1/g, "$2");
  sanitized = sanitized.replace(/~~(.*?)~~/g, "$1");

  // Collapse multiple whitespace and trim
  sanitized = sanitized.replace(/\r?\n+/g, "\n");
  sanitized = sanitized.replace(/[ \t\f\v]{2,}/gm, " "); // Replace consecutive spaces/tabs (not new lines) with single space

  return sanitized.trim();
};

const resolveLanguageType = (text, override) => {
  if (override) {
    return override;
  }

  if (!text) {
    return "English";
  }

  return containsCJKCharacters(text) ? "Chinese" : "English";
};

const createByteSizedChunks = (segments, byteLimit) => {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    current = "";
  };

  const tryAppend = (segment) => {
    if (!segment) {
      return;
    }
    const candidate = current ? `${current}${segment}` : segment;
    if (encoder.encode(candidate).length <= byteLimit) {
      current = candidate;
      return true;
    }
    return false;
  };

  for (const segment of segments) {
    if (tryAppend(segment)) {
      continue;
    }

    if (current) {
      pushCurrent();
      if (tryAppend(segment)) {
        continue;
      }
    }

    if (encoder.encode(segment).length <= byteLimit) {
      current = segment;
      continue;
    }

    let temp = "";
    for (const char of segment) {
      if (encoder.encode(temp + char).length > byteLimit) {
        if (temp) {
          chunks.push(temp);
        }
        temp = char;
      } else {
        temp += char;
      }
    }
    if (temp) {
      current = temp;
    }
  }

  if (current) {
    pushCurrent();
  }

  return chunks;
};

export const splitTextByByteLimit = (text, byteLimit = MAX_TTS_INPUT_BYTES) => {
  if (!text) {
    return [];
  }

  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= byteLimit) {
    return [text];
  }

  const newlineSegments = [];
  let remaining = text;
  while (remaining.length > 0) {
    const newlineIndex = remaining.indexOf("\n");
    if (newlineIndex === -1) {
      newlineSegments.push(remaining);
      break;
    }
    const segment = remaining.slice(0, newlineIndex + 1);
    newlineSegments.push(segment);
    remaining = remaining.slice(newlineIndex + 1);
  }

  const appenders = [
    (segments) => createByteSizedChunks(segments, byteLimit),
    (segments) => {
      const splitRegex =
        /([。！？?!；;：:]+)(?=\s|$)|([.?!;:]+)(?=\s|$)|([．。！？?!；;：:]+)/g;
      const results = [];
      for (const chunk of segments) {
        if (encoder.encode(chunk).length <= byteLimit) {
          results.push(chunk);
          continue;
        }
        let lastIndex = 0;
        let match;
        while ((match = splitRegex.exec(chunk)) !== null) {
          const boundaryIndex = match.index + match[0].length;
          const candidate = chunk.slice(lastIndex, boundaryIndex);
          if (candidate.trim()) {
            results.push(candidate);
          }
          lastIndex = boundaryIndex;
        }
        if (lastIndex < chunk.length) {
          results.push(chunk.slice(lastIndex));
        }
      }
      return createByteSizedChunks(results, byteLimit);
    },
    (segments) => {
      const punctuationRegex = /([,，、\/\\]+)/g;
      const results = [];
      for (const chunk of segments) {
        if (encoder.encode(chunk).length <= byteLimit) {
          results.push(chunk);
          continue;
        }
        let lastIndex = 0;
        let match;
        while ((match = punctuationRegex.exec(chunk)) !== null) {
          const boundaryIndex = match.index + match[0].length;
          const candidate = chunk.slice(lastIndex, boundaryIndex);
          if (candidate.trim()) {
            results.push(candidate);
          }
          lastIndex = boundaryIndex;
        }
        if (lastIndex < chunk.length) {
          results.push(chunk.slice(lastIndex));
        }
      }
      return createByteSizedChunks(results, byteLimit);
    },
    (segments) => {
      const results = [];
      for (const chunk of segments) {
        if (encoder.encode(chunk).length <= byteLimit) {
          results.push(chunk);
          continue;
        }
        const subSegments = chunk.split(/(\s+)/).filter(Boolean);
        for (const sub of subSegments) {
          results.push(sub);
        }
      }
      return createByteSizedChunks(results, byteLimit);
    },
  ];

  let segments = newlineSegments.length ? newlineSegments : [text];

  for (const splitter of appenders) {
    segments = splitter(segments);
    if (segments.every((segment) => encoder.encode(segment).length <= byteLimit)) {
      break;
    }
  }

  return segments.map((segment) => segment.trim()).filter(Boolean);
};

/**
 * Request speech audio generation for the provided text.
 * @param {string} text - The text that should be converted to audio.
 * @param {{ voice?: string, languageType?: string }} [options]
 * @returns {Promise<{ audioUrl?: string, audioUrls: string[], audioSegments: Array<{ url: string, id?: string, expiresAt?: number }>, sanitizedText: string }>}
 */
export const requestSpeechAudio = async (
  text,
  options = {},
  onSegmentGenerated
) => {
  if (!text || text.trim().length === 0) {
    throw new Error("No text available to convert to speech.");
  }

  const subscriptionKey = getSubscriptionKey();

  if (!subscriptionKey) {
    throw new Error(
      "Missing subscription key. Please set it before using text-to-speech."
    );
  }

  const { voice = DEFAULT_VOICE, languageType } = options;
  const sanitizedText = sanitizeTextForSpeech(text);

  if (!sanitizedText) {
    throw new Error("No readable text available for speech generation.");
  }

  const textChunks = splitTextByByteLimit(sanitizedText);
  if (textChunks.length === 0) {
    throw new Error("Unable to split text for speech generation.");
  }

  const audioSegments = [];

  for (let index = 0; index < textChunks.length; index += 1) {
    const chunk = textChunks[index];
    const resolvedLanguageType = resolveLanguageType(chunk, languageType);

    const requestBody = {
      model: DEFAULT_TTS_MODEL,
      input: {
        text: chunk,
        voice,
        language_type: resolvedLanguageType,
      },
    };

    let response;
    try {
      response = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": subscriptionKey,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkError) {
      throw new Error(
        networkError?.message || "Failed to connect to text-to-speech service."
      );
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch (parseError) {
      throw new Error("Failed to parse text-to-speech response.");
    }

    if (!response.ok) {
      const errorMessage =
        responseJson?.error?.message ||
        responseJson?.message ||
        response.statusText ||
        "Text-to-speech request failed.";
      throw new Error(errorMessage);
    }

    const audioInfo = responseJson?.output?.audio;
    const audioUrl = audioInfo?.url;

    if (!audioUrl) {
      throw new Error("Text-to-speech response did not include an audio URL.");
    }

    const segment = {
      url: audioUrl,
      id: audioInfo?.id,
      expiresAt: audioInfo?.expires_at,
      raw: responseJson,
      text: chunk,
    };

    audioSegments.push(segment);

    if (typeof onSegmentGenerated === "function") {
      try {
        await Promise.resolve(onSegmentGenerated(segment, index));
      } catch (callbackError) {
        console.error("Error in onSegmentGenerated callback:", callbackError);
      }
    }
  }

  return {
    audioUrl: audioSegments[0]?.url,
    audioUrls: audioSegments.map((segment) => segment.url),
    audioSegments,
    sanitizedText,
  };
};