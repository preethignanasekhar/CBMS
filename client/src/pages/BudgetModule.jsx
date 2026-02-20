import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    allocationAPI,
    departmentsAPI,
    budgetHeadsAPI,
    categoriesAPI,
    budgetProposalAPI,
    expenditureAPI,
    reportAPI
} from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import {
    Plus, IndianRupee, CreditCard, Wallet, PieChart as PieChartIcon, Pencil, Trash2, X,
    Tag, AlertCircle, Save, AlignLeft, Hash, ArrowLeft, Eye, CheckCircle,
    XCircle, Clock, DollarSign, Send, Check, RefreshCcw, ShieldCheck,
    TrendingUp, TrendingDown, FileText, RotateCw, Download, ArrowUpRight, Search
} from 'lucide-react';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import './BudgetStyles.scss';

export const BudgetAllocations = () => {
    const [allocations, setAllocations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [budgetHeads, setBudgetHeads] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        departmentId: '',
        budgetHeadId: '',
        financialYear: ''
    });

    useEffect(() => {
        fetchData();
    }, [filters]);

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
        <div className="budget-allocations-container">
            <div className="allocations-header">
                <h1>Budget Allocations Management</h1>
                <Link to="/allocations/add" className="btn btn-primary">
                    <Plus size={18} /> Add Allocation
                </Link>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

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

            <div className="filters-section">
                <div className="filter-group">
                    <input
                        type="text"
                        placeholder="Search allocations..."
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        className="filter-input"
                    />
                </div>
                <div className="filter-group">
                    <select
                        name="departmentId"
                        value={filters.departmentId}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        name="budgetHeadId"
                        value={filters.budgetHeadId}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Budget Heads</option>
                        {budgetHeads.map(head => (
                            <option key={head._id} value={head._id}>{head.name}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        name="financialYear"
                        value={filters.financialYear}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Financial Years</option>
                        {(stats?.financialYears || []).map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
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
                            <th>Utilization</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allocations.map((allocation) => {
                            const utilization = getUtilizationPercentage(allocation.allocatedAmount, allocation.spentAmount);
                            return (
                                <tr key={allocation._id}>
                                    <td>
                                        <div className="department-info">
                                            <span className="dept-name">{allocation.departmentName}</span>
                                            <span className="dept-code">{allocation.departmentId}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="budget-head-info">
                                            <span className="head-name">{allocation.budgetHeadName}</span>
                                            <span className="head-code">{allocation.budgetHeadCode}</span>
                                        </div>
                                    </td>
                                    <td>{allocation.financialYear}</td>
                                    <td className="amount">₹{allocation.allocatedAmount?.toLocaleString() || '0'}</td>
                                    <td className="amount">₹{allocation.spentAmount?.toLocaleString() || '0'}</td>
                                    <td className="amount">₹{allocation.remainingAmount?.toLocaleString() || '0'}</td>
                                    <td>
                                        <div className="utilization-bar">
                                            <div className="utilization-fill" style={{
                                                width: `${utilization}%`,
                                                backgroundColor: getUtilizationColor(utilization)
                                            }}></div>
                                            <span className="utilization-text">{utilization}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Tooltip text="Edit Allocation" position="top">
                                                <Link
                                                    to={`/allocations/edit/${allocation._id}`}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    <Pencil size={16} />
                                                </Link>
                                            </Tooltip>
                                            <Tooltip text="Delete Allocation" position="top">
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(allocation._id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </td>
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

                            <div className="form-group">
                                <label className="form-label">Budget Head Code *</label>
                                <div className="input-with-icon">
                                    <span className="input-icon-wrapper"><Hash size={16} /></span>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        required
                                        className="form-input has-icon"
                                        placeholder="e.g., AD-PUB"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Category *</label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    required
                                    className="form-input"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

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

            const response = await budgetHeadsAPI.getBudgetHeads(params);
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
                setError('Failed to delete budget head');
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
                <Link to="/budget-heads/add" className="btn btn-primary">
                    <Plus size={18} /> Add Budget Head
                </Link>
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

            <div className="filters-section">
                <div className="filter-group">
                    <input
                        type="text"
                        placeholder="Search budget heads..."
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        className="filter-input"
                    />
                </div>
                <div className="filter-group">
                    <select
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Categories</option>
                        {categories.map(category => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
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

            <div className="budget-heads-grid">
                {budgetHeads.map((head) => (
                    <div key={head._id} className="budget-head-card">
                        <div className="card-header">
                            <div className="head-info">
                                <h3 className="head-name">{head.name}</h3>
                                <span className="head-code">{head.code}</span>
                            </div>
                            <div className="head-status">
                                <span className={`status ${head.isActive ? 'active' : 'inactive'}`}>
                                    {head.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                            </div>
                        </div>

                        <div className="card-body">
                            <div className="head-category">
                                <span
                                    className="category-badge"
                                    style={{ backgroundColor: getCategoryColor(head.category) }}
                                >
                                    {head.category.toUpperCase()}
                                </span>
                            </div>

                            <p className="head-description">
                                {head.description || 'No description provided'}
                            </p>

                            <div className="head-meta">
                                <p className="created-date">
                                    Created: {new Date(head.createdAt).toLocaleDateString()}
                                </p>
                                <p className="head-id">ID: {head._id}</p>
                            </div>
                        </div>

                        <div className="card-actions">
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
                                    onClick={() => handleDelete(head._id)}
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                ))}
            </div>

            {budgetHeads.length === 0 && (
                <div className="no-budget-heads">
                    <div className="no-budget-heads-icon">
                        <IndianRupee size={48} />
                    </div>
                    <h3>No Budget Heads Found</h3>
                    <p>No budget heads found matching the current filters.</p>
                </div>
            )}
        </div>
    );
};
export const BudgetProposalForm = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { id } = useParams();
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
    const [loadingStats, setLoadingStats] = useState(false);
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
            currentYearSpent: 0
        }],
        notes: ''
    });

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

    useEffect(() => {
        if (formData.department && !isEditMode) {
            fetchBudgetHeads(formData.department);
        }
    }, [formData.department, isEditMode]);

    // (moved) Auto-refresh hook will be defined after refreshAllStats to avoid temporal-deadzone

    useEffect(() => {
        if (isEditMode) {
            const fetchProposal = async () => {
                try {
                    setFetching(true);
                    const response = await budgetProposalAPI.getBudgetProposalById(id);
                    const proposal = response.data.data.proposal;

                    // Fetch budget heads for this department
                    if (proposal.department && proposal.department._id) {
                        await fetchBudgetHeads(proposal.department._id);
                    }

                    const items = proposal.proposalItems.map(item => ({
                        budgetHead: item.budgetHead._id,
                        proposedAmount: item.proposedAmount,
                        justification: item.justification,
                        previousYearUtilization: item.previousYearUtilization || 0
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

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.proposalItems];
        newItems[index] = {
            ...newItems[index],
            [field]: value
        };

        // Auto-fetch budget stats if budget head is selected
        if (field === 'budgetHead' && value && formData.department) {
            fetchBudgetStats(value, formData.department, index);
        }

        setFormData(prev => ({
            ...prev,
            proposalItems: newItems
        }));
    };

    // Auto-refresh current year spent amounts every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (formData.department && formData.proposalItems.some(item => item.budgetHead)) {
                refreshAllStats();
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [formData.department, formData.proposalItems, refreshAllStats]);

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
                    currentYearSpent: 0
                }
            ]
        }));
    };

    const removeItem = (index) => {
        if (formData.proposalItems.length > 1) {
            setFormData(prev => ({
                ...prev,
                proposalItems: prev.proposalItems.filter((_, i) => i !== index)
            }));
        }
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

            if (formData.proposalItems.some(item => !item.budgetHead || !item.proposedAmount || !item.justification)) {
                setError('Please fill in all required fields for each proposal item');
                setLoading(false);
                return;
            }

            const submitData = {
                financialYear: formData.financialYear,
                department: formData.department,
                proposalItems: formData.proposalItems.map(item => ({
                    budgetHead: item.budgetHead,
                    proposedAmount: parseFloat(item.proposedAmount),
                    justification: item.justification,
                    previousYearUtilization: parseFloat(item.previousYearUtilization) || 0
                })),
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
        <div className="budget-proposal-form-container">
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

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={handleSubmit} className="budget-proposal-form">
                <div className="form-section">
                    <h3>Basic Information</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Financial Year <span className="required">*</span></label>
                            <input
                                type="text"
                                name="financialYear"
                                value={formData.financialYear}
                                onChange={handleInputChange}
                                placeholder="e.g., 2025-2026"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Department <span className="required">*</span></label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleInputChange}
                                required
                                disabled={isEditMode || ['department', 'hod', 'officer', 'vp', 'p'].includes(user?.role)}
                            >
                                <option value="">Select Department</option>
                                {departments.map(dept => (
                                    <option key={dept._id} value={dept._id}>
                                        {dept.name} ({dept.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder="Additional notes for the proposal"
                            rows="3"
                            disabled={isEditMode && ['hod', 'officer', 'vp', 'p'].includes(user?.role)}
                            style={isEditMode && ['hod', 'officer', 'vp', 'p'].includes(user?.role) ? { opacity: 0.6 } : {}}
                        />
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
                                <div className="form-group">
                                    <label>Budget Head <span className="required">*</span></label>
                                    <select
                                        value={item.budgetHead}
                                        onChange={(e) => handleItemChange(index, 'budgetHead', e.target.value)}
                                        required
                                        disabled={isEditMode && ['hod', 'officer', 'vp', 'p'].includes(user?.role)}
                                    >
                                        <option value="">Select Budget Head</option>
                                        {budgetHeads.map(head => (
                                            <option key={head._id} value={head._id}>
                                                {head.name} ({head.category})
                                            </option>
                                        ))}
                                    </select>
                                </div>

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
                                        disabled={isEditMode && ['hod', 'officer', 'vp', 'p'].includes(user?.role)}
                                    />
                                </div>

                                <div className="form-group stats-group" style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>
                                    <div className="expenditure-stats" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '1rem',
                                        padding: '1rem',
                                        background: 'rgba(var(--primary-rgb), 0.03)',
                                        border: '1px border var(--border-color)',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        <div className="stat-item">
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                                Prev. Year Allocated Amount
                                            </label>
                                            <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '1rem' }}>
                                                ₹{(item.prevYearAllocated || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                                Prev. Year Spent Amount
                                            </label>
                                            <span style={{ fontWeight: '600', color: 'var(--danger)', fontSize: '1rem' }}>
                                                ₹{(item.prevYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                                Prev. Year Balance (Remaining)
                                            </label>
                                            <span style={{ fontWeight: '600', color: 'var(--success)', fontSize: '1rem' }}>
                                                ₹{(((item.prevYearAllocated || 0) - (item.prevYearSpent || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                                Current Year Spent Amount (Department)
                                            </label>
                                            <span style={{ fontWeight: '600', color: 'var(--warning)', fontSize: '1rem' }}>
                                                ₹{(item.currentYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                                Prev. Year Utilization (To be saved)
                                            </label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>₹</span>
                                                <input
                                                    type="number"
                                                    value={item.previousYearUtilization}
                                                    onChange={(e) => handleItemChange(index, 'previousYearUtilization', e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    step="0.01"
                                                    disabled={['hod', 'office', 'vice_principal', 'principal'].includes(user?.role)}
                                                    style={{
                                                        height: '32px',
                                                        padding: '4px 8px',
                                                        width: '120px',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '4px',
                                                        opacity: ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role) ? 0.6 : 1,
                                                        cursor: ['hod', 'office', 'vice_principal', 'principal'].includes(user?.role) ? 'not-allowed' : 'auto'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
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
                    {isEditMode && (
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
                            {['principal', 'vice_principal'].includes(user?.role) && formData.status === 'verified' && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={async () => {
                                        if (window.confirm('Are you sure you want to verify and accept this proposal?')) {
                                            await budgetProposalAPI.verifyBudgetProposal(id, { remarks: 'Verified & Accepted from detail view' });
                                            navigate('/budget-proposals');
                                        }
                                    }}
                                    style={{ color: 'white' }}
                                >
                                    <ShieldCheck size={18} /> Verify & Accept
                                </button>
                            )}
                            {user?.role === 'office' && formData.status === 'verified' && (
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
    );
};
export const BudgetProposalReport = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [report, setReport] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        financialYear: '2025-2026',
        department: '',
        status: ''
    });
    const [showApprovalDetailsModal, setShowApprovalDetailsModal] = useState(false);
    const [approvalDetails, setApprovalDetails] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await departmentsAPI.getDepartments();
            setDepartments(response.data.data.departments);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    }, []);

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const response = await reportAPI.getBudgetProposalReport(filters);
            setReport(response.data.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch budget proposal report');
            console.error('Error fetching report:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const fetchApprovalDetails = async (proposal) => {
        setLoadingStats(true);
        try {
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();
            const actualCurrentFY = currentMonth >= 4 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

            const proposalFY = proposal.financialYear;
            const [proposalStart] = proposalFY.split('-');
            const prevYearStart = (parseInt(proposalStart) - 2);
            const prevFY = `${prevYearStart}-${parseInt(proposalStart) - 1}`;

            const [currentDeptExpResponse, prevAllocResponse] = await Promise.all([
                expenditureAPI.getExpenditures({
                    department: proposal.department._id,
                    financialYear: actualCurrentFY,
                    limit: 2000
                }),
                allocationAPI.getAllocations({
                    department: proposal.department._id,
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

            setApprovalDetails({
                proposal,
                prevYearAllocated,
                prevYearSpent,
                prevYearBalance,
                currentYearSpent
            });
            setShowApprovalDetailsModal(true);
        } catch (err) {
            console.error('Error fetching approval details:', err);
            setError('Failed to fetch budget details');
        } finally {
            setLoadingStats(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={16} className="text-success" />;
            case 'verified': return <ShieldCheck size={16} className="text-info" />;
            case 'submitted': return <Clock size={16} className="text-primary" />;
            case 'rejected': return <XCircle size={16} className="text-danger" />;
            default: return <FileText size={16} className="text-secondary" />;
        }
    };

    const exportToCSV = () => {
        if (!report || !report.proposals) return;

        let csv = 'Yearly Budget Proposal Report\n';
        csv += `Financial Year: ${filters.financialYear}\n`;
        csv += `Generated on: ${new Date().toLocaleString()}\n\n`;

        csv += 'Department,Status,Total Proposed Amount,Items Count,Submitted Date\n';
        report.proposals.forEach(p => {
            csv += `"${p.department.name}",${p.status},${p.totalProposedAmount},${p.proposalItems.length},${p.submittedDate ? new Date(p.submittedDate).toLocaleDateString() : 'N/A'}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-proposals-${filters.financialYear}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="proposal-report-container">
            <PageHeader
                title="Yearly Budget Proposal Report"
                subtitle="Consolidated view of proposed budgets for the upcoming year"
            >
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={fetchReport}>
                        <RotateCw size={18} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={exportToCSV}>
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </PageHeader>

            {error && <div className="error-message">{error}</div>}

            <div className="filters-section">
                <div className="form-group">
                    <label>Financial Year</label>
                    <input
                        type="text"
                        name="financialYear"
                        value={filters.financialYear}
                        onChange={handleFilterChange}
                        placeholder="e.g., 2025-2026"
                    />
                </div>

                <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={filters.department} onChange={handleFilterChange}>
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={filters.status} onChange={handleFilterChange}>
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>

                <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
                    {loading ? 'Processing...' : 'Generate Summary'}
                </button>
            </div>

            {report && (
                <>
                    <div className="stats-grid">
                        <StatCard
                            title="Total Proposals"
                            value={report.summary.totalProposals}
                            icon={<FileText size={24} />}
                            color="var(--primary)"
                        />
                        <StatCard
                            title="Approved"
                            value={report.summary.byStatus.approved || 0}
                            icon={<CheckCircle size={24} />}
                            color="var(--success)"
                        />
                        <StatCard
                            title="Pending Approval"
                            value={(report.summary.byStatus.submitted || 0) + (report.summary.byStatus.verified || 0)}
                            icon={<Clock size={24} />}
                            color="var(--warning)"
                        />
                        <StatCard
                            title="Total Proposed Amount"
                            value={`₹${report.summary.totalProposedAmount.toLocaleString('en-IN')}`}
                            icon={<FileText size={24} />}
                            color="var(--info)"
                        />
                    </div>

                    <div className="report-section">
                        <div className="section-header">
                            <h3>Proposal Breakdown by Department</h3>
                        </div>
                        <div className="table-responsive">
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Status</th>
                                        <th className="text-right">Proposed Amount</th>
                                        <th className="text-center">Items</th>
                                        <th>Last Updated</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.proposals.length > 0 ? report.proposals.map(p => (
                                        <tr key={p._id}>
                                            <td>
                                                <div className="dept-info">
                                                    <span className="font-bold">{p.department.name}</span>
                                                    <span className="text-muted text-xs block">{p.department.code}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="status-badge">
                                                    {getStatusIcon(p.status)}
                                                    <span className={`status-text status-${p.status}`}>
                                                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="text-right font-mono">
                                                ₹{p.totalProposedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-center">{p.proposalItems.length}</td>
                                            <td className="text-sm text-muted">
                                                {new Date(p.updatedAt).toLocaleDateString()}
                                            </td>
                                            <td className="text-center">
                                                {(p.status === 'submitted' || p.status === 'verified') && ['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
                                                    <div className="action-buttons">
                                                        <button
                                                            className="btn-action approve"
                                                            onClick={async () => {
                                                                setPendingAction('approve');
                                                                await fetchApprovalDetails(p);
                                                            }}
                                                            title="Approve"
                                                            style={{ backgroundColor: '#28a745', color: 'white', marginRight: '4px' }}
                                                        >
                                                            <Check size={16} /> Approve
                                                        </button>
                                                        <button
                                                            className="btn-action reject"
                                                            onClick={async () => {
                                                                setPendingAction('reject');
                                                                await fetchApprovalDetails(p);
                                                            }}
                                                            title="Reject"
                                                            style={{ backgroundColor: '#dc3545', color: 'white' }}
                                                        >
                                                            <X size={16} /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {p.status === 'approved' && (
                                                    <button
                                                        className="btn-action allocate"
                                                        onClick={() => navigate(`/allocations/add?proposalId=${p._id}&deptId=${p.department._id}&fy=${p.financialYear}`)}
                                                        title="Promote to Allocation"
                                                    >
                                                        <ArrowUpRight size={16} /> Allocate
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-muted">No proposals found for the selected criteria</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Approval Details Modal */}
            {showApprovalDetailsModal && approvalDetails && (
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
                        maxWidth: '600px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>Budget Details for Approval</h2>
                            <button
                                onClick={() => {
                                    setShowApprovalDetailsModal(false);
                                    setPendingAction(null);
                                    setApprovalDetails(null);
                                }}
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

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
                                {approvalDetails.proposal.department.name}
                            </h3>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1rem',
                                padding: '1rem',
                                background: 'rgba(var(--primary-rgb), 0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                        Prev. Year Allocated Amount
                                    </label>
                                    <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '1rem' }}>
                                        ₹{(approvalDetails.prevYearAllocated || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                        Prev. Year Spent Amount
                                    </label>
                                    <span style={{ fontWeight: '600', color: 'var(--danger)', fontSize: '1rem' }}>
                                        ₹{(approvalDetails.prevYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                        Prev. Year Balance (Remaining)
                                    </label>
                                    <span style={{ fontWeight: '600', color: 'var(--success)', fontSize: '1rem' }}>
                                        ₹{(approvalDetails.prevYearBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
                                        Current Year Spent Amount (Department)
                                    </label>
                                    <span style={{ fontWeight: '600', color: 'var(--warning)', fontSize: '1rem' }}>
                                        ₹{(approvalDetails.currentYearSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div style={{
                                padding: '1rem',
                                background: 'rgba(var(--info-rgb), 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                marginBottom: '1rem'
                            }}>
                                <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                                    <strong>Proposal Amount:</strong> ₹{(approvalDetails.proposal.totalProposedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                                <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                                    <strong>Items:</strong> {approvalDetails.proposal.proposalItems.length}
                                </p>
                                <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                                    <strong>Financial Year:</strong> {approvalDetails.proposal.financialYear}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowApprovalDetailsModal(false);
                                    setPendingAction(null);
                                    setApprovalDetails(null);
                                }}
                                className="btn btn-secondary"
                                style={{ minWidth: '120px' }}
                            >
                                Cancel
                            </button>
                            {pendingAction === 'approve' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            await budgetProposalAPI.approveBudgetProposal(approvalDetails.proposal._id, { notes: 'Approved from report' });
                                            setShowApprovalDetailsModal(false);
                                            setPendingAction(null);
                                            setApprovalDetails(null);
                                            fetchReport();
                                        } catch (err) {
                                            setError('Failed to approve proposal');
                                            console.error('Error approving:', err);
                                        }
                                    }}
                                    className="btn btn-success"
                                    style={{ minWidth: '120px', color: 'white' }}
                                >
                                    <Check size={16} /> Confirm Approve
                                </button>
                            )}
                            {pendingAction === 'reject' && (
                                <button
                                    onClick={() => {
                                        const reason = prompt('Enter rejection reason:');
                                        if (reason) {
                                            budgetProposalAPI.rejectBudgetProposal(approvalDetails.proposal._id, { rejectionReason: reason }).then(() => {
                                                setShowApprovalDetailsModal(false);
                                                setPendingAction(null);
                                                setApprovalDetails(null);
                                                fetchReport();
                                            }).catch(err => {
                                                setError('Failed to reject proposal');
                                                console.error('Error rejecting:', err);
                                            });
                                        }
                                    }}
                                    className="btn btn-danger"
                                    style={{ minWidth: '120px', color: 'white' }}
                                >
                                    <X size={16} /> Confirm Reject
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
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

    const fetchProposals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await budgetProposalAPI.getBudgetProposals(filters);
            setProposals(response.data.data.proposals);
            setError(null);
        } catch (err) {
            setError('Failed to fetch budget proposals');
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
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
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

    const handleResubmitProposal = async (id) => {
        if (!window.confirm('Do you want to create a new draft from this rejected proposal? This will allow you to make corrections and resubmit.')) {
            return;
        }

        try {
            setLoading(true);
            await budgetProposalAPI.resubmitBudgetProposal(id);
            setError(null);
            fetchProposals();
            fetchStats();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resubmit proposal');
            console.error('Error resubmitting proposal:', err);
            setLoading(false);
        }
    };

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
                        title="Submitted"
                        value={stats.submittedProposals}
                        icon={<Clock size={24} />}
                        color="var(--info)"
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

            <div className="filters-section">
                <div className="form-group">
                    <label>Financial Year</label>
                    <input
                        type="text"
                        name="financialYear"
                        value={filters.financialYear}
                        onChange={handleFilterChange}
                        placeholder="e.g., 2025-2026"
                    />
                </div>

                <div className="form-group">
                    <label>Status</label>
                    <select
                        name="status"
                        value={filters.status}
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
                                <th>Items</th>
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
                                            <div className="dept-name">{proposal.department.name}</div>
                                            <div className="dept-code">{proposal.department.code}</div>
                                        </div>
                                    </td>
                                    <td>{proposal.financialYear}</td>
                                    <td>
                                        <span className="amount">
                                            ₹{proposal.totalProposedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="item-count">{proposal.proposalItems.length} items</span>
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
                                            {(proposal.status === 'draft' || proposal.status === 'revised') && (
                                                <>
                                                    <Tooltip text="Edit Proposal" position="top">
                                                        <Link
                                                            to={`/budget-proposals/edit/${proposal._id}`}
                                                            className="btn btn-sm btn-secondary"
                                                        >
                                                            <Pencil size={16} />
                                                        </Link>
                                                    </Tooltip>
                                                    <Tooltip text="Submit for Approval" position="top">
                                                        <button
                                                            onClick={() => handleSubmitProposal(proposal._id)}
                                                            className="btn btn-sm btn-success"
                                                            style={{ color: 'white' }}
                                                        >
                                                            <Send size={16} />
                                                        </button>
                                                    </Tooltip>
                                                </>
                                            )}
                                            {proposal.status === 'rejected' && (
                                                <Tooltip text="Resubmit (Copy to Draft)" position="top">
                                                    <button
                                                        onClick={() => handleResubmitProposal(proposal._id)}
                                                        className="btn btn-sm btn-warning"
                                                        style={{ color: 'white', backgroundColor: '#fd7e14', borderColor: '#fd7e14' }}
                                                    >
                                                        <RefreshCcw size={16} />
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
export const BudgetUtilizationDashboard = () => {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [financialYear, setFinancialYear] = useState('2025-2026');

    const COLORS = ['#28a745', '#17a2b8', '#ffc107', '#fd7e14', '#dc3545'];
    const UTILIZATION_RANGES = ['0-25', '25-50', '50-75', '75-90', '90+'];

    const fetchDashboard = useCallback(async () => {
        try {
            setLoading(true);
            const response = await reportAPI.getBudgetUtilizationDashboard({ financialYear });
            setDashboard(response.data.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch budget utilization dashboard');
            console.error('Error fetching dashboard:', err);
        } finally {
            setLoading(false);
        }
    }, [financialYear]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleYearChange = (e) => {
        setFinancialYear(e.target.value);
    };

    const getUtilizationData = () => {
        if (!dashboard) return [];
        return UTILIZATION_RANGES.map(range => ({
            range: `${range}%`,
            count: dashboard.utilizationRanges[range].count,
            totalAllocated: dashboard.utilizationRanges[range].totalAllocated
        }));
    };

    const getDepartmentData = () => {
        if (!dashboard) return [];
        return dashboard.departmentWiseUtilization.sort((a, b) => b.totalAllocated - a.totalAllocated).slice(0, 10);
    };

    const getStatusColor = (percentage) => {
        if (percentage >= 90) return '#dc3545';
        if (percentage >= 75) return '#ffc107';
        if (percentage >= 50) return '#17a2b8';
        return '#28a745';
    };

    if (loading) {
        return (
            <div className="budget-utilization-dashboard">
                <div className="loading">Loading budget utilization dashboard...</div>
            </div>
        );
    }

    return (
        <div className="budget-utilization-dashboard">
            <PageHeader
                title="Budget Utilization Dashboard"
                subtitle="Real-time budget utilization monitoring across departments"
            />

            {error && <div className="error-message">{error}</div>}

            <div className="filters-section">
                <div className="form-group">
                    <label>Financial Year</label>
                    <input
                        type="text"
                        value={financialYear}
                        onChange={handleYearChange}
                        placeholder="e.g., 2025-2026"
                    />
                </div>
            </div>

            {dashboard && (
                <>
                    {/* Key Metrics */}
                    <div className="stats-grid">
                        <StatCard
                            title="Total Departments"
                            value={dashboard.totalDepartments}
                            icon={<TrendingUp size={24} />}
                            color="var(--primary)"
                        />
                        <StatCard
                            title="Total Expenditure (FY)"
                            value={`₹${dashboard.departmentWiseUtilization.reduce((sum, d) => sum + d.totalSpent, 0).toLocaleString('en-IN')}`}
                            icon={<IndianRupee size={24} />}
                            color="#17a2b8"
                        />
                        <StatCard
                            title="Today's Expenditure"
                            value={`₹${dashboard.dailyTotal.toLocaleString('en-IN')}`}
                            subtitle={new Date().toLocaleDateString('en-IN')}
                            icon={<Clock size={24} />}
                            color="#6f42c1"
                        />
                        <StatCard
                            title="High Utilization (≥90%)"
                            value={dashboard.departmentsWithHighUtilization}
                            subtitle="Requires attention"
                            icon={<AlertCircle size={24} />}
                            color="var(--danger)"
                        />
                        <StatCard
                            title="Low Utilization (<50%)"
                            value={dashboard.departmentsWithLowUtilization}
                            subtitle="Underutilized budgets"
                            icon={<TrendingDown size={24} />}
                            color="var(--warning)"
                        />
                    </div>

                    {/* Today's Breakdown Section */}
                    {dashboard.dailyTotal > 0 && (
                        <div className="report-section daily-breakdown">
                            <div className="section-header">
                                <h3 className="flex items-center gap-2">
                                    <Clock size={20} /> Today's Expenditure Breakdown
                                </h3>
                                <span className="total-badge">Total: ₹{dashboard.dailyTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="daily-stats-grid">
                                {Object.entries(dashboard.dailyDepartmentWise).map(([dept, amount]) => (
                                    <div key={dept} className="daily-dept-card">
                                        <div className="dept-name">{dept}</div>
                                        <div className="dept-amount">₹{amount.toLocaleString('en-IN')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Charts Section */}
                    <div className="charts-section">
                        {/* Utilization Range Distribution */}
                        <div className="chart-container">
                            <h3>Distribution by Utilization Range</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={getUtilizationData()}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="range" />
                                    <YAxis />
                                    <RechartsTooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#8884d8" name="Number of Allocations" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Top Departments by Allocation */}
                        <div className="chart-container">
                            <h3>Top 10 Departments by Budget Allocation</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={getDepartmentData()} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="code" type="category" width={80} />
                                    <RechartsTooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                                    <Bar dataKey="totalAllocated" fill="#8884d8" name="Allocated" />
                                    <Bar dataKey="totalSpent" fill="#82ca9d" name="Spent" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Utilization Pie Chart */}
                        <div className="chart-container">
                            <h3>Allocations by Utilization Status</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={UTILIZATION_RANGES.map(range => ({
                                            name: `${range}%`,
                                            value: dashboard.utilizationRanges[range].count
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {UTILIZATION_RANGES.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* High Utilization Alert */}
                    {dashboard.departmentsWithHighUtilization > 0 && (
                        <div className="alert alert-warning">
                            <AlertCircle size={20} />
                            <div>
                                <strong>{dashboard.departmentsWithHighUtilization} department(s)</strong> have budget utilization ≥90%.
                                Consider allocating additional funds if needed.
                            </div>
                        </div>
                    )}

                    {/* Low Utilization Alert */}
                    {dashboard.departmentsWithLowUtilization > 0 && (
                        <div className="alert alert-info">
                            <TrendingDown size={20} />
                            <div>
                                <strong>{dashboard.departmentsWithLowUtilization} department(s)</strong> have budget utilization &lt;50%.
                                Review spending plans and reallocate if necessary.
                            </div>
                        </div>
                    )}

                    {/* Department-wise Utilization Table */}
                    <div className="report-section">
                        <h3>Department-wise Utilization Details</h3>
                        <div className="table-container">
                            <table className="utilization-table">
                                <thead>
                                    <tr>
                                        <th>Department Code</th>
                                        <th>Total Allocated</th>
                                        <th>Total Spent</th>
                                        <th>Utilization %</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboard.departmentWiseUtilization.map((dept) => (
                                        <tr key={dept.departmentId}>
                                            <td>{dept.code}</td>
                                            <td>₹{dept.totalAllocated.toLocaleString('en-IN')}</td>
                                            <td>₹{dept.totalSpent.toLocaleString('en-IN')}</td>
                                            <td>
                                                <div className="utilization-cell">
                                                    <div className="utilization-bar">
                                                        <div
                                                            className="utilization-fill"
                                                            style={{
                                                                width: `${Math.min(dept.utilizationPercentage, 100)}%`,
                                                                backgroundColor: getStatusColor(dept.utilizationPercentage)
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="percentage">{dept.utilizationPercentage}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status status-${dept.utilizationPercentage >= 90 ? 'critical' :
                                                    dept.utilizationPercentage >= 75 ? 'warning' :
                                                        dept.utilizationPercentage >= 50 ? 'moderate' : 'low'
                                                    }`}>
                                                    {dept.utilizationPercentage >= 90 ? 'Critical' :
                                                        dept.utilizationPercentage >= 75 ? 'High' :
                                                            dept.utilizationPercentage >= 50 ? 'Moderate' : 'Low'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="legend-section">
                        <h4>Utilization Status Legend</h4>
                        <div className="legend-items">
                            <div className="legend-item">
                                <span className="status status-low" />
                                <span>Low (0-50%)</span>
                            </div>
                            <div className="legend-item">
                                <span className="status status-moderate" />
                                <span>Moderate (50-75%)</span>
                            </div>
                            <div className="legend-item">
                                <span className="status status-warning" />
                                <span>High (75-90%)</span>
                            </div>
                            <div className="legend-item">
                                <span className="status status-critical" />
                                <span>Critical (≥90%)</span>
                            </div>
                        </div>
                    </div>
                </>
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
                                        <option key={head._id} value={head._id}>{head.name} ({head.code})</option>
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
