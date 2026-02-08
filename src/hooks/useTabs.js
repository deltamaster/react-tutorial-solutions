/**
 * Custom hook for tabs management
 * Handles tab state and floating tabs visibility when tabs scroll out of view
 * 
 * @returns {Object} Tab state and control functions
 */
import { useState, useEffect, useRef } from 'react';

export const useTabs = (defaultTab = 'chatbot') => {
  const [currentTab, setCurrentTab] = useState(defaultTab);
  const [showFloatingTabs, setShowFloatingTabs] = useState(false);
  const tabsRef = useRef(null);

  // Handle scroll to show/hide floating tabs
  useEffect(() => {
    const handleScroll = () => {
      if (tabsRef.current) {
        const tabsRect = tabsRef.current.getBoundingClientRect();
        // Show floating tabs when tabs are not fully visible at the top
        setShowFloatingTabs(tabsRect.top < 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    // Initial check with timeout to ensure DOM is fully rendered
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return {
    currentTab,
    setCurrentTab,
    showFloatingTabs,
    tabsRef,
  };
};
