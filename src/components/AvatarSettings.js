import React, { useState, useEffect } from 'react';

const AvatarSettings = () => {
  const [selectedAvatar, setSelectedAvatar] = useState('male');

  // Load saved preference on mount
  useEffect(() => {
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) setSelectedAvatar(savedAvatar);
  }, []);

  // Save preference and update global state
  const handleAvatarChange = (avatarType) => {
    setSelectedAvatar(avatarType);
    localStorage.setItem('userAvatar', avatarType);
    // Trigger re-render of conversation history
    window.dispatchEvent(new Event('avatarChange'));
  };

  return (
    <div className="avatar-settings" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      <div className="avatar-options" style={{ display: 'flex', gap: '20px' }}>
        <div 
          className={`avatar-option ${selectedAvatar === 'male' ? 'selected' : ''}`}
          onClick={() => handleAvatarChange('male')}
          style={{ textAlign: 'center', cursor: 'pointer' }}
        >
          <img 
            src="/avatar-user-male.jpg" 
            alt="Male Avatar" 
            className="avatar-preview" 
            style={{width: '64px', height: '64px', borderRadius: '50%', border: selectedAvatar === 'male' ? '2px solid #007bff' : 'none', transition: 'all 0.2s ease'}}
          />
        </div>
        <div 
          className={`avatar-option ${selectedAvatar === 'female' ? 'selected' : ''}`}
          onClick={() => handleAvatarChange('female')}
          style={{ textAlign: 'center', cursor: 'pointer' }}
        >
          <img 
            src="/avatar-user-female.jpg" 
            alt="Female Avatar" 
            className="avatar-preview" 
            style={{width: '64px', height: '64px', borderRadius: '50%', border: selectedAvatar === 'female' ? '2px solid #007bff' : 'none', transition: 'all 0.2s ease'}}
          />
        </div>
      </div>
    </div>
  );
};

export default AvatarSettings;