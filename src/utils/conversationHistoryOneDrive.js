/**
 * OneDrive-backed conversation history search for tooling (e.g. Adrien).
 * Uses Microsoft Graph via existing sync helpers: index.json and conversation-{uuid}.json under .chatsphere/conversations/.
 */

import { getOneDriveAccessToken } from "../services/sync/onedriveClient";
import { fetchConversationsIndex, fetchConversation } from "../services/sync/fileService";
import {
  listConversationTitles,
  searchConversationTitles,
  searchConversationPartsByKeyword,
  searchConversationPartsByTimeRange,
  getConversationPart,
} from "./conversationHistorySearch";

/**
 * @param {string | null | undefined} explicitToken If provided, used as-is (caller already acquired Graph token).
 * @returns {Promise<string>}
 */
async function resolveAccessToken(explicitToken) {
  if (explicitToken) {
    return explicitToken;
  }
  const token = await getOneDriveAccessToken();
  if (!token) {
    throw new Error(
      "OneDrive access token unavailable. Sign in and ensure conversation sync / OneDrive access is configured."
    );
  }
  return token;
}

/**
 * List saved conversation titles (from remote index.json).
 * @param {string | null | undefined} [accessToken] Optional; otherwise uses {@link getOneDriveAccessToken}.
 * @returns {Promise<Array<{ title: string, tags: string[], conversationUuid: string }>>}
 */
export async function listConversationTitlesFromOneDrive(accessToken) {
  const token = await resolveAccessToken(accessToken);
  const index = await fetchConversationsIndex(token);
  return listConversationTitles(index);
}

/**
 * Search conversation titles/tags (from remote index.json).
 * @param {string} keyword
 * @param {string | null | undefined} [accessToken]
 * @returns {Promise<Array<{ title: string, tags: string[], conversationUuid: string }>>}
 */
export async function searchConversationTitlesFromOneDrive(keyword, accessToken) {
  const token = await resolveAccessToken(accessToken);
  const index = await fetchConversationsIndex(token);
  return searchConversationTitles(index, keyword);
}

/**
 * @typedef {Object} ConversationPartSearchFromOneDriveOptions
 * @property {string | null | undefined} [accessToken] Graph token; resolved via MSAL when omitted.
 * @property {number} [snippetRadius] Passed through to {@link searchConversationPartsByKeyword}.
 */

/**
 * Keyword search within one conversation file on OneDrive.
 * @param {string} conversationUuid Index / file id (conversation-{uuid}.json)
 * @param {string} keyword
 * @param {ConversationPartSearchFromOneDriveOptions} [options]
 * @returns {Promise<Array<{ role: string, name?: string, parts: string[], timestamp: number, partUuid?: string }>>}
 */
export async function searchConversationPartsByKeywordFromOneDrive(
  conversationUuid,
  keyword,
  options = {}
) {
  const { accessToken, snippetRadius } = options;
  const token = await resolveAccessToken(accessToken);
  const data = await fetchConversation(token, conversationUuid);
  if (!data) {
    return [];
  }
  return searchConversationPartsByKeyword(data, keyword, {
    conversationUuid,
    ...(snippetRadius !== undefined ? { snippetRadius } : {}),
  });
}

/**
 * @typedef {Object} ConversationPartTimeRangeFromOneDriveOptions
 * @property {string | null | undefined} [accessToken]
 */

/**
 * List text parts in a time window (loads one conversation file from OneDrive).
 * @param {string} conversationUuid
 * @param {number | Date | string} rangeStart
 * @param {number | Date | string} rangeEnd
 * @param {ConversationPartTimeRangeFromOneDriveOptions} [options]
 * @returns {Promise<Array<{ role: string, name?: string, partUuid: string, timestamp: number }>>}
 */
export async function searchConversationPartsByTimeRangeFromOneDrive(
  conversationUuid,
  rangeStart,
  rangeEnd,
  options = {}
) {
  const { accessToken } = options;
  const token = await resolveAccessToken(accessToken);
  const data = await fetchConversation(token, conversationUuid);
  if (!data) {
    return [];
  }
  return searchConversationPartsByTimeRange(data, rangeStart, rangeEnd, {
    conversationUuid,
  });
}

/**
 * @typedef {Object} GetConversationPartFromOneDriveOptions
 * @property {string | null | undefined} [accessToken]
 */

/**
 * Fetch one part by UUID from the conversation file on OneDrive.
 * @param {string} conversationUuid
 * @param {string} partUuid
 * @param {GetConversationPartFromOneDriveOptions} [options]
 * @returns {Promise<{ role: string, name?: string, parts: string, timestamp: number } | null>}
 */
export async function getConversationPartFromOneDrive(conversationUuid, partUuid, options = {}) {
  const { accessToken } = options;
  const token = await resolveAccessToken(accessToken);
  const data = await fetchConversation(token, conversationUuid);
  if (!data) {
    return null;
  }
  return getConversationPart(data, partUuid, { conversationUuid });
}
