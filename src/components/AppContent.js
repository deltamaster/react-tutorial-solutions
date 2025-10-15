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
  };

  const generationConfigForNextQuestion = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 1024,
    responseMimeType: "text/plain",
  };

  // Handle chatbot question submission
  const handleSubmit = async (question) => {
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
      
      // Make API request
      const responseData = await fetchFromApi(conversationIncludingPrompt, generationConfig, apiKey, true);
      
      // Process response text
      const responseText = extractTextFromResponse(responseData);
      
      // Check for function call
      if (responseData.candidates && responseData.candidates[0].functionCall) {
        const { name, args } = responseData.candidates[0].functionCall;
        if (toolbox[name]) {
          const result = toolbox[name](args);
          
          // Call API again with function result
          const conversationWithFunctionResult = [
            ...conversationIncludingPrompt,
            {
              role: "function",
              parts: [{ text: JSON.stringify({ name, result }) }],
            },
          ];
          
          const functionCallResponseData = await fetchFromApi(conversationWithFunctionResult, generationConfig, apiKey);
          const functionCallResponseText = extractTextFromResponse(functionCallResponseData);
          
          const botResponse = {
            role: "model",
            parts: [{ text: functionCallResponseText }],
          };
          
          setConversation([...conversationIncludingPrompt, botResponse]);
        }
      } else {
        // Regular response
        const botResponse = {
          role: "model",
          parts: [{ text: responseText }],
        };
        
        setConversation([...conversationIncludingPrompt, botResponse]);
        
        // Generate follow-up questions
        setNextQuestionLoading(true);
        try {
          const nextQuestionResponseData = await fetchFromApi(conversationIncludingPrompt, generationConfigForNextQuestion, apiKey);
          const nextQuestionResponseText = extractTextFromResponse(nextQuestionResponseData);
          
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
    } catch (error) {
      console.error(error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  // Handle follow-up question click
  const handleFollowUpClick = (question) => {
    handleSubmit(question);
    setFollowUpQuestions([]);
  }

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
              <Button 
                variant="secondary" 
                onClick={resetConversation}
                style={{ display: conversation.length > 0 ? 'inline-block' : 'none' }}
              >
                <Icon.ArrowClockwise size={16} className="mr-2" />
                Reset Conversation
              </Button>
              <Button 
                variant="secondary" 
                onClick={downloadConversation}
                style={{ display: conversation.length > 0 ? 'inline-block' : 'none' }}
              >
                <Icon.Download size={16} className="mr-2" />
                Download History
              </Button>
              <div className="relative">
                <Button variant="secondary" as="label" htmlFor="upload-conversation">
                  <Icon.Upload size={16} className="mr-2" />
                  Upload History
                </Button>
                <input
                  id="upload-conversation"
                  type="file"
                  accept=".json"
                  onChange={uploadConversation}
                  style={{ display: "none" }} // Hide the actual input element
                />
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