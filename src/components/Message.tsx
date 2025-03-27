import React from 'react';
import { Message as MessageType } from '../types/message';
import './Message.css'; // Create this CSS file

interface Props {
  message: MessageType;
}

const Message: React.FC<Props> = ({ message }) => {
  return (
    <div className={`message ${message.isUser ? 'user' : 'ai'}`}>
      <div className="message-content">{message.text}</div>
      <div className="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default Message;