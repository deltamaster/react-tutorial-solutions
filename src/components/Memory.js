import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, ListGroup, Alert } from 'react-bootstrap';
import { Database, PlusCircle, CheckCircle, List, Trash, Pencil, X, InfoCircle, Save, Inbox } from "react-bootstrap-icons";
import * as Icon from "react-bootstrap-icons";
import memoryService from '../utils/memoryService';

function Memory() {
  const [memories, setMemories] = useState({});
  const [newMemoryValue, setNewMemoryValue] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load all memories
  const loadMemories = () => {
    const loadedMemories = memoryService.getAllMemories();
    setMemories(loadedMemories);
  };

  // Load memories on initialization and listen for memory changes
  useEffect(() => {
    loadMemories();

    // Subscribe to memory change events
    const unsubscribe = memoryService.subscribe((key, action) => {
      console.log(`Memory component received notification: ${action} for key ${key}`);
      // Reload when memory changes
      loadMemories();
    });
    
    // Cleanup function
    return () => {
      console.log("Cleaning up Memory module");
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Add new memory
  const handleAddMemory = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newMemoryValue.trim()) {
      setError('Memory value cannot be empty');
      return;
    }

    try {
      // Generate random UUID for memory key
      const memoryKey = crypto.randomUUID();
      memoryService.setMemory(memoryKey, newMemoryValue.trim());
      setNewMemoryValue('');
      setSuccess('Memory added successfully');
      // No need to manually call loadMemories, as memoryService will trigger event notifications
    } catch (err) {
      setError('Failed to add memory');
      console.error(err);
    }
  };

  // Update memory
  const handleUpdateMemory = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingValue.trim()) {
      setError('Memory value cannot be empty');
      return;
    }

    try {
      memoryService.setMemory(editingKey, editingValue.trim());
      setEditingKey(null);
      setEditingValue('');
      setSuccess('Memory updated successfully');
      // No need to manually call loadMemories, as memoryService will trigger event notifications
    } catch (err) {
      setError('Failed to update memory');
      console.error(err);
    }
  };

  // Delete memory
  const handleDeleteMemory = (key) => {
    if (window.confirm(`Are you sure you want to delete memory: ${key}?`)) {
      try {
          memoryService.deleteMemory(key);
          setSuccess('Memory deleted successfully');
          // No need to manually call loadMemories, as memoryService will trigger event notifications
        } catch (err) {
          setError('Failed to delete memory');
          console.error(err);
        }
    }
  };

  // Start editing memory
  const startEditing = (key, value) => {
    setEditingKey(key);
    setEditingValue(value);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingKey(null);
    setEditingValue('');
  };

  // Clear all memories
  const clearAllMemories = () => {
    if (window.confirm('Are you sure you want to delete all memories? This action cannot be undone.')) {
      try {
          memoryService.clearAllMemories();
          setSuccess('All memories deleted successfully');
          // No need to manually call loadMemories, as memoryService will trigger event notifications
        } catch (err) {
          setError('Failed to delete all memories');
          console.error(err);
        }
    }
  };

  // Download memory data
  const downloadMemory = () => {
    const dataStr = JSON.stringify(memories, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'memory_data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Upload memory data
  const uploadMemory = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const memoryData = JSON.parse(e.target.result);
        
        // Clear existing memories before uploading new ones
        memoryService.clearAllMemories();
        
        // Add each memory from the uploaded file
        Object.entries(memoryData).forEach(([key, value]) => {
          memoryService.setMemory(key, value);
        });
        
        setSuccess('Memory data uploaded successfully');
        event.target.value = '';
      } catch (error) {
        setError('Failed to upload memory data. Please provide a valid JSON file.');
        console.error('Error parsing uploaded file:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="memory-container">
      <Row className="mb-4">
        <Col xs={12}>
          <h3>
            <Database size={20} className="mr-2" />
            Memory Management
          </h3>
          <p>Manage your stored memories that the assistant can reference during conversations.</p>
        </Col>
      </Row>

      {/* Error and success messages */}
      {error && (
        <Row className="mb-3">
          <Col xs={12}>
            <Alert variant="danger" onClose={() => setError('')} dismissible>
              <InfoCircle size={16} className="mr-2" />
              {error}
            </Alert>
          </Col>
        </Row>
      )}

      {success && (
        <Row className="mb-3">
          <Col xs={12}>
            <Alert variant="success" onClose={() => setSuccess('')} dismissible>
              <CheckCircle size={16} className="mr-2" />
              {success}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Add new memory form */}
      <Row className="mb-4">
        <Col xs={12}>
          <div className="card p-3">
            <h5>
              <PlusCircle size={18} className="mr-2" />
              Add New Memory
            </h5>
            <Form onSubmit={handleAddMemory} className="mt-2">
              <Row>
                <Col xs={12} md={11} className="mb-2">
                  <Form.Group controlId="memoryValue">
                    <Form.Label>Memory Value</Form.Label>
                    <Form.Control
                      as="textarea"
                      value={newMemoryValue}
                      onChange={(e) => setNewMemoryValue(e.target.value)}
                      placeholder="Enter the memory content"
                      rows={2}
                      maxLength={5000}
                    />
                    <Form.Text className="text-muted">
                      Memory key will be automatically generated
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col xs={12} md={1} className="mb-2 d-flex align-items-end">
                  <Button type="submit" variant="primary" className="w-100">
                    <Save size={16} />
                  </Button>
                </Col>
              </Row>
            </Form>
          </div>
        </Col>
      </Row>

      {/* Memory list */}
      <Row>
        <Col xs={12}>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5>
                <List size={18} className="mr-2" />
                Stored Memories ({Object.keys(memories).length})
              </h5>
              <div className="d-flex gap-2">
                <div className="relative">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    style={{ display: "none" }} 
                  />
                  <input
                    id="upload-memory"
                    type="file"
                    accept=".json"
                    onChange={uploadMemory}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="upload-memory" className="toggle-label toggle-on">
                    <Icon.Upload size={16} className="mr-1" />
                    Upload
                  </label>
                </div>
                {Object.keys(memories).length > 0 && (
                  <>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={downloadMemory}
                    >
                      <Icon.Download size={16} className="mr-1" />
                      Download
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={clearAllMemories}
                    >
                      <Trash size={16} className="mr-1" />
                      Clear All
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="card-body">
              {Object.keys(memories).length === 0 ? (
                <div className="text-center text-muted py-4">
                  <Inbox size={48} className="mb-2" />
                  <p>No memories stored yet. Add your first memory above.</p>
                </div>
              ) : (
                <ListGroup variant="flush">
                  {Object.entries(memories).map(([key, value]) => (
                    <ListGroup.Item key={key} className="py-3">
                      {editingKey === key ? (
                        <Form onSubmit={handleUpdateMemory}>
                          <Row>
                            <Col xs={12} md={3} className="mb-2">
                              <Form.Group controlId={`editKey-${key}`}>
                                <Form.Label className="small">Memory Key</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={key}
                                  disabled
                                  className="bg-light"
                                />
                              </Form.Group>
                            </Col>
                            <Col xs={12} md={7} className="mb-2">
                              <Form.Group controlId={`editValue-${key}`}>
                                <Form.Label className="small">Memory Value</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  rows={2}
                                  maxLength={5000}
                                />
                              </Form.Group>
                            </Col>
                            <Col xs={12} md={2} className="mb-2 d-flex gap-2">
                              <Button type="submit" variant="success" size="sm" className="flex-grow-1">
                                <CheckCircle size={16} />
                                Save
                              </Button>
                              <Button variant="secondary" size="sm" onClick={cancelEditing} className="flex-grow-1">
                                <X size={16} />
                                Cancel
                              </Button>
                            </Col>
                          </Row>
                        </Form>
                      ) : (
                        <Row>
                          <Col xs={12} md={3}>
                            <div className="font-weight-bold text-primary">{key}</div>
                          </Col>
                          <Col xs={12} md={7}>
                            <div className="text-muted">{value}</div>
                          </Col>
                          <Col xs={12} md={2} className="d-flex gap-2">
                            <Button 
                              variant="info" 
                              size="sm" 
                              onClick={() => startEditing(key, value)}
                              className="flex-grow-1"
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                            <Button 
                              variant="danger" 
                              size="sm" 
                              onClick={() => handleDeleteMemory(key)}
                              className="flex-grow-1"
                            >
                              <Trash size={16} />
                              Delete
                            </Button>
                          </Col>
                        </Row>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default Memory;