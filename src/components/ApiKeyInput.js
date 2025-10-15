// API key input component
function ApiKeyInput({ apiKey, setApiKey }) {
  const handleSaveApiKey = () => {
    localStorage.setItem("geminiApiKey", apiKey);
  };

  return (
    <div className="api-key-container">
      <label htmlFor="api-key">Enter API Key</label>
      <input
        id="api-key"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter API Key"
        onBlur={handleSaveApiKey} // Store API key on blur (optional)
        className="api-key-input"
      />
    </div>
  );
}

export default ApiKeyInput;