import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle, ChevronRight, Send, User, Bot, RefreshCw, IndianRupee, Clock, Flag, Calendar, Plus } from 'lucide-react';
import axios from 'axios';
import './AIRequirementGenerator.scss';

const QUESTION_NODES = {
    eventName: {
        text: "Hello! What event are you planning today?",
        process: (v) => v,
        next: () => 'eventType'
    },
    eventType: {
        text: "Is this a Workshop, Seminar, Cultural event, or something else?",
        process: (v) => v,
        next: () => 'days'
    },
    days: {
        text: "How many days will the event last? (e.g., 1, 2)",
        process: (v) => { const num = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(num) ? 1 : num; },
        next: () => 'participants'
    },
    participants: {
        text: "How many participants are expected?",
        process: (v) => { const num = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(num) ? 50 : num; },
        next: () => 'isInternal'
    },
    isInternal: {
        text: "Is this an internal event or are external participants joining? (Type 'Internal' or 'External')",
        process: (v) => !v.toLowerCase().includes('external'),
        next: () => 'venue'
    },
    venue: {
        text: "Where will the event be conducted? (e.g., Lab, Seminar Hall)",
        process: (v) => v.toLowerCase().includes('lab') ? 'lab' : 'seminar',
        next: () => 'laptopType'
    },
    laptopType: {
        text: "Will participants use College 'Systems' (Lab) or 'Personal Laptops'?",
        process: (v) => v.toLowerCase().includes('system') || v.toLowerCase().includes('college') ? 'system' : 'laptop',
        next: () => 'softwareRequired'
    },
    softwareRequired: {
        text: "Does this require any specific software installation? (Type 'Yes' or 'No/None')",
        process: (v) => v.toLowerCase().includes('yes'),
        next: (v) => v ? 'softwareType' : 'resourcePerson'
    },
    softwareType: {
        text: "Is the software Free or Paid?",
        process: (v) => v.toLowerCase().includes('paid') ? 'paid' : 'free',
        next: (v) => v === 'paid' ? 'softwareCost' : 'resourcePerson'
    },
    softwareCost: {
        text: "Please enter the estimated software license cost:",
        process: (v) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 5000,
        next: () => 'resourcePerson'
    },
    resourcePerson: {
        text: "Will there be a Resource Person or Chief Guest? (Type 'Yes' or 'No')",
        process: (v) => v.toLowerCase().includes('yes'),
        next: (v) => v ? 'resourcePersonType' : 'participantFood'
    },
    resourcePersonType: {
        text: "Is the Resource Person Internal or External?",
        process: (v) => v.toLowerCase().includes('external') ? 'external' : 'internal',
        next: () => 'honorarium'
    },
    honorarium: {
        text: "What is the estimated Honorarium/Payment amount for the guest?",
        process: (v) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
        next: (v, data) => data.resourcePersonType === 'external' ? 'guestAccommodation' : 'participantFood'
    },
    guestAccommodation: {
        text: "Does the external guest need accommodation? (Type 'Yes' or 'No')",
        process: (v) => v.toLowerCase().includes('yes'),
        next: () => 'guestTravel'
    },
    guestTravel: {
        text: "Do they require a travel expense allowance? (Type 'Yes' or 'No')",
        process: (v) => v.toLowerCase().includes('yes'),
        next: (v) => v ? 'travelExpense' : 'participantFood'
    },
    travelExpense: {
        text: "What is the estimated travel expense?",
        process: (v) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
        next: () => 'participantFood'
    },
    participantFood: {
        text: "What food arrangements are needed for the participants? (You can select multiple)",
        type: 'checkboxes',
        options: [
            { id: 'breakfast', label: 'Breakfast', price: 100 },
            { id: 'lunch', label: 'Lunch', price: 200 },
            { id: 'dinner', label: 'Dinner', price: 250 },
            { id: 'refreshments', label: 'Refreshments (Tea/Snacks) - 2x/day', price: 100 }
        ],
        process: (v) => v, // we'll pass an array of selected IDs directly
        next: () => 'certification'
    },
    certification: {
        text: "Will certificates be provided to participants? (Type 'Yes' or 'No')",
        process: (v) => v.toLowerCase().includes('yes'),
        next: () => null // End of dynamic tree
    }
};

