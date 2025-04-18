import React from 'react';
import { Message as MessageType } from '../types/message';
import './Message.css';

interface Props {
  message: MessageType;
  isSelected?: boolean;
  onClick?: () => void;
}

const Message: React.FC<Props> = ({ message, isSelected = false, onClick }) => {
  return (
    <div 
      className={`message ${message.isUser ? 'user' : 'ai'} ${isSelected ? 'selected' : ''}`} 
      onClick={onClick}
    >
      <div className="message-content">{message.text}</div>
      <div className="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default Message;