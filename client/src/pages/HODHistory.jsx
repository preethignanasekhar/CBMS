import React, { useState, useEffect } from 'react';
import { budgetProposalAPI, expenditureAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/Common/PageHeader';
import StatusBadge from '../components/Common/StatusBadge';
import { FileText, Calculator, Search, AlertTriangle } from 'lucide-react';
import './HODHistory.scss';

const HODHistory = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('proposals');
    const [proposals, setProposals] = useState([]);
    const [expenditures, setExpenditures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchHistory();
    }, [activeTab]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const deptId = user?.department?._id || user?.department;

            if (activeTab === 'proposals') {
                const response = await budgetProposalAPI.getBudgetProposals({
                    department: deptId,
                    limit: 100
                });
                const data = response?.data?.data;
                setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
            } else {
                const response = await expenditureAPI.getExpenditures({
                    department: deptId,
                    limit: 100
                });
                const data = response?.data?.data;
                setExpenditures(Array.isArray(data?.expenditures) ? data.expenditures : []);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            setError(err?.response?.data?.message || err?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        if (amount == null || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (date) => {
        if (!date) return '—';
        try {
            return new Date(date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return '—';
        }
    };

    const filteredProposals = (proposals || []).filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (p?.financialYear || '').toLowerCase().includes(q) ||
            (p?.submittedBy?.name || '').toLowerCase().includes(q);
    });

    const filteredExpenditures = (expenditures || [])
        .filter(e => (e?.totalAmount || 0) > 0 && e?.eventName) // Remove zero-amount or placeholder rows
        .filter(e => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (e?.eventName || '').toLowerCase().includes(q) ||
                (e?.submittedBy?.name || '').toLowerCase().includes(q);
        });

    return (
        <div className="page-container hod-history-container">
            <PageHeader
                title="Management History"
                subtitle="Track all status changes and historical budget records"
            />

            <div className="history-tabs-container">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'proposals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('proposals')}
                    >
                        <FileText size={18} />
                        Budget Proposals
                    </button>
                    <button
                        className={`tab ${activeTab === 'expenditures' ? 'active' : ''}`}
                        onClick={() => setActiveTab('expenditures')}
                    >
                        <Calculator size={18} />
                        Event Expenditures
                    </button>
                </div>

                <div className="history-filters">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="history-content card-standard">
                {loading ? (
                    <div className="loading-state">
                        <div className="loader"></div>
                        <p>Loading history records...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <AlertTriangle size={48} />
                        <h3>Error Loading Data</h3>
                        <p>{error}</p>
                        <button className="btn-retry" onClick={fetchHistory}>Retry</button>
                    </div>
                ) : activeTab === 'proposals' ? (
                    filteredProposals.length > 0 ? (
                        <div className="table-responsive">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Financial Year</th>
                                        <th>Submitted By</th>
                                        <th>Total Proposed</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                        <th>Workflow Tracking</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProposals.map(proposal => (
                                        <tr key={proposal?._id}>
                                            <td><strong>{proposal?.financialYear || '—'}</strong></td>
                                            <td>{proposal?.submittedBy?.name || '—'}</td>
                                            <td className="amount">{formatCurrency(proposal?.totalProposedAmount)}</td>
                                            <td>{formatDate(proposal?.createdAt)}</td>
                                            <td><StatusBadge status={proposal?.status} /></td>
                                            <td>
                                                <div className="status-trail">
                                                    <span className={`step ${['submitted', 'verified_by_hod', 'verified_by_principal', 'approved', 'allocated'].includes(proposal?.status) ? 'done' : ''}`} title="Submitted by Department">
                                                        S
                                                        <span className="tooltip">Submitted by Department</span>
                                                    </span>
                                                    <span className={`separator ${['verified_by_hod', 'verified_by_principal', 'approved', 'allocated'].includes(proposal?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['verified_by_hod', 'verified_by_principal', 'approved', 'allocated'].includes(proposal?.status) ? 'done' : ''}`} title="Verified by HOD">
                                                        H
                                                        <span className="tooltip">Verified by HOD</span>
                                                    </span>
                                                    <span className={`separator ${['verified_by_principal', 'approved', 'allocated'].includes(proposal?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['verified_by_principal', 'approved', 'allocated'].includes(proposal?.status) ? 'done' : ''}`} title="Approved by Principal">
                                                        P
                                                        <span className="tooltip">Approved by Principal</span>
                                                    </span>
                                                    <span className={`separator ${['allocated'].includes(proposal?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['allocated'].includes(proposal?.status) ? 'done' : ''}`} title="Allocated by Office">
                                                        O
                                                        <span className="tooltip">Allocated by Office</span>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-records-container">
                            <div className="no-records-icon">
                                <Search size={48} />
                            </div>
                            <h3>No Budget Proposals Found</h3>
                            <p>No budget proposal history records exist for your department yet.</p>
                        </div>
                    )
                ) : (
                    filteredExpenditures.length > 0 ? (
                        <div className="table-responsive">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Event Name</th>
                                        <th>Event Type</th>
                                        <th>Amount</th>
                                        <th>Event Date</th>
                                        <th>Status</th>
                                        <th>Workflow Tracking</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenditures.map(exp => (
                                        <tr key={exp?._id}>
                                            <td><strong>{exp?.eventName || '—'}</strong></td>
                                            <td>{exp?.eventType || '—'}</td>
                                            <td className="amount">{formatCurrency(exp?.totalAmount)}</td>
                                            <td>{formatDate(exp?.eventDate)}</td>
                                            <td><StatusBadge status={exp?.status} /></td>
                                            <td>
                                                <div className="status-trail">
                                                    <span className={`step ${['pending', 'verified', 'approved', 'finalized'].includes(exp?.status) ? 'done' : ''}`} title="Submitted by Department">
                                                        S
                                                        <span className="tooltip">Submitted by Department</span>
                                                    </span>
                                                    <span className={`separator ${['verified', 'approved', 'finalized'].includes(exp?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['verified', 'approved', 'finalized'].includes(exp?.status) ? 'done' : ''}`} title="Verified by HOD">
                                                        H
                                                        <span className="tooltip">Verified by HOD</span>
                                                    </span>
                                                    <span className={`separator ${['approved', 'finalized'].includes(exp?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['approved', 'finalized'].includes(exp?.status) ? 'done' : ''}`} title="Approved by Principal">
                                                        P
                                                        <span className="tooltip">Approved by Principal</span>
                                                    </span>
                                                    <span className={`separator ${['finalized'].includes(exp?.status) ? 'done' : ''}`}></span>
                                                    <span className={`step ${['finalized'].includes(exp?.status) ? 'done' : ''}`} title="Sanctioned by Office">
                                                        O
                                                        <span className="tooltip">Sanctioned by Office</span>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-records-container">
                            <div className="no-records-icon">
                                <Search size={48} />
                            </div>
                            <h3>No Expenditures Found</h3>
                            <p>No event expenditure history records exist for your department yet.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default HODHistory;
