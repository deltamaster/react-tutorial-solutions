import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

/**
 * Expandable HTML code block component
 * Shows first line with expand option for longer HTML content
 */
const ExpandableHtmlBlock = ({ code }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the first line of HTML for preview
  const firstLine = code.split("\n")[0];
  const hasMoreContent = code.includes("\n");

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="html-code-container">
      <div className="html-code-header">
        <span className="html-label">HTML Content</span>
        <button
          onClick={toggleExpand}
          className="expand-toggle-button"
          title={isExpanded ? "Collapse HTML" : "Expand HTML"}
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <div
        className={`html-code-content ${isExpanded ? "expanded" : "collapsed"}`}
        onClick={hasMoreContent && !isExpanded ? toggleExpand : undefined}
      >
        {!isExpanded && hasMoreContent ? (
          <>
            <SyntaxHighlighter
              language="html"
              style={vscDarkPlus}
              className="code-syntax-highlighter html-preview"
            >
              {firstLine}
            </SyntaxHighlighter>
            <div className="html-fade-effect"></div>
            <div className="html-expand-hint">
              Click to expand HTML content...
            </div>
          </>
        ) : (
          <SyntaxHighlighter
            language="html"
            style={vscDarkPlus}
            className="code-syntax-highlighter"
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

export default ExpandableHtmlBlock;
