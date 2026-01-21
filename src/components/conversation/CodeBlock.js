import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ExpandableHtmlBlock from "./ExpandableHtmlBlock";

/**
 * Code block component with syntax highlighting
 * Special handling for HTML code blocks (makes them expandable)
 */
const CodeBlock = ({ language, code }) => {
  // Special handling for HTML code blocks - make them expandable
  if (language === "html") {
    return <ExpandableHtmlBlock code={code} />;
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      className="code-syntax-highlighter"
    >
      {code}
    </SyntaxHighlighter>
  );
};

export default CodeBlock;
