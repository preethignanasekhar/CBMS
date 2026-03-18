import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/Common/PageHeader';
import { CalendarCheck, Lightbulb, ArrowRight, CheckCircle2, Wallet, Info } from 'lucide-react';
import './EventBudget.scss';

const EventBudget = () => {
    const navigate = useNavigate();

    const steps = [
        {
            icon: <Info size={20} />,
            title: 'Prepare Requirements',
            desc: 'Identify the event requirements and resources needed for your academic event.'
        },
        {
            icon: <CheckCircle2 size={20} />,
            title: 'Review Checklist',
            desc: 'Ensure all necessary items like honorarium, transport, and refreshment are covered.'
        },
        {
            icon: <Wallet size={20} />,
            title: 'Create Budget Proposal',
            desc: 'Draft the budget proposal with estimated amounts for each requirement.'
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
                subtitle="Guidelines and planning for your event budget proposal"
            />

            <div className="event-budget-layout">
                {/* LEFT PANEL — Planning Info */}
                <div className="event-budget-left">
                    <div className="panel-label">
                        <Info size={16} className="info-icon" />
                        <span>Event Planning Guidelines</span>
                    </div>
                    <div className="planning-info-container" style={{ padding: '2rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Standard Operating Procedure</h3>
                        <p style={{ color: '#64748b', lineHeight: '1.6' }}>
                            When planning a departmental event (Seminar, Workshop, FDP, etc.), please ensure:
                        </p>
                        <ul style={{ color: '#64748b', paddingLeft: '1.25rem', marginTop: '1rem', lineHeight: '2' }}>
                            <li>Budget heads are correctly identified.</li>
                            <li>Resource persons' details are finalized.</li>
                            <li>Venue and duration are confirmed.</li>
                            <li>Honorarium and travel allowances are within institution norms.</li>
                        </ul>
                        <button 
                            className="btn btn-primary mt-4" 
                            onClick={() => navigate('/budget-proposals/add')}
                            style={{ width: '100%', marginTop: '2rem', padding: '1rem' }}
                        >
                            Proceed to Create Proposal <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {/* RIGHT PANEL — How it works */}
                <div className="event-budget-right">
                    <div className="how-it-works-card">
                        <div className="how-title">
                            <Lightbulb size={20} className="lightbulb" />
                            <h3>How It Works</h3>
                        </div>
                        <p className="how-subtitle">
                            Follow these steps to ensure a smooth budget approval process.
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
                            Submitting your proposal at least 15 days in advance ensures sufficient time for
                            administrative verification and financial allocation.
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
