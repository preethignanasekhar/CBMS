import React, { useState, useEffect } from 'react';
import { financialYearAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import { Calendar, Lock, CheckCircle, RefreshCw, Plus, AlertCircle, TrendingUp, DollarSign } from 'lucide-react';
import './FinancialYearManagement.scss';

const FinancialYearManagement = () => {
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    const [newYear, setNewYear] = useState({
        year: '',
        startDate: '',
        endDate: '',
        status: 'planning'
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canManage = ['principal', 'admin'].includes(user.role);

    useEffect(() => {
        fetchYears();
    }, []);

    const fetchYears = async () => {
        try {
            setLoading(true);
            const response = await financialYearAPI.getFinancialYears();
            setYears(response.data.data.financialYears || []);
            setError(null);
        } catch (err) {
            setError('Failed to fetch financial years');
            console.error('Error fetching years:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateYear = async (e) => {
        e.preventDefault();
        try {
            setActionLoading('create');
            await financialYearAPI.createYear(newYear);
            setNewYear({ year: '', startDate: '', endDate: '', status: 'planning' });
            setShowCreateForm(false);
            fetchYears();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create financial year');
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleLockYear = async (id, year) => {
        const remarks = prompt(`Lock financial year ${year}? No new allocations can be created after locking.\n\nEnter remarks (optional):`);
        if (remarks === null) return; // User cancelled

        try {
            setActionLoading(id);
            await financialYearAPI.lockYear(id, { remarks });
            alert(`Financial year ${year} locked successfully. No new allocations can be created.`);
            fetchYears();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to lock year');
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCloseYear = async (id, year) => {
        if (!window.confirm(`⚠️ CLOSE FINANCIAL YEAR ${year}?\n\nThis will:\n- Make all data READ-ONLY (irreversible)\n- Calculate final totals\n- Prevent ANY modifications\n\nProceed only if all expenditures are approved/rejected.`)) {
            return;
        }

        const remarks = prompt('Enter closure remarks (optional):');
        if (remarks === null) return;

        try {
            setActionLoading(id);
            await financialYearAPI.closeYear(id, { remarks });
            alert(`Financial year ${year} closed successfully. All data is now immutable.`);
            fetchYears();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to close year');
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRecalculate = async (id, year) => {
        if (!window.confirm(`Recalculate totals for ${year}? This will sync income, allocation, and expenditure totals.`)) {
            return;
        }

        try {
            setActionLoading(id);
            await financialYearAPI.recalculateTotals(id);
            alert(`Totals recalculated successfully for ${year}`);
            fetchYears();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to recalculate totals');
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'planning': return <Calendar size={20} />;
            case 'active': return <TrendingUp size={20} />;
            case 'locked': return <Lock size={20} />;
            case 'closed': return <CheckCircle size={20} />;
            default: return null;
        }
    };

    const getStatusClass = (status) => {
        return `year-status status-${status}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="fy-management-container">
                <div className="loading">Loading financial years...</div>
            </div>
        );
    }

    return (
        <div className="fy-management-container">
            <PageHeader
                title="Financial Year Management"
                subtitle="Manage financial year lifecycle: Create, Lock, and Close years"
            >
                {canManage && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        <Plus size={18} /> {showCreateForm ? 'Cancel' : 'Create New Year'}
                    </button>
                )}
            </PageHeader>

            {error && (
                <div className="error-message">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {!canManage && (
                <div className="info-message">
                    <AlertCircle size={20} />
                    Only Principal or Admin can manage financial years.
                </div>
            )}

            {showCreateForm && canManage && (
                <div className="create-year-card">
                    <h3>Create New Financial Year</h3>
                    <form onSubmit={handleCreateYear} className="create-year-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Year (Format: YYYY-YY)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., 2026-27"
                                    value={newYear.year}
                                    onChange={(e) => setNewYear({ ...newYear, year: e.target.value })}
                                    required
                                    pattern="\d{4}-\d{2}"
                                />
                                <small>Format: 2026-27</small>
                            </div>
                            <div className="form-group">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    value={newYear.startDate}
                                    onChange={(e) => setNewYear({ ...newYear, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>End Date</label>
                                <input
                                    type="date"
                                    value={newYear.endDate}
                                    onChange={(e) => setNewYear({ ...newYear, endDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Initial Status</label>
                                <select
                                    value={newYear.status}
                                    onChange={(e) => setNewYear({ ...newYear, status: e.target.value })}
                                >
                                    <option value="planning">Planning</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={actionLoading === 'create'}
                        >
                            {actionLoading === 'create' ? 'Creating...' : 'Create Financial Year'}
                        </button>
                    </form>
                </div>
            )}

            <div className="years-grid">
                {years.map((year) => (
                    <div key={year._id} className={`year-card ${getStatusClass(year.status)}`}>
                        <div className="year-header">
                            <div className="year-title-section">
                                <h2 className="year-title">{year.year}</h2>
                                <span className="year-status-badge">
                                    {getStatusIcon(year.status)}
                                    {year.status}
                                </span>
                            </div>
                            <div className="year-dates">
                                {formatDate(year.startDate)} - {formatDate(year.endDate)}
                            </div>
                        </div>

                        <div className="year-stats">
                            <div className="stat-row">
                                <span className="stat-label">Income Received:</span>
                                <span className="stat-value">₹{year.totalIncomeReceived?.toLocaleString('en-IN') || '0'}</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Total Allocated:</span>
                                <span className="stat-value">₹{year.totalAllocated?.toLocaleString('en-IN') || '0'}</span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Total Spent:</span>
                                <span className="stat-value spent">₹{year.totalSpent?.toLocaleString('en-IN') || '0'}</span>
                            </div>
                            <div className="stat-row highlight">
                                <span className="stat-label">Utilization:</span>
                                <span className="stat-value">{year.utilizationPercentage?.toFixed(1) || '0'}%</span>
                            </div>
                            {year.status === 'closed' && (
                                <div className="stat-row highlight">
                                    <span className="stat-label">Carryforward:</span>
                                    <span className="stat-value">₹{year.carryforwardAmount?.toLocaleString('en-IN') || '0'}</span>
                                </div>
                            )}
                        </div>

                        {(year.lockedBy || year.closedBy) && (
                            <div className="year-actions-taken">
                                {year.lockedBy && (
                                    <div className="action-info">
                                        <Lock size={14} />
                                        Locked by {year.lockedBy.name} on {formatDate(year.lockedAt)}
                                    </div>
                                )}
                                {year.closedBy && (
                                    <div className="action-info">
                                        <CheckCircle size={14} />
                                        Closed by {year.closedBy.name} on {formatDate(year.closedAt)}
                                    </div>
                                )}
                            </div>
                        )}

                        {canManage && (
                            <div className="year-actions">
                                {(year.status === 'planning' || year.status === 'active') && (
                                    <>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleRecalculate(year._id, year.year)}
                                            disabled={actionLoading === year._id}
                                        >
                                            <RefreshCw size={16} />
                                            Recalculate
                                        </button>
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={() => handleLockYear(year._id, year.year)}
                                            disabled={actionLoading === year._id}
                                        >
                                            <Lock size={16} />
                                            Lock Year
                                        </button>
                                    </>
                                )}
                                {year.status === 'locked' && (
                                    <>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleRecalculate(year._id, year.year)}
                                            disabled={actionLoading === year._id}
                                        >
                                            <RefreshCw size={16} />
                                            Recalculate
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleCloseYear(year._id, year.year)}
                                            disabled={actionLoading === year._id}
                                        >
                                            <CheckCircle size={16} />
                                            Close Year
                                        </button>
                                    </>
                                )}
                                {year.status === 'closed' && (
                                    <div className="closed-notice">
                                        ✓ Year Closed - Data is READ-ONLY
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {years.length === 0 && (
                    <div className="no-years">
                        <Calendar size={48} />
                        <p>No financial years found.</p>
                        {canManage && (
                            <p>Click "Create New Year" to get started.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinancialYearManagement;
