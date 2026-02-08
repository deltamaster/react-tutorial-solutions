/**
 * Custom hook for floating menu state management
 * Handles floating menu visibility, open/close state, and click-outside detection
 * 
 * @returns {Object} Floating menu state and control functions
 */
import { useState, useEffect, useRef } from 'react';

export const useFloatingMenu = () => {
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [isFloatingMenuOpen, setIsFloatingMenuOpen] = useState(false);
  const [isConversationSelectorOpen, setIsConversationSelectorOpen] = useState(false);
  const floatingMenuRef = useRef(null);

  // Detect scroll to show/hide floating menu
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // Show floating menu when scrolled down more than 100px
      setShowFloatingMenu(scrollY > 100);
      // Close menu when scrolling back to top
      if (scrollY <= 100) {
        setIsFloatingMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close floating menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (floatingMenuRef.current && !floatingMenuRef.current.contains(event.target)) {
        setIsFloatingMenuOpen(false);
      }
    };

    if (isFloatingMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFloatingMenuOpen]);

  return {
    showFloatingMenu,
    setShowFloatingMenu,
    isFloatingMenuOpen,
    setIsFloatingMenuOpen,
    isConversationSelectorOpen,
    setIsConversationSelectorOpen,
    floatingMenuRef,
  };
};
