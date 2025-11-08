/**
 * Escape special characters in a string so it can be used inside a RegExp.
 * @param {string} value
 * @returns {string}
 */
const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalize "$$$ {NAME} BEGIN $$$" markers in model responses.
 * - Removes duplicate markers scattered across parts.
 * - Ensures a single marker exists at the beginning of the first text part.
 *
 * @param {Array} parts - Model response parts
 * @param {string} personaName - Persona display name expected in the marker
 * @returns {Array} - New array with normalized parts
 */
export const normalizeBeginMarker = (parts = [], personaName) => {
  if (!personaName) {
    return parts;
  }

  const markerRegex = new RegExp(
    `\\$\\$\\$\\s*${escapeRegex(personaName)}\\s+BEGIN\\s+\\$\\$\\$\\s*\\n?`,
    "gi"
  );
  let markerDetected = false;

  const cleanedParts = parts.map((part) => {
    if (!part || typeof part.text !== "string") {
      return part;
    }

    let markerRemovedInPart = false;
    let newText = part.text.replace(markerRegex, () => {
      markerDetected = true;
      markerRemovedInPart = true;
      return "";
    });

    if (markerRemovedInPart) {
      newText = newText.replace(/^\n+/, "");
    }

    if (newText === part.text) {
      return part;
    }

    return { ...part, text: newText };
  });

  if (!markerDetected) {
    return cleanedParts;
  }

  const firstTextIndex = cleanedParts.findIndex(
    (part) => part && typeof part.text === "string" && !part.thought
  );

  if (firstTextIndex === -1) {
    return cleanedParts;
  }

  const normalizedMarker = `$$$ ${personaName} BEGIN $$$\n`;
  const firstPart = cleanedParts[firstTextIndex];
  const currentText = firstPart.text || "";
  const textWithoutLeadingNewlines = currentText.replace(/^\n+/, "");

  cleanedParts[firstTextIndex] = {
    ...firstPart,
    text: normalizedMarker + textWithoutLeadingNewlines,
  };

  return cleanedParts;
};


