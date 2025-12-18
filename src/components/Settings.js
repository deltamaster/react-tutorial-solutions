import React, { useState, useEffect } from 'react';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { getUserAvatar, setUserAvatar } from '../utils/settingsService';

const Settings = ({ subscriptionKey, setSubscriptionKey, systemPrompt, setSystemPrompt, model, setModel }) => {
  const [selectedAvatar, setSelectedAvatar] = useState('male');

  // Load saved preference on mount
  useEffect(() => {
    const savedAvatar = getUserAvatar();
    if (savedAvatar) setSelectedAvatar(savedAvatar);
  }, []);

  // Save preference and update global state using settingsService
  const handleAvatarChange = (avatarType) => {
    setSelectedAvatar(avatarType);
    setUserAvatar(avatarType);
    // Trigger re-render of conversation history
    window.dispatchEvent(new Event('avatarChange'));
  };

  const handleSaveSubscriptionKey = () => {
    localStorage.setItem('subscriptionKey', subscriptionKey);
  };

  return (
    <Card className="settings-container mb-4">
      <Card.Body>
        {/* Subscription Key Section */}
        <Row className="mb-4">
          <Col xs={12}>
            <Form.Group controlId="subscription-key">
              <Form.Label>Subscription Key</Form.Label>
              <Form.Control
                type="password"
                value={subscriptionKey}
                onChange={(e) => setSubscriptionKey(e.target.value)}
                placeholder="Enter your subscription key"
                onBlur={handleSaveSubscriptionKey}
                className="api-key-input"
              />
              <Form.Text className="text-muted">
                Your subscription key is stored securely in your browser's local storage.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        
        {/* System Prompt Section */}
        <Row className="mb-4">
          <Col xs={12}>
            <Form.Group controlId="system-prompt">
              <Form.Label>System Prompt</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter system prompt here..."
              />
              <Form.Text className="text-muted">
                System prompts help define how the assistant behaves. Example: 'You are a helpful assistant specialized in technology.'
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        
        {/* Model Selection Section */}
        <Row className="mb-4">
          <Col xs={12}>
            <Form.Group controlId="model-selection">
              <Form.Label>Model</Form.Label>
              <Form.Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Select the AI model to use for generating responses.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>
        
        {/* Avatar Selection Section */}
        <Row>
          <Col xs={12}>
            <h6 className="mb-2">Avatar Selection</h6>
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
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default Settings;