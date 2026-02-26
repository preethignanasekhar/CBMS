import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIRequirementGenerator from '../components/AI/AIRequirementGenerator';
import PageHeader from '../components/Common/PageHeader';
import { Sparkles, CalendarCheck, Lightbulb, ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import './EventBudget.scss';

const EventBudget = () => {
    const navigate = useNavigate();
    const [generatedItems, setGeneratedItems] = useState(null);

    const handleRequirementsGenerated = (data) => {
        setGeneratedItems(data);
        // Redirect to budget proposal with pre-filled data
        navigate('/budget-proposals/add', {
            state: {
                eventName: data.eventName,
                selectedItems: data.selectedItems,
                budgetSuggestions: data.budgetSuggestions
            }
        });
    };

    const steps = [
        {
            icon: <Sparkles size={20} />,
            title: 'Describe Your Event',
            desc: 'Enter the event name and a brief description of requirements.'
        },
        {
            icon: <CheckCircle2 size={20} />,
            title: 'Review AI Checklist',
            desc: 'AI suggests items tailored to your event. Select what you need.'
        },
        {
            icon: <Wallet size={20} />,
            title: 'Create Budget Proposal',
            desc: 'Click "Add to Proposal" to pre-fill the budget form with your selections.'
        },
        {
            icon: <CalendarCheck size={20} />,
            title: 'Submit for Approval',
            desc: 'Submit the proposal and track it through the approval workflow.'
        }
    ];

    return (
        <div className="event-budget-page">
            <PageHeader
                title="Event Budget Planner"
                subtitle="Use AI to plan your event requirements and generate a budget proposal"
            />

            <div className="event-budget-layout">
                {/* LEFT PANEL — AI Planner */}
                <div className="event-budget-left">
                    <div className="panel-label">
                        <Sparkles size={16} className="sparkle" />
                        <span>AI Event Planner</span>
                    </div>
                    <AIRequirementGenerator onRequirementsGenerated={handleRequirementsGenerated} />
                </div>

                {/* RIGHT PANEL — How it works */}
                <div className="event-budget-right">
                    <div className="how-it-works-card">
                        <div className="how-title">
                            <Lightbulb size={20} className="lightbulb" />
                            <h3>How It Works</h3>
                        </div>
                        <p className="how-subtitle">
                            Follow these steps to create an event-specific budget proposal with AI assistance.
                        </p>

                        <div className="steps-list">
                            {steps.map((step, idx) => (
                                <div className="step-item" key={idx}>
                                    <div className="step-number">{idx + 1}</div>
                                    <div className="step-icon-wrapper">{step.icon}</div>
                                    <div className="step-content">
                                        <h4>{step.title}</h4>
                                        <p>{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="tip-card">
                        <div className="tip-title">
                            <Lightbulb size={16} />
                            <span>Pro Tip</span>
                        </div>
                        <p>
                            Be specific in your event description — mentioning the number of attendees, duration,
                            and required resources helps the AI generate a more accurate checklist.
                        </p>
                    </div>

                    <button
                        className="goto-proposals-btn"
                        onClick={() => navigate('/budget-proposals/add')}
                    >
                        Skip to Empty Proposal <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventBudget;
