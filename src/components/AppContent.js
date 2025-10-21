import { useState } from "react";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import * as Icon from "react-bootstrap-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import '../styles.css';
import ConversationHistory from './ConversationHistory';
import QuestionInput from './QuestionInput';
import LoadingSpinner from './LoadingSpinner';
import FollowUpQuestions from './FollowUpQuestions';
import Memory from './Memory';
import { extractTextFromResponse, fetchFromApi, toolbox } from '../utils/apiUtils';
import { useLocalStorage } from '../utils/storageUtils';
import ApiKeyInput from './ApiKeyInput';

// Main application content component
function AppContent() {
  const [subscriptionKey, setSubscriptionKey] = useLocalStorage("subscriptionKey", "");
  const [conversation, setConversation] = useLocalStorage('conversation', []);
  const [systemPrompt, setSystemPrompt] = useLocalStorage('systemPrompt', 'You are a helpful assistant.');
  const [showSystemPrompt, setShowSystemPrompt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [question, setQuestion] = useState('');
  const [nextQuestionLoading, setNextQuestionLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('chatbot');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Generation configurations
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
    thinkingConfig: {
      includeThoughts: true,
      thinkingBudget: -1 // -1 means adptive; 0 means no thinking
    }
  };

  const generationConfigForNextQuestion = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 1024,
    responseMimeType: "text/plain",
    thinkingConfig: {
      includeThoughts: false,
      thinkingBudget: 0
    }
  };

  // Helper function to convert image file to base64
  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove the data:image/xxx;base64, prefix to get just the base64 data
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle chatbot question submission
  const handleSubmit = async (contentParts, thinkingBudget = 0) => {
    if (!subscriptionKey) {
      alert("Please input Subscription key");
      return;
    }

    setLoading(true);
    setFollowUpQuestions([]);

    // Process content parts to convert image files to base64 for storing in conversation history
    const processedContentParts = [];
    for (const part of contentParts) {
      if (part.inline_data && part.inline_data.file) {
        try {
          // Convert image to base64 for storing in conversation history
          const base64Data = await convertImageToBase64(part.inline_data.file);
          processedContentParts.push({
            inline_data: {
              mime_type: part.inline_data.mime_type,
              data: base64Data
            }
          });
        } catch (error) {
          console.error('Error converting image to base64:', error);
          alert('Failed to process image file');
          setLoading(false);
          return;
        }
      } else {
        // Keep text parts as is
        processedContentParts.push(part);
      }
    }

    // Create a new user message with the processed content parts
    const newUserMessage = {
      role: "user",
      parts: processedContentParts,
    };

    setConversation((prev) => [...prev, newUserMessage]);

    try {
      // Use system prompt as parameter, not as part of conversation
      let currentConversation = [...conversation, newUserMessage];
      
      // Create dynamic generation config with the provided thinkingBudget
      const dynamicGenerationConfig = {
        ...generationConfig,
        thinkingConfig: {
          ...generationConfig.thinkingConfig,
          thinkingBudget: thinkingBudget
        }
      };
      
      // Use a loop to handle multiple function calls
      let hasFunctionCalls = true;
      
      while (hasFunctionCalls) {
        // Make API request with current conversation state
        const responseData = await fetchFromApi(currentConversation, dynamicGenerationConfig, true, subscriptionKey, systemPrompt);
        
        // Check if response data has valid structure
        if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
          const responseParts = responseData.candidates[0].content.parts || [];
          
          // Separate text parts and function call parts
          const textParts = responseParts.filter(part => part.text);
          const functionCallParts = responseParts.filter(part => part.functionCall);
          
          // Always create a bot response with text parts (if any)
          if (textParts.length > 0) {
            const botResponse = {
              role: "model",
              parts: textParts,
            };
            currentConversation = [...currentConversation, botResponse];
            setConversation(currentConversation);
          }
          
          // Check if there are function calls to process
          if (functionCallParts.length > 0) {
            hasFunctionCalls = true;
            const functionResults = [];
            
            // Execute each function call
            for (const functionCallPart of functionCallParts) {
              const { name, args } = functionCallPart.functionCall;
              if (toolbox[name]) {
                const result = toolbox[name](args);
                functionResults.push({ name, result });
              }
            }
            
            // Add function results to conversation
            const functionResponseMessage = {
              role: "user",
              parts: functionResults.map(result => ({
                functionResponse: { name: result.name, response: { result: result.result } }
              })),
            };
            currentConversation = [...currentConversation, functionResponseMessage];
          } else {
            // No more function calls, exit loop
            hasFunctionCalls = false;
          }
        } else {
          // No valid content, exit loop
          hasFunctionCalls = false;
        }
      }
      
      // After all function calls are processed, generate follow-up questions
      setNextQuestionLoading(true);
      try {
        let askForFollowUpRequest = {
          role: "user",
          parts: [
            {
              text: "Predict my follow-up question based on the previous conversation. " +
                "Come up with up to 3, each in a new line. " +
                "The answer should only contain the question proposed without anything else."
            }
          ],
        };
        const nextQuestionResponseData = await fetchFromApi([...currentConversation, askForFollowUpRequest], generationConfigForNextQuestion, false, subscriptionKey, systemPrompt);
        const nextQuestionResponseObj = extractTextFromResponse(nextQuestionResponseData);
        const nextQuestionResponseText = nextQuestionResponseObj.responseText;
        
        // Parse follow-up questions
        if (nextQuestionResponseText) {
          const lines = nextQuestionResponseText.split('\n');
          const questions = lines.slice(0, 3).filter(q => q.trim());
          
          setFollowUpQuestions(questions);
        }
      } catch (error) {
        console.error('Error generating follow-up questions:', error);
      } finally {
        setNextQuestionLoading(false);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  // Handle follow-up question click
  const handleFollowUpClick = (question) => {
    // For follow-up questions, we just set the question text directly
    // since follow-up questions don't include images
    setQuestion(question);
  };

  // Reset conversation history
  const resetConversation = () => {
    if (window.confirm('Are you sure you want to reset the conversation history?')) {
      setConversation([]);
      setFollowUpQuestions([]);
    }
  };

  // Download conversation history
  const downloadConversation = () => {
    const dataStr = JSON.stringify(conversation, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'conversation_history.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Upload conversation history
  const uploadConversation = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const conversationData = JSON.parse(e.target.result);
        setConversation(conversationData);
        event.target.value = '';
      } catch (error) {
        alert('Failed to upload conversation history. Please provide a valid JSON file.');
        console.error('Error parsing uploaded file:', error);
      }
    };
    reader.readAsText(file);
  };

  // Delete a conversation message
  const deleteConversationMessage = (index) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      setConversation((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Start editing a conversation part
  const startEditing = (index, partIndex, text) => {
    setEditingIndex(index);
    setEditingPartIndex(partIndex);
    setEditingText(text);
  };

  // Save edited conversation part
  const saveEditing = () => {
    if (editingIndex !== null && editingPartIndex !== null) {
      setConversation((prev) => 
        prev.map((message, index) => {
          if (index === editingIndex) {
            return {
              ...message,
              parts: message.parts.map((part, partIndex) => {
                if (partIndex === editingPartIndex) {
                  return { ...part, text: editingText };
                }
                return part;
              })
            };
          }
          return message;
        })
      );
      cancelEditing();
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingPartIndex(null);
    setEditingText('');
  };

  return (
    <Container className="App">
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          <ApiKeyInput 
            subscriptionKey={subscriptionKey} 
            setSubscriptionKey={setSubscriptionKey} 
          />
        </Col>
      </Row>

      <Row>
        <Col xs={12}>
          <Alert variant="info" className="warning-alert">
            <Icon.ShieldExclamation size={16} className="mr-2" />
            There is no filter on offending response. Use the tool at your own risk.
          </Alert>
        </Col>
      </Row>
      
      <Tabs 
        activeKey={currentTab} 
        onSelect={(tab) => setCurrentTab(tab)}
        className="mb-3"
        style={{ borderBottom: '1px solid #e9ecef' }}
      >
        <Tab eventKey="chatbot" title="Chatbot">
          <Row className="mb-3">
            <Col xs={12} className="d-flex justify-content-end gap-2">
              <div className="relative">
                <Button 
                  id="reset-conversation"
                  variant="secondary" 
                  onClick={resetConversation}
                  className="toggle-label"
                  style={{ display: "none" }} // Hide the actual input element
                ></Button>
                <label htmlFor="reset-conversation" className="toggle-label toggle-on"
                  style={{ display: conversation.length > 0 ? 'inline-block' : 'none' }}>
                  <Icon.ArrowClockwise size={16} className="mr-2" />
                  <span className="toggle-text">&nbsp;Reset Conversation</span>
                </label>
              </div>
              <div className="relative">
                <Button 
                  id="download-conversation"
                  variant="secondary" 
                  onClick={downloadConversation}
                  style={{ display: "none" }} // Hide the actual input element
                ></Button>
                <label htmlFor="download-conversation" className="toggle-label toggle-on"
                  style={{ display: conversation.length > 0 ? 'inline-block' : 'none' }}>
                  <Icon.Download size={16} className="mr-2" />
                  <span className="toggle-text">&nbsp;Download History</span>
                </label>
              </div>

              <div className="relative">
                <Button 
                  variant="secondary" 
                  style={{ display: "none" }} // Hide the actual input element
                ></Button>
                <input
                  id="upload-conversation"
                  type="file"
                  accept=".json"
                  onChange={uploadConversation}
                  style={{ display: "none" }} // Hide the actual input element
                />
                <label htmlFor="upload-conversation" className="toggle-label toggle-on"
                  style={{ display: 'inline-block' }}>
                  <Icon.Upload size={16} className="mr-2" />
                  <span className="toggle-text">&nbsp;Upload History</span>
                </label>
              </div>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col>
              <div className="mb-2">
                <h5 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: '#f5f5f5ff'
                  }}
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#d4d4d4ff'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f5ff'}
                >
                  <span style={{ fontWeight: '500' }}>System Prompt Settings</span>
                  <span style={{ display: 'flex', alignItems: 'center', color: '#6c757d', fontSize: '0.85em' }}>
                    {showSystemPrompt ? (
                      <>
                        <Icon.ChevronUp size={16} className="mr-1" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Icon.ChevronDown size={16} className="mr-1" />
                        <span>Show</span>
                      </>
                    )}
                  </span>
                </h5>
              </div>
              {showSystemPrompt && (
                <>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt here..."
                  />
                  <small className="form-text text-muted">System prompts help define how the assistant behaves. Example: 'You are a helpful assistant specialized in technology.'</small>
                </>
              )}
            </Col>
          </Row>
          <Row>
            <Col>
              <ConversationHistory 
                history={conversation} 
                onDelete={deleteConversationMessage}
                onEdit={startEditing}
                editingIndex={editingIndex}
                editingPartIndex={editingPartIndex}
                editingText={editingText}
                onEditingTextChange={setEditingText}
                onSave={saveEditing}
                onCancel={cancelEditing}
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <FollowUpQuestions 
                questions={followUpQuestions}
                onQuestionClick={handleFollowUpClick}
                isLoading={nextQuestionLoading}
              />
              {loading ? (
                <LoadingSpinner />
              ) : (
                <QuestionInput 
                onSubmit={handleSubmit} 
                disabled={loading} 
                value={question} 
                onChange={setQuestion} 
              />
              )}
              
            </Col>
          </Row>
        </Tab>
        <Tab eventKey="memory" title="Memory">
          <Row>
            <Col>
              <Memory />
            </Col>
          </Row>
        </Tab>
        <Tab eventKey="picture" title="Picture">
          <Row>
            <Col>
              <p> Under construction </p>
            </Col>
          </Row>
        </Tab>
      </Tabs>
    </Container>
  );
}

export default AppContent;