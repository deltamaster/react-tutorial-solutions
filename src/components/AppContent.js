import { useState, useEffect, useRef } from 'react';
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
import MarkdownEditor from './MarkdownEditor';
import { extractTextFromResponse, fetchFromApi, toolbox, ApiError, roleDefinition } from '../utils/apiUtils';
import { useLocalStorage } from '../utils/storageUtils';
import Settings from './Settings';

// Main application content component
function AppContent() {
  const [subscriptionKey, setSubscriptionKey] = useLocalStorage("subscriptionKey", "");

  // 从Chrome storage获取API密钥
  useEffect(() => {
    // 检查是否在Chrome扩展环境中
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
          setSubscriptionKey(result.apiKey);
        }
      });
    }
  }, []);

  // 当subscriptionKey变化时，同时更新到Chrome storage
  useEffect(() => {
    if (subscriptionKey && typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ apiKey: subscriptionKey });
    }
  }, [subscriptionKey]);
  const [conversation, setConversation] = useLocalStorage('conversation', []);
  const [systemPrompt, setSystemPrompt] = useLocalStorage('systemPrompt', 'You are a helpful assistant.');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [question, setQuestion] = useState('');

  // 从Chrome storage API获取内容并填充到问题输入框
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contentStored = urlParams.get('content') === 'stored';
    
    if (contentStored && typeof chrome !== 'undefined' && chrome.storage) {
      // 从Chrome storage获取内容
      chrome.storage.local.get(['pageContent', 'contentTimestamp'], (result) => {
        if (result.pageContent && result.contentTimestamp) {
          // 检查内容是否是最近5分钟内存储的，避免使用过期内容
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (now - result.contentTimestamp < fiveMinutes) {
            // 使用存储的内容
            setQuestion(result.pageContent.content);
            
            // 内容使用后清理存储，避免下次打开时重复使用
            chrome.storage.local.remove(['pageContent', 'contentTimestamp']);
          } else {
            console.log('Stored content is too old, ignoring');
          }
        }
      });
    } else {
      // 兼容处理：如果不是从右键菜单打开，或者不支持chrome.storage
      // 仍然尝试从URL参数获取内容（用于测试或其他情况）
      const markdownContent = urlParams.get('markdown');
      const htmlContent = urlParams.get('html');
      
      // 优先使用markdown内容，如果没有则使用html内容
      let content = markdownContent || htmlContent;
      
      if (content) {
        try {
          // 解码URL编码的内容
          const decodedContent = decodeURIComponent(content);
          setQuestion(decodedContent);
        } catch (error) {
          console.error('Error decoding content from URL:', error);
        }
      }
    }
  }, []);
  const [nextQuestionLoading, setNextQuestionLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('chatbot');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingPartIndex, setEditingPartIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // State for controlling visibility of top settings
  const [showTopSettings, setShowTopSettings] = useState(false);
  
  // State for floating tabs visibility
  const [showFloatingTabs, setShowFloatingTabs] = useState(false);
  const tabsRef = useRef(null);

  // Generation configurations
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
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
      let shouldSwitchRole = false;
      let currentRole = "general";
      
      // Check if user message contains an @mention to switch role
      // First, check if any text part contains an @mention
      for (const part of processedContentParts) {
        if (part.text) {
          const text = part.text.toLowerCase();
          
          // Check for @mentions of each role
          // Keep the @mention in the original text as requested
          if (text.includes('@belinda')) {
            currentRole = 'searcher';
            console.log(`Belinda mentioned in user message, switching to ${currentRole}`);
          } else if (text.includes('@adrien')) {
            currentRole = 'general';
            console.log(`Adrien mentioned in user message, switching to ${currentRole}`);
          } else if (text.includes('@charlie')) {
            currentRole = 'editor';
            console.log(`Charlie mentioned in user message, switching to ${currentRole}`);
          }
        }
      }
      
      while (hasFunctionCalls || shouldSwitchRole) {
        // Make API request with current conversation state
        console.log('Current role:', currentRole);
        const responseData = await fetchFromApi(currentConversation, dynamicGenerationConfig, true, subscriptionKey, systemPrompt, currentRole);
        
        // Check if response data has valid structure
        if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
          let finishReason = responseData.candidates[0].finishReason;
          let finishMessage = responseData.candidates[0].finishMessage;
          console.log('Finish reason:', finishReason);
          if (finishReason !== 'STOP') {
            // Throw exception showing finishReason and finishMessage
            throw new Error(`API request finished with reason: ${finishReason}. Message: ${finishMessage}`);
          }
          const responseParts = responseData.candidates[0].content.parts || [];
          
          // Separate text parts and function call parts
          const textParts = responseParts.filter(part => part.text || part.executableCode || part.codeExecutionResult || (part.inlineData && part.inlineData.data && part.inlineData.mimeType));
          const functionCallParts = responseParts.filter(part => part.functionCall);
          
          // Always create a bot response with text parts (if any)
          if (textParts.length > 0) {
            // 创建 bot 响应，包含 groundingChunks 和 groundingSupports（如果存在）
            // 添加name字段以区分不同角色，但保持role为'model'以确保API兼容性
            const botResponse = {
              role: "model",
              name: roleDefinition[currentRole]?.name || 'Adrien',
              parts: textParts,
              // 添加 grounding 数据到响应中，但这些数据不会被传递到下次请求
              groundingChunks: responseData.candidates[0]?.groundingMetadata?.groundingChunks || [],
              groundingSupports: responseData.candidates[0]?.groundingMetadata?.groundingSupports || []
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
            // continue if the role is not general
            if (currentRole === "searcher") {
              // Only searcher does not have the ability to make functionCall
              continue;
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
            currentRole = "general";
          }

          // 遍历所有文本部分，查找@userName格式的标记
          textParts.forEach(part => {
            let prevRole = currentRole;
            if (part.text) {
              // 检查是否包含@Belinda或@Adrien标记
              if (part.text.includes('@Belinda')) {
                currentRole = 'searcher';
                console.log(`Belinda mentioned, switch role to ${currentRole}`);
              } else if (part.text.includes('@Adrien')) {
                currentRole = 'general';
                console.log(`Adrien mentioned, switch role to ${currentRole}`);
              } else if (part.text.includes('@Charlie')) {
                currentRole = 'editor';
                console.log(`Charlie mentioned, switch role to ${currentRole}`);
              } else {
                shouldSwitchRole = false;
              }
              if (prevRole !== currentRole) {
                shouldSwitchRole = true;
              }
            }
          });
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
      console.error('API Error:', error);
      
      // Handle ApiError with structured information
      if (error instanceof ApiError) {
        const { statusCode, errorType, message, details } = error;
        
        // Create a more user-friendly error message based on error type
        let userMessage = '';
        
        switch (errorType) {
          case 'validation_error':
            userMessage = `Invalid input: ${message}`;
            break;
          case 'file_processing_error':
            userMessage = `File processing error: ${message} (MIME type: ${details.mimeType || 'unknown'})`;
            break;
          case 'api_response_error':
            userMessage = `Service error: ${message}`;
            if (statusCode === 401 || statusCode === 403) {
              userMessage += ' - Please check your API key';
            }
            break;
          case 'network_error':
            userMessage = `Network error: ${message || 'Please check your internet connection'}`;
            break;
          default:
            userMessage = message;
        }
        
        // Include status code if available
        if (statusCode && statusCode !== 'Unknown') {
          userMessage += ` (Status: ${statusCode})`;
        }
        
        setErrorMessage(userMessage);
      } else {
        // Handle generic errors
        const statusCode = error.statusCode || error.status || 'Unknown';
        const errorMsg = error.message || 'Failed to send message';
        setErrorMessage(`${errorMsg} (Status: ${statusCode})`);
      }
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
  
  // Handle scroll to show/hide floating tabs
  useEffect(() => {
    const handleScroll = () => {
      if (tabsRef.current) {
        const tabsRect = tabsRef.current.getBoundingClientRect();
        // Show floating tabs when tabs are not fully visible at the top
        setShowFloatingTabs(tabsRect.top < 0);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    // Initial check with timeout to ensure DOM is fully rendered
    setTimeout(handleScroll, 100);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Container className="App">
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          {/* Settings toggle button */}
          <div 
            onClick={() => setShowTopSettings(!showTopSettings)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f8f9fa'}
          >
            <h5 className="mb-0" style={{ fontWeight: '500' }}>Global Settings</h5>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {showTopSettings ? (
                <>
                  <span className="mr-1" style={{ fontSize: '0.9em' }}>Hide</span>
                  <Icon.ChevronUp size={16} />
                </>
              ) : (
                <>
                  <span className="mr-1" style={{ fontSize: '0.9em' }}>Show</span>
                  <Icon.ChevronDown size={16} />
                </>
              )}
            </div>
          </div>
          
          {/* Settings section - conditionally rendered */}
          {showTopSettings && (
            <Settings 
              subscriptionKey={subscriptionKey} 
              setSubscriptionKey={setSubscriptionKey} 
              systemPrompt={systemPrompt} 
              setSystemPrompt={setSystemPrompt} 
            />
          )}
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
      
      <div ref={tabsRef}>
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
              
              {/* 错误消息显示，带关闭按钮 */}
              {errorMessage && (
                <div className="mb-3 alert alert-danger alert-dismissible fade show" role="alert">
                  {errorMessage}
                  <button 
                    type="button" 
                    className="close-button" 
                    data-dismiss="alert" 
                    aria-label="Close"
                    onClick={() => setErrorMessage('')}
                  >
                    <Icon.X size={14} />
                  </button>
                </div>
              )}
              
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
        <Tab eventKey="markdown" title="Co-Edit">
          <Row>
            <Col>
              <MarkdownEditor />
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
        </Tabs>
      </div>
      
      {/* Floating tabs buttons - appear when original tabs are scrolled out of view */}
      {showFloatingTabs && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <Button 
            variant={currentTab === 'chatbot' ? 'primary' : 'outline-primary'}
            size="sm"
            onClick={() => setCurrentTab('chatbot')}
          >
            Chatbot
          </Button>
          <Button 
            variant={currentTab === 'markdown' ? 'primary' : 'outline-primary'}
            size="sm"
            onClick={() => setCurrentTab('markdown')}
          >
            Co-Edit
          </Button>
          <Button 
            variant={currentTab === 'memory' ? 'primary' : 'outline-primary'}
            size="sm"
            onClick={() => setCurrentTab('memory')}
          >
            Memory
          </Button>
        </div>
      )}
    </Container>
  );
}

export default AppContent;