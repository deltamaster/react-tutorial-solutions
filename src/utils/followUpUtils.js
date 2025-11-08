export const sanitizeFollowUpResponse = (text) => {
  if (!text) {
    return "";
  }

  let cleaned = text;

  cleaned = cleaned.replace(
    /\$\$\$\s+[A-Za-z0-9_\-]+\s+BEGIN\s+\$\$\$/gi,
    ""
  );
  cleaned = cleaned.replace(
    /\$\$\$\s+[A-Za-z0-9_\-]+\s+END\s+\$\$\$/gi,
    ""
  );

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|>\s*[-*•])\s*/, "")
        .replace(/^\s*\d+[\.)]\s*/, "")
        .trim()
    )
    .filter((line) => line.length > 0);

  return lines.join("\n");
};

