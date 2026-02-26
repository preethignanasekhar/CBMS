import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle, AlertCircle, Plus, Info, ChevronRight, Wand2, Loader2, Send, User, Bot, RefreshCw } from 'lucide-react';
import axios from 'axios';
import './AIRequirementGenerator.scss';

const AIRequirementGenerator = ({ onRequirementsGenerated }) => {
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: "Hello! I'm your AI Budget Assistant. What event are you planning today?",
            sender: 'ai',
            type: 'text'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [error, setError] = useState(null);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!inputValue.trim() || loading) return;

        const userMessage = inputValue;
        setInputValue('');

        // Add user message to chat
        const newMessage = {
            id: Date.now().toString(),
            text: userMessage,
            sender: 'user',
            type: 'text'
        };
        setMessages(prev => [...prev, newMessage]);
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/ai/analyze-event', {
                eventName: analysis?.eventName || userMessage,
                eventDescription: userMessage
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const data = response.data.data;
                setAnalysis(data);

                // Add AI Response
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: data.nextQuestion || "Here's what I've suggested so far:",
                    sender: 'ai',
                    type: 'text',
                    data: data
                }]);

                // Update selected items with new suggestions if not already present
                if (data.checklist) {
                    const newItems = data.checklist.filter(item => !selectedItems.includes(item));
                    if (newItems.length > 0) {
                        setSelectedItems(prev => [...new Set([...prev, ...data.checklist])]);
                    }
                }
            } else {
                setError('Failed to analyze event');
            }
        } catch (err) {
            console.error('Chat Error:', err);
            setError('Error connecting to AI service');
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (item) => {
        if (selectedItems.includes(item)) {
            setSelectedItems(selectedItems.filter(i => i !== item));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const handleApply = () => {
        if (onRequirementsGenerated && analysis) {
            onRequirementsGenerated({
                eventName: analysis.eventName || analysis.analysis?.eventName,
                selectedItems,
                budgetSuggestions: analysis.budgetSuggestions,
                analysisDetails: analysis.analysis
            });
        }
    };

    const renderMessageContent = (msg) => {
        if (msg.sender === 'ai' && msg.id !== '1' && msg.data) {
            return (
                <div className="ai-content-bubble">
                    <p>{msg.text}</p>

                    {msg.data.checklist && msg.data.checklist.length > 0 && (
                        <div className="mini-checklist">
                            <div className="checklist-header">
                                <CheckCircle size={14} /> <span>Suggestions Added</span>
                            </div>
                            <div className="suggestion-chips">
                                {msg.data.checklist.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`chip ${selectedItems.includes(item) ? 'active' : ''}`}
                                        onClick={() => toggleItem(item)}
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {msg.data.followUps && msg.data.followUps.length > 0 && (
                        <div className="follow-up-suggestions">
                            {msg.data.followUps.map((fu, idx) => (
                                <button
                                    key={idx}
                                    className="btn-suggestion"
                                    onClick={() => {
                                        setInputValue(fu.itemToAdd);
                                        // Auto-send can be implemented here
                                    }}
                                >
                                    Add {fu.itemToAdd}?
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        return <p>{msg.text}</p>;
    };

    return (
        <div className="ai-chatbot-container">
            <div className="chatbot-header">
                <div className="header-info">
                    <Sparkles className="sparkle-icon" size={20} />
                    <div className="status-dot"></div>
                    <h3>AI Planning Assistant</h3>
                </div>
                <button className="reset-btn" onClick={() => setMessages([{ id: '1', text: "Hello! What event should we plan today?", sender: 'ai', type: 'text' }])}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-row ${msg.sender}`}>
                        <div className="avatar">
                            {msg.sender === 'ai' ? <Bot size={16} /> : <User size={16} />}
                        </div>
                        <div className="message-bubble">
                            {renderMessageContent(msg)}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="message-row ai">
                        <div className="avatar"><Bot size={16} /></div>
                        <div className="message-bubble loading">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {selectedItems.length > 0 && (
                <div className="current-summary">
                    <div className="summary-badges">
                        <span className="badge-count">{selectedItems.length} items planned</span>
                        <button className="apply-trigger" onClick={handleApply}>
                            Proceed to Budget <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder="Type your response..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" className="send-btn" disabled={!inputValue.trim() || loading}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};

export default AIRequirementGenerator;
