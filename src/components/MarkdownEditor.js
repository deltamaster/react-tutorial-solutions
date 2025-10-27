import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import coEditService from '../utils/coEditService';

const MarkdownEditor = () => {
  // State for markdown content and last update timestamp
  const [markdown, setMarkdown] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Load document content and last update timestamp on component mount
  useEffect(() => {
    const loadDocument = () => {
      const content = coEditService.getDocumentContent();
      const timestamp = coEditService.getLastUpdateTimestamp();
      setMarkdown(content);
      setLastUpdate(timestamp);
    };
    
    loadDocument();
    
    // Subscribe to document change events
    const unsubscribe = coEditService.subscribe((action) => {
      console.log(`MarkdownEditor received notification: ${action}`);
      // Reload when document content changes
      loadDocument();
    });
    
    // Cleanup function
    return () => {
      console.log("Cleaning up MarkdownEditor subscription");
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Update document content whenever markdown changes
  useEffect(() => {
    if (markdown) {
      // Use coEditService to update document content and timestamp
      const result = coEditService.setDocumentContent(markdown);
      if (result.success) {
        setLastUpdate(result.lastUpdated);
        
        // Show success message
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
    }
  }, [markdown]);
  

  
  // Clear the document
  const clearDocument = () => {
    if (window.confirm('Are you sure you want to clear the document?')) {
      const result = coEditService.clearDocumentContent();
      if (result.success) {
        setMarkdown('');
        setLastUpdate(null);
      }
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };
  
  // Use ref to access the textarea DOM element
  const textareaRef = React.useRef(null);
  
  // Initialize textarea height when component mounts or markdown changes
  React.useEffect(() => {
    if (textareaRef.current) {
      // Reset height first
      textareaRef.current.style.height = 'auto';
      // Set height based on content
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [markdown]);
  
  return (
    <div className="markdown-editor">
      <Row className="mb-3 justify-content-between align-items-center">
        <Col xs={12} md={6} className="mb-2 mb-md-0">
          <h5 className="mb-0">Co-Edit Markdown Document</h5>
          <small className="text-muted">Last updated: {formatDate(lastUpdate)}</small>
        </Col>
        <Col xs={12} md={6} className="d-flex justify-content-end gap-2">

          <Button variant="secondary" onClick={clearDocument}>
            Clear Document
          </Button>
        </Col>
      </Row>
      
      {/* Success message removed as requested */}
      
      <Row>
        <Col xs={12} lg={6} className="mb-3 lg:mb-0">
          <Card>
            <Card.Header>Editor</Card.Header>
            <Card.Body>
              <Form.Group>
                <Form.Control
                  ref={textareaRef}
                  as="textarea"
                  value={markdown}
                  onChange={(e) => {
                    setMarkdown(e.target.value);
                    // Reset height to calculate new height properly
                    e.target.style.height = 'auto';
                    // Set new height based on scrollHeight
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Start writing your Markdown content here..."
                  style={{ 
                    minHeight: '400px', 
                    maxHeight: 'none', 
                    resize: 'none',
                    overflow: 'hidden'
                  }}
                />
                <Form.Text className="text-muted">
                  Use Markdown syntax: # for headers, **bold**, *italic*, `code`, ```code blocks```, [links](url)
                </Form.Text>
              </Form.Group>
            </Card.Body>
          </Card>
        </Col>
        
        <Col xs={12} lg={6}>
          <Card>
            <Card.Header>Preview</Card.Header>
            <Card.Body>
              <div 
                className="markdown-preview"
                style={{ 
                  minHeight: '400px', 
                  border: '1px solid #e9ecef', 
                  borderRadius: '4px', 
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  overflowY: 'auto'
                }}>
                <Markdown remarkPlugins={[remarkGfm]}>
                  {markdown || '# Start writing your Markdown content'}
                </Markdown>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mt-3">
        <Col>
          <Alert variant="info">
            <strong>Tips for Co-Editing:</strong>
            <ul className="mb-0">
              <li>You can update the document just by chatting</li>
              <li>Charlie will be responsible for maintaining the document content</li>
              <li>Your document is automatically saved and synchronized</li>
            </ul>
          </Alert>
        </Col>
      </Row>
    </div>
  );
};

export default MarkdownEditor;