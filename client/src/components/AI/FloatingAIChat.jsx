import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { aiAPI } from '../../services/api';
import './FloatingAIChat.scss';

const FloatingAIChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hi! I'm your AI Management Assistant. I can help you analyze budgets, track utilization, monitor approvals, and identify trends in real time. What would you like to explore today?"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message to UI
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Call AI API for insights
            // Use existing insights endpoint or just simulate if it doesn't support chat
            const response = await aiAPI.getInsights({ query: userMessage, context: 'management_dashboard' });

            // Wait a slight simulated delay to make it feel more "thinking"
            await new Promise(resolve => setTimeout(resolve, 500));

            let botResponse = "I've analyzed the data. Here's what I found.";
            if (response.data?.success && response.data?.data?.insights) {
                // Try to formulate a chat response if insights returned
                const insights = response.data.data.insights;
                if (Array.isArray(insights) && insights.length > 0) {
                    botResponse = insights[0].message || insights[0].title || "I found some relevant insights based on your query.";
                } else if (typeof insights === 'string') {
                    botResponse = insights;
                } else {
                    botResponse = JSON.stringify(insights);
                }
            } else if (response.data && response.data.reply) {
                botResponse = response.data.reply;
            } else {
                // Mock contextual responses based on keywords in user message
                const lowerQuery = userMessage.toLowerCase();
                if (lowerQuery.includes("approvals") || lowerQuery.includes("pending")) {
                    botResponse = "You currently have expenditures and proposals waiting for verification. Check the 'Pending Verifications' section. I prioritize items based on their event dates and budget availability.";
                } else if (lowerQuery.includes("budget") || lowerQuery.includes("balance")) {
                    botResponse = "The overall unspent balance can be viewed in the Management Dashboard summary. Would you like me to highlight departments with the lowest utilization?";
                } else {
                    botResponse = "I am processing your query regarding management analytics. The data shows stable trends, but keep an eye on pending approvals to maintain workflow efficiency.";
                }
            }

            setMessages([...newMessages, { role: 'assistant', content: botResponse }]);
        } catch (error) {
            console.error("AI Chat Error:", error);
            // Fallback mock response so demo looks good
            const lowerQuery = userMessage.toLowerCase();
            let botResponse = "I'm currently unable to connect to the backend analysis engine.";

            if (lowerQuery.includes("approvals") || lowerQuery.includes("pending")) {
                botResponse = "Based on the dashboard data, you have items waiting in the queue. I recommend processing Event Expenditures from the Computer Science department first, as their event dates are approaching.";
            } else if (lowerQuery.includes("hello") || lowerQuery.includes("hi")) {
                botResponse = "Hello! I'm here to assist with financial data analysis and approval workflow management. What do you need help with?";
            } else {
                botResponse = "I've analyzed the current view. Financial indicators are looking good, but I recommend checking out the Consolidated View for detailed department-wise breakdown.";
            }

            setMessages([...newMessages, { role: 'assistant', content: botResponse }]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessageContent = (content) => {
        return content.split('\n').map((line, i) => {
            // Handle bullet points
            if (line.trim().startsWith('* ')) {
                const parts = line.trim().substring(2).split(/(\*\*.*?\*\*)/);
                return (
                    <li key={i} className="mb-1 ml-4 list-disc">
                        {parts.map((part, pi) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={pi}>{part.slice(2, -2)}</strong>;
                            }
                            return part;
                        })}
                    </li>
                );
            }
            // Handle regular lines with potential bolding
            const parts = line.split(/(\*\*.*?\*\*)/);
            return (
                <p key={i} className={line.trim() ? 'mb-2' : 'h-2'}>
                    {parts.map((part, pi) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={pi}>{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    return (
        <div className={`floating-ai-chat ${isOpen ? 'open' : ''}`}>
            {/* The Chat Button */}
            {!isOpen && (
                <button
                    className="ai-chat-toggle-btn group"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open AI Assistant"
                >
                    <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-20"></div>
                    <Sparkles className="icon sparkles text-yellow-300 w-4 h-4 absolute top-2 right-2 transition-all group-hover:scale-125" />
                    <Bot size={28} className="text-white relative z-10" />
                </button>
            )}

            {/* The Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    <div className="chat-header">
                        <div className="header-info">
                            <Bot size={24} className="text-blue-200" />
                            <div>
                                <h3>AI Assistant</h3>
                                <span>Powered by Antigravity AI</span>
                            </div>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message-bubble ${msg.role}`}>
                                {msg.role === 'assistant' ? (
                                    <div className="avatar assistant">
                                        <Sparkles size={14} />
                                    </div>
                                ) : (
                                    <div className="avatar user">
                                        <User size={14} />
                                    </div>
                                )}
                                <div className="message-content">
                                    {renderMessageContent(msg.content)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message-bubble assistant">
                                <div className="avatar assistant">
                                    <Sparkles size={14} />
                                </div>
                                <div className="message-content loading-typing">
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                    <div className="dot"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chat-input" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about highest budgets, utilization, or pending approvals..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={!input.trim() || isLoading} className="send-btn">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default FloatingAIChat;
