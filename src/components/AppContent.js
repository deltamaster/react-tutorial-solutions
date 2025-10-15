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
import { extractTextFromResponse, fetchFromApi, toolbox } from '../utils/apiUtils';
import { useLocalStorage } from '../utils/storageUtils';
import ApiKeyInput from './ApiKeyInput';

// Main application content component
function AppContent() {
  const [apiKey, setApiKey] = useLocalStorage("geminiApiKey", "");
  const [conversation, setConversation] = useLocalStorage("conversation", []);
  const [loading, setLoading] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [nextQuestionLoading, setNextQuestionLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('chatbot');

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

  // Handle chatbot question submission
  const handleSubmit = async (question, thinkingBudget = 0) => {
    if (!apiKey) {
      alert("Please input API key");
      return;
    }

    setLoading(true);
    const newUserMessage = {
      role: "user",
      parts: [{ text: question }],
    };

    setConversation((prev) => [...prev, newUserMessage]);

    try {
      // Create conversation including new message
      const conversationIncludingPrompt = [...conversation, newUserMessage];
      
      // Create dynamic generation config with the provided thinkingBudget
      const dynamicGenerationConfig = {
        ...generationConfig,
        thinkingConfig: {
          ...generationConfig.thinkingConfig,
          thinkingBudget: thinkingBudget
        }
      };
      
      // Make API request with dynamic generation config
      const responseData = await fetchFromApi(conversationIncludingPrompt, dynamicGenerationConfig, apiKey, true);
      
      // Process response text
      const responseDataObj = extractTextFromResponse(responseData);
      const responseText = responseDataObj.responseText;
      
      // Check if response data has valid structure
      if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content) {
        // Check for function calls in all parts if parts exist
        let hasFunctionCalls = false;
        let functionCalls = [];
        
        if (responseData.candidates[0].content.parts) {
          // Iterate through all parts to find function calls
          for (const part of responseData.candidates[0].content.parts) {
            if (part.functionCall) {
              functionCalls.push(part.functionCall);
              hasFunctionCalls = true;
            }
          }
        }
        
        // If there are function calls, execute them
        if (hasFunctionCalls) {
          const functionResults = [];
          
          // Execute each function call
          for (const functionCall of functionCalls) {
            const { name, args } = functionCall;
            if (toolbox[name]) {
              const result = toolbox[name](args);
              functionResults.push({ name, result });
            }
          }
          
          // Call API again with all function results
          const conversationWithFunctionResult = [
            ...conversationIncludingPrompt,
            {
              role: "user",
              parts: functionResults.map(result => ({
                functionResponse: { name: result.name, response: { result: result.result } }
              })),
            },
          ];
          
          // Use dynamic generation config for function call response as well
          const functionCallResponseData = await fetchFromApi(conversationWithFunctionResult, dynamicGenerationConfig, apiKey);
          
          // Create bot response with original parts structure (preserving thought flags)
          const botResponse = {
            role: "model",
            parts: functionCallResponseData.candidates[0].content.parts,
          };
          
          setConversation([...conversationIncludingPrompt, botResponse]);
        } else {
          const botResponse = {
            role: "model",
            parts: responseData.candidates[0].content.parts,
          };
          
          setConversation([...conversationIncludingPrompt, botResponse]);
          
          // Generate follow-up questions
          setNextQuestionLoading(true);
          try {
            const nextQuestionResponseData = await fetchFromApi(conversationIncludingPrompt, generationConfigForNextQuestion, apiKey);
            const nextQuestionResponseObj = extractTextFromResponse(nextQuestionResponseData);
            const nextQuestionResponseText = nextQuestionResponseObj.responseText;
            
            // Parse follow-up questions
            if (nextQuestionResponseText) {
              const lines = nextQuestionResponseText.split('\n');
              const questions = lines
                .filter(line => line.trim().startsWith('Q: '))
                .map(line => line.replace('Q: ', '').trim())
                .slice(0, 3);
              
              setFollowUpQuestions(questions);
            }
          } catch (error) {
            console.error('Error generating follow-up questions:', error);
          } finally {
            setNextQuestionLoading(false);
          }
        }
      } else {
        // No content from the response?  Add a default response
        const defaultResponse = {
          role: "model",
          parts: [{ text: "I'm sorry, I didn't understand that. Could you please rephrase?" }],
        };
        setConversation([...conversationIncludingPrompt, defaultResponse]);
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
    // For follow-up questions, we'll use the same thinking behavior as the original question
    // Default to 0 (no thinking) for consistency
    handleSubmit(question, 0);
    setFollowUpQuestions([]);
  };

  // Reset conversation history
  const resetConversation = () => {
    if (window.confirm('Are you sure you want to reset the conversation history?')) {
      setConversation([]);
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
        alert('Conversation history uploaded successfully');
        // Clear the file input
        event.target.value = '';
      } catch (error) {
        alert('Failed to upload conversation history. Please provide a valid JSON file.');
        console.error('Error parsing uploaded file:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Container className="App">
      <Row>
        <Col xs={12} className="mb-3 mt-3">
          <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
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
          <Row>
            <Col>
              <ConversationHistory history={conversation} />
            </Col>
          </Row>
          <Row>
            <Col>
              {loading ? (
                <LoadingSpinner />
              ) : (
                <QuestionInput onSubmit={handleSubmit} disabled={loading} />
              )}
              <FollowUpQuestions 
                questions={followUpQuestions}
                onQuestionClick={handleFollowUpClick}
                isLoading={nextQuestionLoading}
              />
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