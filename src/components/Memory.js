import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, ListGroup, Alert } from 'react-bootstrap';
import { Database, PlusCircle, CheckCircle, List, Trash, Pencil, X, InfoCircle, Save, Inbox } from "react-bootstrap-icons";

function Memory() {
  const [memories, setMemories] = useState({});
  const [newMemoryKey, setNewMemoryKey] = useState('');
  const [newMemoryValue, setNewMemoryValue] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 加载所有记忆
  const loadMemories = () => {
    const loadedMemories = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('memory-')) {
        const actualKey = key.substring('memory-'.length);
        loadedMemories[actualKey] = localStorage.getItem(key);
      }
    }
    setMemories(loadedMemories);
  };

  // 初始化时加载记忆，并监听localStorage变化
  useEffect(() => {
    loadMemories();

    // 监听localStorage变化
    const handleStorageChange = (e) => {
      console.log("storageChange event fired", e);
      // 检查key是否以'memory-'开头，或者当key为null时（表示所有存储被清空）
      if ((e.key && e.key.startsWith('memory-')) || e.key === null) {
        loadMemories();
      }
    };

    // 在当前标签页中手动触发更新 - 使用更兼容移动设备的方式
    console.log("create custom storageChange event listeners")
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    
    localStorage.setItem = function(key, value) {
      console.log("customized setItem called with key: ", key);
      const result = originalSetItem.apply(this, arguments);
      
      // 创建更兼容的自定义事件
      try {
        // 方式1：使用CustomEvent（更现代的方式）
        const event = new CustomEvent('storageChange', {
          detail: { key, newValue: value }
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.log("error dispatching custom storageChange event: ", e);
        // 方式2：降级方案，使用标准Event
        const event = new Event('storageChange');
        event.key = key;
        event.newValue = value;
        window.dispatchEvent(event);
      }
      
      return result;
    };
    
    localStorage.removeItem = function(key) {
      const result = originalRemoveItem.apply(this, arguments);
      console.log("customized removeItem called with key: ", key);
      
      // 创建更兼容的自定义事件
      try {
        const event = new CustomEvent('storageChange', {
          detail: { key }
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.log("error dispatching custom storageChange event: ", e);
        // 方式2：降级方案，使用标准Event
        const event = new Event('storageChange');
        event.key = key;
        window.dispatchEvent(event);
      }
      
      return result;
    };

    // 处理自定义存储变化事件
    const handleCustomStorageChange = (e) => {
      console.log("custom storageChange event fired", e);
      const key = e.detail ? e.detail.key : e.key;
      if (key && key.startsWith('memory-')) {
        loadMemories();
      }
    };

    // 添加两个事件监听器：标准的storage事件和自定义的storageChange事件
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storageChange', handleCustomStorageChange);
    
    // 清理函数
    return () => {
      console.log("clean up Memory module")
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storageChange', handleCustomStorageChange);
      // 恢复原始方法
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
    };
  }, []);

  // 添加新记忆
  const handleAddMemory = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newMemoryKey.trim()) {
      setError('Memory key cannot be empty');
      return;
    }

    if (!newMemoryValue.trim()) {
      setError('Memory value cannot be empty');
      return;
    }

    if (memories[newMemoryKey]) {
      setError('A memory with this key already exists');
      return;
    }

    try {
      localStorage.setItem(`memory-${newMemoryKey.trim()}`, newMemoryValue.trim());
      setNewMemoryKey('');
      setNewMemoryValue('');
      setSuccess('Memory added successfully');
      loadMemories(); // 重新加载记忆列表
    } catch (err) {
      setError('Failed to add memory');
      console.error(err);
    }
  };

  // 更新记忆
  const handleUpdateMemory = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingValue.trim()) {
      setError('Memory value cannot be empty');
      return;
    }

    try {
      localStorage.setItem(`memory-${editingKey}`, editingValue.trim());
      setEditingKey(null);
      setEditingValue('');
      setSuccess('Memory updated successfully');
      loadMemories(); // 重新加载记忆列表
    } catch (err) {
      setError('Failed to update memory');
      console.error(err);
    }
  };

  // 删除记忆
  const handleDeleteMemory = (key) => {
    if (window.confirm(`Are you sure you want to delete memory: ${key}?`)) {
      try {
        localStorage.removeItem(`memory-${key}`);
        setSuccess('Memory deleted successfully');
        loadMemories(); // 重新加载记忆列表
      } catch (err) {
        setError('Failed to delete memory');
        console.error(err);
      }
    }
  };

  // 开始编辑记忆
  const startEditing = (key, value) => {
    setEditingKey(key);
    setEditingValue(value);
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingKey(null);
    setEditingValue('');
  };

  // 清除所有记忆
  const clearAllMemories = () => {
    if (window.confirm('Are you sure you want to delete all memories? This action cannot be undone.')) {
      try {
        // 删除所有以'memory-'开头的localStorage项
        const keysToDelete = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('memory-')) {
            keysToDelete.push(key);
          }
        }
        
        keysToDelete.forEach(key => localStorage.removeItem(key));
        setSuccess('All memories deleted successfully');
        loadMemories(); // 重新加载记忆列表
      } catch (err) {
        setError('Failed to delete all memories');
        console.error(err);
      }
    }
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

      {/* 错误和成功消息 */}
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

      {/* 添加新记忆的表单 */}
      <Row className="mb-4">
        <Col xs={12}>
          <div className="card p-3">
            <h5>
              <PlusCircle size={18} className="mr-2" />
              Add New Memory
            </h5>
            <Form onSubmit={handleAddMemory} className="mt-2">
              <Row>
                <Col xs={12} md={4} className="mb-2">
                  <Form.Group controlId="memoryKey">
                    <Form.Label>Memory Key</Form.Label>
                    <Form.Control
                      type="text"
                      value={newMemoryKey}
                      onChange={(e) => setNewMemoryKey(e.target.value)}
                      placeholder="Enter a key (e.g., 'name', 'preferences')"
                      maxLength={500}
                    />
                  </Form.Group>
                </Col>
                <Col xs={12} md={7} className="mb-2">
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

      {/* 记忆列表 */}
      <Row>
        <Col xs={12}>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5>
                <List size={18} className="mr-2" />
                Stored Memories ({Object.keys(memories).length})
              </h5>
              {Object.keys(memories).length > 0 && (
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={clearAllMemories}
                  className="text-sm"
                >
                  <Trash size={16} className="mr-1" />
                  Clear All
                </Button>
              )}
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