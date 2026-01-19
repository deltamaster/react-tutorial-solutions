import React, { useState, useEffect, useRef } from 'react';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import ListGroup from 'react-bootstrap/ListGroup';
import { getUserAvatar, setUserAvatar, getSystemPrompts, getSelectedSystemPromptKey, setSelectedSystemPromptKey, addSystemPrompt, updateSystemPrompt, deleteSystemPrompt } from '../utils/settingsService';
import { PlusCircle, Pencil, Trash, CheckCircle, X } from 'react-bootstrap-icons';

const Settings = ({ subscriptionKey, setSubscriptionKey, systemPrompt, setSystemPrompt, model, setModel }) => {
  const [selectedAvatar, setSelectedAvatar] = useState('male');
  const [systemPrompts, setSystemPromptsState] = useState({});
  const [selectedPromptKey, setSelectedPromptKeyState] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingPrompt, setEditingPrompt] = useState('');
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const lastSyncedPromptRef = useRef(null); // Track last synced prompt to prevent loops

  // Load saved preferences on mount
  useEffect(() => {
    const savedAvatar = getUserAvatar();
    if (savedAvatar) setSelectedAvatar(savedAvatar);
    
    // Load system prompts
    const prompts = getSystemPrompts();
    const selectedKey = getSelectedSystemPromptKey();
    setSystemPromptsState(prompts);
    setSelectedPromptKeyState(selectedKey);
    
    // Load prompt on mount (skip sync - just loading existing value)
    if (selectedKey && prompts[selectedKey]) {
      const promptText = prompts[selectedKey].prompt;
      setSystemPrompt(promptText, true); // Skip sync when loading on mount
      lastSyncedPromptRef.current = promptText;
    }
    
    setIsInitialized(true);
  }, []);

  // Update system prompt ONLY when selection changes (not when systemPrompts object changes)
  useEffect(() => {
    // Don't sync until initialization is complete
    if (!isInitialized) return;
    
    // Only update if the selected key changed, not if systemPrompts object reference changed
    const currentPromptText = selectedPromptKey && systemPrompts[selectedPromptKey] 
      ? systemPrompts[selectedPromptKey].prompt 
      : '';
    
    // Only update if the prompt text actually changed
    if (currentPromptText !== lastSyncedPromptRef.current) {
      setSystemPrompt(currentPromptText);
      lastSyncedPromptRef.current = currentPromptText;
    }
  }, [selectedPromptKey, isInitialized]); // Removed systemPrompts and setSystemPrompt from deps

  // Reload system prompts when they change
  const reloadSystemPrompts = () => {
    const prompts = getSystemPrompts();
    const selectedKey = getSelectedSystemPromptKey();
    setSystemPromptsState(prompts);
    setSelectedPromptKeyState(selectedKey);
  };

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

  // Handle system prompt selection
  const handleSelectSystemPrompt = (uuidKey) => {
    setSelectedSystemPromptKey(uuidKey);
    setSelectedPromptKeyState(uuidKey);
    
    // Update prompt immediately when user selects
    const prompts = getSystemPrompts();
    if (uuidKey && prompts[uuidKey]) {
      const promptText = prompts[uuidKey].prompt;
      setSystemPrompt(promptText);
      lastSyncedPromptRef.current = promptText;
    }
    
    reloadSystemPrompts();
  };

  // Handle adding new system prompt
  const handleAddSystemPrompt = () => {
    if (!newPromptText.trim()) {
      return;
    }
    const uuid = addSystemPrompt(newPromptTitle.trim() || 'Untitled', newPromptText.trim());
    setSelectedSystemPromptKey(uuid);
    setSelectedPromptKeyState(uuid);
    
    // Update prompt immediately when new prompt is added
    const promptText = newPromptText.trim();
    setSystemPrompt(promptText);
    lastSyncedPromptRef.current = promptText;
    
    setNewPromptTitle('');
    setNewPromptText('');
    setShowAddForm(false);
    reloadSystemPrompts();
  };

  // Handle starting edit
  const handleStartEdit = (uuidKey) => {
    const prompt = systemPrompts[uuidKey];
    if (prompt) {
      setEditingKey(uuidKey);
      setEditingTitle(prompt.title);
      setEditingPrompt(prompt.prompt);
    }
  };

  // Handle saving edit
  const handleSaveEdit = () => {
    if (editingKey && editingPrompt.trim()) {
      updateSystemPrompt(editingKey, {
        title: editingTitle.trim() || 'Untitled',
        prompt: editingPrompt.trim()
      });
      
      // Update prompt if this is the selected prompt
      if (editingKey === selectedPromptKey) {
        const promptText = editingPrompt.trim();
        setSystemPrompt(promptText);
        lastSyncedPromptRef.current = promptText;
      }
      
      setEditingKey(null);
      setEditingTitle('');
      setEditingPrompt('');
      reloadSystemPrompts();
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditingTitle('');
    setEditingPrompt('');
  };

  // Handle deleting system prompt
  const handleDeleteSystemPrompt = (uuidKey) => {
    if (window.confirm(`Are you sure you want to delete "${systemPrompts[uuidKey]?.title || 'Untitled'}"?`)) {
      deleteSystemPrompt(uuidKey);
      reloadSystemPrompts();
    }
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
            <Form.Group controlId="system-prompt-selection">
              <Form.Label>System Prompt Selection</Form.Label>
              <Form.Select
                value={selectedPromptKey || ''}
                onChange={(e) => handleSelectSystemPrompt(e.target.value || null)}
              >
                <option value="">-- Select a system prompt --</option>
                {Object.entries(systemPrompts).map(([uuidKey, prompt]) => (
                  <option key={uuidKey} value={uuidKey}>
                    {prompt.title}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Select which system prompt to use. The selected prompt will be applied to conversations.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        {/* System Prompt List */}
        <Row className="mb-4">
          <Col xs={12}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">System Prompts</h6>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  <PlusCircle size={16} className="mr-1" />
                  {showAddForm ? 'Cancel' : 'Add New'}
                </Button>
              </Card.Header>
              <Card.Body>
                {/* Add New Prompt Form */}
                {showAddForm && (
                  <div className="mb-3 p-3 border rounded">
                    <Form.Group className="mb-2">
                      <Form.Label>Title</Form.Label>
                      <Form.Control
                        type="text"
                        value={newPromptTitle}
                        onChange={(e) => setNewPromptTitle(e.target.value)}
                        placeholder="Untitled"
                      />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label>Prompt</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        placeholder="Enter system prompt here..."
                      />
                    </Form.Group>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleAddSystemPrompt}
                      disabled={!newPromptText.trim()}
                    >
                      <CheckCircle size={16} className="mr-1" />
                      Save
                    </Button>
                  </div>
                )}

                {/* System Prompts List */}
                {Object.keys(systemPrompts).length === 0 ? (
                  <div className="text-center text-muted py-3">
                    No system prompts yet. Click "Add New" to create one.
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {Object.entries(systemPrompts).map(([uuidKey, prompt]) => (
                      <ListGroup.Item key={uuidKey} className="px-0">
                        {editingKey === uuidKey ? (
                          <div className="p-3 border rounded">
                            <Form.Group className="mb-2">
                              <Form.Label>Title</Form.Label>
                              <Form.Control
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                              />
                            </Form.Group>
                            <Form.Group className="mb-2">
                              <Form.Label>Prompt</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={3}
                                value={editingPrompt}
                                onChange={(e) => setEditingPrompt(e.target.value)}
                              />
                            </Form.Group>
                            <div className="d-flex gap-2">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={!editingPrompt.trim()}
                              >
                                <CheckCircle size={16} className="mr-1" />
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                <X size={16} className="mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <strong>{prompt.title}</strong>
                                {selectedPromptKey === uuidKey && (
                                  <span className="badge bg-primary">Selected</span>
                                )}
                              </div>
                              <div className="text-muted small" style={{ whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'auto' }}>
                                {prompt.prompt || <em>No prompt text</em>}
                              </div>
                            </div>
                            <div className="d-flex gap-2 ms-3">
                              <Button
                                variant="info"
                                size="sm"
                                onClick={() => handleStartEdit(uuidKey)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteSystemPrompt(uuidKey)}
                              >
                                <Trash size={14} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
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