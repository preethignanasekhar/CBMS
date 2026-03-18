import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    financialYearAPI,
    budgetProposalAPI,
    allocationAPI,
    departmentsAPI,
    budgetHeadsAPI,
    categoriesAPI,
    reportAPI,
    expenditureAPI
} from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import {
    Plus, IndianRupee, CreditCard, Wallet, PieChart as PieChartIcon, Pencil, Trash2, X,
    Tag, AlertCircle, Save, AlignLeft, Hash, ArrowLeft, Eye, CheckCircle,
    XCircle, Clock, DollarSign, Send, Check, RefreshCcw, ShieldCheck,
    TrendingUp, TrendingDown, FileText, RotateCw, Download, ArrowUpRight, Search,
    AlertTriangle, Sparkles, Calendar, RefreshCw
} from 'lucide-react';
import { getCurrentFinancialYear } from '../utils/dateUtils';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import './BudgetStyles.scss';
import AIRequirementGenerator from '../components/AI/AIRequirementGenerator';

export const BudgetAllocations = () => {
    const navigate = useNavigate();
    const [allocations, setAllocations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchParams] = useSearchParams();
    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        departmentId: searchParams.get('department') || '',
        budgetHeadId: searchParams.get('budgetHead') || '',
        financialYear: searchParams.get('financialYear') || ''
    });
    const [financialYears, setFinancialYears] = useState([]);
    const [tempFY, setTempFY] = useState(filters.financialYear);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const handleSearch = () => {
        setFilters(prev => ({ ...prev, financialYear: tempFY }));
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch allocations with filters
            const allocationParams = {};
            if (filters.search) allocationParams.search = filters.search;
            if (filters.departmentId) allocationParams.department = filters.departmentId;
            if (filters.budgetHeadId) allocationParams.budgetHead = filters.budgetHeadId;
            if (filters.financialYear) allocationParams.financialYear = filters.financialYear;

            const [allocationsResponse, departmentsResponse, budgetHeadsResponse, statsResponse] = await Promise.all([
                allocationAPI.getAllocations(allocationParams),
                departmentsAPI.getDepartments(),
                budgetHeadsAPI.getBudgetHeads(),
                allocationAPI.getAllocationStats()
            ]);

            setAllocations(allocationsResponse.data.data.allocations);
            setDepartments(departmentsResponse.data.data.departments);
            setBudgetHeads(budgetHeadsResponse.data.data.budgetHeads);
            setStats(statsResponse.data.data);

            // Also fetch all available years for the flexible filter
            const yearsRes = await financialYearAPI.getFinancialYears();
            const years = yearsRes.data.data.financialYears || [];
            setFinancialYears(Array.isArray(years) ? years.map(fy => fy.year) : []);

            setError(null);
        } catch (err) {
            setError('Failed to fetch data');
            console.error('Error fetching data:', err);
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

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this allocation?')) {
            try {
                await allocationAPI.deleteAllocation(id);
                fetchData();
            } catch (err) {
                setError('Failed to delete allocation');
                console.error('Error deleting allocation:', err);
            }
        }
    };

    const handleDateToFY = (e) => {
        const date = new Date(e.target.value);
        if (isNaN(date.getTime())) return;
        const month = date.getMonth();
        const year = date.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        setTempFY(`${startYear}-${startYear + 1}`);
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

    if (loading) {
        return (
            <div className="budget-allocations-container">
                <div className="loading">Loading budget allocations...</div>
            </div>
        );
    }

    return (
        <div className="page-container budget-allocations-container">
            <PageHeader
                title="Budget Allocations Management"
                subtitle="Manage and monitor budget allocations across departments"
            >
                <div className="header-actions">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                </div>
            </PageHeader>

            {error && (
                <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                    <button
                        className="alert-dismiss"
                        onClick={() => setError(null)}
                        title="Dismiss"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            <div className="filters-section" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                <div className="filter-group" style={{ flex: '0 0 300px' }}>
                    <label className="filter-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Financial Year</label>
                    <div className="flexible-year-input">
                        <input
                            type="text"
                            placeholder="e.g. 2024-2025"
                            value={tempFY}
                            onChange={(e) => setTempFY(e.target.value)}
                            className="year-input"
                            list="fy-datalist"
                        />
                        <datalist id="fy-datalist">
                            {financialYears.map(year => (
                                <option key={year} value={year} />
                            ))}
                        </datalist>
                        <div className="date-picker-helper">
                            <Calendar size={20} />
                            <input
                                type="date"
                                className="hidden-date-picker"
                                onChange={handleDateToFY}
                            />
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSearch}
                    className="btn btn-primary"
                    style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem' }}
                >
                    <Search size={18} /> Search
                </button>
            </div>

            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">
                            <IndianRupee size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary?.totalAllocated?.toLocaleString() || '0'}</div>
                            <div className="stat-label">Total Allocated</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <CreditCard size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary?.totalSpent?.toLocaleString() || '0'}</div>
                            <div className="stat-label">Total Spent</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <Wallet size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary?.totalRemaining?.toLocaleString() || '0'}</div>
                            <div className="stat-label">Remaining Budget</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <PieChartIcon size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{stats.summary?.utilizationPercentage || '0'}%</div>
                            <div className="stat-label">Utilization</div>
                        </div>
                    </div>
                </div>
            )}



            <div className="charts-section" style={{ marginBottom: '2rem' }}>
                <div className="chart-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600', color: 'black' }}>
                        {allocations.length > 0 && allocations[0].budgetHeadName ? `${allocations[0].budgetHeadName} - ` : ''}Allocation vs Spending by Department
                    </h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={allocations.slice(0, 8)}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="departmentCode" tick={{ fontSize: 11 }} interval={0} height={40} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <RechartsTooltip
                                    formatter={(value) => `₹${value.toLocaleString()}`}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="allocatedAmount" name="Allocated" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="spentAmount" name="Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="allocations-table-container">
                <table className="allocations-table">
                    <thead>
                        <tr>
                            <th>Department</th>
                            <th>Budget Head</th>
                            <th>Financial Year</th>
                            <th>Allocated Amount</th>
                            <th>Spent Amount</th>
                            <th>Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allocations.map((allocation) => {
                            return (
                                <tr key={allocation._id}>
                                    <td>
                                        <div className="department-info">
                                            <span className="dept-name">{allocation.departmentCode}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="budget-head-info">
                                            <span className="head-name">{allocation.budgetHeadName}</span>
                                        </div>
                                    </td>
                                    <td>{allocation.financialYear}</td>
                                    <td className="amount">₹{allocation.allocatedAmount?.toLocaleString() || '0'}</td>
                                    <td className="amount">₹{allocation.spentAmount?.toLocaleString() || '0'}</td>
                                    <td className="amount">₹{allocation.remainingAmount?.toLocaleString() || '0'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    );
};
export const BudgetHeadForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        category: 'other',
        isActive: true
    });

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchCategories();
        if (isEditMode) {
            fetchBudgetHead();
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            const response = await categoriesAPI.getCategories();
            if (response.data.success) {
                setCategories(response.data.data.categories);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchBudgetHead = async () => {
        try {
            setLoading(true);
            const response = await budgetHeadsAPI.getBudgetHeadById(id);
            if (response.data.success) {
                const head = response.data.data.budgetHead;
                setFormData({
                    name: head.name,
                    code: head.code,
                    description: head.description || '',
                    category: head.category,
                    isActive: head.isActive
                });
            }
        } catch (err) {
            setError('Failed to fetch budget head details');
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
            if (isEditMode) {
                await budgetHeadsAPI.updateBudgetHead(id, formData);
            } else {
                await budgetHeadsAPI.createBudgetHead(formData);
            }
            navigate('/budget-heads');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save budget head');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="form-page-container">
                <div className="loading">Loading budget head data...</div>
            </div>
        );
    }

    return (
        <div className="form-page-container">
            <PageHeader
                title={isEditMode ? "Edit Budget Head" : "Add New Budget Head"}
                subtitle={isEditMode ? `Updating ${formData.name}` : "Create a new category for financial allocations"}
            >
                <button className="btn btn-secondary" onClick={() => navigate('/budget-heads')}>
                    <ArrowLeft size={18} /> Back to Budget Heads
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
                            <IndianRupee size={18} />
                            Budget Head Details
                        </h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Budget Head Name *</label>
                                <div className="input-with-icon">
                                    <span className="input-icon-wrapper"><Tag size={16} /></span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="form-input has-icon"
                                        placeholder="e.g., Academic Publications"
                                    />
                                </div>
                            </div>

                            {/* Category and Code are now handled automatically or optional */}

                            <div className="form-group full-width">
                                <label className="form-label">Description</label>
                                <div className="input-with-icon textarea-wrapper">
                                    <span className="input-icon-wrapper"><AlignLeft size={16} /></span>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="form-input has-icon"
                                        placeholder="Explain the purpose of this budget head..."
                                        rows="3"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            Status & Visibility
                        </h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <div className="checkbox-item active-toggle">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleChange}
                                    />
                                    <label htmlFor="isActive">
                                        {formData.isActive ? 'Active - Available for allocations' : 'Inactive - Hidden from new budget plans'}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/budget-heads')}
                            disabled={saving}
                        >
                            <X size={18} /> Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            <Save size={18} /> {saving ? 'Saving...' : (isEditMode ? 'Update Budget Head' : 'Create Budget Head')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const BudgetHeads = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canManage = user && ['admin', 'office', 'principal', 'vice_principal', 'hod', 'department'].includes(user.role);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        isActive: ''
    });

    useEffect(() => {
        fetchCategories();
        fetchBudgetHeads();
        fetchStats();
    }, [filters]);

    const fetchCategories = async () => {
        try {
            const response = await categoriesAPI.getCategories();
            if (response.data.success) {
                setCategories(response.data.data.categories);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchBudgetHeads = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filters.search) params.search = filters.search;
            if (filters.category) params.category = filters.category;
            if (filters.isActive) params.isActive = filters.isActive;

            const response = await budgetHeadsAPI.getBudgetHeads({ ...params, limit: 1000 });
            setBudgetHeads(response.data.data.budgetHeads);
            setError(null);
        } catch (err) {
            setError('Failed to fetch budget heads');
            console.error('Error fetching budget heads:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await budgetHeadsAPI.getBudgetHeadStats();
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this budget head?')) {
            try {
                await budgetHeadsAPI.deleteBudgetHead(id);
                fetchBudgetHeads();
                fetchStats();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to delete budget head');
                console.error('Error deleting budget head:', err);
            }
        }
    };

    const getCategoryColor = (categoryId) => {
        const category = categories.find(c => c.id === categoryId);
        return category?.color || '#6c757d';
    };

    if (loading) {
        return (
            <div className="budget-heads-container">
                <div className="loading">Loading budget heads...</div>
            </div>
        );
    }

    return (
        <div className="budget-heads-container">
            <PageHeader
                title="Budget Heads Management"
                subtitle="Manage and allocate budget categories"
            >
                <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => {
                            fetchBudgetHeads();
                            fetchStats();
                            fetchCategories();
                        }}
                        className="btn btn-outline"
                        title="Refresh List"
                    >
                        <RefreshCw size={18} />
                    </button>
                    {canManage && (
                        <Link to="/budget-heads/add" className="btn btn-primary">
                            <Plus size={18} /> Add Budget Head
                        </Link>
                    )}
                </div>
            </PageHeader>

            {error && <div className="error-message">{error}</div>}

            {stats && (
                <div className="stats-grid">
                    <StatCard
                        title="Total Budget Heads"
                        value={stats.totalBudgetHeads}
                        icon={<IndianRupee size={24} />}
                        color="var(--primary)"
                    />
                    <StatCard
                        title="Active Budget Heads"
                        value={stats.activeBudgetHeads}
                        icon={<IndianRupee size={24} />}
                        color="var(--success)"
                    />
                    <StatCard
                        title="Inactive Budget Heads"
                        value={stats.inactiveBudgetHeads}
                        icon={<IndianRupee size={24} />}
                        color="var(--warning)"
                    />
                    <StatCard
                        title="Categories"
                        value={stats.byCategory ? Object.keys(stats.byCategory).length : 0}
                        icon={<IndianRupee size={24} />}
                        color="var(--info)"
                    />
                </div>
            )}



            <div className="budget-heads-grid">
                {budgetHeads.map((head) => (
                    <div key={head._id} className="budget-head-card" onClick={() => navigate(`/allocations?budgetHead=${head._id}`)} style={{ cursor: 'pointer' }}>
                        <div className="card-header">
                            <div className="head-info">
                                <h3 className="head-name">{head.name}</h3>
                            </div>
                            <div className="head-status">
                                <span className={`status ${head.isActive ? 'active' : 'inactive'}`}>
                                    {head.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                            </div>
                        </div>

                        {/* Category removed as per request */}

                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                            {canManage && (
                                <>
                                    <Tooltip text="View Allocations" position="top">
                                        <Link
                                            to={`/allocations?budgetHead=${head._id}`}
                                            className="btn btn-sm btn-info"
                                            style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                                        >
                                            <Eye size={16} /> View
                                        </Link>
                                    </Tooltip>
                                    <Tooltip text="Edit Budget Head" position="top">
                                        <Link
                                            to={`/budget-heads/edit/${head._id}`}
                                            className="btn btn-sm btn-secondary"
                                        >
                                            <Pencil size={16} /> Edit
                                        </Link>
                                    </Tooltip>
                                    <Tooltip text="Delete Budget Head" position="top">
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(head._id);
                                            }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {
                budgetHeads.length === 0 && (
                    <div className="no-budget-heads">
                        <div className="no-budget-heads-icon">
                            <IndianRupee size={48} />
                        </div>
                        <h3>No Budget Heads Found</h3>
                        <p>No budget heads found matching the current filters.</p>
                    </div>
                )
            }
        </div >
    );
};
export const BudgetProposalForm = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { id } = useParams();
    const location = useLocation();
    const isEditMode = !!id;

    const [departments, setDepartments] = useState([]);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [allDepartmentsStats, setAllDepartmentsStats] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);
    const [stats, setStats] = useState(null);

    const calculateMonthlyTotals = () => {
        const totals = { 
            apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0 
        };
        formData.proposalItems.forEach(item => {
            if (item.monthlyBreakdown) {
                Object.keys(totals).forEach(month => {
                    totals[month] += (parseFloat(item.monthlyBreakdown[month]) || 0);
                });
            }
        });
        return totals;
    };
    const [formData, setFormData] = useState({
        financialYear: '2025-2026',
        department: user?.department?._id || user?.department || '',
        status: '',
        proposalItems: [{
            budgetHead: '',
            proposedAmount: '',
            justification: '',
            previousYearUtilization: '',
            prevYearAllocated: 0,
            prevYearSpent: 0,
            currentYearSpent: 0,
            monthlyBreakdown: {
                apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '', jan: '', feb: '', mar: ''
            }
        }],
        notes: ''
    });
    const [existingProposals, setExistingProposals] = useState([]);


    const fetchBudgetStats = useCallback(async (budgetHeadId, departmentId, itemIndex) => {
        try {
            // Calculate years based on proposal financial year
            // Example: If proposal is for 2025-2026
            // Current Running Year = 2024-2025
            // Previous Year = 2023-2024
            const proposalFY = formData.financialYear;
            const [proposalStart] = proposalFY.split('-');

            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            const actualCurrentFY = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

            const prevYearStart = (parseInt(proposalStart) - 2);
            const prevFY = `${prevYearStart}-${parseInt(proposalStart) - 1}`;

            console.log(`[Stats] Fetching for Prop: ${proposalFY}, Actual Cur: ${actualCurrentFY}, Prev: ${prevFY}`);

            // Fetch allocations for previous year (specific budget head)
            // and actual expenditures for current year (DEPARTMENT TOTAL)
            const [currentDepartmentExpResponse, prevAllocResponse] = await Promise.all([
                expenditureAPI.getExpenditures({
                    department: departmentId,
                    financialYear: actualCurrentFY,
                    limit: 2000 // Get all items to sum for the whole department
                }),
                allocationAPI.getAllocations({
                    department: departmentId,
                    budgetHead: budgetHeadId,
                    financialYear: prevFY
                })
            ]);

            const currentDeptExpenditures = currentDepartmentExpResponse.data.data.expenditures;
            const prevAllocations = prevAllocResponse.data.data.allocations;

            console.log(`[Stats Debug] Expenditures found: ${currentDeptExpenditures?.length || 0}`);
            if (currentDeptExpenditures?.length > 0) {
                console.log(`[Stats Debug] First expenditure amount: ${currentDeptExpenditures[0].billAmount}, status: ${currentDeptExpenditures[0].status}`);
            }

            const stats = {
                currentYearSpent: 0,
                prevYearAllocated: 0,
                prevYearSpent: 0
            };

            if (currentDeptExpenditures && currentDeptExpenditures.length > 0) {
                // Sum billAmount from ALL departmental expenditures for current year
                stats.currentYearSpent = currentDeptExpenditures.reduce((sum, e) => {
                    const amount = parseFloat(e.billAmount) || 0;
                    return sum + amount;
                }, 0);
                console.log(`[Stats Debug] Final calculated currentYearSpent: ${stats.currentYearSpent}`);
            }

            if (prevAllocations && prevAllocations.length > 0) {
                stats.prevYearAllocated = prevAllocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
                stats.prevYearSpent = prevAllocations.reduce((sum, a) => sum + (a.spentAmount || 0), 0);
            }

            // Update state
            setFormData(prev => {
                const newItems = [...prev.proposalItems];
                if (newItems[itemIndex]) {
                    newItems[itemIndex] = {
                        ...newItems[itemIndex],
                        prevYearAllocated: stats.prevYearAllocated,
                        prevYearSpent: stats.prevYearSpent,
                        currentYearSpent: stats.currentYearSpent,
                        // Persist spent in previous year utilization field if it's currently empty
                        previousYearUtilization: stats.prevYearSpent || newItems[itemIndex].previousYearUtilization
                    };
                }
                return { ...prev, proposalItems: newItems };
            });

        } catch (err) {
            console.error('Could not fetch budget stats:', err.message);
        }
    }, [formData.financialYear]);

    const refreshAllStats = useCallback(async () => {
        try {
            setRefreshing(true);
            // Refresh stats for all items that have a budget head selected
            const promises = formData.proposalItems
                .map((item, index) => {
                    if (item.budgetHead && formData.department) {
                        return fetchBudgetStats(item.budgetHead, formData.department, index);
                    }
                    return Promise.resolve();
                })
                .filter(p => p !== undefined);

            await Promise.all(promises);
            setLastRefreshed(new Date());
            console.log('[Stats] All expenditure amounts refreshed');
        } catch (err) {
            console.error('Error refreshing stats:', err.message);
        } finally {
            setRefreshing(false);
        }
    }, [formData.proposalItems, formData.department, fetchBudgetStats]);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const response = await departmentsAPI.getDepartments();
                setDepartments(response.data.data.departments);
            } catch (err) {
                console.error('Error fetching departments:', err);
            }
        };
        fetchDepartments();
    }, []);

    const fetchExistingProposals = useCallback(async (deptId, year) => {
        try {
            const response = await budgetProposalAPI.getBudgetProposals({
                department: deptId,
                financialYear: year,
                status: 'submitted,verified_by_hod,verified_by_principal,verified,approved'
            });
            setExistingProposals(response.data.data.proposals);
        } catch (err) {
            console.error('Error fetching existing proposals:', err);
        }
    }, []);

    useEffect(() => {
        if (formData.department && formData.financialYear) {
            fetchExistingProposals(formData.department, formData.financialYear);
        }
    }, [formData.department, formData.financialYear, fetchExistingProposals]);

    useEffect(() => {
        if (formData.department && !isEditMode) {
            fetchBudgetHeads(formData.department);
        }
    }, [formData.department, isEditMode]);


    // (moved) Auto-refresh hook will be defined after refreshAllStats to avoid temporal-deadzone

    // AI tested data loading removed as requested to avoid value inconsistencies 


    useEffect(() => {
        if (isEditMode) {
            const fetchProposal = async () => {
                try {
                    setFetching(true);
                    const response = await budgetProposalAPI.getBudgetProposalById(id);
                    // Server returns { success, data: <proposalObject> } — not nested under .proposal
                    const proposal = response.data.data;

                    // Fetch budget heads for this department
                    if (proposal.department && proposal.department._id) {
                        await fetchBudgetHeads(proposal.department._id);
                    }

                    const items = proposal.proposalItems.map(item => ({
                        // budgetHead may be a populated object or a raw string ID
                        budgetHead: item.budgetHead?._id || item.budgetHead,
                        proposedAmount: item.proposedAmount,
                        justification: item.justification,
                        previousYearUtilization: item.previousYearUtilization || 0,
                        monthlyBreakdown: item.monthlyBreakdown || {
                            apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '', jan: '', feb: '', mar: ''
                        }
                    }));

                    setFormData({
                        financialYear: proposal.financialYear,
                        department: proposal.department._id,
                        status: proposal.status,
                        proposalItems: items,
                        notes: proposal.notes || ''
                    });

                    // Auto-fetch budget stats if not available
                    items.forEach((item, index) => {
                        if (item.budgetHead && (!item.prevYearAllocated || !item.currentYearSpent)) {
                            fetchBudgetStats(item.budgetHead, proposal.department._id, index);
                        }
                    });

                    // Mark as read if user is principal, office, or admin
                    if (['admin', 'office', 'principal', 'vice_principal'].includes(user.role)) {
                        try {
                            await budgetProposalAPI.markProposalAsRead(id);
                        } catch (readErr) {
                            console.error('Error marking proposal as read:', readErr);
                        }
                    }
                } catch (err) {
                    setError('Failed to fetch proposal');
                    console.error('Error fetching proposal:', err);
                } finally {
                    setFetching(false);
                }
            };
            fetchProposal();
        }
    }, [id, isEditMode, fetchBudgetStats, user.role]);

    const fetchBudgetHeads = async (departmentId) => {
        try {
            const response = await budgetHeadsAPI.getBudgetHeads({ department: departmentId });
            setBudgetHeads(response.data.data.budgetHeads);
        } catch (err) {
            console.error('Error fetching budget heads:', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear selected budget heads in items if department changes (only in create mode)
        if (name === 'department' && !isEditMode) {
            setFormData(prev => ({
                ...prev,
                department: value,
                proposalItems: prev.proposalItems.map(item => ({ ...item, budgetHead: '', previousYearUtilization: '' }))
            }));
        }
    };

    const handleOpenApprovalModal = async () => {
        setLoadingStats(true);
        try {
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            const actualCurrentFY = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

            const proposalFY = formData.financialYear;
            const [proposalStart] = proposalFY.split('-');
            const prevYearStart = (parseInt(proposalStart) - 2);
            const prevFY = `${prevYearStart}-${parseInt(proposalStart) - 1}`;

            const stats = [];
            for (const dept of departments) {
                try {
                    const [currentDeptExpResponse, prevAllocResponse] = await Promise.all([
                        expenditureAPI.getExpenditures({
                            department: dept._id,
                            financialYear: actualCurrentFY,
                            limit: 2000
                        }),
                        allocationAPI.getAllocations({
                            department: dept._id,
                            financialYear: prevFY
                        })
                    ]);

                    const currentDeptExpenditures = currentDeptExpResponse.data.data.expenditures || [];
                    const prevAllocations = prevAllocResponse.data.data.allocations || [];

                    const currentYearSpent = currentDeptExpenditures.reduce((sum, e) => {
                        const amount = parseFloat(e.billAmount) || 0;
                        return sum + amount;
                    }, 0);

                    const prevYearAllocated = prevAllocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
                    const prevYearSpent = prevAllocations.reduce((sum, a) => sum + (a.spentAmount || 0), 0);
                    const prevYearBalance = prevYearAllocated - prevYearSpent;

                    stats.push({
                        departmentId: dept._id,
                        departmentName: dept.name,
                        departmentCode: dept.code,
                        prevYearAllocated,
                        prevYearSpent,
                        prevYearBalance,
                        currentYearSpent
                    });
                } catch (err) {
                    console.error(`Error fetching stats for ${dept.name}:`, err);
                }
            }
            setAllDepartmentsStats(stats);
            setShowApprovalModal(true);
        } catch (err) {
            console.error('Error fetching approval stats:', err);
            setError('Failed to fetch department statistics');
        } finally {
            setLoadingStats(false);
        }
    };

    const handleMonthlyChange = (itemIndex, month, value) => {
        setFormData(prev => {
            const newItems = [...prev.proposalItems];
            const currentItem = { ...newItems[itemIndex] };
            
            const newMonthlyBreakdown = {
                ...currentItem.monthlyBreakdown,
                [month]: value // Keep as string or number from input
            };
            
            // Calculate new total for this item
            const newTotal = Object.values(newMonthlyBreakdown).reduce((sum, val) => {
                return sum + (parseFloat(val) || 0);
            }, 0);
            
            newItems[itemIndex] = {
                ...currentItem,
                monthlyBreakdown: newMonthlyBreakdown,
                proposedAmount: newTotal.toFixed(2) // Keep as string for better input handling
            };

            return {
                ...prev,
                proposalItems: newItems
            };
        });
    };

    const handleItemChange = (index, field, value) => {
        if (field === 'budgetHead' && value) {
            // Check if this head is already in ANOTHER existing proposal (exclude current one if editing)
            const isAlreadyProposed = existingProposals.some(p => 
                p._id !== id && 
                p.proposalItems.some(item => (item.budgetHead?._id || item.budgetHead) === value)
            );

            if (isAlreadyProposed) {
                const headName = budgetHeads.find(h => h._id === value)?.name || 'This Budget Head';
                setError(`${headName} has already been proposed for this financial year.`);
                return;
            }

            // Also check for duplicates within the current form items
            const isDuplicateInForm = formData.proposalItems.some((item, i) => i !== index && item.budgetHead === value);
            if (isDuplicateInForm) {
                setError('Matching budget head already exists in this proposal. Please combine them or choose a different head.');
                return;
            }

            // Clear error if selection is now valid
            setError(null);
        }

        setFormData(prev => {
            const newItems = [...prev.proposalItems];
            newItems[index] = {
                ...newItems[index],
                [field]: value
            };

            // Auto-fetch budget stats if budget head is selected
            if (field === 'budgetHead' && value && prev.department) {
                fetchBudgetStats(value, prev.department, index);
            }

            return {
                ...prev,
                proposalItems: newItems
            };
        });
    };


    // Use a ref for the refresh function to keep the interval stable across renders
    const refreshAllStatsRef = useRef(refreshAllStats);

    const handleAIRequirements = (data) => {
        const { selectedItems, budgetSuggestions, chatNotes } = data;

        // Map selected checklist items and chat notes to proposal notes
        if (selectedItems.length > 0 || (chatNotes && chatNotes.length > 0)) {
            let notesAppendText = '';

            if (chatNotes && chatNotes.length > 0) {
                notesAppendText += `\n\nEvent Needs (From Chat):\n- ${chatNotes.join('\n- ')}`;
            }

            if (selectedItems.length > 0) {
                notesAppendText += `\n\nAI Suggested Requirements:\n- ${selectedItems.join('\n- ')}`;
            }

            setFormData(prev => ({
                ...prev,
                notes: (prev.notes || '') + notesAppendText
            }));
            setSuccess(`AI successfully analyzed "${data.eventName || 'the requirements'}" and added items/notes to the proposal.`);
        }
    };
    const formDataRef = useRef(formData);

    useEffect(() => {
        refreshAllStatsRef.current = refreshAllStats;
    }, [refreshAllStats]);

    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    // Auto-refresh current year spent amounts every 60 seconds
    useEffect(() => {
        // Only start the timer once per mounting
        const interval = setInterval(() => {
            // Use refs to get latest values without restarting the interval
            const currentData = formDataRef.current;
            if (currentData.department && currentData.proposalItems.some(item => item.budgetHead)) {
                console.log('[Auto-Refresh] Triggering periodic stats update...');
                refreshAllStatsRef.current();
            }
        }, 60000); // Changed to 60s for better balance between freshness and performance

        return () => clearInterval(interval);
    }, []); // Totally stable interval

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            proposalItems: [
                ...prev.proposalItems,
                {
                    budgetHead: '',
                    proposedAmount: '',
                    justification: '',
                    previousYearUtilization: '',
                    prevYearAllocated: 0,
                    prevYearSpent: 0,
                    currentYearSpent: 0,
                    monthlyBreakdown: {
                        apr: '', may: '', jun: '', jul: '', aug: '', sep: '', oct: '', nov: '', dec: '', jan: '', feb: '', mar: ''
                    }
                }
            ]
        }));
    };

    const removeItem = (index) => {
        setFormData(prev => {
            if (prev.proposalItems.length > 1) {
                return {
                    ...prev,
                    proposalItems: prev.proposalItems.filter((_, i) => i !== index)
                };
            }
            return prev;
        });
    };

    const handleSubmit = async (e, status = 'draft') => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate form
            if (!formData.department) {
                setError('Please select a department');
                setLoading(false);
                return;
            }

            for (let i = 0; i < formData.proposalItems.length; i++) {
                const item = formData.proposalItems[i];
                if (!item.budgetHead) {
                    setError(`Please select a Budget Head for Item ${i + 1}`);
                    setLoading(false);
                    return;
                }

                // Monthly Expenditure Validation
                const months = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];
                const hasMonthlyExpenditure = months.some(m => parseFloat(item.monthlyBreakdown[m] || 0) > 0);

                if (!hasMonthlyExpenditure) {
                    setError(`Please enter expenditure in at least one month before submitting the budget proposal for Item ${i + 1}.`);
                    setLoading(false);
                    return;
                }

                if (item.proposedAmount === '' || item.proposedAmount === undefined || item.proposedAmount === null || parseFloat(item.proposedAmount) <= 0) {
                    setError(`Please enter a valid Proposed Amount for Item ${i + 1}`);
                    setLoading(false);
                    return;
                }
                if (!String(item.justification || '').trim()) {
                    setError(`Please provide a Justification for Item ${i + 1}`);
                    setLoading(false);
                    return;
                }
            }

            const submitData = {
                financialYear: formData.financialYear,
                department: formData.department,
                proposalItems: formData.proposalItems.map(item => {
                    const cleanMonthlyBreakdown = {};
                    ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'].forEach(m => {
                        cleanMonthlyBreakdown[m] = parseFloat(item.monthlyBreakdown[m]) || 0;
                    });

                    return {
                        budgetHead: item.budgetHead,
                        proposedAmount: parseFloat(item.proposedAmount),
                        justification: item.justification,
                        previousYearUtilization: parseFloat(item.previousYearUtilization) || 0,
                        monthlyBreakdown: cleanMonthlyBreakdown
                    };
                }),
                notes: formData.notes,
                status: status
            };

            console.log('[Debug] Submit data:', submitData);

            if (isEditMode) {
                await budgetProposalAPI.updateBudgetProposal(id, submitData);
                setSuccess('Budget proposal updated successfully');
            } else {
                await budgetProposalAPI.createBudgetProposal(submitData);
                setSuccess(status === 'submitted' ? 'Budget proposal submitted successfully' : 'Budget proposal created successfully');
            }

            const successMsg = status === 'submitted' ? 'Proposal submitted for approval!' : 'Proposal saved successfully!';
            setSuccess(successMsg);

            setTimeout(() => {
                navigate('/budget-proposals');
            }, 1500);
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                setError('Authentication failed. Please log in again.');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                let errorMsg = err.response?.data?.message || err.response?.data?.error || 'Error saving budget proposal';

                // Add validation errors if available
                if (err.response?.data?.validationErrors && Array.isArray(err.response.data.validationErrors)) {
                    const validationDetails = err.response.data.validationErrors
                        .map(ve => `${ve.field}: ${ve.message}`)
                        .join('; ');
                    errorMsg += ` | Validation: ${validationDetails}`;
                }

                setError(errorMsg);
                console.error('[Client Error] Full error details:', err);
                console.error('[Client Error] Response status:', err.response?.status);
                console.error('[Client Error] Response data:', err.response?.data);
            }
        } finally {
            setLoading(false);
        }
    };

    const getTotalProposedAmount = () => {
        return formData.proposalItems.reduce((sum, item) => {
            return sum + (parseFloat(item.proposedAmount) || 0);
        }, 0);
    };

    if (fetching) {
        return (
            <div className="budget-proposal-form-container">
                <div className="loading">Loading budget proposal...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="budget-proposal-form-container">
                <div className="error-message">
                    <strong>Authentication Error</strong><br />
                    You are not logged in. Please log in to create a proposal.
                </div>
            </div>
        );
    }

    return (
        <div className="budget-proposal-page-container">
            <PageHeader
                title={isEditMode ? 'Edit Budget Proposal' : 'Create Budget Proposal'}
                subtitle="Propose budget requirements for your department"
            >
                <button
                    type="button"
                    className="btn btn-info"
                    onClick={refreshAllStats}
                    disabled={refreshing || !formData.proposalItems.some(item => item.budgetHead)}
                    title="Refresh current year expenditure amounts"
                    style={{ marginRight: '8px' }}
                >
                    <RotateCw size={18} style={{ marginRight: '6px' }} />
                    {refreshing ? 'Refreshing...' : 'Refresh Amounts'}
                </button>
                {lastRefreshed && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '12px' }}>
                        Last refreshed: {lastRefreshed.toLocaleTimeString()}
                    </span>
                )}
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/budget-proposals')}
                >
                    <ArrowLeft size={18} /> Cancel
                </button>
            </PageHeader>

            {error && (
                <div className="error-message">
                    <button className="close-popup" onClick={() => setError(null)} title="Close">
                        <X size={14} />
                    </button>
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            {success && (
                <div className="success-message">
                    <button className="close-popup" onClick={() => setSuccess(null)} title="Close">
                        <X size={14} />
                    </button>
                    <CheckCircle size={18} /> {success}
                </div>
            )}

            {formData.status === 'approved' && isEditMode && (
                <div className="warning-message" style={{
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1.25rem',
                    border: '1px solid #ffeeba',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.9rem'
                }}>
                    <AlertTriangle size={24} />
                    <div>
                        <strong>Warning:</strong> This proposal has already been approved.
                        Editing and saving it will revert its status to <strong>Revised</strong> and require a new round of approvals.
                        Existing allocations will be updated only after the new version is approved.
                    </div>
                </div>
            )}

            <div className="budget-proposal-layout">
                <div className="proposal-form-column">
                    <form onSubmit={handleSubmit} className="budget-proposal-form">
                        <div className="form-section">

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Financial Year <span className="required">*</span></label>
                                    <div className="flexible-year-input" style={{ background: 'white', border: '1px solid #ddd', borderRadius: '4px', padding: '0 8px' }}>
                                        <input
                                            type="text"
                                            name="financialYear"
                                            list="fy-suggestions"
                                            value={formData.financialYear}
                                            onChange={handleInputChange}
                                            placeholder="e.g., 2025-2026"
                                            required
                                            style={{ border: 'none', width: '100%', padding: '10px 0' }}
                                        />
                                        <div className="date-picker-helper" style={{ cursor: 'pointer', color: 'var(--primary)' }}>
                                            <Calendar size={18} />
                                            <input
                                                type="date"
                                                onChange={(e) => {
                                                    const date = new Date(e.target.value);
                                                    if (isNaN(date.getTime())) return;
                                                    const month = date.getMonth();
                                                    const year = date.getFullYear();
                                                    const startYear = month >= 3 ? year : year - 1;
                                                    setFormData(prev => ({ ...prev, financialYear: `${startYear}-${startYear + 1}` }));
                                                }}
                                                className="hidden-date-picker"
                                                style={{ position: 'absolute', opacity: 0, width: '20px', marginLeft: '-20px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                                <div className="form-section">
                                <div className="section-header">
                                    <h3>Proposal Items</h3>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={addItem}
                                    >
                                        <Plus size={16} /> Add Item
                                    </button>
                                </div>

                                {formData.proposalItems.map((item, index) => (
                                    <div key={index} className="proposal-item">
                                        <div className="item-header">
                                            <h4>Item {index + 1}</h4>
                                            {formData.proposalItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: '1 1 100%' }}>
                                                <label>Budget Head <span className="required">*</span></label>
                                                <select
                                                    value={item.budgetHead}
                                                    onChange={(e) => handleItemChange(index, 'budgetHead', e.target.value)}
                                                    required
                                                    disabled={isEditMode && !['draft', 'revised', 'approved', 'rejected', 'submitted'].includes(formData.status) && ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role)}
                                                >
                                                    <option value="">Select Budget Head</option>
                                                    {budgetHeads.map(head => (
                                                        <option key={head._id} value={head._id}>
                                                            {head.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="monthly-breakdown-section" style={{ 
                                            marginTop: '1.5rem', 
                                            marginBottom: '1.5rem',
                                            padding: '1.5rem',
                                            background: '#f8fafc',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            <label style={{ 
                                                fontWeight: '700', 
                                                marginBottom: '12px', 
                                                display: 'flex', 
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: 'var(--primary)',
                                                fontSize: '0.95rem'
                                            }}>
                                                <Calendar size={18} /> Monthly Expenditure Plan (Estimated)
                                            </label>
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                                                gap: '15px'
                                            }}>
                                                {['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'].map(month => (
                                                    <div key={month} className="month-input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <label style={{ 
                                                            fontSize: '0.7rem', 
                                                            textTransform: 'uppercase', 
                                                            color: '#64748b', 
                                                            fontWeight: '800', 
                                                            letterSpacing: '0.05em' 
                                                        }}>{month}</label>
                                                        <input
                                                            type="number"
                                                            value={item.monthlyBreakdown[month]}
                                                            onChange={(e) => handleMonthlyChange(index, month, e.target.value)}
                                                            placeholder="0"
                                                            min="0"
                                                            style={{ 
                                                                padding: '10px', 
                                                                fontSize: '0.9rem', 
                                                                borderRadius: '8px', 
                                                                border: '1px solid #cbd5e1',
                                                                width: '100%',
                                                                textAlign: 'right',
                                                                background: 'white',
                                                                transition: 'border-color 0.2s'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p style={{ margin: '12px 0 0 0', color: '#64748b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <AlertCircle size={14} /> 
                                                Entering monthly values will automatically update the total Proposed Amount below.
                                            </p>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Proposed Amount (₹) <span className="required">*</span></label>
                                                <input
                                                    type="number"
                                                    value={item.proposedAmount}
                                                    onChange={(e) => handleItemChange(index, 'proposedAmount', e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                    disabled={isEditMode && !['draft', 'revised', 'approved', 'rejected', 'submitted'].includes(formData.status) && ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role)}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Justification <span className="required">*</span></label>
                                            <textarea
                                                value={item.justification}
                                                onChange={(e) => handleItemChange(index, 'justification', e.target.value)}
                                                placeholder="Explain why this budget is needed"
                                                rows="3"
                                                required
                                                disabled={isEditMode && ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role)}
                                                style={isEditMode && ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role) ? { opacity: 0.6 } : {}}
                                            />
                                        </div>
                                    </div>
                                ))}

                            <div className="total-proposed">
                                <strong>Total Proposed Amount: ₹{getTotalProposedAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>

                            {/* Monthly Totals Summary (Sum Data) */}
                            <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-slate-200">
                                <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold uppercase text-xs tracking-wider">
                                    <TrendingUp size={16} className="text-primary" /> Monthly Sum Data (Consolidated)
                                </div>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                    gap: '12px' 
                                }}>
                                    {Object.entries(calculateMonthlyTotals()).map(([month, total]) => (
                                        <div key={month} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                            <div className="text-[10px] text-slate-500 font-black uppercase">{month}</div>
                                            <div className="text-sm font-bold text-slate-800">₹{total.toLocaleString('en-IN')}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => navigate('/budget-proposals')}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleSubmit(null, 'draft')}
                                disabled={loading}
                            >
                                <Save size={18} /> {loading ? 'Saving...' : isEditMode ? 'Update Draft' : 'Save as Draft'}
                            </button>
                            {['hod', 'office', 'vice_principal', 'principal'].includes(user?.role) && isEditMode && (
                                <button
                                    type="button"
                                    className="btn btn-info"
                                    onClick={handleOpenApprovalModal}
                                    disabled={loadingStats}
                                    style={{ color: 'white' }}
                                >
                                    {loadingStats ? 'Loading...' : 'View All Departments Stats'}
                                </button>
                            )}

                            {/* Quick Approve/Verify buttons in Form */}
                            {user && ['admin', 'office', 'principal', 'vice_principal', 'hod', 'department'].includes(user.role) && (
                                <>
                                    {user?.role === 'hod' && formData.status === 'submitted' && (
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                if (window.confirm('Are you sure you want to verify this proposal?')) {
                                                    await budgetProposalAPI.verifyBudgetProposal(id, { remarks: 'Verified from detail view' });
                                                    navigate('/budget-proposals');
                                                }
                                            }}
                                            style={{ color: 'white' }}
                                        >
                                            <ShieldCheck size={18} /> Verify Proposal
                                        </button>
                                    )}
                                    {['principal', 'vice_principal'].includes(user?.role) && ['verified_by_hod', 'verified'].includes(formData.status) && (
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                if (window.confirm('Are you sure you want to verify and accept this proposal in principle?')) {
                                                    await budgetProposalAPI.verifyBudgetProposal(id, { remarks: 'Verified & Accepted in principle from detail view' });
                                                    navigate('/budget-proposals');
                                                }
                                            }}
                                            style={{ color: 'white' }}
                                        >
                                            <ShieldCheck size={18} /> Verify & Accept (In Principle)
                                        </button>
                                    )}
                                    {user?.role === 'office' && ['verified_by_principal', 'verified'].includes(formData.status) && (
                                        <button
                                            type="button"
                                            className="btn btn-success"
                                            onClick={async () => {
                                                if (window.confirm('Are you sure you want to allocate and approve this proposal?')) {
                                                    await budgetProposalAPI.approveBudgetProposal(id, { notes: 'Approved from detail view' });
                                                    navigate('/budget-proposals');
                                                }
                                            }}
                                            style={{ color: 'white' }}
                                        >
                                            <Check size={18} /> Allocate & Approve
                                        </button>
                                    )}
                                    {/* Additional Verify & Accept for Office if requested to be "like hod" */}
                                    {user?.role === 'office' && (formData.status === 'verified_by_hod') && (
                                        <button
                                            type="button"
                                            className="btn btn-info"
                                            onClick={async () => {
                                                if (window.confirm('Are you sure you want to verify and accept this proposal in principle?')) {
                                                    await budgetProposalAPI.verifyBudgetProposal(id, { remarks: 'Verified & Accepted in principle by Office' });
                                                    navigate('/budget-proposals');
                                                }
                                            }}
                                            style={{ color: 'white' }}
                                        >
                                            <ShieldCheck size={18} /> Verify & Accept (In Principle)
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                type="button"
                                className="btn btn-success"
                                onClick={() => handleSubmit(null, 'submitted')}
                                disabled={loading}
                                style={{ color: 'white' }}
                            >
                                <Send size={18} /> {loading ? 'Submitting...' : 'Save & Submit'}
                            </button>
                        </div>

                        {/* Approval Modal for viewing all departments' stats */}
                        {showApprovalModal && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }}>
                                <div style={{
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    padding: '2rem',
                                    maxWidth: '90%',
                                    maxHeight: '90vh',
                                    overflowY: 'auto',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h2>All Departments - Budget Statistics</h2>
                                        <button
                                            onClick={() => setShowApprovalModal(false)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                fontSize: '1.5rem',
                                                cursor: 'pointer',
                                                color: '#666'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                        gap: '1.5rem'
                                    }}>
                                        {allDepartmentsStats.map((deptStat) => (
                                            <div key={deptStat.departmentId} style={{
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                padding: '1.5rem',
                                                background: 'rgba(var(--primary-rgb), 0.02)'
                                            }}>
                                                <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
                                                    {deptStat.departmentName} ({deptStat.departmentCode})
                                                </h4>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Prev. Year Allocated Amount</span>
                                                        <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                                            ₹{(deptStat.prevYearAllocated || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Prev. Year Spent Amount</span>
                                                        <span style={{ fontWeight: '600', color: 'var(--danger)' }}>
                                                            ₹{(deptStat.prevYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Prev. Year Balance (Remaining)</span>
                                                        <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                                                            ₹{(deptStat.prevYearBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Current Year Spent Amount</span>
                                                        <span style={{ fontWeight: '600', color: 'var(--warning)' }}>
                                                            ₹{(deptStat.currentYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setShowApprovalModal(false)}
                                            className="btn btn-secondary"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export const BudgetProposals = () => {
    const { user } = useAuth();
    const [proposals, setProposals] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        financialYear: '2025-2026'
    });
    const [tempFilters, setTempFilters] = useState({
        status: '',
        financialYear: '2025-2026'
    });

    const fetchProposals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await budgetProposalAPI.getBudgetProposals(filters);
            setProposals(response.data.data.proposals);
            setError(null);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch budget proposals';
            setError(errorMsg);
            console.error('Error fetching proposals:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await budgetProposalAPI.getBudgetProposalsStats({ financialYear: filters.financialYear });
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [filters.financialYear]);

    useEffect(() => {
        fetchProposals();
        fetchStats();
    }, [fetchProposals, fetchStats]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setTempFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSearch = () => {
        setFilters({ ...tempFilters });
    };

    const handleSubmitProposal = async (id) => {
        if (!window.confirm('Are you sure you want to submit this proposal for approval? After submission, you will not be able to edit it unless it is sent back for revision.')) {
            return;
        }

        try {
            setLoading(true);
            await budgetProposalAPI.submitBudgetProposal(id);
            setError(null);
            // Refresh data
            fetchProposals();
            fetchStats();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit proposal');
            console.error('Error submitting proposal:', err);
            setLoading(false);
        }
    };

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleApproveProposal = async (id) => {
        const actionLabel = user?.role === 'office' ? 'Allocate & Approve' : 'Approve';
        if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} this budget proposal?`)) {
            return;
        }

        try {
            setLoading(true);
            await budgetProposalAPI.approveBudgetProposal(id, { notes: 'Approved from list view' });
            setError(null);
            fetchProposals();
            fetchStats();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to approve proposal');
            console.error('Error approving proposal:', err);
            setLoading(false);
        }
    };

    const handleRejectClick = (id) => {
        setSelectedProposalId(id);
        setShowRejectModal(true);
    };

    const handleRejectProposal = async () => {
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            setLoading(true);
            await budgetProposalAPI.rejectBudgetProposal(selectedProposalId, { rejectionReason: rejectionReason });
            setShowRejectModal(false);
            setRejectionReason('');
            setError(null);
            fetchProposals();
            fetchStats();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reject proposal');
            console.error('Error rejecting proposal:', err);
            setLoading(false);
        }
    };

    // The handleResubmitProposal function is being removed as per requested rule:
    // "If the proposal status is Rejected, the user should be allowed to edit the existing proposal and resubmit it, instead of creating a new one."
    // Users will now just use the Edit button.


    const getStatusColor = (status) => {
        const colors = {
            draft: '#ffc107',
            submitted: '#17a2b8',
            verified: '#6f42c1',
            approved: '#28a745',
            rejected: '#dc3545',
            revised: '#6c757d'
        };
        return colors[status] || '#6c757d';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved':
                return <CheckCircle size={18} style={{ color: '#28a745' }} />;
            case 'rejected':
                return <XCircle size={18} style={{ color: '#dc3545' }} />;
            case 'verified':
                return <ShieldCheck size={18} style={{ color: '#6f42c1' }} />;
            case 'submitted':
                return <Clock size={18} style={{ color: '#17a2b8' }} />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="budget-proposals-container">
                <div className="loading">Loading budget proposals...</div>
            </div>
        );
    }

    return (
        <div className="budget-proposals-container">
            <PageHeader
                title={['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? 'Budget Proposals Approvals' : 'Budget Proposals Management'}
                subtitle={['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? 'Review and approve budget proposals' : 'Create and manage budget proposals for your department'}
            >
                {['admin', 'office', 'principal', 'vice_principal', 'auditor'].includes(user?.role) ? null : (
                    <Link to="/budget-proposals/add" className="btn btn-primary">
                        <Plus size={18} /> Create Proposal
                    </Link>
                )}
            </PageHeader>

            {error && <div className="error-message">{error}</div>}

            {stats && (
                <div className="stats-grid">
                    <StatCard
                        title="Total Proposals"
                        value={stats.totalProposals}
                        icon={<DollarSign size={24} />}
                        color="var(--primary)"
                    />

                    <StatCard
                        title="Approved"
                        value={stats.approvedProposals}
                        icon={<CheckCircle size={24} />}
                        color="var(--success)"
                    />
                    <StatCard
                        title="Rejected"
                        value={stats.rejectedProposals}
                        icon={<XCircle size={24} />}
                        color="var(--danger)"
                    />
                    <StatCard
                        title="Approved Amount"
                        value={`₹${stats.totalApprovedAmount.toLocaleString('en-IN')}`}
                        icon={<DollarSign size={24} />}
                        color="var(--success)"
                    />
                </div>
            )}

            <div className="filters-section" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                    <label>Financial Year</label>
                    <input
                        type="text"
                        name="financialYear"
                        value={tempFilters.financialYear}
                        onChange={handleFilterChange}
                        placeholder="e.g., 2025-2026"
                    />
                </div>

                <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                    <label>Status</label>
                    <select
                        name="status"
                        value={tempFilters.status}
                        onChange={handleFilterChange}
                    >
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="revised">Revised</option>
                    </select>
                </div>

                <div className="form-group" style={{ flexShrink: 0 }}>
                    <label style={{ visibility: 'hidden', display: 'block' }}>Search</label>
                    <button
                        onClick={handleSearch}
                        className="btn btn-primary"
                        style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', whiteSpace: 'nowrap' }}
                    >
                        <Search size={18} /> Search
                    </button>
                </div>
            </div>

            <div className="proposals-table-container">
                {proposals.length === 0 ? (
                    <div className="empty-state">
                        <p>No budget proposals found</p>
                        <Link to="/budget-proposals/add" className="btn btn-primary btn-sm">
                            Create First Proposal
                        </Link>
                    </div>
                ) : (
                    <table className="proposals-table">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Financial Year</th>
                                <th>Total Proposed</th>
                                <th>Budget Heads</th>
                                <th>Status</th>
                                <th>Submitted Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.map((proposal) => (
                                <tr key={proposal._id}>
                                    <td>
                                        <div className="dept-info">
                                            <div className="dept-name">{proposal.department?.name || 'N/A'}</div>
                                            <div className="dept-code">{proposal.department?.code || proposal.department || 'N/A'}</div>
                                        </div>
                                    </td>
                                    <td>{proposal.financialYear}</td>
                                    <td>
                                        <span className="amount">
                                            ₹{(proposal.totalProposedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="budget-heads-list text-sm">
                                            {proposal.proposalItems?.map(item => item.budgetHead?.name).join(', ') || 'N/A'}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="status-cell">
                                            {getStatusIcon(proposal.status)}
                                            <span className="status" style={{ backgroundColor: getStatusColor(proposal.status) }}>
                                                {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        {proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Tooltip text="View Proposal" position="top">
                                                <Link
                                                    to={`/budget-proposals/${proposal._id}`}
                                                    className="btn btn-sm btn-info"
                                                >
                                                    <Eye size={16} />
                                                </Link>
                                            </Tooltip>
                                            {(proposal.status === 'draft' || proposal.status === 'revised' || proposal.status === 'approved' || proposal.status === 'rejected' || proposal.status === 'submitted') && (
                                                <>
                                                    <Tooltip text="Edit Proposal" position="top">
                                                        <Link
                                                            to={`/budget-proposals/edit/${proposal._id}`}
                                                            className="btn btn-sm btn-secondary"
                                                        >
                                                            <Pencil size={16} />
                                                        </Link>
                                                    </Tooltip>
                                                </>
                                            )}
                                            {(proposal.status === 'draft' || proposal.status === 'revised') && (
                                                <Tooltip text="Submit for Approval" position="top">
                                                    <button
                                                        onClick={() => handleSubmitProposal(proposal._id)}
                                                        className="btn btn-sm btn-success"
                                                        style={{ color: 'white' }}
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}

                                            {proposal.status === 'submitted' && user?.role === 'hod' && (
                                                <Tooltip text="Verify Proposal" position="top">
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('Are you sure you want to verify this proposal? We recommend viewing details first.')) {
                                                                budgetProposalAPI.verifyBudgetProposal(proposal._id, { remarks: 'Verified by HOD' }).then(() => fetchProposals());
                                                            }
                                                        }}
                                                        className="btn btn-sm btn-primary"
                                                        style={{ color: 'white' }}
                                                    >
                                                        <ShieldCheck size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                            {(proposal.status === 'submitted' || proposal.status === 'verified') && ['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
                                                <>
                                                    {/* Principal/Vice Principal Verification */}
                                                    {['principal', 'vice_principal'].includes(user?.role) && proposal.status === 'verified' && !proposal.approvalSteps?.some(s => ['principal', 'vice_principal'].includes(s.role)) && (
                                                        <Tooltip text="Verify & Accept" position="top">
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Are you sure you want to verify and accept this proposal? We recommend viewing details first.')) {
                                                                        budgetProposalAPI.verifyBudgetProposal(proposal._id, { remarks: 'Verified & Accepted by Principal/VP' }).then(() => fetchProposals());
                                                                    }
                                                                }}
                                                                className="btn btn-sm btn-primary"
                                                                style={{ color: 'white' }}
                                                            >
                                                                <ShieldCheck size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {/* Office or Principal Final Approval/Allocation */}
                                                    {['office', 'principal', 'vice_principal'].includes(user?.role) && proposal.status === 'verified' && (
                                                        <Tooltip text={user?.role === 'office' ? "Allocate & Approve" : "Approve & Accept"} position="top">
                                                            <button
                                                                onClick={() => handleApproveProposal(proposal._id)}
                                                                className="btn btn-sm btn-success"
                                                                style={{ color: 'white' }}
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    {/* Admin can do everything */}
                                                    {user?.role === 'admin' && (
                                                        <Tooltip text="Approve (Admin)" position="top">
                                                            <button
                                                                onClick={() => handleApproveProposal(proposal._id)}
                                                                className="btn btn-sm btn-success"
                                                                style={{ color: 'white' }}
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}

                                                    <Tooltip text="Reject" position="top">
                                                        <button
                                                            onClick={() => handleRejectClick(proposal._id)}
                                                            className="btn btn-sm btn-danger"
                                                            style={{ color: 'white' }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showRejectModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Reject Budget Proposal</h3>
                            <button onClick={() => setShowRejectModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p>Please provide a reason for rejecting this budget proposal.</p>
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label">Rejection Reason *</label>
                                <textarea
                                    className="form-textarea"
                                    rows="3"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter reason here..."
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleRejectProposal}>Reject Proposal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export const AllocationForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const isEditMode = !!id;

    const queryParams = new URLSearchParams(location.search);
    const preselectProposalId = queryParams.get('proposalId');
    const preselectDeptId = queryParams.get('deptId');
    const preselectFY = queryParams.get('fy');

    const [departments, setDepartments] = useState([]);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        department: '',
        budgetHead: '',
        allocatedAmount: '',
        financialYear: '2024-2025',
        remarks: '',
        proposalId: '' // NEW: Link to approved budget proposal
    });

    const [proposals, setProposals] = useState([]);
    const [fetchingProposals, setFetchingProposals] = useState(false);
    const [showProposalPicker, setShowProposalPicker] = useState(false);

    const fetchApprovedProposals = async () => {
        if (!formData.department || !formData.financialYear) {
            setError('Please select department and financial year first');
            return;
        }

        try {
            setFetchingProposals(true);
            const response = await reportAPI.getBudgetProposalReport({
                department: formData.department,
                financialYear: formData.financialYear,
                status: 'approved'
            });

            const approvedProposals = response.data.data.proposals;
            // Flatten proposal items
            const items = approvedProposals.flatMap(p =>
                p.proposalItems.map(item => ({
                    ...item,
                    proposalId: p._id,
                    deptName: p.department.name
                }))
            );

            setProposals(items);
            setShowProposalPicker(true);
            if (items.length === 0) {
                setError('No approved proposals found for the selected criteria');
            }
        } catch (err) {
            console.error('Error fetching approved proposals:', err);
            setError('Failed to fetch approved proposals');
        } finally {
            setFetchingProposals(false);
        }
    };

    const handleSelectProposal = (item) => {
        setFormData(prev => ({
            ...prev,
            budgetHead: item.budgetHead._id || item.budgetHead,
            allocatedAmount: item.proposedAmount.toString(),
            remarks: `Based on approved budget proposal item. Justification: ${item.justification}`,
            proposalId: item.proposalId // NEW: Store proposal ID for backend
        }));
        setShowProposalPicker(false);
    };

    useEffect(() => {
        fetchInitialData();
        if (isEditMode) {
            fetchAllocation();
        } else if (preselectDeptId && preselectFY) {
            setFormData(prev => ({
                ...prev,
                department: preselectDeptId,
                financialYear: preselectFY,
                proposalId: preselectProposalId || ''
            }));
        }
    }, [id, isEditMode, preselectDeptId, preselectFY]);

    useEffect(() => {
        if (!isEditMode && preselectProposalId && formData.department === preselectDeptId && formData.financialYear === preselectFY) {
            fetchApprovedProposals();
        }
    }, [formData.department, formData.financialYear, isEditMode, preselectProposalId, preselectDeptId, preselectFY]);

    const fetchInitialData = async () => {
        try {
            const deptResponse = await departmentsAPI.getDepartments();
            setDepartments(deptResponse.data.data.departments);

            // Fetch all budget heads initially (will be filtered by department selection)
            const headResponse = await budgetHeadsAPI.getBudgetHeads();
            setBudgetHeads(headResponse.data.data.budgetHeads);
        } catch (err) {
            console.error('Error fetching initial data:', err);
            setError('Failed to fetch departments or budget heads');
        }
    };

    // Fetch budget heads when department changes
    useEffect(() => {
        const fetchBudgetHeadsForDepartment = async () => {
            if (formData.department && !isEditMode) {
                try {
                    const headResponse = await budgetHeadsAPI.getBudgetHeads({ department: formData.department });
                    setBudgetHeads(headResponse.data.data.budgetHeads);
                } catch (err) {
                    console.error('Error fetching budget heads:', err);
                }
            }
        };
        fetchBudgetHeadsForDepartment();
    }, [formData.department, isEditMode]);

    const fetchAllocation = async () => {
        try {
            setFetching(true);
            const response = await allocationAPI.getAllocationById(id);
            const allocation = response.data.data.allocation;
            setFormData({
                department: allocation.department?._id || allocation.department || '',
                budgetHead: allocation.budgetHead?._id || allocation.budgetHead || '',
                allocatedAmount: allocation.allocatedAmount.toString(),
                financialYear: allocation.financialYear,
                remarks: allocation.remarks || '',
                proposalId: allocation.sourceProposalId || '' // Include existing proposal link
            });
        } catch (err) {
            setError('Failed to fetch allocation data');
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Reset budget head when department changes (for new allocations only)
        if (name === 'department' && !isEditMode) {
            setFormData(prev => ({
                ...prev,
                budgetHead: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            setLoading(true);
            if (isEditMode) {
                await allocationAPI.updateAllocation(id, formData);
            } else {
                await allocationAPI.createAllocation(formData);
            }
            navigate('/allocations');
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} allocation`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="allocation-form-loading">
                <div className="loading-spinner"></div>
                <p>Loading allocation data...</p>
            </div>
        );
    }

    return (
        <div className="add-allocation-container">
            <PageHeader
                title={isEditMode ? "Edit Allocation" : "Add New Allocation"}
                subtitle={isEditMode ? "Update budget allocation details" : "Allocate budget to a department and budget head"}
            >
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/allocations')}>
                    <ArrowLeft size={18} /> Back to Allocations
                </button>
            </PageHeader>

            <div className="add-allocation-card">
                <form onSubmit={handleSubmit} className="add-allocation-form">
                    {error && (
                        <div className="alert alert-error mb-4">
                            <X size={20} className="mr-2" onClick={() => setError(null)} style={{ cursor: 'pointer' }} />
                            {error}
                        </div>
                    )}

                    <div className="form-sections-grid">
                        <div className="form-section">
                            <h3 className="section-title">Allocation Details</h3>

                            <div className="form-group">
                                <label htmlFor="department">Department *</label>
                                <select
                                    id="department"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(dept => (
                                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                                    ))}
                                </select>
                                {isEditMode && <small>Department cannot be changed after allocation</small>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="budgetHead">Budget Head *</label>
                                <select
                                    id="budgetHead"
                                    name="budgetHead"
                                    value={formData.budgetHead}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Budget Head</option>
                                    {budgetHeads.map(head => (
                                        <option key={head._id} value={head._id}>{head.name}</option>
                                    ))}
                                </select>
                                {isEditMode && <small>Budget head cannot be changed after allocation</small>}
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="section-title">Financial Information</h3>

                            <div className="form-group">
                                <div className="label-with-action">
                                    <label htmlFor="allocatedAmount">Allocated Amount *</label>
                                    {!isEditMode && (
                                        <button
                                            type="button"
                                            className="btn-link"
                                            onClick={fetchApprovedProposals}
                                            disabled={fetchingProposals || !formData.department || !formData.financialYear}
                                        >
                                            <Search size={14} /> {fetchingProposals ? 'Fetching...' : 'Fetch from Proposal'}
                                        </button>
                                    )}
                                </div>
                                <div className="amount-input-wrapper">
                                    <input
                                        type="number"
                                        id="allocatedAmount"
                                        name="allocatedAmount"
                                        value={formData.allocatedAmount}
                                        onChange={handleInputChange}
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="Enter amount"
                                    />
                                    <IndianRupee size={16} className="lucide-indian-rupee" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="financialYear">Financial Year *</label>
                                <input
                                    type="text"
                                    id="financialYear"
                                    name="financialYear"
                                    value={formData.financialYear}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g., 2024-2025"
                                    disabled={isEditMode}
                                />
                                {isEditMode && <small>Financial year cannot be changed after allocation</small>}
                            </div>
                        </div>

                        <div className="form-section full-width">
                            <h3 className="section-title">Additional Information</h3>
                            <div className="form-group">
                                <label htmlFor="remarks">Remarks</label>
                                <textarea
                                    id="remarks"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleInputChange}
                                    placeholder="Enter any additional notes or remarks..."
                                    rows="4"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/allocations')}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (
                                <>
                                    <Save size={18} className="mr-2" /> {isEditMode ? 'Update Allocation' : 'Create Allocation'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {showProposalPicker && (
                <div className="proposal-picker-modal">
                    <div className="proposal-picker-content">
                        <div className="proposal-picker-header">
                            <h3>Select Approved Proposal Item</h3>
                            <button className="close-btn" onClick={() => setShowProposalPicker(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="proposal-picker-body">
                            {proposals.length > 0 ? (
                                <div className="proposal-items-list">
                                    {proposals.map((item, index) => (
                                        <div
                                            key={index}
                                            className="proposal-item-card"
                                            onClick={() => handleSelectProposal(item)}
                                        >
                                            <div className="item-header">
                                                <span className="item-head">{item.budgetHead.name}</span>
                                                <span className="item-amount">₹{item.proposedAmount.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="item-details">
                                                <p><strong>Justification:</strong> {item.justification}</p>
                                                <p className="item-meta">Approved Proposal</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-items">No approved proposal items found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
