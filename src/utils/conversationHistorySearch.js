/**
 * Pure utilities for searching saved conversation history (index.json + per-conversation exports).
 * Callers load JSON from disk/OneDrive and pass parsed objects; these functions do no I/O.
 */

/** Default characters before/after a keyword for snippet windows (≈30 chars around the match, excluding the keyword span). */
const DEFAULT_SNIPPET_RADIUS = 15;

/**
 * @typedef {Object} ConversationTitleRow
 * @property {string} title
 * @property {string[]} tags
 * @property {string} conversationUuid
 */

/**
 * @typedef {Object} ConversationPartKeywordMatch
 * @property {string} role
 * @property {string} [name]
 * @property {string[]} parts Snippets around each non-overlapping match in this text part (one row per part).
 * @property {number} timestamp Effective timestamp (ms) for the part or message.
 * @property {string} [partUuid]
 */

/**
 * @typedef {Object} ConversationPartTimeRow
 * @property {string} role
 * @property {string} [name]
 * @property {string} partUuid
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ConversationPartDetail
 * @property {string} role
 * @property {string} [name]
 * @property {string} parts Full text-only content of the matched part.
 * @property {number} timestamp
 */

/**
 * Normalize index payload: supports `{ conversations: [...] }`.
 * @param {unknown} indexData
 * @returns {{ conversations: Array<{ id?: string, name?: string, tags?: string[] }> }}
 */
function normalizeIndex(indexData) {
  if (!indexData || typeof indexData !== "object") {
    return { conversations: [] };
  }
  const raw = /** @type {{ conversations?: unknown }} */ (indexData);
  const list = Array.isArray(raw.conversations) ? raw.conversations : [];
  return { conversations: list };
}

/**
 * List all conversation titles from index.json (parsed).
 * @param {unknown} indexData Parsed index.json
 * @returns {ConversationTitleRow[]}
 */
export function listConversationTitles(indexData) {
  const { conversations } = normalizeIndex(indexData);
  return conversations.map((c) => ({
    title: typeof c.name === "string" ? c.name : "",
    tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string") : [],
    conversationUuid: typeof c.id === "string" ? c.id : "",
  }));
}

/**
 * Search conversations by keyword in title or tags (case-insensitive).
 * @param {unknown} indexData Parsed index.json
 * @param {string} keyword
 * @returns {ConversationTitleRow[]}
 */
export function searchConversationTitles(indexData, keyword) {
  const rows = listConversationTitles(indexData);
  const q = (keyword ?? "").trim().toLowerCase();
  if (!q) {
    return rows;
  }
  return rows.filter((row) => {
    if (row.title.toLowerCase().includes(q)) {
      return true;
    }
    return row.tags.some((t) => t.toLowerCase().includes(q));
  });
}

/**
 * Extract the conversation message array from a full export object or a raw array.
 * @param {unknown} conversationData Parsed conversation-*.json or `conversation` array
 * @returns {Array<Record<string, unknown>>}
 */
export function getConversationMessages(conversationData) {
  if (!conversationData) {
    return [];
  }
  if (Array.isArray(conversationData)) {
    return /** @type {Array<Record<string, unknown>>} */ (conversationData);
  }
  if (typeof conversationData === "object" && Array.isArray(/** @type {{ conversation?: unknown }} */(conversationData).conversation)) {
    return /** @type {Array<Record<string, unknown>>} */ (
      /** @type {{ conversation: unknown[] }} */ (conversationData).conversation
    );
  }
  return [];
}

/**
 * @param {string} text
 * @param {number} matchIndex
 * @param {number} keywordLength
 * @param {number} radius
 */
function snippetAroundMatch(text, matchIndex, keywordLength, radius) {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + keywordLength + radius);
  return text.slice(start, end);
}

/**
 * Non-overlapping matches for keyword in text (case-insensitive).
 * @param {string} text
 * @param {string} keyword
 * @returns {number[]}
 */
function matchIndicesNonOverlapping(text, keyword) {
  if (!keyword) {
    return [];
  }
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const indices = [];
  let pos = 0;
  while (pos <= lowerText.length - lowerKw.length) {
    const idx = lowerText.indexOf(lowerKw, pos);
    if (idx === -1) {
      break;
    }
    indices.push(idx);
    pos = idx + lowerKw.length;
  }
  return indices;
}

/**
 * Search text parts in one conversation for a keyword. Returns one row per text part that matches;
 * multiple matches in the same part are combined into one result with `parts` as an array of snippets.
 * @param {unknown} conversationData Parsed conversation JSON (export with `conversation` or message array)
 * @param {string} keyword
 * @param {{ conversationUuid?: string, snippetRadius?: number }} [options]
 * @returns {ConversationPartKeywordMatch[]}
 */
