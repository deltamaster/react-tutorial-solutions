import React from 'react';

function ApiKeyInput({ subscriptionKey, setSubscriptionKey }) {
  const handleSaveSubscriptionKey = () => {
    localStorage.setItem('subscriptionKey', subscriptionKey);
  };

  return (
    <div className="api-key-container">
      <div>
        <label htmlFor="subscription-key" className="d-block mb-1">Subscription Key</label>
        <input
          id="subscription-key"
          type="password"
          value={subscriptionKey}
          onChange={(e) => setSubscriptionKey(e.target.value)}
          placeholder="Enter your subscription key"
          onBlur={handleSaveSubscriptionKey}
          className="api-key-input w-100"
        />
      </div>
    </div>
  );
}

export default ApiKeyInput;