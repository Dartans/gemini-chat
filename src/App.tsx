import React from 'react';
import ApiKeyInput from './components/ApiKeyInput';
import ChatInterface from './components/ChatInterface';
import useCookie from './hooks/useCookie';
import './App.css'; // Create this CSS file

const App: React.FC = () => {
  const [apiKey] = useCookie('geminiApiKey');
  const [hasApiKey, setHasApiKey] = React.useState(!!apiKey);

  const handleApiKeySubmit = () => {
    setHasApiKey(true);
  };

  return (
    <div className="app">
      {!hasApiKey ? (
        <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />
      ) : (
        <ChatInterface />
      )}
    </div>
  );
};

export default App;