export function searchConversationPartsByKeyword(conversationData, keyword, options = {}) {
  const { conversationUuid, snippetRadius = DEFAULT_SNIPPET_RADIUS } = options;
  const kw = (keyword ?? "").trim();
  if (!kw) {
    return [];
  }

  if (
    conversationUuid &&
    typeof conversationData === "object" &&
    conversationData !== null &&
    "id" in conversationData &&
    typeof /** @type {{ id?: string }} */ (conversationData).id === "string" &&
    /** @type {{ id?: string }} */ (conversationData).id !== conversationUuid
  ) {
    return [];
  }

  const messages = getConversationMessages(conversationData);
  const out = [];

  for (const message of messages) {
    if (message.deleted) {
      continue;
    }
    const role = typeof message.role === "string" ? message.role : "";
    const name = typeof message.name === "string" ? message.name : undefined;
    const messageTs =
      typeof message.timestamp === "number" ? message.timestamp : undefined;
    const parts = Array.isArray(message.parts) ? message.parts : [];

    for (const part of parts) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const p = /** @type {{ text?: unknown, timestamp?: unknown, uuid?: unknown }} */ (part);
      if (typeof p.text !== "string") {
        continue;
      }
      const text = p.text;
      const indices = matchIndicesNonOverlapping(text, kw);
      if (indices.length === 0) {
        continue;
      }
      const partUuid = typeof p.uuid === "string" ? p.uuid : undefined;
      const partTs = typeof p.timestamp === "number" ? p.timestamp : messageTs;
      const timestamp = typeof partTs === "number" ? partTs : 0;

      const partSnippets = indices.map((idx) =>
        snippetAroundMatch(text, idx, kw.length, snippetRadius)
      );
      out.push({
        role,
        ...(name !== undefined ? { name } : {}),
        parts: partSnippets,
        timestamp,
        ...(partUuid !== undefined ? { partUuid } : {}),
      });
    }
  }

  return out;
}

/**
 * @param {unknown} t
 * @returns {number | null}
 */
function toTimestampMs(t) {
  if (typeof t === "number" && !Number.isNaN(t)) {
    return t;
  }
  if (t instanceof Date && !Number.isNaN(t.getTime())) {
    return t.getTime();
  }
  if (typeof t === "string") {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) {
      return ms;
    }
  }
  return null;
}

/**
 * List text parts whose effective timestamp falls in [rangeStart, rangeEnd] (inclusive).
 * @param {unknown} conversationData
 * @param {number|Date|string} rangeStart
 * @param {number|Date|string} rangeEnd
 * @param {{ conversationUuid?: string }} [options]
 * @returns {ConversationPartTimeRow[]}
 */
export function searchConversationPartsByTimeRange(conversationData, rangeStart, rangeEnd, options = {}) {
  const { conversationUuid } = options;
  const startMs = toTimestampMs(rangeStart);
  const endMs = toTimestampMs(rangeEnd);
  if (startMs === null || endMs === null || startMs > endMs) {
    return [];
  }

  if (
    conversationUuid &&
    typeof conversationData === "object" &&
    conversationData !== null &&
    "id" in conversationData &&
    typeof /** @type {{ id?: string }} */ (conversationData).id === "string" &&
    /** @type {{ id?: string }} */ (conversationData).id !== conversationUuid
  ) {
    return [];
  }

  const messages = getConversationMessages(conversationData);
  const out = [];

  for (const message of messages) {
    if (message.deleted) {
      continue;
    }
    const role = typeof message.role === "string" ? message.role : "";
    const name = typeof message.name === "string" ? message.name : undefined;
    const messageTs =
      typeof message.timestamp === "number" ? message.timestamp : undefined;
    const parts = Array.isArray(message.parts) ? message.parts : [];

    for (const part of parts) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const p = /** @type {{ text?: unknown, timestamp?: unknown, uuid?: unknown }} */ (part);
      if (typeof p.text !== "string") {
        continue;
      }
      const partUuid = typeof p.uuid === "string" ? p.uuid : null;
      if (!partUuid) {
        continue;
      }
      const partTs = typeof p.timestamp === "number" ? p.timestamp : messageTs;
      if (typeof partTs !== "number") {
        continue;
      }
      if (partTs < startMs || partTs > endMs) {
        continue;
      }
      out.push({
        role,
        ...(name !== undefined ? { name } : {}),
        partUuid,
        timestamp: partTs,
      });
    }
  }

  return out;
}

/**
 * Full text for one part by part UUID (first occurrence).
 * @param {unknown} conversationData Parsed conversation JSON for the given conversation
 * @param {string} partUuid
 * @param {{ conversationUuid?: string }} [options] If `conversationUuid` is set, must match `conversationData.id` when present
 * @returns {ConversationPartDetail | null}
 */
export function getConversationPart(conversationData, partUuid, options = {}) {
  const { conversationUuid } = options;
  const id = (partUuid ?? "").trim();
  if (!id) {
    return null;
  }

  if (
    conversationUuid &&
    typeof conversationData === "object" &&
    conversationData !== null &&
    "id" in conversationData &&
    typeof /** @type {{ id?: string }} */ (conversationData).id === "string" &&
    /** @type {{ id?: string }} */ (conversationData).id !== conversationUuid
  ) {
    return null;
  }

  const messages = getConversationMessages(conversationData);

  for (const message of messages) {
    if (message.deleted) {
      continue;
    }
    const role = typeof message.role === "string" ? message.role : "";
    const name = typeof message.name === "string" ? message.name : undefined;
    const messageTs =
      typeof message.timestamp === "number" ? message.timestamp : undefined;
    const parts = Array.isArray(message.parts) ? message.parts : [];

    for (const part of parts) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const p = /** @type {{ text?: unknown, timestamp?: unknown, uuid?: unknown }} */ (part);
      if (p.uuid !== id) {
        continue;
      }
      const partTs = typeof p.timestamp === "number" ? p.timestamp : messageTs;
      const content = typeof p.text === "string" ? p.text : "";
      return {
        role,
        ...(name !== undefined ? { name } : {}),
        parts: content,
        timestamp: typeof partTs === "number" ? partTs : 0,
      };
    }
  }

  return null;
}
