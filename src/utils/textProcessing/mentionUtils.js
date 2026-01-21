/**
 * Mention processing utilities
 * Functions for extracting and processing @mentions in text
 */

/**
 * Extracts mentioned roles from message parts
 * 
 * @param {Array} parts - Array of message parts
 * @param {Object} mentionRoleMap - Map of mention strings to role keys
 * @returns {Array} - Array of unique role keys mentioned
 */
export const extractMentionedRolesFromParts = (parts, mentionRoleMap) => {
  const roles = new Set();
  if (!Array.isArray(parts)) {
    return [];
  }

  parts.forEach((part) => {
    if (!part || part.hide || part.thought) {
      return;
    }

    if (!part.text) {
      return;
    }

    const mentionRegex = /@([a-z0-9_]+)/gi;
    let match;
    while ((match = mentionRegex.exec(part.text))) {
      const mentioned = match[1].toLowerCase();
      const mappedRole = mentionRoleMap[mentioned];
      if (mappedRole) {
        roles.add(mappedRole);
      }
    }
  });

  return Array.from(roles);
};
