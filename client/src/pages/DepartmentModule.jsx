import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
    allocationAPI,
    expenditureAPI,
    authAPI,
    departmentsAPI,
    usersAPI,
    reportAPI
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
    IndianRupee,
    CreditCard,
    Wallet,
    PieChart,
    CheckCircle,
    AlertTriangle,
    Receipt,
    Plus,
    List,
    Download,
    ArrowLeft,
    Building2,
    TrendingUp,
    TrendingDown,
    Calendar,
    AlertCircle,
    FileText,
    Building,
    Users,
    Save,
    X,
    Pencil,
    Trash2,
    Users as UsersIcon,
    Crown,
    UserCheck,
    UserX
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import Tooltip from '../components/Tooltip/Tooltip';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import './DepartmentStyles.scss';

// --- DepartmentDashboard Component ---
export const DepartmentDashboard = () => {
    const { user, updateProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [allocations, setAllocations] = useState([]);
    const [expenditures, setExpenditures] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const { socket } = useSocket();

    useEffect(() => {
        if (user?.department) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user]);

    // Real-time updates
    useEffect(() => {
        if (!socket) return;

        const handleNotification = (data) => {
            console.log('Real-time update received:', data);
            fetchData(); // Refresh data on new notification
        };

        socket.on('notification', handleNotification);

        return () => {
            socket.off('notification', handleNotification);
        };
    }, [socket, user]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [allocationsResponse, expendituresResponse, statsResponse] = await Promise.all([
                allocationAPI.getAllocations({ department: user.department?._id || user.department }),
                expenditureAPI.getExpenditures({ department: user.department?._id || user.department }),
                allocationAPI.getAllocationStats({ department: user.department?._id || user.department })
            ]);

            setAllocations(allocationsResponse.data.data.allocations);
            setExpenditures(expendituresResponse.data.data.expenditures);
            setStats(statsResponse.data.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch department data');
            console.error('Error fetching department data:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshUserData = async () => {
        try {
            setRefreshing(true);
            const response = await authAPI.getProfile();
            const updatedUser = response.data.data.user;

            // Update localStorage
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update context
            await updateProfile(updatedUser);
        } catch (err) {
            console.error('Error refreshing user data:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const getUtilizationPercentage = (allocated, spent) => {
        if (allocated === 0) return 0;
        return Math.round((spent / allocated) * 100);
    };

    const getUtilizationColor = (percentage) => {
        if (percentage >= 90) return '#dc3545';
        if (percentage >= 75) return '#ffc107';
        if (percentage >= 50) return '#17a2b8';
        return '#28a745';
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: '#ffc107',
            approved: '#28a745',
            rejected: '#dc3545',
            verified: '#17a2b8'
        };
        return colors[status] || '#6c757d';
    };

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

    const handleDownloadReport = async () => {
        try {
            setRefreshing(true);
            const response = await reportAPI.getExpenditureReport({
                department: user.department?._id || user.department,
                format: 'csv'
            });

            // Create blob and download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Expenditure_Report_${user.department?.name || 'Department'}_${new Date().toLocaleDateString()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error downloading report:', err);
            setError('Failed to download report. Please try again.');
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className="department-dashboard-container">
                <div className="loading">
                    Loading department dashboard...
                </div>
            </div>
        );
    }

    if (!user?.department) {
        return (
            <div className="department-dashboard-container">
                <div className="no-department">
                    <h2>No Department Assigned</h2>
                    <p>You are not assigned to any department. Please contact an administrator.</p>
                    <div style={{ marginTop: '20px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={refreshUserData}
                            disabled={refreshing}
                            style={{ marginRight: '10px' }}
                        >
                            {refreshing ? 'Refreshing...' : 'Refresh User Data'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                localStorage.clear();
                                window.location.reload();
                            }}
                        >
                            Clear Cache & Reload
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="department-dashboard-container">
            <PageHeader
                title="Department Dashboard"
                subtitle="Budget overview and expenditure tracking for your department"
            />

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {stats && (
                <div className="stats-grid">
                    <div className="card-standard stat-card">
                        <div className="stat-icon">
                            <IndianRupee size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{formatCurrency(stats.summary.totalAllocated)}</div>
                            <div className="stat-label">Total Allocated</div>
                        </div>
                    </div>
                    <div className="card-standard stat-card">
                        <div className="stat-icon">
                            <CreditCard size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{formatCurrency(stats.summary.totalSpent)}</div>
                            <div className="stat-label">Total Spent</div>
                        </div>
                    </div>
                    <div className="card-standard stat-card">
                        <div className="stat-icon">
                            <Wallet size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{formatCurrency(stats.summary.totalRemaining)}</div>
                            <div className="stat-label">Remaining Budget</div>
                        </div>
                    </div>
                    <div className="card-standard stat-card">
                        <div className="stat-icon">
                            <PieChart size={24} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{stats.summary.utilizationPercentage}%</div>
                            <div className="stat-label">Utilization</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="dashboard-content">
                <div className="card-standard budget-overview">
                    <div className="card-standard-header">
                        <h2>Budget Overview by Head</h2>
                        <p>Track allocation and utilization per budget head</p>
                    </div>
                    <div className="budget-table-container table-responsive">
                        <table className="budget-table">
                            <thead>
                                <tr>
                                    <th>Budget Head</th>
                                    <th>Allocated</th>
                                    <th>Spent</th>
                                    <th>Remaining</th>
                                    <th>Utilization</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocations.map((allocation) => {
                                    const utilization = getUtilizationPercentage(allocation.allocatedAmount, allocation.spentAmount);
                                    return (
                                        <tr key={allocation._id}>
                                            <td data-label="Budget Head">
                                                <div className="budget-head-info">
                                                    <span className="head-name">{allocation.budgetHead?.name || 'Unknown'}</span>
                                                    <span className="head-code">{allocation.budgetHead?.code || '-'}</span>
                                                </div>
                                            </td>
                                            <td data-label="Allocated" className="amount">{formatCurrency(allocation.allocatedAmount)}</td>
                                            <td data-label="Spent" className="amount spent">{formatCurrency(allocation.spentAmount)}</td>
                                            <td data-label="Remaining" className="amount remaining">{formatCurrency(allocation.remainingAmount)}</td>
                                            <td data-label="Utilization">
                                                <div className="utilization-cell">
                                                    <div className="utilization-bar-small">
                                                        <div className="utilization-fill-small" style={{
                                                            width: `${utilization}%`,
                                                            backgroundColor: getUtilizationColor(utilization)
                                                        }}></div>
                                                    </div>
                                                    <span className="utilization-text-small">{utilization}%</span>
                                                </div>
                                            </td>
                                            <td data-label="Status">
                                                {allocation.remainingAmount > 0 ? (
                                                    <span className="status-tag available">
                                                        <CheckCircle size={14} />
                                                        Available
                                                    </span>
                                                ) : (
                                                    <span className="status-tag exhausted">
                                                        <AlertTriangle size={14} />
                                                        Exhausted
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="right-column-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card-standard quick-actions">
                        <div className="card-standard-header">
                            <h2>Quick Actions</h2>
                            <p>Common tasks and navigation</p>
                        </div>
                        <div className="action-buttons">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/submit-expenditure')}
                            >
                                <Plus size={18} />
                                Submit New Expenditure
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => navigate('/expenditures')}
                            >
                                <List size={18} />
                                View All Expenditures
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={handleDownloadReport}
                                disabled={refreshing}
                            >
                                <Download size={18} />
                                {refreshing ? 'Generating...' : 'Download Report'}
                            </button>
                        </div>
                    </div>

                    <div className="card-standard expenditure-history">
                        <div className="card-standard-header">
                            <h2>Recent Expenditures</h2>
                            <p>Latest approved spending entries</p>
                        </div>
                        <div className="expenditure-list">
                            {expenditures.slice(0, 10).map((expenditure) => (
                                <div key={expenditure._id} className="expenditure-item">
                                    <div className="expenditure-info">
                                        <div className="bill-info">
                                            <h4 className="bill-number">{expenditure.billNumber}</h4>
                                            <span className="budget-head">{expenditure.budgetHead?.name || 'Unknown'}</span>
                                        </div>
                                        <div className="expenditure-details">
                                            <span className="party-name">{expenditure.partyName}</span>
                                            <span className="bill-date">{formatDate(expenditure.billDate)}</span>
                                        </div>
                                    </div>

                                    <div className="expenditure-amount">
                                        <span className="amount">{formatCurrency(expenditure.billAmount)}</span>
                                    </div>

                                    <div className="expenditure-status">
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(expenditure.status), color: 'white' }}
                                        >
                                            {expenditure.status.charAt(0).toUpperCase() + expenditure.status.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {expenditures.length === 0 && (
                            <div className="no-expenditures">
                                <div className="no-expenditures-icon">
                                    <Receipt size={16} />
                                </div>
                                <h3>No Expenditures</h3>
                                <p>No expenditures have been submitted yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DepartmentDetail Component ---
export const DepartmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [departmentData, setDepartmentData] = useState(null);
    const currentFY = getCurrentFinancialYear();
    const previousFY = getPreviousFinancialYear();

    // Simple logic to get a year before previous
    const getFYMinus2 = () => {
        const [start] = previousFY.split('-');
        const year = parseInt(start) - 1;
        return `${year}-${year + 1}`;
    };
    const fyMinus2 = getFYMinus2();

    const [selectedFinancialYear, setSelectedFinancialYear] = useState(currentFY);

    useEffect(() => {
        fetchDepartmentData();
    }, [id, selectedFinancialYear]);

    const fetchDepartmentData = async () => {
        try {
            setLoading(true);
            const response = await departmentsAPI.getDepartmentDetail(id, { financialYear: selectedFinancialYear });
            setDepartmentData(response.data.data);
        } catch (error) {
            console.error('Error fetching department detail:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'approved':
                return 'status-approved';
            case 'verified':
                return 'status-verified';
            case 'pending':
                return 'status-pending';
            case 'rejected':
                return 'status-rejected';
            default:
                return '';
        }
    };

    const getBudgetHeadBreakdownChart = () => {
        if (!departmentData || !departmentData.budgetHeadBreakdown) return null;

        const data = Object.entries(departmentData.budgetHeadBreakdown).map(([name, values]) => ({
            name,
            allocated: values.allocated,
            spent: values.spent,
            utilization: values.utilization
        }));

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    return params.map(param =>
                        `${param.seriesName}: ${param.seriesName.includes('Utilization') ? param.value.toFixed(2) + '%' : formatCurrency(param.value)}`
                    ).join('<br/>');
                }
            },
            legend: {
                data: ['Allocated', 'Spent', 'Utilization %']
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.map(d => d.name)
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Amount (₹)',
                    axisLabel: {
                        formatter: (value) => `₹${(value / 1000).toFixed(0)}K`
                    }
                },
                {
                    type: 'value',
                    name: 'Utilization (%)',
                    max: 100,
                    axisLabel: {
                        formatter: '{value}%'
                    }
                }
            ],
            series: [
                {
                    name: 'Allocated',
                    type: 'bar',
                    data: data.map(d => d.allocated),
                    itemStyle: { color: '#667eea' }
                },
                {
                    name: 'Spent',
                    type: 'bar',
                    data: data.map(d => d.spent),
                    itemStyle: { color: '#28a745' }
                },
                {
                    name: 'Utilization %',
                    type: 'line',
                    yAxisIndex: 1,
                    data: data.map(d => d.utilization),
                    itemStyle: { color: '#ffc107' },
                    lineStyle: { width: 3 }
                }
            ]
        };
    };

    if (loading) {
        return (
            <div className="department-detail-container">
                <div className="loading">
                    <p>Loading department details...</p>
                </div>
            </div>
        );
    }

    if (!departmentData) {
        return (
            <div className="department-detail-container">
                <div className="error-message">
                    <AlertCircle size={48} />
                    <h2>Department Not Found</h2>
                    <button onClick={() => navigate(-1)} className="btn-primary">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="department-detail-container">
            {/* Header */}
            <div className="detail-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    Back
                </button>
                <div className="header-content">
                    <div className="header-left">
                        <div className="dept-icon">
                            <Building2 size={32} />
                        </div>
                        <div className="header-info">
                            <h1>{departmentData.department.name}</h1>
                            <p className="dept-code">Code: {departmentData.department.code}</p>
                            {departmentData.department.description && (
                                <p className="dept-description">{departmentData.department.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="financial-year-selector">
                            <Calendar size={16} />
                            <select value={selectedFinancialYear} onChange={(e) => setSelectedFinancialYear(e.target.value)}>
                                <option value={currentFY}>FY {currentFY}</option>
                                <option value={previousFY}>FY {previousFY}</option>
                                <option value={fyMinus2}>FY {fyMinus2}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid">
                <div className="summary-card">
                    <div className="card-icon" style={{ background: '#667eea' }}>
                        <IndianRupee size={24} />
                    </div>
                    <div className="card-content">
                        <h3>{formatCurrency(departmentData.summary.totalAllocated)}</h3>
                        <p>Total Allocated</p>
                        <span className="card-meta">{departmentData.summary.allocationCount} allocations</span>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{ background: '#28a745' }}>
                        <FileText size={24} />
                    </div>
                    <div className="card-content">
                        <h3>{formatCurrency(departmentData.summary.totalSpent)}</h3>
                        <p>Total Spent</p>
                        <span className="card-meta">{departmentData.summary.expenditureCount} expenditures</span>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{ background: '#ffc107' }}>
                        <IndianRupee size={24} />
                    </div>
                    <div className="card-content">
                        <h3>{formatCurrency(departmentData.summary.totalRemaining)}</h3>
                        <p>Remaining Budget</p>
                        <span className={`card-meta ${departmentData.summary.totalRemaining < 0 ? 'negative' : ''}`}>
                            {departmentData.summary.totalRemaining < 0 ? 'Overspent' : 'Available'}
                        </span>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon" style={{
                        background: departmentData.summary.utilizationPercentage > 90 ? '#dc3545' :
                            departmentData.summary.utilizationPercentage > 75 ? '#ffc107' : '#17a2b8'
                    }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="card-content">
                        <h3>{departmentData.summary.utilizationPercentage.toFixed(2)}%</h3>
                        <p>Utilization Rate</p>
                        <span className="card-meta">Budget efficiency</span>
                    </div>
                </div>
            </div>

            {/* Year Comparison */}
            {departmentData.yearComparison ? (
                <div className="year-comparison-section">
                    <h2>Year-over-Year Comparison</h2>
                    <div className="comparison-grid">
                        <div className="comparison-card">
                            <h4>Budget Allocated</h4>
                            <div className="comparison-values">
                                <div className="value-row">
                                    <span>Previous ({departmentData.yearComparison.previousYear}):</span>
                                    <span>{formatCurrency(departmentData.yearComparison.previous.totalAllocated)}</span>
                                </div>
                                <div className="value-row">
                                    <span>Current ({departmentData.yearComparison.currentYear}):</span>
                                    <span>{formatCurrency(departmentData.yearComparison.current.totalAllocated)}</span>
                                </div>
                            </div>
                            <div className="change-badge">
                                {departmentData.yearComparison.changes.allocatedChange >= 0 ? (
                                    <span className="positive">
                                        <TrendingUp size={16} />
                                        +{departmentData.yearComparison.changes.allocatedChange.toFixed(2)}%
                                    </span>
                                ) : (
                                    <span className="negative">
                                        <TrendingDown size={16} />
                                        {departmentData.yearComparison.changes.allocatedChange.toFixed(2)}%
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="comparison-card">
                            <h4>Expenses Incurred</h4>
                            <div className="comparison-values">
                                <div className="value-row">
                                    <span>Previous ({departmentData.yearComparison.previousYear}):</span>
                                    <span>{formatCurrency(departmentData.yearComparison.previous.totalSpent)}</span>
                                </div>
                                <div className="value-row">
                                    <span>Current ({departmentData.yearComparison.currentYear}):</span>
                                    <span>{formatCurrency(departmentData.yearComparison.current.totalSpent)}</span>
                                </div>
                            </div>
                            <div className="change-badge">
                                {departmentData.yearComparison.changes.spentChange >= 0 ? (
                                    <span className="warning">
                                        <TrendingUp size={16} />
                                        +{departmentData.yearComparison.changes.spentChange.toFixed(2)}%
                                    </span>
                                ) : (
                                    <span className="positive">
                                        <TrendingDown size={16} />
                                        {departmentData.yearComparison.changes.spentChange.toFixed(2)}%
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="comparison-card">
                            <h4>Utilization Rate</h4>
                            <div className="comparison-values">
                                <div className="value-row">
                                    <span>Previous ({departmentData.yearComparison.previousYear}):</span>
                                    <span>{departmentData.yearComparison.previous.utilization.toFixed(2)}%</span>
                                </div>
                                <div className="value-row">
                                    <span>Current ({departmentData.yearComparison.currentYear}):</span>
                                    <span>{departmentData.yearComparison.current.utilization.toFixed(2)}%</span>
                                </div>
                            </div>
                            <div className="change-badge">
                                <span className="neutral">
                                    {departmentData.yearComparison.changes.utilizationChange >= 0 ? '+' : ''}
                                    {departmentData.yearComparison.changes.utilizationChange.toFixed(2)}% points
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="year-comparison-section">
                    <h2>Year-over-Year Comparison</h2>
                    <div className="no-data-message">
                        <AlertCircle size={48} />
                        <p>No previous year data available for comparison</p>
                    </div>
                </div>
            )}

            {/* Budget Head Breakdown Chart */}
            {getBudgetHeadBreakdownChart() ? (
                <div className="chart-section">
                    <h2>Budget Head-wise Allocation & Utilization</h2>
                    <div className="chart-container">
                        <ReactECharts option={getBudgetHeadBreakdownChart()} style={{ height: '400px', width: '100%' }} />
                    </div>
                </div>
            ) : (
                <div className="chart-section">
                    <h2>Budget Head-wise Allocation & Utilization</h2>
                    <div className="no-data-display">
                        <AlertCircle size={40} />
                        <p>No budget breakdown available for this financial year</p>
                    </div>
                </div>
            )}

            {/* Budget Head Breakdown Table */}
            <div className="table-section">
                <h2>Budget Head Breakdown</h2>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Budget Head</th>
                                <th>Code</th>
                                <th>Allocated</th>
                                <th>Spent</th>
                                <th>Remaining</th>
                                <th>Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(departmentData.budgetHeadBreakdown).map(([name, data]) => (
                                <tr key={name}>
                                    <td><strong>{name}</strong></td>
                                    <td>{data.budgetHeadCode}</td>
                                    <td>{formatCurrency(data.allocated)}</td>
                                    <td>{formatCurrency(data.spent)}</td>
                                    <td className={data.remaining < 0 ? 'negative' : ''}>{formatCurrency(data.remaining)}</td>
                                    <td>
                                        <div className="utilization-cell">
                                            <span>{data.utilization.toFixed(2)}%</span>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill"
                                                    style={{
                                                        width: `${Math.min(data.utilization, 100)}%`,
                                                        backgroundColor: data.utilization > 90 ? '#dc3545' :
                                                            data.utilization > 75 ? '#ffc107' : '#28a745'
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expenditure Register */}
            <div className="table-section">
                <h2>Expenditure Bill Register</h2>
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Bill No</th>
                                <th>Date</th>
                                <th>Budget Head</th>
                                <th>Amount</th>
                                <th>Purpose</th>
                                <th>Submitted By</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departmentData.expenditures.length > 0 ? (
                                departmentData.expenditures.map((exp) => (
                                    <tr key={exp._id}>
                                        <td><strong>{exp.billNumber}</strong></td>
                                        <td>{formatDate(exp.billDate)}</td>
                                        <td>{exp.budgetHead.name}</td>
                                        <td>{formatCurrency(exp.billAmount)}</td>
                                        <td className="purpose-cell">{exp.purpose}</td>
                                        <td>{exp.submittedBy.name}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusBadgeClass(exp.status)}`}>
                                                {exp.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="no-data-cell">
                                        <AlertCircle size={24} />
                                        <span>No expenditures found for this financial year</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Breakdown */}
            <div className="status-breakdown-section">
                <h2>Expenditure Status Summary</h2>
                <div className="status-grid">
                    <div className="status-card pending">
                        <h3>{departmentData.statusBreakdown.pending}</h3>
                        <p>Pending</p>
                    </div>
                    <div className="status-card verified">
                        <h3>{departmentData.statusBreakdown.verified}</h3>
                        <p>Verified</p>
                    </div>
                    <div className="status-card approved">
                        <h3>{departmentData.statusBreakdown.approved}</h3>
                        <p>Approved</p>
                    </div>
                    <div className="status-card rejected">
                        <h3>{departmentData.statusBreakdown.rejected}</h3>
                        <p>Rejected</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DepartmentForm Component ---
export const DepartmentForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        hod: '',
        isActive: true
    });

    const [hodUsers, setHodUsers] = useState([]);
    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchHODs();
        if (isEditMode) {
            fetchDepartment();
        }
    }, [id]);

    const fetchHODs = async () => {
        try {
            const response = await usersAPI.getUsersByRole('hod');
            if (response.data.success) {
                setHodUsers(response.data.data.users);
            }
        } catch (err) {
            console.error('Error fetching HODs:', err);
        }
    };

    const fetchDepartment = async () => {
        try {
            setLoading(true);
            const response = await departmentsAPI.getDepartmentById(id);
            if (response.data.success) {
                const dept = response.data.data.department;
                setFormData({
                    name: dept.name,
                    code: dept.code,
                    description: dept.description || '',
                    hod: dept.hod?._id || dept.hod || '',
                    isActive: dept.isActive
                });
            }
        } catch (err) {
            setError('Failed to fetch department details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const submitData = { ...formData };
            if (!submitData.hod) submitData.hod = null;

            if (isEditMode) {
                await departmentsAPI.updateDepartment(id, submitData);
            } else {
                await departmentsAPI.createDepartment(submitData);
            }
            navigate('/departments');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save department');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="form-page-container">
                <div className="loading">Loading department data...</div>
            </div>
        );
    }

    return (
        <div className="form-page-container">
            <PageHeader
                title={isEditMode ? "Edit Department" : "Add New Department"}
                subtitle={isEditMode ? `Updating ${formData.name}` : "Create a new academic or administrative department"}
            >
                <button className="btn btn-secondary" onClick={() => navigate('/departments')}>
                    <ArrowLeft size={18} /> Back to Departments
                </button>
            </PageHeader>

            <div className="form-content-card">
                {error && (
                    <div className="form-error-banner">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="modern-form">
                    <div className="form-section">
                        <h3 className="section-title">
                            <Building size={18} />
                            Department Information
                        </h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Department Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="form-input"
                                    placeholder="e.g., Computer Science"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Department Code *</label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleChange}
                                    required
                                    className="form-input"
                                    placeholder="e.g., CS"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>

                            <div className="form-group full-width">
                                <label className="form-label">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Tell something about the department..."
                                    rows="3"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            <Users size={18} />
                            Administration
                        </h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Head of Department (HOD)</label>
                                <select
                                    name="hod"
                                    value={formData.hod}
                                    onChange={handleChange}
                                    className="form-input"
                                >
                                    <option value="">Select HOD (Optional)</option>
                                    {hodUsers.map(user => (
                                        <option key={user._id} value={user._id}>
                                            {user.name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                                <p className="form-help">Only users with 'Hod' role appear here.</p>
                            </div>

                            {isEditMode && (
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <div className="checkbox-item active-toggle">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            name="isActive"
                                            checked={formData.isActive}
                                            onChange={handleChange}
                                        />
                                        <label htmlFor="isActive">
                                            {formData.isActive ? 'Active - Department is operational' : 'Inactive - Department is disabled'}
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/departments')}
                            disabled={saving}
                        >
                            <X size={18} /> Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            <Save size={18} /> {saving ? 'Saving...' : (isEditMode ? 'Update Department' : 'Create Department')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Departments Component ---
export const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchDepartments();
        fetchStats();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const response = await departmentsAPI.getDepartments();
            setDepartments(response.data.data.departments);
            setError(null);
        } catch (err) {
            setError('Failed to fetch departments');
            console.error('Error fetching departments:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await departmentsAPI.getDepartmentStats();
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this department?')) {
            try {
                await departmentsAPI.deleteDepartment(id);
                fetchDepartments();
                fetchStats();
            } catch (err) {
                setError('Failed to delete department');
                console.error('Error deleting department:', err);
            }
        }
    };

    if (loading) {
        return (
            <div className="departments-container">
                <div className="loading">Loading departments...</div>
            </div>
        );
    }

    return (
        <div className="departments-container">
            <PageHeader
                title="Departments Management"
                subtitle="Manage academic and administrative departments"
            >
                <Link to="/departments/add" className="btn btn-primary">
                    <Plus size={18} /> Add Department
                </Link>
            </PageHeader>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {stats && (
                <div className="stats-grid">
                    <StatCard
                        title="Total Departments"
                        value={stats.totalDepartments}
                        icon={<Building size={24} />}
                        color="var(--primary)"
                    />
                    <StatCard
                        title="Active Departments"
                        value={stats.activeDepartments}
                        icon={<Building size={24} />}
                        color="var(--success)"
                    />
                    <StatCard
                        title="With HOD"
                        value={stats.departmentsWithHOD}
                        icon={<Users size={24} />}
                        color="var(--info)"
                    />
                    <StatCard
                        title="Without HOD"
                        value={stats.departmentsWithoutHOD}
                        icon={<Users size={24} />}
                        color="var(--warning)"
                    />
                </div>
            )}

            <div className="departments-table-container">
                <table className="departments-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Description</th>
                            <th>HOD</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {departments.map((dept) => (
                            <tr key={dept._id}>
                                <td>{dept.name}</td>
                                <td>
                                    <span className="dept-code">{dept.code}</span>
                                </td>
                                <td>{dept.description || '-'}</td>
                                <td>
                                    {dept.hodInfo ? (
                                        <div className="hod-info">
                                            <div className="hod-name">{dept.hodInfo.name}</div>
                                            <div className="hod-email">{dept.hodInfo.email}</div>
                                        </div>
                                    ) : (
                                        <span className="no-hod">No HOD assigned</span>
                                    )}
                                </td>
                                <td>
                                    <span className={`status ${dept.isActive ? 'active' : 'inactive'}`}>
                                        {dept.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <Tooltip text="Edit Department" position="top">
                                            <Link
                                                to={`/departments/edit/${dept._id}`}
                                                className="btn btn-sm btn-secondary"
                                            >
                                                <Pencil size={16} />
                                            </Link>
                                        </Tooltip>
                                        <Tooltip text="Delete Department" position="top">
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(dept._id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Tooltip>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- DepartmentUsers Component ---
export const DepartmentUsers = () => {
    const { user } = useAuth();
    const [departmentUsers, setDepartmentUsers] = useState([]);
    const [department, setDepartment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        isActive: ''
    });

    useEffect(() => {
        if (user?.department) {
            fetchDepartmentUsers();
        }
    }, [user, filters]);

    const fetchDepartmentUsers = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filters.search) params.search = filters.search;
            if (filters.isActive) params.isActive = filters.isActive;

            const response = await usersAPI.getUsersByDepartment(user.department, params);
            setDepartmentUsers(response.data.data.users);
            setDepartment(response.data.data.department);
            setError(null);
        } catch (err) {
            setError('Failed to fetch department users');
            console.error('Error fetching department users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getRoleLabel = (role) => {
        const roleLabels = {
            admin: 'Admin',
            office: 'Office',
            department: 'Department User',
            hod: 'Head of Department',
            vice_principal: 'Vice Principal',
            principal: 'Principal',
            auditor: 'Auditor'
        };
        return roleLabels[role] || role;
    };

    const getRoleColor = (role) => {
        const colors = {
            admin: '#dc3545',
            office: '#007bff',
            department: '#28a745',
            hod: '#ffc107',
            vice_principal: '#6f42c1',
            principal: '#fd7e14',
            auditor: '#20c997'
        };
        return colors[role] || '#6c757d';
    };

    if (loading) {
        return (
            <div className="department-users-container">
                <div className="loading">Loading department users...</div>
            </div>
        );
    }

    if (!user?.department) {
        return (
            <div className="department-users-container">
                <div className="no-department">
                    <h2>No Department Assigned</h2>
                    <p>You are not assigned to any department. Please contact an administrator.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="department-users-container">
            <div className="department-users-header">
                <div className="header-info">
                    <h1>Department Users</h1>
                    {department && (
                        <div className="department-info">
                            <h2>{department.name}</h2>
                            <span className="dept-code">{department.code}</span>
                        </div>
                    )}
                </div>
                <div className="user-count">
                    <span className="count-number">{departmentUsers.length}</span>
                    <span className="count-label">Users</span>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="filters-section">
                <div className="filter-group">
                    <input
                        type="text"
                        placeholder="Search users..."
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        className="filter-input"
                    />
                </div>
                <div className="filter-group">
                    <select
                        name="isActive"
                        value={filters.isActive}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            </div>

            <div className="users-grid">
                {departmentUsers.map((user) => (
                    <div key={user._id} className="user-card">
                        <div className="user-avatar">
                            <div className="avatar-circle">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div className="user-details">
                            <h3 className="user-name">{user.name}</h3>
                            <p className="user-email">{user.email}</p>
                            <div className="user-role">
                                <span
                                    className="role-badge"
                                    style={{ backgroundColor: getRoleColor(user.role) }}
                                >
                                    {getRoleLabel(user.role)}
                                </span>
                            </div>
                            <div className="user-status">
                                <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
                                    {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="user-meta">
                                <p className="last-login">
                                    Last Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                                </p>
                                <p className="user-id">ID: {user._id}</p>
                            </div>
                        </div>
                        <div className="user-actions">
                            {user.role === 'hod' && (
                                <div className="hod-badge">
                                    <Crown size={14} />
                                    HOD
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {departmentUsers.length === 0 && (
                <div className="no-users">
                    <div className="no-users-icon">
                        <Users size={20} />
                    </div>
                    <h3>No Users Found</h3>
                    <p>No users found in your department matching the current filters.</p>
                </div>
            )}

            <div className="department-stats">
                <div className="stats-card">
                    <div className="stat-icon">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-number">{departmentUsers.length}</div>
                        <div className="stat-label">Total Users</div>
                    </div>
                </div>
                <div className="stats-card">
                    <div className="stat-icon">
                        <UserCheck size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-number">
                            {departmentUsers.filter(u => u.isActive).length}
                        </div>
                        <div className="stat-label">Active Users</div>
                    </div>
                </div>
                <div className="stats-card">
                    <div className="stat-icon">
                        <UserX size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-number">
                            {departmentUsers.filter(u => !u.isActive).length}
                        </div>
                        <div className="stat-label">Inactive Users</div>
                    </div>
                </div>
                <div className="stats-card">
                    <div className="stat-icon">
                        <Crown size={20} />
                    </div>
                    <div className="stat-info">
                        <div className="stat-number">
                            {departmentUsers.filter(u => u.role === 'hod').length}
                        </div>
                        <div className="stat-label">HODs</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
