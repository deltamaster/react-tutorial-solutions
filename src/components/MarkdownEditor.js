import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import coEditService from '../utils/coEditService';

const MarkdownEditor = () => {
  // State for markdown content and last update timestamp
  const [markdown, setMarkdown] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Ref for the editor container to observe visibility
  const editorRef = useRef(null);
  const hasLoadedOnce = useRef(false);
  
  // Load document content function
  const loadDocument = () => {
    if (hasLoadedOnce.current) return; // Only load once when first visible
    
    console.log("Loading document content as editor becomes visible");
    const content = coEditService.getDocumentContent();
    const timestamp = coEditService.getLastUpdateTimestamp();
    setMarkdown(content);
    setLastUpdate(timestamp);
    
    // Set height after loading content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
    
    hasLoadedOnce.current = true;
  };
  
  // Set up visibility observer to load document when editor becomes visible
  useEffect(() => {
    // Subscribe to document change events
    const unsubscribe = coEditService.subscribe((action) => {
      console.log(`MarkdownEditor received notification: ${action}`);
      // Always reload when document content changes, regardless of visibility
      const content = coEditService.getDocumentContent();
      const timestamp = coEditService.getLastUpdateTimestamp();
      setMarkdown(content);
      setLastUpdate(timestamp);
    });
    
    // Set up Intersection Observer to detect when editor becomes visible
    let observer = null;
    if (editorRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            loadDocument();
            // Once loaded, we can disconnect the observer if we only want to load once
            // observer.disconnect();
          }
        },
        {
          rootMargin: '0px',
          threshold: 0.1 // Trigger when 10% of the element is visible
        }
      );
      
      observer.observe(editorRef.current);
    }
    
    // Cleanup function
    return () => {
      console.log("Cleaning up MarkdownEditor observer and subscription");
      if (observer) {
        observer.disconnect();
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  // Update document content whenever markdown changes
  useEffect(() => {
    if (markdown) {
      // Use coEditService to update document content and timestamp
      const result = coEditService.setDocumentContent(markdown);
      if (result.success) {
        setLastUpdate(result.lastUpdated);
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
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [markdown]);
  
  return (
    <div className="markdown-editor" ref={editorRef}>
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