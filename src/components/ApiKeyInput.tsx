import React, { useState } from 'react';
import useCookie from '../hooks/useCookie';

interface ApiKeyInputProps {
  onApiKeySubmit: () => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [, setApiKeyCookie] = useCookie('geminiApiKey');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setApiKeyCookie(apiKey, { expires: 365 }); // Store for a year
    onApiKeySubmit();
  };

  return (
    <div>
      <h2>Enter your Gemini API Key</h2>
      <h2>https://aistudio.google.com/app/apikey</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="apiKey">API Key:</label>
          <input
            type="text"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
        </div>
        <button type="submit">Save API Key</button>
      </form>
    </div>
  );
};

export default ApiKeyInput;