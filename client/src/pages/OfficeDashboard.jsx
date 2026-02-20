import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetProposalAPI, expenditureAPI, reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    CheckCircle,
    Clock,
    IndianRupee,
    ArrowRight,
    Eye,
    ShieldCheck,
    Wallet,
    FileText,
    Activity
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import StatusBadge from '../components/Common/StatusBadge';
import './HODDashboard.scss'; // Reusing HOD dashboard styles for consistency

const OfficeDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [proposals, setProposals] = useState([]);
    const [expenditures, setExpenditures] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { socket } = useSocket();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const currentYear = '2025-2026'; // Should ideally be dynamic
            const [proposalsRes, expendituresRes, statsRes] = await Promise.all([
                budgetProposalAPI.getBudgetProposals({ status: 'verified_by_principal' }),
                expenditureAPI.getExpenditures({ status: 'approved' }), // Management approved, waiting for Office sanction
                budgetProposalAPI.getBudgetProposalsStats({ financialYear: currentYear })
            ]);

            setProposals(proposalsRes.data.data.proposals);
            setExpenditures(expendituresRes.data.data.expenditures);
            setStats(statsRes.data.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching office dashboard data:', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;
        const handleUpdate = () => fetchData();
        socket.on('notification', handleUpdate);
        return () => socket.off('notification', handleUpdate);
    }, [socket, fetchData]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return <div className="page-container"><div className="loading">Loading Office Dashboard...</div></div>;
    }

    return (
        <div className="page-container hod-dashboard-container">
            <PageHeader
                title="Office Dashboard"
                subtitle="Financial Sanctions & Budget Management"
            />

            {error && <div className="error-message">{error}</div>}

            {stats && (
                <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                    <StatCard
                        title="Deduction Pending"
                        value={expenditures.length}
                        icon={<Activity size={24} />}
                        color="var(--warning)"
                    />
                    <StatCard
                        title="Proposals Pending"
                        value={proposals.length}
                        icon={<Clock size={24} />}
                        color="var(--info)"
                    />
                    <StatCard
                        title="Total Approved"
                        value={formatCurrency(stats.totalAllocatedAmount || stats.totalApprovedAmount)}
                        icon={<IndianRupee size={24} />}
                        color="var(--success)"
                    />
                    <StatCard
                        title="Sanctioned Items"
                        value={stats.approvedProposals}
                        icon={<CheckCircle size={24} />}
                        color="var(--primary)"
                    />
                </div>
            )}

            <div className="expenditures-section" style={{ marginBottom: '3rem' }}>
                <div className="section-header">
                    <div className="header-left">
                        <h2>Expenditures Awaiting Final Sanction (Budget Deduction)</h2>
                        <span className="count-badge">{expenditures.length}</span>
                    </div>
                </div>

                {expenditures.length === 0 ? (
                    <div className="no-expenditures card-standard">
                        <div className="no-expenditures-icon">
                            <CheckCircle size={18} />
                        </div>
                        <p>No expenditures are currently awaiting final sanction.</p>
                    </div>
                ) : (
                    <div className="expenditures-grid">
                        {expenditures.map((exp) => (
                            <div key={exp._id} className="card-standard expenditure-card">
                                <div className="card-header">
                                    <div className="bill-info">
                                        <h3>{exp.eventName || exp.billNumber}</h3>
                                        <span className="amount text-primary">{formatCurrency(exp.totalAmount)}</span>
                                    </div>
                                    <StatusBadge status={exp.status} />
                                </div>
                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="label">Department:</span>
                                        <span className="value">{exp.department?.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Budget Head:</span>
                                        <span className="value">{exp.budgetHead?.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Items:</span>
                                        <span className="value">{exp.expenseItems?.length} items</span>
                                    </div>
                                </div>
                                <div className="card-footer">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => navigate('/approvals')}
                                    >
                                        <Eye size={16} /> Process Sanction
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="proposals-section">
                <div className="section-header">
                    <div className="header-left">
                        <h2>Budget Proposals Awaiting Allocation</h2>
                        <span className="count-badge">{proposals.length}</span>
                    </div>
                    <button
                        onClick={() => navigate('/approvals')}
                        className="btn btn-text"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        Go to Actions <ArrowRight size={16} />
                    </button>
                </div>

                {proposals.length === 0 ? (
                    <div className="no-expenditures card-standard">
                        <div className="no-expenditures-icon">
                            <CheckCircle size={18} />
                        </div>
                        <p>No budget proposals are currently awaiting allocation.</p>
                    </div>
                ) : (
                    <div className="expenditures-grid">
                        {proposals.map((proposal) => (
                            <div key={proposal._id} className="card-standard expenditure-card proposal-card">
                                <div className="card-header">
                                    <div className="bill-info">
                                        <h3>FY {proposal.financialYear}</h3>
                                        <span className="amount">{formatCurrency(proposal.totalProposedAmount)}</span>
                                    </div>
                                    <StatusBadge status={proposal.status} />
                                </div>

                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="label">Department:</span>
                                        <span className="value">{proposal.department?.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Submitted By:</span>
                                        <span className="value">{proposal.submittedBy?.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Items:</span>
                                        <span className="value">{proposal.proposalItems?.length} items</span>
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <div className="action-buttons">
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => navigate(`/budget-proposals/${proposal._id}`)}
                                        >
                                            <Eye size={16} /> Review & Allocate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="quick-actions card-standard" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                <h3>Quick Management</h3>
                <div className="action-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('/budget-heads')} className="btn btn-secondary">
                        <Wallet size={18} /> Manage Budget Heads
                    </button>
                    <button onClick={() => navigate('/categories')} className="btn btn-secondary">
                        <ShieldCheck size={18} /> Manage Categories
                    </button>
                    <button onClick={() => navigate('/allocations')} className="btn btn-secondary">
                        <IndianRupee size={18} /> View All Allocations
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OfficeDashboard;
