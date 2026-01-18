import React from 'react';
import AppContent from './components/AppContent';
import Snowfall from './components/Snowfall';
import { AuthProvider } from './contexts/AuthContext';

// Main application component
function ChatSphereApp() {
  return (
    <AuthProvider>
      <div className="App">
        <Snowfall />
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default ChatSphereApp;
