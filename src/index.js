import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";

// Hide loading screen once React is ready
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.remove();
    }, 300); // Match transition duration
  }
};

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hide loading screen after React renders
// Use requestAnimationFrame to ensure DOM is ready
requestAnimationFrame(() => {
  // Small delay to ensure smooth transition
  setTimeout(hideLoadingScreen, 100);
});
