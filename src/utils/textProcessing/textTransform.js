/**
 * Text transformation utilities
 * Functions for processing and transforming text content
 */

/**
 * Escapes currency dollar signs before math processing
 * This prevents currency symbols like $884.10 from being interpreted as LaTeX math
 * 
 * @param {string} text - The text to process
 * @returns {string} - Text with currency dollar signs escaped
 */
export const escapeCurrencyDollars = (text) => {
  if (!text) return text;
  
  // Escape dollar signs that are followed by digits (currency pattern)
  // Pattern: $ followed by one or more digits, optionally with decimal point and more digits
  // We use a negative lookbehind to avoid escaping already-escaped dollar signs
  // The pattern matches: $ followed by digits (with optional decimal/comma separators)
  // This will match $884.10, $879.00, $100, etc., but not $x$ (math expressions)
  return text.replace(
    /(?<!\\)\$(?=\d[\d.,]*)/g,
    "\\$"
  );
};

/**
 * Removes BEGIN marker from the beginning of text
 * Used to filter out special markers from API responses
 * 
 * @param {string} text - The text to filter
 * @returns {string} - Text with BEGIN marker removed
 */
export const removeBeginMarker = (text) => {
  if (!text) return text;
  
  // Only remove BEGIN line at the beginning
  return text.replace(
    /^\s*\$\$\$\s+[^\$]+\s+BEGIN\s+\$\$\$\s*\n/,
    ""
  );
};

/**
 * Replaces @mentions with markdown link format
 * Converts @adrien, @belinda, etc. to [@mention](##) format
 * 
 * @param {string} text - The text to process
 * @returns {string} - Text with mentions replaced
 */
export const replaceMentions = (text) => {
  if (!text) return text;

  // Regular expression to match valid @mentions (case insensitive)
  // This matches @adrien, @belinda, @charlie, @diana with word boundaries
  return text.replace(/@(adrien|belinda|charlie|diana)\b/gi, "[@$1](##)");
};
