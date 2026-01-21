/**
 * Grounding data component to display sources/references
 */
const GroundingData = ({ groundingChunks }) => {
  if (!groundingChunks || groundingChunks.length === 0) {
    return null;
  }

  return (
    <div className="grounding-container">
      <div className="grounding-title">Sources:</div>
      <div className="grounding-links">
        {groundingChunks.map((chunk, idx) => (
          <div key={idx}>
            {chunk.web?.uri ? (
              <a
                href={chunk.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="grounding-link"
              >
                {idx + 1}: {chunk.web?.title}
              </a>
            ) : (
              <span className="grounding-link-disabled">
                {idx + 1}: {chunk.web?.title}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroundingData;
