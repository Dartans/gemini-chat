import React, { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onInputChange?: (message: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onInputChange }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(event.target.value);
    if (onInputChange) onInputChange(event.target.value);
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
      if (onInputChange) onInputChange('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="message-input">
      <textarea
        value={newMessage}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
};

export default MessageInput;