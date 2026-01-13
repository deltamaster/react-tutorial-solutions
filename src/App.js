import React from 'react';
import AppContent from './components/AppContent';
import Snowfall from './components/Snowfall';

// Main application component
function ChatSphereApp() {
  return (
    <div className="App">
      <Snowfall />
      <AppContent />
    </div>
  );
}

export default ChatSphereApp;
