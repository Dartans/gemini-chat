import React, { useState, useEffect, useRef } from 'react';
import useCookie from '../hooks/useCookie';
import { Message } from '../types/message';
import MessageItem from './Message'; // Changed import name
import MessageInput from './MessageInput';
import LoadingIndicator from './LoadingIndicator';
import { chatWithGemini } from '../services/aiService';
import './ChatInterface.css';

interface ChatConfig {
  systemInstruction: string;
}

const ChatInterface: React.FC = () => {
  const [apiKey] = useCookie('geminiApiKey');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [systemInstruction, setSystemInstruction] = useState<string>('');

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSystemInstructionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemInstruction(event.target.value);
  };

  const handleSendMessage = async (newMessage: string) => {
    if (!apiKey) {
      alert('API Key not found. Please enter it in the previous screen.');
      return;
    }

    const userMessage: Message = {
      text: newMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setLoading(true);

    try {
      const systemInput: ChatConfig = {
        systemInstruction: systemInstruction,
      };
      const aiResponse = await chatWithGemini(apiKey, newMessage, systemInput); // Pass config

      if (aiResponse) {
        const aiMessage: Message = {
          text: aiResponse,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prevMessages) => [...prevMessages, aiMessage]);
      } else {
        console.error("Failed to get a response from Gemini.");
        setMessages(prevMessages => [...prevMessages, { text: "Sorry, I couldn't process your request.", isUser: false, timestamp: new Date() }]);
      }
    } catch (error) {
      console.error("Error during Gemini interaction:", error);
      setMessages(prevMessages => [...prevMessages, { text: "Sorry, an error occurred.", isUser: false, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="system-instruction-container">
        <label htmlFor="systemInstruction">System Instruction:</label>
        <textarea
          id="systemInstruction"
          value={systemInstruction}
          onChange={handleSystemInstructionChange}
          placeholder="Enter instructions for the AI (e.g., You are a helpful assistant)."
        />
      </div>
      <div className="chat-container" ref={chatContainerRef}>
        {messages.map((message: Message, index: number) => (
          <MessageItem key={index} message={message} />
        ))}
        {loading && <LoadingIndicator />}
      </div>
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatInterface;