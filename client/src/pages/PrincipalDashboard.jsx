import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetProposalAPI, expenditureAPI, reportAPI, financialYearAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear } from '../utils/dateUtils';
import {
    CheckCircle,
    Clock,
    IndianRupee,
    ArrowRight,
    Eye,
    ShieldCheck,
    Wallet,
    FileText,
    TrendingUp,
    AlertCircle,
    Check,
    RefreshCw,
    Calendar
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import StatusBadge from '../components/Common/StatusBadge';
import FloatingAIChat from '../components/AI/FloatingAIChat';
import './HODDashboard.scss'; // Reusing HOD dashboard styles for consistency

const PrincipalDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [proposals, setProposals] = useState([]);
    const [expenditures, setExpenditures] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [financialYears, setFinancialYears] = useState([]);
    const [targetYear, setTargetYear] = useState(getCurrentFinancialYear());
    const { socket } = useSocket();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [proposalsRes, expendituresRes, reportRes, yearsRes] = await Promise.all([
                budgetProposalAPI.getBudgetProposals({ status: 'verified_by_hod', financialYear: targetYear }),
                expenditureAPI.getExpenditures({ status: 'verified', financialYear: targetYear }), // Verified by HOD, waiting for Principal
                reportAPI.getDashboardReport({ financialYear: targetYear }),
                financialYearAPI.getFinancialYears()
            ]);

            setProposals(proposalsRes.data.data.proposals || []);
            setExpenditures(expendituresRes.data.data.expenditures || []);
            setStats(reportRes.data.data.consolidated);
            const years = yearsRes.data.data.financialYears || [];
            setFinancialYears(Array.isArray(years) ? years.map(fy => fy.year) : []);
            setError(null);
        } catch (err) {
            console.error('Error fetching principal dashboard data:', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [targetYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDateToFY = (e) => {
        const date = new Date(e.target.value);
        if (isNaN(date.getTime())) return;
        const month = date.getMonth();
        const year = date.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        setTargetYear(`${startYear}-${startYear + 1}`);
    };

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

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return <div className="page-container"><div className="loading">Loading Management Dashboard...</div></div>;
    }

    return (
        <div className="page-container hod-dashboard-container">
            <PageHeader
                title="Management Dashboard"
                subtitle="Approval Queue & Financial Oversight"
            >
                <button className="btn btn-secondary flex items-center gap-2" onClick={fetchData}>
                    <RefreshCw size={18} /> Refresh Dashboard
                </button>
            </PageHeader>

            {error && <div className="error-message">{error}</div>}

            {stats && (
                <div className="stats-grid-4 mb-5">
                    <StatCard
                        title="Total Budget"
                        value={formatCurrency(stats.totalAllocated)}
                        icon={<IndianRupee size={24} />}
                        subtitle="Annual Allocation"
                    />
                    <StatCard
                        title="Utilized Fund"
                        value={formatCurrency(stats.totalUtilized)}
                        icon={<TrendingUp size={24} />}
                        color="var(--success)"
                        subtitle="Finalized Expenses"
                    />
                    <StatCard
                        title="Pending Queue"
                        value={(expenditures.length + proposals.length)}
                        icon={<Clock size={24} />}
                        isPending={true}
                        subtitle="Awaiting Your Review"
                    />
                    <StatCard
                        title="Unspent Balance"
                        value={formatCurrency(stats.remainingBalance)}
                        icon={<Wallet size={24} />}
                        subtitle={`Institutional Balance (${targetYear})`}
                    />
                </div>
            )}



            <div className="approvals-section">
                <div className="section-header">
                    <div className="header-left">
                        <h2>Pending Verifications (Verified by HOD)</h2>
                        <span className="count-badge">{expenditures.length + proposals.length}</span>
                    </div>
                    <button
                        onClick={() => navigate('/approvals')}
                        className="btn btn-text"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        View Full Queue <ArrowRight size={16} />
                    </button>
                </div>

                <div className="table-container card-standard p-0 overflow-hidden border-0 shadow-sm">
                    <table className="approvals-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Department</th>
                                <th>Reference / Proposal</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.length === 0 && expenditures.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-gray-500">
                                        <div className="flex flex-col items-center gap-2 py-8">
                                            <CheckCircle size={48} className="text-gray-200" />
                                            <p className="font-medium">All caught up! No items waiting for your verification.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {/* Render Proposals */}
                                    {proposals.map(proposal => (
                                        <tr key={proposal._id}>
                                            <td><span className="type-tag proposal">Budget Proposal</span></td>
                                            <td>{proposal.department?.name}</td>
                                            <td>
                                                <div className="font-bold">Annual Budget {proposal.financialYear}</div>
                                                <div className="text-xs text-gray-500">{proposal.proposalItems?.length} items</div>
                                            </td>
                                            <td>{formatDate(proposal.submittedAt || proposal.createdAt)}</td>
                                            <td className="font-bold text-blue-600">{formatCurrency(proposal.totalProposedAmount)}</td>
                                            <td>
                                                <div className="action-buttons-mini" style={{ justifyContent: 'flex-end' }}>
                                                    <button className="btn-verify" onClick={() => navigate('/approvals')}>
                                                        <Eye size={14} /> Process
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Render Expenditures */}
                                    {expenditures.map(exp => (
                                        <tr key={exp._id}>
                                            <td><span className="type-tag expenditure">Event Expenditure</span></td>
                                            <td>{exp.department?.name}</td>
                                            <td>
                                                <div className="font-bold">{exp.eventName}</div>
                                                <div className="text-xs text-gray-500">{exp.eventType} | {exp.budgetHead?.name}</div>
                                            </td>
                                            <td>{formatDate(exp.eventDate)}</td>
                                            <td className="font-bold text-emerald-600">{formatCurrency(exp.totalAmount)}</td>
                                            <td>
                                                <div className="action-buttons-mini" style={{ justifyContent: 'flex-end' }}>
                                                    <button className="btn-verify" onClick={() => navigate('/approvals')}>
                                                        <Eye size={14} /> Process
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="quick-management mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card-standard">
                    <h3>Analytics Oversight</h3>
                    <p className="text-sm text-gray-500 mb-4">Review institutional financial health and departmental performance.</p>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/consolidated-view')} className="btn btn-secondary flex items-center gap-2">
                            <ShieldCheck size={18} /> Consolidated View
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Chat Integration */}
            <FloatingAIChat />
        </div>
    );
};

export default PrincipalDashboard;
