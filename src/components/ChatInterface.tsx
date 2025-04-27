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

interface ChatInterfaceProps {
  systemInstruction: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ systemInstruction }) => {
  const [apiKey] = useCookie('geminiApiKey');
  const [userName] = useCookie('userName');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentInput, setCurrentInput] = useState('');

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Update full AI request preview on input or system instruction change
  useEffect(() => {
    let fullSystemInstruction = systemInstruction;
    if (userName) {
      fullSystemInstruction = `'''the users name is ${userName}''' ` + (systemInstruction || '');
    }
    window.dispatchEvent(new CustomEvent('updateFullRequest', { detail: JSON.stringify({
      systemInstruction: fullSystemInstruction,
      userMessage: currentInput,
      userName: userName || undefined
    }, null, 2) }));
  }, [systemInstruction, userName, currentInput]);

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
      let fullSystemInstruction = systemInstruction;
      if (userName) {
        fullSystemInstruction = `'''the users name is ${userName}''' ` + (systemInstruction || '');
      }
      // Dispatch event to update sidebar
      window.dispatchEvent(new CustomEvent('updateFullRequest', { detail: JSON.stringify({
        systemInstruction: fullSystemInstruction,
        userMessage: newMessage,
        userName: userName || undefined
      }, null, 2) }));
      const systemInput: ChatConfig = {
        systemInstruction: fullSystemInstruction,
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
      setCurrentInput(''); // Clear preview after send
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-container" ref={chatContainerRef}>
        {messages.map((message: Message, index: number) => (
          <MessageItem key={index} message={message} />
        ))}
        {loading && <LoadingIndicator />}
      </div>
      <MessageInput onSendMessage={handleSendMessage} onInputChange={setCurrentInput} />
    </div>
  );
};

export default ChatInterface;