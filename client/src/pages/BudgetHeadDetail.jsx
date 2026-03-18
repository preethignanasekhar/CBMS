import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { budgetHeadsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft, Wallet, IndianRupee, FileText, TrendingUp, TrendingDown,
    AlertCircle, Calendar, BarChart3
} from 'lucide-react';
import StatusBadge from '../components/Common/StatusBadge';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import './BudgetHeadDetail.scss';

const BudgetHeadDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const currentFY = getCurrentFinancialYear();
    const previousFY = getPreviousFinancialYear();
    const [startYr] = previousFY.split('-');
    const fyMinus2 = `${parseInt(startYr) - 1}-${parseInt(startYr)}`;

    const [selectedFY, setSelectedFY] = useState(currentFY);

    useEffect(() => { fetchDetail(); }, [id, selectedFY]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await budgetHeadsAPI.getBudgetHeadDetail(id, { financialYear: selectedFY });
            setData(res.data.data);
        } catch (err) {
            console.error('Error fetching budget head detail:', err);
            setError(err?.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const utilColor = (pct) => pct >= 90 ? '#dc3545' : pct >= 75 ? '#ffc107' : pct >= 50 ? '#17a2b8' : '#28a745';

    if (loading) return <div className="bhd-container"><div className="loading"><p>Loading budget head details...</p></div></div>;
    if (error) return (
        <div className="bhd-container">
            <div className="error-state"><AlertCircle size={48} /><h2>Error</h2><p>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
            </div>
        </div>
    );
    if (!data) return (
        <div className="bhd-container">
            <div className="error-state"><AlertCircle size={48} /><h2>Not Found</h2>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
            </div>
        </div>
    );

    const { budgetHead, summary, departmentBreakdown, expenditures, statusBreakdown, yearComparison } = data;

    return (
        <div className="bhd-container">
            {/* Header */}
            <div className="bhd-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="header-content">
                    <div className="header-left">
                        <div className="bhd-icon"><Wallet size={32} /></div>
                        <div className="header-info">
                            <h1>{budgetHead.name}</h1>
                            {/* Code and Category removed as per request */}
                            {budgetHead.description && <p className="bhd-desc">{budgetHead.description}</p>}
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="fy-selector">
                            <Calendar size={16} />
                            <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)}>
                                <option value={currentFY}>FY {currentFY}</option>
                                <option value={previousFY}>FY {previousFY}</option>
                                <option value={fyMinus2}>FY {fyMinus2}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="bhd-summary-grid">
                <div className="bhd-stat-card">
                    <div className="stat-icon" style={{ background: '#667eea' }}><IndianRupee size={24} /></div>
                    <div className="stat-body">
                        <h3>{fmt(summary.totalAllocated)}</h3>
                        <p>Total Allocated</p>
                        <span className="meta">{summary.allocationCount} allocations</span>
                    </div>
                </div>
                <div className="bhd-stat-card">
                    <div className="stat-icon" style={{ background: '#28a745' }}><FileText size={24} /></div>
                    <div className="stat-body">
                        <h3>{fmt(summary.totalSpent)}</h3>
                        <p>Total Spent</p>
                        <span className="meta">{summary.expenditureCount} expenditures</span>
                    </div>
                </div>
                <div className="bhd-stat-card">
                    <div className="stat-icon" style={{ background: '#ffc107' }}><IndianRupee size={24} /></div>
                    <div className="stat-body">
                        <h3>{fmt(summary.totalRemaining)}</h3>
                        <p>Remaining Budget</p>
                        <span className={`meta ${summary.totalRemaining < 0 ? 'negative' : ''}`}>
                            {summary.totalRemaining < 0 ? 'Overspent' : 'Available'}
                        </span>
                    </div>
                </div>
                <div className="bhd-stat-card">
                    <div className="stat-icon" style={{ background: utilColor(summary.utilizationPercentage) }}><TrendingUp size={24} /></div>
                    <div className="stat-body">
                        <h3>{summary.utilizationPercentage.toFixed(1)}%</h3>
                        <p>Utilization Rate</p>
                        <span className="meta">Budget efficiency</span>
                    </div>
                </div>
            </div>

            {/* Year Comparison */}
            {yearComparison ? (
                <div className="bhd-section">
                    <h2>Year-over-Year Comparison</h2>
                    <div className="comparison-grid">
                        {[
                            { label: 'Budget Allocated', key: 'totalAllocated', change: yearComparison.changes.allocatedChange, isCurrency: true },
                            { label: 'Expenses Incurred', key: 'totalSpent', change: yearComparison.changes.spentChange, isCurrency: true },
                            { label: 'Utilization Rate', key: 'utilization', change: yearComparison.changes.utilizationChange, isCurrency: false }
                        ].map(item => (
                            <div className="comparison-card" key={item.key}>
                                <h4>{item.label}</h4>
                                <div className="comparison-values">
                                    <div className="value-row">
                                        <span>Previous ({yearComparison.previousYear}):</span>
                                        <span>{item.isCurrency ? fmt(yearComparison.previous[item.key]) : `${yearComparison.previous[item.key].toFixed(1)}%`}</span>
                                    </div>
                                    <div className="value-row">
                                        <span>Current ({yearComparison.currentYear}):</span>
                                        <span>{item.isCurrency ? fmt(yearComparison.current[item.key]) : `${yearComparison.current[item.key].toFixed(1)}%`}</span>
                                    </div>
                                </div>
                                <div className="change-badge">
                                    <span className={item.change >= 0 ? 'positive' : 'negative'}>
                                        {item.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%{!item.isCurrency ? ' pts' : ''}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bhd-section">
                    <h2>Year-over-Year Comparison</h2>
                    <div className="no-data-display"><AlertCircle size={40} /><p>No previous year data available</p></div>
                </div>
            )}

            {/* Department Breakdown Table */}
            <div className="bhd-section">
                <h2>Department-wise Breakdown</h2>
                <div className="table-wrapper">
                    <table className="bhd-table">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Code</th>
                                <th>Allocated</th>
                                <th>Spent</th>
                                <th>Remaining</th>
                                <th>Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(departmentBreakdown).length > 0 ? (
                                Object.entries(departmentBreakdown).map(([name, d]) => (
                                    <tr key={name} className="clickable-row" onClick={() => d.departmentId && navigate(`/department-detail/${d.departmentId}`)}>
                                        <td><strong>{name}</strong></td>
                                        <td>{d.departmentCode || '—'}</td>
                                        <td>{fmt(d.allocated)}</td>
                                        <td>{fmt(d.spent)}</td>
                                        <td className={d.remaining < 0 ? 'negative' : ''}>{fmt(d.remaining)}</td>
                                        <td>
                                            <div className="util-cell">
                                                <span>{d.utilization.toFixed(1)}%</span>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${Math.min(d.utilization, 100)}%`, backgroundColor: utilColor(d.utilization) }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className="no-data-cell"><AlertCircle size={20} /> No allocations found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expenditure Register */}
            <div className="bhd-section">
                <h2>Event Expenditure Register</h2>
                <div className="table-wrapper">
                    <table className="bhd-table">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Department</th>
                                <th>Event Date</th>
                                <th>Amount</th>
                                <th>Submitted By</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenditures.length > 0 ? (
                                expenditures.map(exp => (
                                    <tr key={exp._id}>
                                        <td><strong>{exp.eventName || '—'}</strong></td>
                                        <td>{exp.department?.name || '—'}</td>
                                        <td>{fmtDate(exp.eventDate)}</td>
                                        <td>{fmt(exp.totalAmount)}</td>
                                        <td>{exp.submittedBy?.name || '—'}</td>
                                        <td><StatusBadge status={exp.status} /></td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className="no-data-cell"><AlertCircle size={20} /> No expenditures found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default BudgetHeadDetail;
