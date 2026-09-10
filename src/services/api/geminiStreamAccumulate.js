import { mergeAdjacentThoughtParts } from "../conversationService";

export function createStreamAccumulator() {
  return {
    responseMeta: {},
    candidateMeta: {},
    partAccumulator: [],
    responseStarted: false,
  };
}

const BEGIN_MARKER_REGEX = /\$\$\$\s+[\w.]+\s+BEGIN\s+\$\$\$\s*\n?/i;

function splitAtBeginMarker(text) {
  const match = text.match(BEGIN_MARKER_REGEX);
  if (!match) {
    return { before: text, after: "", hasMarker: false };
  }
  const markerIndex = text.search(BEGIN_MARKER_REGEX);
  return {
    before: text.slice(0, markerIndex),
    after: text.slice(markerIndex + match[0].length),
    hasMarker: true,
  };
}

function getOrCreateThoughtPart(accumulator) {
  const thoughtIndex = accumulator.partAccumulator.findIndex(
    (part) => part && part.thought === true && !part.functionCall
  );
  if (thoughtIndex !== -1) {
    return accumulator.partAccumulator[thoughtIndex];
  }

  const newIndex = accumulator.partAccumulator.length;
  accumulator.partAccumulator[newIndex] = {
    text: "",
    thought: true,
  };
  return accumulator.partAccumulator[newIndex];
}

function getOrCreateResponsePartIndex(accumulator) {
  const existingIndex = accumulator.partAccumulator.findIndex(
    (part) =>
      part &&
      part.thought !== true &&
      !part.functionCall &&
      !part.executableCode &&
      !part.codeExecutionResult &&
      typeof part.text === "string"
  );
  if (existingIndex !== -1) {
    return existingIndex;
  }

  return accumulator.partAccumulator.length;
}

function mergeStreamPartFields(existing, part) {
  if (part.thought !== undefined) {
    existing.thought = part.thought;
  }
  if (part.thoughtSignature) {
    existing.thoughtSignature = part.thoughtSignature;
  }
  if (part.inlineData) {
    existing.inlineData = part.inlineData;
  }
}

function mergeFunctionCall(existingCall, incomingCall) {
  if (!incomingCall) {
    return existingCall;
  }
  if (!existingCall) {
    return {
      ...incomingCall,
      args:
        incomingCall.args && typeof incomingCall.args === "object"
          ? { ...incomingCall.args }
          : incomingCall.args,
    };
  }

  let mergedArgs = existingCall.args;
  if (typeof incomingCall.args === "string" && typeof existingCall.args === "string") {
    mergedArgs = `${existingCall.args}${incomingCall.args}`;
  } else if (incomingCall.args && typeof incomingCall.args === "object") {
    mergedArgs = {
      ...(existingCall.args && typeof existingCall.args === "object"
        ? existingCall.args
        : {}),
      ...incomingCall.args,
    };
  }

  return {
    ...existingCall,
    ...incomingCall,
    name: incomingCall.name || existingCall.name,
    id: incomingCall.id || existingCall.id,
    args: mergedArgs,
  };
}

function isThoughtSignatureOnlyPart(part) {
  return Boolean(
    part?.thoughtSignature &&
      !part.text &&
      !part.functionCall &&
      !part.executableCode &&
      !part.codeExecutionResult &&
      !part.inlineData
  );
}

function findMatchingNonTextPartIndex(accumulator, part) {
  if (part.functionCall) {
    return accumulator.partAccumulator.findIndex((existing) => {
      if (!existing?.functionCall) {
        return false;
      }
      const existingName = existing.functionCall.name;
      const incomingName = part.functionCall.name;
      return !existingName || !incomingName || existingName === incomingName;
    });
  }
  if (part.executableCode) {
    return accumulator.partAccumulator.findIndex((existing) => existing?.executableCode);
  }
  if (part.codeExecutionResult) {
    return accumulator.partAccumulator.findIndex(
      (existing) => existing?.codeExecutionResult
    );
  }
  return -1;
}

function mergeNonTextPart(existing, part) {
  if (part.functionCall) {
    existing.functionCall = mergeFunctionCall(existing.functionCall, part.functionCall);
  }
  if (part.executableCode) {
    existing.executableCode = {
      ...existing.executableCode,
      ...part.executableCode,
      code: `${existing.executableCode?.code || ""}${part.executableCode.code || ""}`,
    };
  }
  if (part.codeExecutionResult) {
    existing.codeExecutionResult = {
      ...existing.codeExecutionResult,
      ...part.codeExecutionResult,
      output: `${existing.codeExecutionResult?.output || ""}${
        part.codeExecutionResult.output || ""
      }`,
    };
  }
  mergeStreamPartFields(existing, part);
}

function appendNonTextPart(accumulator, part) {
  const existingIndex = findMatchingNonTextPartIndex(accumulator, part);
  if (existingIndex !== -1) {
    mergeNonTextPart(accumulator.partAccumulator[existingIndex], part);
    return;
  }

  const nextPart = { ...part };
  if (part.functionCall) {
    nextPart.functionCall = mergeFunctionCall(undefined, part.functionCall);
    delete nextPart.thought;
  }
  accumulator.partAccumulator.push(nextPart);
}

