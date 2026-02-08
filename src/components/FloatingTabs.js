/**
 * Floating Tabs Component
 * Displays floating tab buttons when the main tabs scroll out of view
 */

import Button from "react-bootstrap/Button";

/**
 * FloatingTabs component
 * @param {Object} props
 * @param {string} props.currentTab - Currently active tab
 * @param {Function} props.onTabChange - Tab change handler
 * @param {boolean} props.showFloatingTabs - Whether to show floating tabs
 */
export default function FloatingTabs({ currentTab, onTabChange, showFloatingTabs }) {
  if (!showFloatingTabs) {
    return null;
  }

  return (
    <div
      className="floating-tabs-container"
      style={{
        position: "fixed",
        top: "16px",
        left: "16px",
        right: "16px",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        maxWidth: "fit-content",
        margin: "0 auto",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: "8px",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        gap: "8px"
      }}
    >
      <Button
        variant={currentTab === "chatbot" ? "primary" : "outline-primary"}
        size="sm"
        onClick={() => onTabChange("chatbot")}
        style={{
          backgroundColor: currentTab === "chatbot" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(255, 255, 255, 0.5)",
          borderColor: currentTab === "chatbot" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(13, 110, 253, 0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.3s ease",
          color: currentTab === "chatbot" ? "white" : "rgba(13, 110, 253, 0.9)"
        }}
      >
        Chatbot
      </Button>
      <Button
        variant={currentTab === "markdown" ? "primary" : "outline-primary"}
        size="sm"
        onClick={() => onTabChange("markdown")}
        style={{
          backgroundColor: currentTab === "markdown" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(255, 255, 255, 0.5)",
          borderColor: currentTab === "markdown" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(13, 110, 253, 0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.3s ease",
          color: currentTab === "markdown" ? "white" : "rgba(13, 110, 253, 0.9)"
        }}
      >
        Co-Edit
      </Button>
      <Button
        variant={currentTab === "memory" ? "primary" : "outline-primary"}
        size="sm"
        onClick={() => onTabChange("memory")}
        style={{
          backgroundColor: currentTab === "memory" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(255, 255, 255, 0.5)",
          borderColor: currentTab === "memory" 
            ? "rgba(13, 110, 253, 0.8)" 
            : "rgba(13, 110, 253, 0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.3s ease",
          color: currentTab === "memory" ? "white" : "rgba(13, 110, 253, 0.9)"
        }}
      >
        Memory
      </Button>
    </div>
  );
}
