import React from 'react';
import AppContent from './components/AppContent';
import Snowfall from './components/Snowfall';

// Main application component
function QnAApp() {
  return (
    <div className="App">
      <Snowfall />
      <AppContent />
    </div>
  );
}

export default QnAApp;
