import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { incomeAPI, financialYearAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import Tooltip from '../components/Tooltip/Tooltip';
import {
    Plus,
    IndianRupee,
    TrendingUp,
    CheckCircle,
    Clock,
    Pencil,
    Trash2,
    CheckSquare,
    ArrowLeft,
    Save
} from 'lucide-react';
import './IncomeStyles.scss';

// --- IncomeReceipts Component ---
export const IncomeReceipts = () => {
    const [incomes, setIncomes] = useState([]);
    const [stats, setStats] = useState(null);
    const [financialYears, setFinancialYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        financialYear: '',
        source: '',
        status: '',
        category: ''
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canVerify = ['principal', 'admin'].includes(user.role);
    const canDelete = ['admin'].includes(user.role);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const params = {};
            if (filters.financialYear) params.financialYear = filters.financialYear;
            if (filters.source) params.source = filters.source;
            if (filters.status) params.status = filters.status;
            if (filters.category) params.category = filters.category;

            const [incomesResponse, statsResponse, yearsResponse] = await Promise.all([
                incomeAPI.getIncomes(params),
                incomeAPI.getIncomeStats(params),
                financialYearAPI.getFinancialYears()
            ]);

            setIncomes(incomesResponse.data.data.incomes || []);
            setStats(statsResponse.data.data || {});
            setFinancialYears(yearsResponse.data.data.financialYears || []);
            setError(null);
        } catch (err) {
            setError('Failed to fetch income data');
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

    const handleVerify = async (id) => {
        if (!window.confirm('Verify this income record? This action confirms the funds have been received and verified.')) {
            return;
        }

        try {
            const remarks = prompt('Enter verification remarks (optional):');
            await incomeAPI.verifyIncome(id, { remarks: remarks || 'Verified by Principal' });
            fetchData(); // Refresh list
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to verify income');
            console.error('Error verifying income:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this income record? This action cannot be undone.')) {
            return;
        }

        try {
            await incomeAPI.deleteIncome(id);
            fetchData(); // Refresh list
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete income');
            console.error('Error deleting income:', err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN');
    };

    const getStatusBadgeClass = (status) => {
        const classes = {
            expected: 'status-expected',
            received: 'status-received',
            verified: 'status-verified'
        };
        return classes[status] || '';
    };

    const sourceLabels = {
        government_grant: 'Government Grant',
        student_fees: 'Student Fees',
        donation: 'Donation',
        research_grant: 'Research Grant',
        consultancy: 'Consultancy',
        other: 'Other'
    };

    if (loading) {
        return (
            <div className="income-receipts-container">
                <div className="loading">Loading income records...</div>
            </div>
        );
    }

    return (
        <div className="income-receipts-container">
            <PageHeader
                title="Income & Receipts Management"
                subtitle="Track institutional income, grants, and other fund receipts"
            >
                <Link to="/income/add" className="btn btn-primary">
                    <Plus size={18} /> Add Income Record
                </Link>
            </PageHeader>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {stats?.summary && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">
                            <Clock size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary.totalExpected?.toLocaleString('en-IN') || '0'}</div>
                            <div className="stat-label">Total Expected</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <TrendingUp size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary.totalReceived?.toLocaleString('en-IN') || '0'}</div>
                            <div className="stat-label">Total Received</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <CheckCircle size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">₹{stats.summary.totalVerified?.toLocaleString('en-IN') || '0'}</div>
                            <div className="stat-label">Total Verified</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">
                            <IndianRupee size={32} />
                        </div>
                        <div className="stat-info">
                            <div className="stat-number">{stats.summary.receptionRate || '0'}%</div>
                            <div className="stat-label">Reception Rate</div>
                            <div className="stat-sublabel">
                                Pending: ₹{stats.summary.pending?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="filters-section">
                <div className="filter-group">
                    <select
                        name="financialYear"
                        value={filters.financialYear}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Financial Years</option>
                        {financialYears.map(fy => (
                            <option key={fy._id} value={fy.year}>{fy.year}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        name="source"
                        value={filters.source}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Sources</option>
                        {Object.entries(sourceLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="expected">Expected</option>
                        <option value="received">Received</option>
                        <option value="verified">Verified</option>
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Categories</option>
                        <option value="recurring">Recurring</option>
                        <option value="non-recurring">Non-Recurring</option>
                    </select>
                </div>
            </div>

            <div className="income-table-container">
                <table className="income-table">
                    <thead>
                        <tr>
                            <th>FY</th>
                            <th>Source</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Category</th>
                            <th>Expected Date</th>
                            <th>Received Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {incomes.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="no-data">
                                    No income records found. Click "Add Income Record" to create one.
                                </td>
                            </tr>
                        ) : (
                            incomes.map((income) => (
                                <tr key={income._id}>
                                    <td>{income.financialYear}</td>
                                    <td>
                                        <div className="source-info">
                                            <span className="source-name">{sourceLabels[income.source]}</span>
                                            {income.referenceNumber && (
                                                <span className="ref-number">Ref: {income.referenceNumber}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="description-cell">
                                            {income.description}
                                        </div>
                                    </td>
                                    <td className="amount">₹{income.amount?.toLocaleString('en-IN') || '0'}</td>
                                    <td>
                                        <span className={`category-badge category-${income.category}`}>
                                            {income.category}
                                        </span>
                                    </td>
                                    <td>{formatDate(income.expectedDate)}</td>
                                    <td>{formatDate(income.receivedDate)}</td>
                                    <td>
                                        <span className={`status-badge ${getStatusBadgeClass(income.status)}`}>
                                            {income.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <Tooltip text="Edit Income" position="top">
                                                <Link
                                                    to={`/income/edit/${income._id}`}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    <Pencil size={16} />
                                                </Link>
                                            </Tooltip>
                                            {canVerify && income.status === 'received' && (
                                                <Tooltip text="Verify Income" position="top">
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleVerify(income._id)}
                                                    >
                                                        <CheckSquare size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                            {canDelete && income.status !== 'verified' && (
                                                <Tooltip text="Delete Income" position="top">
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(income._id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- IncomeForm Component ---
export const IncomeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [financialYears, setFinancialYears] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditMode);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        financialYear: '',
        source: '',
        category: 'recurring',
        amount: '',
        expectedDate: '',
        receivedDate: '',
        status: 'expected',
        referenceNumber: '',
        description: '',
        remarks: ''
    });

    const sourceOptions = [
        { value: 'government_grant', label: 'Government Grant' },
        { value: 'student_fees', label: 'Student Fees' },
        { value: 'donation', label: 'Donation' },
        { value: 'research_grant', label: 'Research Grant' },
        { value: 'consultancy', label: 'Consultancy' },
        { value: 'other', label: 'Other' }
    ];

    const statusOptions = [
        { value: 'expected', label: 'Expected' },
        { value: 'received', label: 'Received' },
        { value: 'verified', label: 'Verified' }
    ];

    useEffect(() => {
        fetchFinancialYears();
        if (isEditMode) {
            fetchIncome();
        }
    }, [id, isEditMode]);

    const fetchFinancialYears = async () => {
        try {
            const response = await financialYearAPI.getFinancialYears();
            setFinancialYears(response.data.data.financialYears);

            // Set active year as default for new income
            if (!isEditMode) {
                const activeYear = response.data.data.financialYears.find(fy => fy.status === 'active');
                if (activeYear) {
                    setFormData(prev => ({ ...prev, financialYear: activeYear.year }));
                }
            }
        } catch (err) {
            console.error('Error fetching financial years:', err);
            setError('Failed to fetch financial years');
        }
    };

    const fetchIncome = async () => {
        try {
            setFetching(true);
            const response = await incomeAPI.getIncomeById(id);
            const income = response.data.data.income;

            setFormData({
                financialYear: income.financialYear || '',
                source: income.source || '',
                category: income.category || 'recurring',
                amount: income.amount?.toString() || '',
                expectedDate: income.expectedDate ? income.expectedDate.split('T')[0] : '',
                receivedDate: income.receivedDate ? income.receivedDate.split('T')[0] : '',
                status: income.status || 'expected',
                referenceNumber: income.referenceNumber || '',
                description: income.description || '',
                remarks: income.remarks || ''
            });
        } catch (err) {
            setError('Failed to fetch income data');
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (formData.status === 'received' && !formData.receivedDate) {
            setError('Received date is required when status is "Received"');
            return;
        }

        try {
            setLoading(true);
            const submitData = {
                ...formData,
                amount: parseFloat(formData.amount)
            };

            if (isEditMode) {
                await incomeAPI.updateIncome(id, submitData);
            } else {
                await incomeAPI.createIncome(submitData);
            }
            navigate('/income');
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} income record`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="income-form-loading">
                <div className="loading-spinner"></div>
                <p>Loading income data...</p>
            </div>
        );
    }

    return (
        <div className="income-form-container">
            <PageHeader
                title={isEditMode ? "Edit Income Record" : "Add New Income"}
                subtitle={isEditMode ? "Update income/receipt details" : "Record expected or received institutional income"}
            >
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/income')}>
                    <ArrowLeft size={18} /> Back to Income
                </button>
            </PageHeader>

            <div className="income-form-card">
                <form onSubmit={handleSubmit} className="income-form">
                    {error && (
                        <div className="alert alert-error mb-4">
                            {error}
                        </div>
                    )}

                    <div className="form-sections-grid">
                        <div className="form-section">
                            <h3 className="section-title">Income Source</h3>

                            <div className="form-group">
                                <label htmlFor="financialYear">Financial Year *</label>
                                <select
                                    id="financialYear"
                                    name="financialYear"
                                    value={formData.financialYear}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Financial Year</option>
                                    {financialYears.map(fy => (
                                        <option key={fy._id} value={fy.year}>
                                            {fy.year} ({fy.status})
                                        </option>
                                    ))}
                                </select>
                                {isEditMode && <small>Financial year cannot be changed</small>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="source">Source *</label>
                                <select
                                    id="source"
                                    name="source"
                                    value={formData.source}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select Source</option>
                                    {sourceOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="category">Category *</label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="recurring">Recurring</option>
                                    <option value="non-recurring">Non-Recurring</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="status">Status *</label>
                                <select
                                    id="status"
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    required
                                >
                                    {statusOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <small>Verification can only be done by Principal</small>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="section-title">Amount & Dates</h3>

                            <div className="form-group">
                                <label htmlFor="amount">Amount *</label>
                                <div className="amount-input-wrapper">
                                    <input
                                        type="number"
                                        id="amount"
                                        name="amount"
                                        value={formData.amount}
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
                                <label htmlFor="expectedDate">Expected Date *</label>
                                <input
                                    type="date"
                                    id="expectedDate"
                                    name="expectedDate"
                                    value={formData.expectedDate}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="receivedDate">
                                    Received Date {formData.status !== 'expected' && '*'}
                                </label>
                                <input
                                    type="date"
                                    id="receivedDate"
                                    name="receivedDate"
                                    value={formData.receivedDate}
                                    onChange={handleInputChange}
                                    required={formData.status !== 'expected'}
                                />
                                <small>Required when status is Received or Verified</small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="referenceNumber">Reference Number</label>
                                <input
                                    type="text"
                                    id="referenceNumber"
                                    name="referenceNumber"
                                    value={formData.referenceNumber}
                                    onChange={handleInputChange}
                                    placeholder="Transaction/Sanction reference"
                                />
                            </div>
                        </div>

                        <div className="form-section full-width">
                            <h3 className="section-title">Description & Remarks</h3>

                            <div className="form-group">
                                <label htmlFor="description">Description *</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Describe the income source (e.g., 'UGC General Grant FY 2025-26')"
                                    rows="3"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="remarks">Remarks</label>
                                <textarea
                                    id="remarks"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleInputChange}
                                    placeholder="Additional notes or remarks..."
                                    rows="3"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/income')}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (
                                <>
                                    <Save size={18} className="mr-2" /> {isEditMode ? 'Update Income' : 'Create Income'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
