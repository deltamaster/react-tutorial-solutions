/**
 * Timestamp formatting utilities
 * Functions for formatting timestamps in a user-friendly way
 */

/**
 * Formats timestamp intelligently based on age
 * - Today: shows only time (e.g., "2:30 PM")
 * - This year but not today: shows date and time (e.g., "Jan 15 2:30 PM")
 * - Not current year: shows full date with year and time (e.g., "Jan 15, 2023 2:30 PM")
 * 
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} - Formatted timestamp string
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();

  // Check if timestamp is from today
  const isToday = date.toDateString() === now.toDateString();

  // Check if timestamp is from current year
  const isCurrentYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    // Today: show only time
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (isCurrentYear) {
    // This year but not today: show date and time
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  } else {
    // Not current year: show full date with year and time
    return (
      date.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
};