const AIRequirementGenerator = ({ onRequirementsGenerated }) => {
    const [currentKey, setCurrentKey] = useState('eventName');
    const [stepCount, setStepCount] = useState(0);
    const [eventData, setEventData] = useState({
        eventName: '', eventType: '', participants: 50, days: 1, isInternal: true,
        venue: 'seminar', laptopType: 'laptop', softwareRequired: false, softwareType: 'free', softwareCost: 0,
        resourcePerson: false, resourcePersonType: 'internal', honorarium: 0, guestAccommodation: false,
        guestTravel: false, travelExpense: 0, participantFood: 'Refreshments', certification: true
    });
    const [messages, setMessages] = useState([
        { id: '1', text: QUESTION_NODES['eventName'].text, sender: 'ai', type: 'text' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [chatNotes, setChatNotes] = useState([]);

    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        if (chatEndRef.current) {
            const parent = chatEndRef.current.parentElement;
            if (parent) {
                parent.scrollTo({
                    top: parent.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e, customValue = null) => {
        if (e) e.preventDefault();

        // Use customValue if provided (like from checkbox submit), otherwise use inputValue
        const rawMessage = customValue !== null ? customValue : inputValue;
        if ((!rawMessage || (typeof rawMessage === 'string' && !rawMessage.trim())) && customValue === null) return;

        const userDisplayMessage = customValue !== null && Array.isArray(customValue)
            ? (customValue.length > 0 ? customValue.join(", ") : "None")
            : rawMessage.trim();

        if (customValue === null) setInputValue('');

        // Add user response to chat
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: userDisplayMessage,
            sender: 'user',
            type: 'text'
        }]);

        // Process data based on current step
        if (!currentKey) {
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                const customNoteName = userDisplayMessage;

                // Add to notes instead of creating a fake item
                setChatNotes(prev => prev.includes(customNoteName) ? prev : [...prev, customNoteName]);

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: `I've added "${customNoteName}" to your Event Notes below. Anything else?`,
                    sender: 'ai',
                    type: 'text'
                }]);
            }, 800);
            return;
        }

        const currentNode = QUESTION_NODES[currentKey];
        if (!currentNode) return;

        const processedValue = currentNode.process(customValue !== null ? customValue : rawMessage);
        const updatedData = { ...eventData, [currentKey]: processedValue };
        setEventData(updatedData);

        // Add affirmative answers to notes automatically
        let noteText = '';
        if (currentKey === 'softwareRequired' && processedValue === true) noteText = 'Software Installation Required';
        if (currentKey === 'resourcePerson' && processedValue === true) noteText = 'Resource Person / Guest Required';
        if (currentKey === 'guestAccommodation' && processedValue === true) noteText = 'Guest Accommodation Required';
        if (currentKey === 'guestTravel' && processedValue === true) noteText = 'Guest Travel Allowance Required';
        if (currentKey === 'certification' && processedValue === true) noteText = 'Certificates to be printed';
        if (currentKey === 'isInternal' && processedValue === false) noteText = 'External participants joining';

        if (noteText) {
            setChatNotes(prev => prev.includes(noteText) ? prev : [...prev, noteText]);
        }

        const nextKey = currentNode.next(processedValue, updatedData);

        if (nextKey) {
            setCurrentKey(nextKey);
            setStepCount(prev => prev + 1);

            // Add typing delay
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: QUESTION_NODES[nextKey].text,
                    sender: 'ai',
                    type: QUESTION_NODES[nextKey].type || 'text',
                    options: QUESTION_NODES[nextKey].options || null,
                    nodeKey: nextKey
                }]);
            }, 800);
        } else {
            setCurrentKey(null);
            setStepCount(prev => prev + 1);
            fetchAnalysis(updatedData);
        }
    };

    const fetchAnalysis = async (dataPayload) => {
        setLoading(true);
        setStep(questions.length); // Generating step

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/ai/analyze-event', dataPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const data = response.data.data;
                setAnalysis(data);

                let responseText = data.nextQuestion;
                if (!responseText) {
                    const typeDisplay = dataPayload.eventType || 'event';
                    const typeStr = typeDisplay.toLowerCase();
                    const externalStr = dataPayload.isInternal ? 'internal' : 'external';
                    responseText = `Based on your ${dataPayload.days}-day ${externalStr} ${typeStr} with ${dataPayload.participants} participants, I've generated recommended requirements. Please review and select the items you need. Would you like to modify anything?`;
                }

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: responseText,
                    sender: 'ai',
                    type: 'analysis',
                    data: data
                }]);

                if (data.checklist) {
                    setSelectedItems(data.checklist);
                }
            } else {
                addAiMessage("Sorry, I encountered an error while analyzing your event.");
            }
        } catch (err) {
            console.error('Chat Error:', err);
            addAiMessage("I'm having trouble connecting to my servers right now.");
        } finally {
            setLoading(false);
        }
    };

    const addAiMessage = (text) => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'ai', type: 'text' }]);
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
                eventName: eventData.eventName,
                selectedItems,
                budgetSuggestions: analysis.budgetSuggestions,
                analysisDetails: analysis.analysis,
                chatNotes
            });
        }
    };

    const renderMessageContent = (msg) => {
        if (msg.sender === 'ai' && msg.type === 'analysis' && msg.data) {
            const { items, estimatedTotal } = msg.data;
            return (
                <div className="ai-content-bubble advanced">
                    <p>{msg.text}</p>

                    {items && items.length > 0 && (
                        <div className="budget-preview">
                            <div className="budget-preview-header">
                                <IndianRupee size={16} /> Estimated Cost Preview
                            </div>
                            <div className="budget-items-list">
                                {items.map((item, idx) => (
                                    <div key={idx} className={`budget-item-row priority-${item.priority.toLowerCase()}`} onClick={() => toggleItem(item.name)}>
                                        <div className="item-details">
                                            <div className="item-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.includes(item.name)}
                                                    readOnly
                                                    className="checklist-cb"
                                                />
                                                <div>
                                                    <span className="item-name">{item.name}</span>
                                                    <span className="quantity-tag">Qty: {item.quantity}</span>
                                                </div>
                                            </div>
                                            <div className="item-right">
                                                <span className={`priority-badge ${item.priority.toLowerCase()}`}>{item.priority}</span>
                                                <span className="item-cost">₹{item.estimatedCost.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="budget-total">
                                <span>Total Estimated Budget</span>
                                <span className="total-amount">₹{estimatedTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    {items && items.length > 0 && (
                        <div className="timeline-generator">
                            <div className="timeline-header">
                                <Calendar size={16} /> Recommended Event Timeline
                            </div>
                            <div className="timeline-steps">
                                <div className="t-step"><div className="t-icon"></div><p><b>2 Weeks Before:</b> Confirm Venue & Requirements</p></div>
                                <div className="t-step"><div className="t-icon"></div><p><b>1 Week Before:</b> Finalize participants & Guest Mementos</p></div>
                                <div className="t-step"><div className="t-icon"></div><p><b>1 Day Before:</b> Setup Equipment & Decorations</p></div>
                                <div className="t-step final"><div className="t-icon"></div><p><b>Event Day:</b> Execution & Logistic Support</p></div>
                            </div>
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
                    <div>
                        <h3>AI Planning Assistant</h3>
                        <div className="progress-steps text-xs text-gray-400 mt-1 flex gap-2">
                            <span className={stepCount >= 0 ? 'text-indigo-600 font-medium' : ''}>1. Info</span> {'>'}
                            <span className={stepCount >= 4 ? 'text-indigo-600 font-medium' : ''}>2. Requirements</span> {'>'}
                            <span className={!currentKey ? 'text-indigo-600 font-medium' : ''}>3. Budget</span>
                        </div>
                    </div>
                </div>
                <button className="reset-btn" onClick={() => {
                    setCurrentKey('eventName');
                    setStepCount(0);
                    setEventData({
                        eventName: '', eventType: '', participants: 50, days: 1, isInternal: true,
                        venue: 'seminar', laptopType: 'laptop', softwareRequired: false, softwareType: 'free', softwareCost: 0,
                        resourcePerson: false, resourcePersonType: 'internal', honorarium: 0, guestAccommodation: false,
                        guestTravel: false, travelExpense: 0, participantFood: 'Refreshments', certification: true
                    });
                    setAnalysis(null);
                    setSelectedItems([]);
                    setChatNotes([]);
                    setMessages([{ id: '1', text: QUESTION_NODES['eventName'].text, sender: 'ai', type: 'text' }]);
                }}>
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

            {analysis && (
                <div className="current-summary">
                    <div className="summary-badges">
                        <span className="badge-count">{selectedItems.length} items verified</span>
                        <div className="flex gap-2">
                            <button className="btn btn-secondary text-sm px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-1" onClick={() => {
                                setInputValue("Professional Video Coverage");
                            }}>
                                <Plus size={14} /> Add Item
                            </button>
                            <button className="apply-trigger" onClick={handleApply}>
                                Proceed to Budget Planning <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    placeholder={analysis ? "Need something else? Just ask..." : "Type your response..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={loading}
                    autoFocus
                />
                <button type="submit" className="send-btn" disabled={!inputValue.trim() || loading}>
                    <Send size={18} />
                </button>
            </form>

            {chatNotes.length > 0 && analysis && (
                <div className="ai-chat-notes-panel" style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Flag size={14} style={{ color: 'var(--primary)' }} /> Event Notes
                    </div>
                    <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', listStyleType: 'disc', margin: 0 }}>
                        {chatNotes.map((note, idx) => (
                            <li key={idx} style={{ paddingBottom: '2px' }}>{note}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AIRequirementGenerator;
