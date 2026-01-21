import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { escapeCurrencyDollars, removeBeginMarker, replaceMentions } from "./textTransform";

/**
 * Markdown processing utilities
 * Functions for rendering markdown content with code blocks, mermaid diagrams, etc.
 */

/**
 * Renders text content with support for mixed content (markdown, code blocks, mermaid)
 * Processes code blocks separately from markdown text
 * 
 * @param {string} text - The text content to render
 * @param {Function} ExpandableHtmlBlock - Component for rendering expandable HTML blocks
 * @returns {React.ReactElement|null} - Rendered content or null if text is empty
 */
export const renderTextContent = (text, ExpandableHtmlBlock) => {
  if (!text) return null;

  // Remove BEGIN marker and escape currency dollar signs
  let filteredText = removeBeginMarker(text);
  filteredText = escapeCurrencyDollars(filteredText);

  // Process mixed content: Split text by code blocks and render separately
  // Use regular expressions to match all code blocks (including mermaid and regular code blocks)
  const parts = [];
  const codeBlockRegex = /```(mermaid|\w+)[\s\S]*?```/g;
  let lastIndex = 0;
  let match;

  // Find all code blocks and split filtered text
  while ((match = codeBlockRegex.exec(filteredText)) !== null) {
    // Add regular text before code block (if any)
    if (match.index > lastIndex) {
      const nonCodeText = filteredText.slice(lastIndex, match.index);
      // Only trim if the text is not empty after trimming
      const trimmedText = nonCodeText.trim();
      if (trimmedText) {
        // Replace @mentions in non-code text (preserve original whitespace structure)
        const textWithReplacedMentions = replaceMentions(nonCodeText);
        parts.push(
          <Markdown
            key={`md-${parts.length}`}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {textWithReplacedMentions}
          </Markdown>
        );
      }
    }

    // Process code block (keep unchanged - don't replace mentions inside code blocks)
    const fullCodeBlock = match[0];
    const language = match[1];

    if (language === "mermaid") {
      // Extract mermaid content
      const mermaidMatch = fullCodeBlock.match(/```mermaid([\s\S]*?)```/);
      if (mermaidMatch && mermaidMatch[1]) {
        parts.push(
          <div
            key={`mermaid-${parts.length}`}
            className="mermaid"
            data-mermaid-content={mermaidMatch[1].trim()}
          >
            {mermaidMatch[1].trim()}
          </div>
        );
      }
    } else {
      // Extract regular code block content
      const codeMatch = fullCodeBlock.match(/```\w+([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        // Special handling for HTML code blocks - use ExpandableHtmlBlock
        if (language === "html") {
          parts.push(
            <div key={`html-${parts.length}`}>
              <ExpandableHtmlBlock code={codeMatch[1].trim()} />
            </div>
          );
        } else {
          parts.push(
            <SyntaxHighlighter
              key={`code-${parts.length}`}
              language={language}
              style={vscDarkPlus}
              className="code-syntax-highlighter"
            >
              {codeMatch[1].trim()}
            </SyntaxHighlighter>
          );
        }
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add regular text after the last code block (if any)
  if (lastIndex < filteredText.length) {
    const nonCodeText = filteredText.slice(lastIndex);
    // Only check if text exists after trimming, but preserve original whitespace
    const trimmedText = nonCodeText.trim();
    if (trimmedText) {
      // Replace @mentions in non-code text (preserve original whitespace structure)
      const textWithReplacedMentions = replaceMentions(nonCodeText);
      parts.push(
        <Markdown
          key={`md-${parts.length}`}
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {textWithReplacedMentions}
        </Markdown>
      );
    }
  }

  // If no code blocks are found, just replace mentions in the filtered text
  if (parts.length === 0) {
    const textWithReplacedMentions = replaceMentions(filteredText);
    return (
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {textWithReplacedMentions}
      </Markdown>
    );
  }

  // Return combination of all parts
  return <div className="mixed-content">{parts}</div>;
};