function appendToResponsePart(accumulator, text, partMeta = {}) {
  if (!text) {
    return;
  }
  const responseIndex = getOrCreateResponsePartIndex(accumulator);
  if (!accumulator.partAccumulator[responseIndex]) {
    accumulator.partAccumulator[responseIndex] = {
      text: "",
      thought: false,
    };
  }
  const responsePart = accumulator.partAccumulator[responseIndex];
  responsePart.text = `${responsePart.text || ""}${text}`;
  responsePart.thought = false;
  mergeStreamPartFields(responsePart, partMeta);
  accumulator.responseStarted = true;
}

function appendStreamText(accumulator, incomingText, partMeta = {}) {
  if (!incomingText) {
    return;
  }

  if (partMeta.thought === false || accumulator.responseStarted) {
    appendToResponsePart(accumulator, incomingText, partMeta);
    return;
  }

  const thoughtPart = getOrCreateThoughtPart(accumulator);
  const combined = `${thoughtPart.text || ""}${incomingText}`;
  const { before, after, hasMarker } = splitAtBeginMarker(combined);

  thoughtPart.text = before;
  thoughtPart.thought = true;
  mergeStreamPartFields(thoughtPart, partMeta);

  if (hasMarker) {
    accumulator.responseStarted = true;
    appendToResponsePart(accumulator, after, partMeta);
  }
}

export function applyStreamChunk(accumulator, chunk) {
  if (!chunk || typeof chunk !== "object") {
    return;
  }

  accumulator.responseMeta = {
    ...accumulator.responseMeta,
    ...(chunk.modelVersion ? { modelVersion: chunk.modelVersion } : {}),
    ...(chunk.responseId ? { responseId: chunk.responseId } : {}),
    ...(chunk.usageMetadata ? { usageMetadata: chunk.usageMetadata } : {}),
  };

  const candidate = chunk.candidates?.[0];
  if (!candidate) {
    return;
  }

  accumulator.candidateMeta = {
    ...accumulator.candidateMeta,
    ...(candidate.finishReason ? { finishReason: candidate.finishReason } : {}),
    ...(candidate.finishMessage ? { finishMessage: candidate.finishMessage } : {}),
    ...(candidate.groundingMetadata
      ? { groundingMetadata: candidate.groundingMetadata }
      : {}),
  };

  const parts = candidate.content?.parts || [];
  parts.forEach((part) => {
    if (isThoughtSignatureOnlyPart(part)) {
      const thoughtPart = getOrCreateThoughtPart(accumulator);
      thoughtPart.thoughtSignature = part.thoughtSignature;
      thoughtPart.thought = true;
      return;
    }

    const hasRenderableContent =
      part.text ||
      part.functionCall ||
      part.executableCode ||
      part.codeExecutionResult ||
      part.inlineData;
    if (!hasRenderableContent) {
      return;
    }

    if (part.text) {
      if (part.thought === true) {
        appendStreamText(accumulator, part.text, part);
      } else if (part.thought === false || accumulator.responseStarted) {
        appendToResponsePart(accumulator, part.text, part);
      } else {
        appendStreamText(accumulator, part.text, part);
      }
      return;
    }

    appendNonTextPart(accumulator, part);
  });
}

export function buildStreamResponse(accumulator) {
  if (accumulator.partAccumulator.length === 0 && !accumulator.candidateMeta.finishReason) {
    return null;
  }

  const mergedParts = mergeAdjacentThoughtParts(
    accumulator.partAccumulator.filter(Boolean)
  );

  return {
    ...accumulator.responseMeta,
    candidates: [
      {
        ...accumulator.candidateMeta,
        content: {
          role: "model",
          parts: mergedParts,
        },
      },
    ],
  };
}

function processSseLine(line, onEvent) {
  if (!line.startsWith("data: ")) {
    return;
  }
  const payload = line.slice(6).trim();
  if (!payload) {
    return;
  }
  onEvent(JSON.parse(payload));
}

export async function consumeGeminiSseStream(response, onEvent) {
  if (!response.body) {
    throw new Error("Streaming response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      if (buffer) {
        buffer.split("\n").forEach((line) => processSseLine(line, onEvent));
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      processSseLine(line, onEvent);
    }
  }
}

export async function handleGeminiStreamingResponse(response, onStreamUpdate) {
  const accumulator = createStreamAccumulator();

  await consumeGeminiSseStream(response, (chunk) => {
    applyStreamChunk(accumulator, chunk);
    if (typeof onStreamUpdate === "function") {
      const partialResponse = buildStreamResponse(accumulator);
      if (partialResponse) {
        onStreamUpdate(partialResponse);
      }
    }
  });

  const responseObj = buildStreamResponse(accumulator);
  if (!responseObj?.candidates?.length) {
    throw new Error("No candidates in streaming response");
  }

  return responseObj;
}
