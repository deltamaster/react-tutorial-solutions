import { useEffect } from "react";
import mermaid from "mermaid";

/**
 * Initialize mermaid configuration
 */
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose", // Allow more features
  suppressErrorRendering: true, // Prevent error messages from being appended to the DOM
});

/**
 * Reusable function to render a single mermaid diagram
 * 
 * @param {HTMLElement} element - DOM element containing mermaid code
 */
const renderMermaidDiagram = async (element) => {
  try {
    const graphCode =
      element.getAttribute("data-mermaid-content") ||
      element.textContent.trim();
    const uniqueId = `mermaid-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const { svg } = await mermaid.render(uniqueId, graphCode);
    element.innerHTML = svg;
  } catch (err) {
    console.error("Error rendering individual mermaid diagram:", err);
    // Optionally show error message to user
  }
};

/**
 * Custom hook for Mermaid diagram rendering
 * Automatically renders mermaid diagrams when dependencies change
 * 
 * @param {Array} dependencies - Dependencies that trigger re-rendering (e.g., history, editingIndex)
 */
export const useMermaid = (dependencies = []) => {
  useEffect(() => {
    // Debug log
    console.debug("useEffect for mermaid rendering triggered");

    // Initialize mermaid
    if (mermaid && document) {
      console.debug("Mermaid library available, starting rendering process");
      let timer;

      // Use setTimeout to delay rendering to ensure DOM is fully loaded
      timer = setTimeout(() => {
        try {
          // Select all mermaid elements
          const allMermaidElements = document.querySelectorAll(".mermaid");
          console.debug(
            "Found total mermaid elements:",
            allMermaidElements.length
          );

          // Set data-mermaid-content attribute for elements that don't have it
          allMermaidElements.forEach((element) => {
            if (!element.hasAttribute("data-mermaid-content")) {
              const graphCode = element.textContent.trim();
              element.setAttribute("data-mermaid-content", graphCode);
            }
          });

          // Render all mermaid elements uniformly
          allMermaidElements.forEach((element) => {
            renderMermaidDiagram(element);
          });
        } catch (error) {
          console.error("Error in mermaid rendering process:", error);
        }
      }, 200); // Slightly increased delay to ensure DOM is fully updated

      // Clean up timer
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, dependencies);
};

/**
 * Mermaid diagram component
 * 
 * @param {string} content - Mermaid diagram code
 */
export const MermaidDiagram = ({ content }) => {
  return (
    <div className="mermaid" data-mermaid-content={content}>
      {content}
    </div>
  );
};
