import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    expenditureAPI,
    budgetHeadsAPI,
    allocationAPI,
    settingsAPI,
    categoriesAPI,
    departmentsAPI
} from '../services/api';
import {
    Send,
    Plus,
    Trash2,
    Calendar,
    ChevronRight,
    ChevronLeft,
    Search,
    FileText,
    Eye,
    RotateCcw,
    X,
    IndianRupee,
    Sparkles,
    Paperclip,
    ClipboardList,
    AlertCircle
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import Tooltip from '../components/Tooltip/Tooltip';
import './ExpenditureStyles.scss';

// --- Expenditures Component ---
export const Expenditures = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [expenditures, setExpenditures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedExpenditure, setSelectedExpenditure] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        category: '',
        financialYear: ''
    });
    const [pagination, setPagination] = useState({
        current: 1,
        pages: 1,
        total: 0
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchExpenditures();
    }, [filters, pagination.current]);

    const fetchCategories = async () => {
        try {
            const response = await categoriesAPI.getCategories();
            if (response.data.success) {
                setCategories(response.data.data.categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchExpenditures = async () => {
        try {
            setLoading(true);
            const res = await expenditureAPI.getExpenditures({
                ...filters,
                page: pagination.current,
                limit: 10
            });
            setExpenditures(res.data.data.expenditures);
            setPagination(res.data.data.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResubmit = (id) => {
        navigate(`/resubmit-expenditure/${id}`);
    };

    const handleView = (exp) => {
        setSelectedExpenditure(exp);
        setShowModal(true);
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, current: newPage }));
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    const getStatusColor = (status) => {
        const colors = {
            pending: 'pending',
            approved: 'approved',
            rejected: 'rejected',
            verified: 'verified'
        };
        return colors[status] || '';
    };

    return (
        <div className="expenditures-container">
            <PageHeader
                title="My Expenditures"
                subtitle="Track and manage your department's expenditure requests"
            >
                {['department', 'coordinator', 'coordinater'].includes(user.role) && (
                    <button className="btn btn-primary" onClick={() => navigate('/submit-expenditure')}>
                        <Plus size={18} /> Create Event Budget
                    </button>
                )}
            </PageHeader>

            <div className="filters-section">
                <div className="filter-group search-group">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by Bill Number, Party..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))} // Reset to page 1 on filter change
                        className="filter-input has-icon"
                    />
                </div>
                <div className="filter-group">
                    <select
                        className="filter-select"
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div className="filter-group">
                    <select
                        className="filter-select"
                        value={filters.category}
                        onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
                    >
                        <option value="">All Categories</option>
                        <option value="EVENT_DECORATION">Decoration</option>
                        <option value="REFRESHMENTS">Catering</option>
                        <option value="PRINTING">Printing</option>
                        <option value="EQUIPMENT">Equipment</option>
                        <option value="MISCELLANEOUS">Miscellaneous</option>
                        {categories.map(cat => (
                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="loading-state">Loading expenditures...</div>
                ) : expenditures.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><FileText size={48} /></div>
                        <h3>No Events Found</h3>
                        <p>You haven&apos;t submitted any event budgets matching your criteria.</p>
                        {['department', 'hod', 'admin', 'office'].includes(user.role) && (
                            <button className="btn btn-primary" onClick={() => navigate('/submit-expenditure')}>
                                Create Event Budget
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <table className="expenditures-table">
                            <thead>
                                <tr>
                                    <th>Event Name</th>
                                    <th>Type</th>
                                    <th>Budget Head</th>
                                    <th>Date</th>
                                    <th>Total Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenditures.map((exp) => (
                                    <tr key={exp._id}>
                                        <td className="font-medium">{exp.eventName}</td>
                                        <td><span className="type-badge">{exp.eventType}</span></td>
                                        <td>{exp.budgetHead?.name || exp.budgetHeadName}</td>
                                        <td>{new Date(exp.eventDate).toLocaleDateString('en-IN')}</td>
                                        <td className="text-right font-medium">{formatCurrency(exp.totalAmount)}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusColor(exp.status)}`}>
                                                {exp.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Tooltip text="View Details" position="top">
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleView(exp)}>
                                                        <Eye size={16} />
                                                    </button>
                                                </Tooltip>

                                                {exp.status === 'rejected' && (
                                                    <Tooltip text="Resubmit" position="top">
                                                        <button className="btn btn-sm btn-primary" onClick={() => handleResubmit(exp._id)}>
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {pagination.pages > 1 && (
                            <div className="pagination">
                                <button
                                    disabled={pagination.current === 1}
                                    onClick={() => handlePageChange(pagination.current - 1)}
                                    className="btn btn-outline btn-sm"
                                >
                                    Previous
                                </button>
                                <div className="page-numbers">
                                    {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            className={`page-number ${pagination.current === page ? 'active' : ''}`}
                                            onClick={() => handlePageChange(page)}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    disabled={pagination.current === pagination.pages}
                                    onClick={() => handlePageChange(pagination.current + 1)}
                                    className="btn btn-outline btn-sm"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showModal && selectedExpenditure && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Expenditure Details</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item full-width">
                                    <label>Event Name</label>
                                    <div className="font-bold text-lg">{selectedExpenditure.eventName}</div>
                                </div>
                                <div className="detail-item">
                                    <label>Event Type</label>
                                    <div>{selectedExpenditure.eventType}</div>
                                </div>
                                <div className="detail-item">
                                    <label>Date</label>
                                    <div>{new Date(selectedExpenditure.eventDate).toLocaleDateString('en-IN')}</div>
                                </div>
                                <div className="detail-item">
                                    <label>Budget Head</label>
                                    <div>{selectedExpenditure.budgetHead?.name}</div>
                                </div>
                                <div className="detail-item">
                                    <label>Total Amount</label>
                                    <div className="text-lg font-bold">{formatCurrency(selectedExpenditure.totalAmount)}</div>
                                </div>
                                <div className="detail-item full-width">
                                    <label>Event Description</label>
                                    <div className="text-muted">{selectedExpenditure.description}</div>
                                </div>

                                <div className="detail-item full-width">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: '800', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                                        <ClipboardList size={18} className="text-primary" /> Expense Items ({selectedExpenditure.expenseItems?.length || 0})
                                    </label>
                                    <div className="expense-items-list" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                        {selectedExpenditure.expenseItems?.map((item, idx) => (
                                            <div key={idx} style={{ padding: '1.25rem', borderBottom: idx !== selectedExpenditure.expenseItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{item.vendorName}</strong>
                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                                            Bill: <span style={{ color: '#1e293b', fontWeight: '600' }}>{item.billNumber}</span> | Date: <span style={{ color: '#1e293b', fontWeight: '600' }}>{new Date(item.billDate).toLocaleDateString('en-IN')}</span>
                                                        </div>
                                                        {item.description && (
                                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic' }}>
                                                                &ldquo;{item.description}&rdquo;
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>{formatCurrency(item.amount)}</div>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '700' }}>{item.category?.replace('_', ' ')}</span>
                                                    </div>
                                                </div>

                                                {item.attachments && item.attachments.length > 0 && (
                                                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                        {item.attachments.map((file, fIdx) => (
                                                            <a 
                                                                key={fIdx} 
                                                                href={file.url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '6px', 
                                                                    fontSize: '0.75rem', 
                                                                    background: '#eff6ff', 
                                                                    color: '#2563eb', 
                                                                    padding: '6px 12px', 
                                                                    borderRadius: '8px', 
                                                                    textDecoration: 'none', 
                                                                    fontWeight: '600',
                                                                    border: '1px solid #dbeafe',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                            >
                                                                <Paperclip size={14} /> {file.originalName || `Bill ${fIdx + 1}`}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedExpenditure.status === 'rejected' && selectedExpenditure.approvalSteps && (
                                    <div className="detail-item full-width rejection-box">
                                        <label className="text-danger">Rejection Remarks</label>
                                        <div className="text-danger">
                                            {selectedExpenditure.approvalSteps.find(step => step.decision === 'reject')?.remarks || 'No remarks provided'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            {selectedExpenditure.status === 'rejected' && (
                                <button className="btn btn-primary" onClick={() => {
                                    setShowModal(false);
                                    handleResubmit(selectedExpenditure._id);
                                }}>
                                    Resubmit Now
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SubmitExpenditure Component ---
export const SubmitExpenditure = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        departmentId: user?.department?._id || user?.department || '',
        budgetHeadId: '',
        eventName: '',
        eventType: '',
        eventDate: '',
        description: '',
        expenseItems: [{
            category: 'MISCELLANEOUS',
            billNumber: '',
            billDate: new Date().toISOString().split('T')[0],
            vendorName: '',
            amount: '',
            description: '',
            attachments: []
        }]
    });

    const [departments, setDepartments] = useState([]);

    const [budgetHeads, setBudgetHeads] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [remainingBudget, setRemainingBudget] = useState(0);
    const [overspendPolicy, setOverspendPolicy] = useState('disallow');

    useEffect(() => {
        const allowedRoles = ['department', 'coordinator', 'coordinater'];
        if (!user && !localStorage.getItem('user')) {
            // Wait for user to load if not in local storage
            return;
        }
        if (user && !allowedRoles.includes(user.role)) {
            navigate('/dashboard');
            return;
        }

        fetchBudgetHeads();
        fetchCategories();
        if (['admin', 'office', 'principal', 'vice_principal'].includes(user?.role)) {
            fetchDepartments();
        }
        fetchSettings();
    }, [user, navigate]);

    useEffect(() => {
        if (user?.department && !formData.departmentId) {
            const deptId = typeof user.department === 'object' ? user.department._id : user.department;
            setFormData(prev => ({ ...prev, departmentId: deptId }));
        }
    }, [user, formData.departmentId]);

    useEffect(() => {
        if (formData.departmentId) {
            fetchAllocations();
        } else {
            setAllocations([]);
        }
    }, [formData.departmentId]);

    const fetchDepartments = async () => {
        try {
            const response = await departmentsAPI.getDepartments();
            setDepartments(response.data.data.departments);
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await categoriesAPI.getCategories();
            if (response.data.success) {
                setCategories(response.data.data.categories.filter(c => c.isActive));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await settingsAPI.getPublicSettings();
            if (response.data.success) {
                setOverspendPolicy(response.data.data.budget_overspend_policy || 'disallow');
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchBudgetHeads = async () => {
        try {
            const response = await budgetHeadsAPI.getBudgetHeads({ isActive: true });
            setBudgetHeads(response.data.data.budgetHeads);
        } catch (error) {
            console.error('Error fetching budget heads:', error);
        }
    };

    const fetchAllocations = async () => {
        try {
            const dateStr = formData.eventDate || new Date().toISOString().split('T')[0];
            const dateObj = new Date(dateStr);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const fy = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

            const response = await allocationAPI.getAllocations({
                financialYear: fy,
                department: formData.departmentId,
                limit: 1000
            });
            setAllocations(response.data.data.allocations || []);
        } catch (error) {
            console.error('Error fetching allocations:', error);
        }
    };

    const getCurrentFinancialYear = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    };

    useEffect(() => {
        fetchAllocations();
    }, [formData.eventDate, formData.departmentId]);

    useEffect(() => {
        // Since budget info is now per-item, we should ideally check balances per item.
        // For the "remainingBudget" summary, we'll keep a map or just check the total against some head if needed.
        // However, the component relies on 'remainingBudget' for a global check.
        // We'll calculate a total remaining budget across used heads or just handle it per item in validation.
    }, [formData.expenseItems, allocations]);

    const handleEventChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleItemChange = (index, e) => {
        const { name, value } = e.target;
        const updatedItems = [...formData.expenseItems];
        updatedItems[index][name] = value;
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const handleFileChange = (index, e) => {
        const files = Array.from(e.target.files);
        const updatedItems = [...formData.expenseItems];
        updatedItems[index].attachments = [...updatedItems[index].attachments, ...files];
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const removeItemFile = (itemIndex, fileIndex) => {
        const updatedItems = [...formData.expenseItems];
        updatedItems[itemIndex].attachments = updatedItems[itemIndex].attachments.filter((_, i) => i !== fileIndex);
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
                budgetHeadId: '',
                category: 'MISCELLANEOUS',
                billNumber: '',
                billDate: new Date().toISOString().split('T')[0],
                vendorName: '',
                amount: '',
                description: '',
                attachments: []
            }]
        }));
    };

    const removeItem = (index) => {
        if (formData.expenseItems.length > 1) {
            const updatedItems = formData.expenseItems.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
        }
    };

    const calculateTotal = () => {
        if (!formData.expenseItems) return 0;
        return formData.expenseItems.reduce((acc, item) => acc + (parseFloat(item?.amount) || 0), 0);
    };

    const validateStep1 = () => {
        const newErrors = {};

        // Resolve departmentId: check formData first, then user object
        let effectiveDeptId = formData.departmentId;
        if (!effectiveDeptId && user?.department) {
            effectiveDeptId = typeof user.department === 'object' ? user.department._id : user.department;
            // Sync it back to formData for consistency in Step 2/3
            setFormData(prev => ({ ...prev, departmentId: effectiveDeptId }));
        }

        const isManagement = ['admin', 'office', 'principal', 'vice_principal'].includes(user?.role);

        if (isManagement && !effectiveDeptId) {
            newErrors.departmentId = 'Department selection is required.';
        } else if (!effectiveDeptId) {
            newErrors.departmentId = 'Configuration Error: No department found for your account.';
        }

        if (!formData.eventName.trim()) newErrors.eventName = 'Event name is required.';
        if (!formData.eventDate) newErrors.eventDate = 'Event date is required.';
        if (!formData.budgetHeadId) newErrors.budgetHeadId = 'Budget Head is required.';

        if (Object.keys(newErrors).length > 0) {
            console.warn('[Step 1 Validation Failed]', newErrors);
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};
        formData.expenseItems.forEach((item, idx) => {
            if (!item.vendorName?.trim()) newErrors[`item_${idx}_vendor`] = 'Vendor name required';
            if (!item.amount || parseFloat(item.amount) <= 0) newErrors[`item_${idx}_amount`] = 'Invalid amount';
            if (!item.category) newErrors[`item_${idx}_category`] = 'Category required';
            if (!item.billNumber?.trim()) newErrors[`item_${idx}_bill`] = 'Bill number required';
            if (!item.billDate) newErrors[`item_${idx}_date`] = 'Bill date required';

            // Event-level budget check
            if (formData.budgetHeadId && item.amount) {
                const headId = formData.budgetHeadId.toString();
                const allocation = allocations.find(a => (a.budgetHead?._id || a.budgetHeadId || a.budgetHead)?.toString() === headId);
                const avail = allocation ? (allocation.remainingAmount ?? (allocation.allocatedAmount - allocation.spentAmount)) : 0;
                
                // Calculate total spent on this head across ALL items so far
                const totalForThisHead = formData.expenseItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

                if (totalForThisHead > avail && overspendPolicy === 'disallow') {
                    newErrors[`item_${idx}_amount`] = `Total exceeds available budget (₹${avail.toLocaleString()})`;
                }
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        console.log('[NextStep] Current Step:', step);
        if (step === 1 && validateStep1()) {
            setStep(2);
            window.scrollTo(0, 0);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
            window.scrollTo(0, 0);
        }
    };

    const prevStep = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setStep(prev => Math.max(1, prev - 1));
        window.scrollTo(0, 0);
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const submissionData = new FormData();
            submissionData.append('department', formData.departmentId);
            submissionData.append('budgetHead', formData.budgetHeadId);
            submissionData.append('eventName', formData.eventName);
            submissionData.append('eventType', formData.expenseItems[0]?.category || 'MISCELLANEOUS');
            submissionData.append('eventDate', formData.eventDate);
            submissionData.append('description', formData.description);

            // We need to send items and files. 
            // Multiple files with standard multer can be tricky with indexed fields.
            // Simplified approach: Send items as JSON and files as a flat array.
            // But usually, we want to link files to items. 
            // Here we'll send a structured JSON for items metadata and then the files.

            const expenseItems = formData.expenseItems.map((item, idx) => ({
                budgetHead: formData.budgetHeadId,
                category: item.category || 'MISCELLANEOUS',
                billNumber: item.billNumber,
                billDate: item.billDate || new Date().toISOString().split('T')[0],
                vendorName: item.vendorName,
                amount: item.amount,
                description: item.description,
                fileCount: item.attachments.length
            }));

            submissionData.append('expenseItems', JSON.stringify(expenseItems));

            formData.expenseItems.forEach(item => {
                item.attachments.forEach(file => {
                    submissionData.append('attachments', file);
                });
            });

            const response = await expenditureAPI.submitExpenditure(submissionData);
            if (response.data.success) {
                navigate('/expenditures', { state: { message: 'Event Budget created successfully!' } });
            }
        } catch (error) {
            setErrors({ submit: error.response?.data?.message || 'Submission failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="submit-expenditure-container">
            <PageHeader
                title="Create Event Budget"
                subtitle="Submit an event-based expenditure request for approval"
            />

            <div className="expenditure-form-container card-standard">
                <div className="stepper">
                    <div className={`step-item ${step >= 1 ? 'active' : ''}`}>1. Event Info</div>
                    <div className={`step-item ${step >= 2 ? 'active' : ''}`}>2. Expense Items</div>
                    <div className={`step-item ${step >= 3 ? 'active' : ''}`}>3. Final Preview</div>
                </div>

                {!user ? (
                    <div className="loading py-5 text-center">Loading your profile...</div>
                ) : (
                    <>
                        {errors.submit && <div className="alert alert-danger mb-4">{errors.submit}</div>}
                        {/* Step content here - no changes to inner logic */}
                        {step === 1 && (
                            /* ... Step 1 content ... */
                            <div className="form-step">
                                {errors.departmentId && !['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
                                    <div className="alert alert-danger mb-4">
                                        <AlertCircle size={18} /> {errors.departmentId}
                                    </div>
                                )}
                                {['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
                                    <div className="form-group mb-4">
                                        <label>Department *</label>
                                        <select
                                            name="departmentId"
                                            value={formData.departmentId}
                                            onChange={handleEventChange}
                                            className={errors.departmentId ? 'error' : ''}
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(dept => (
                                                <option key={dept._id} value={dept._id}>{dept.name}</option>
                                            ))}
                                        </select>
                                        {errors.departmentId && <span className="form-error">{errors.departmentId}</span>}
                                    </div>
                                )}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Event Name *</label>
                                        <input type="text" name="eventName" value={formData.eventName} onChange={handleEventChange} placeholder="e.g. Annual Tech Symposium" className={errors.eventName ? 'error' : ''} />
                                        {errors.eventName && <span className="form-error">{errors.eventName}</span>}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Event Date *</label>
                                        <input type="date" name="eventDate" value={formData.eventDate} onChange={handleEventChange} className={errors.eventDate ? 'error' : ''} />
                                        {errors.eventDate && <span className="form-error">{errors.eventDate}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Budget Head *</label>
                                        <select 
                                            name="budgetHeadId" 
                                            value={formData.budgetHeadId} 
                                            onChange={handleEventChange} 
                                            className={errors.budgetHeadId ? 'error' : ''}
                                        >
                                            <option value="">Select Budget Head</option>
                                            {budgetHeads.map(head => (
                                                <option key={head._id} value={head._id}>{head.name}</option>
                                            ))}
                                        </select>
                                        {formData.budgetHeadId && (
                                            <div className="form-help text-info" style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: '600' }}>
                                                {(() => {
                                                    const alloc = allocations.find(a => (a.budgetHead?._id || a.budgetHeadId || a.budgetHead)?.toString() === formData.budgetHeadId.toString());
                                                    const balance = alloc ? (alloc.remainingAmount ?? (alloc.allocatedAmount - alloc.spentAmount)) : 0;
                                                    return `Available Balance: ${formatCurrency(balance)}`;
                                                })()}
                                            </div>
                                        )}
                                        {errors.budgetHeadId && <span className="form-error">{errors.budgetHeadId}</span>}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>General Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleEventChange} rows="3" placeholder="Brief about the event..."></textarea>
                                </div>
                                <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-primary" onClick={nextStep}>
                                        Next: Add Items <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="form-step">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3>Expense Items</h3>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={addItem}><Plus size={16} /> Add Item</button>
                                </div>

                                {errors.budget && <div className="alert alert-danger mb-3">{errors.budget}</div>}

                                <div className="items-scroll-area" style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '1rem' }}>
                                    {(!formData.expenseItems || formData.expenseItems.length === 0) && (
                                        <div className="text-center py-5 text-muted">
                                            No items added yet. Click "Add Item" to start.
                                        </div>
                                    )}
                                    {formData.expenseItems && formData.expenseItems.map((item, idx) => (
                                        <div key={idx} className="expense-item-card mb-4" style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px', background: '#fdfdfd', position: 'relative' }}>
                                            {formData.expenseItems.length > 1 && (
                                                <button type="button" className="remove-item-btn" onClick={() => removeItem(idx)} style={{ position: 'absolute', top: '10px', right: '10px', color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                            <h5 className="mb-3">Item #{idx + 1}</h5>
                                             <div className="form-row">
                                                <div className="form-group">
                                                    <label>Event Category *</label>
                                                    <select 
                                                        name="category" 
                                                        value={item.category} 
                                                        onChange={(e) => handleItemChange(idx, e)}
                                                        className={errors[`item_${idx}_category`] ? 'error' : ''}
                                                    >
                                                        <option value="">Select Category</option>
                                                        {categories.map(cat => (
                                                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                                                        ))}
                                                        <option value="MISCELLANEOUS">Miscellaneous</option>
                                                    </select>
                                                    {errors[`item_${idx}_category`] && <span className="form-error">{errors[`item_${idx}_category`]}</span>}
                                                </div>
                                                <div className="form-group">
                                                    <label>Vendor Name *</label>
                                                    <input type="text" name="vendorName" value={item.vendorName} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_vendor`] ? 'error' : ''} />
                                                    {errors[`item_${idx}_vendor`] && <span className="form-error">{errors[`item_${idx}_vendor`]}</span>}
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label>Amount (₹) *</label>
                                                    <input type="number" name="amount" value={item.amount} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_amount`] ? 'error' : ''} />
                                                    {errors[`item_${idx}_amount`] && <span className="form-error">{errors[`item_${idx}_amount`]}</span>}
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label>Bill Number *</label>
                                                    <input type="text" name="billNumber" value={item.billNumber} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_bill`] ? 'error' : ''} />
                                                    {errors[`item_${idx}_bill`] && <span className="form-error">{errors[`item_${idx}_bill`]}</span>}
                                                </div>
                                                <div className="form-group">
                                                    <label>Bill Date *</label>
                                                    <input type="date" name="billDate" value={item.billDate} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_date`] ? 'error' : ''} />
                                                    {errors[`item_${idx}_date`] && <span className="form-error">{errors[`item_${idx}_date`]}</span>}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Description</label>
                                                <input type="text" name="description" value={item.description} onChange={(e) => handleItemChange(idx, e)} placeholder="What was this for?" />
                                            </div>
                                            <div className="form-group">
                                                <label>Attach Bills</label>
                                                <input type="file" multiple onChange={(e) => handleFileChange(idx, e)} accept="image/*,.pdf" />
                                                <p className="form-help mt-1" style={{ fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertCircle size={12} /> Supporting documents must be clear and legible. PDF or Images only.
                                                </p>
                                                <div className="mt-2" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    {item.attachments.map((file, fIdx) => (
                                                        <span key={fIdx} style={{ background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {file.name} <X size={12} onClick={() => removeItemFile(idx, fIdx)} style={{ cursor: 'pointer' }} />
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="form-summary mt-4" style={{ borderTop: '2px solid #eee', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="total-preview">
                                        <strong>Total Event Budget: </strong>
                                        <span className="text-xl font-bold text-primary">
                                            {formatCurrency(calculateTotal())}
                                        </span>
                                    </div>
                                    <div className="form-actions">
                                        <button className="btn btn-secondary" onClick={prevStep}><ChevronLeft size={16} /> Back</button>
                                        <button className="btn btn-primary" onClick={nextStep}>Preview & Submit <ChevronRight size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="form-step">
                                <h3>Summary Review</h3>
                                <div className="summary-card" style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginTop: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div><strong>Event:</strong> {formData.eventName}</div>
                                        <div><strong>Budget Head:</strong> {budgetHeads.find(h => h._id === formData.budgetHeadId)?.name || 'N/A'}</div>
                                        <div><strong>Date:</strong> {formData.eventDate}</div>
                                    </div>
                                    <hr className="my-3" />
                                    <div><strong>Expense Items:</strong> {formData.expenseItems.length} items</div>
                                    <div className="mt-3">
                                        {formData.expenseItems.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px dashed #eee', pb: '4px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{item.vendorName}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                                                        {item.category} | {item.billNumber}
                                                    </span>
                                                </div>
                                                <span style={{ fontWeight: 'bold' }}>{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <hr className="my-3" />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="text-lg font-bold">Total Request:</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>
                                                {formData.expenseItems.length} items | {formData.expenseItems.reduce((acc, i) => acc + (i.attachments?.length || 0), 0)} documents
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="alert alert-info mt-4" style={{ fontSize: '0.85rem' }}>
                                    <AlertCircle size={16} /> Budget will be deducted **only after Office Sanction**. This request will now move to HOD for verification.
                                </div>

                                <div className="form-actions mt-4" style={{ justifyContent: 'space-between' }}>
                                    <button className="btn btn-secondary" onClick={prevStep}><ChevronLeft size={16} /> Edit Details</button>
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                                        {isSubmitting ? 'Submitting...' : 'Confirm & Submit Event'} <Send size={16} className="ml-2" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
// --- ResubmitExpenditure Component ---
export const ResubmitExpenditure = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        eventName: '',
        eventType: '',
        eventDate: '',
        budgetHeadId: '',
        description: '',
        expenseItems: []
    });
    const [allocations, setAllocations] = useState([]);

    const [budgetHeads, setBudgetHeads] = useState([]);
    const [categories, setCategories] = useState([]);
    const [remainingBudget, setRemainingBudget] = useState(0);
    const [overspendPolicy, setOverspendPolicy] = useState('disallow');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [expRes, headsRes, settingsRes, catsRes] = await Promise.all([
                    expenditureAPI.getExpenditureById(id),
                    budgetHeadsAPI.getBudgetHeads({ isActive: true }),
                    settingsAPI.getPublicSettings(),
                    categoriesAPI.getCategories()
                ]);

                const exp = expRes.data.data.expenditure;
                setCategories(catsRes.data.data.categories.filter(c => c.isActive));
                setFormData({
                    eventName: exp.eventName,
                    eventType: exp.eventType,
                    eventDate: exp.eventDate ? new Date(exp.eventDate).toISOString().split('T')[0] : '',
                    budgetHeadId: exp.budgetHead?._id || exp.budgetHead || (exp.expenseItems?.[0]?.budgetHead?._id || exp.expenseItems?.[0]?.budgetHead) || '',
                    description: exp.description || '',
                    expenseItems: exp.expenseItems?.map(item => ({
                        ...item,
                        billDate: item.billDate ? new Date(item.billDate).toISOString().split('T')[0] : '',
                        attachments: []
                    })) || []
                });

                setBudgetHeads(headsRes.data.data.budgetHeads);
                setOverspendPolicy(settingsRes.data.data.budget_overspend_policy || 'disallow');

                // Fetch all allocations for department
                const deptId = user.department?._id || user.department;
                if (deptId) {
                    const year = getCurrentFinancialYear();
                    const allocRes = await allocationAPI.getAllocations({
                        financialYear: year,
                        department: deptId,
                        limit: 1000
                    });
                    setAllocations(allocRes.data.data.allocations || []);
                }

            } catch (err) {
                console.error(err);
                setError('Failed to load expenditure data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, user]);

    const getCurrentFinancialYear = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    };

    const handleEventChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index, e) => {
        const { name, value } = e.target;
        const updatedItems = [...formData.expenseItems];
        updatedItems[index][name] = value;
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            expenseItems: [...prev.expenseItems, {
                category: 'MISCELLANEOUS',
                vendorName: '',
                amount: '',
                billNumber: '',
                billDate: new Date().toISOString().split('T')[0],
                description: '',
                attachments: []
            }]
        }));
    };

    const handleFileChange = (index, e) => {
        const files = Array.from(e.target.files);
        const updatedItems = [...formData.expenseItems];
        updatedItems[index].attachments = [...(updatedItems[index].attachments || []), ...files];
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const removeItemFile = (itemIndex, fileIndex) => {
        const updatedItems = [...formData.expenseItems];
        updatedItems[itemIndex].attachments = updatedItems[itemIndex].attachments?.filter((_, i) => i !== fileIndex);
        setFormData(prev => ({ ...prev, expenseItems: updatedItems }));
    };

    const removeItem = (index) => {
        if (formData.expenseItems.length > 1) {
            setFormData(prev => ({
                ...prev,
                expenseItems: prev.expenseItems.filter((_, i) => i !== index)
            }));
        }
    };

    const calculateTotal = () => formData.expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const validateStep1 = () => {
        const errs = {};
        if (!formData.eventName) errs.eventName = 'Required';
        if (!formData.eventDate) errs.eventDate = 'Required';
        if (!formData.budgetHeadId) errs.budgetHeadId = 'Required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const validateStep2 = () => {
        const errs = {};
        formData.expenseItems.forEach((item, idx) => {
            if (!item.vendorName) errs[`item_${idx}_vendor`] = 'Required';
            if (!item.amount || item.amount <= 0) errs[`item_${idx}_amount`] = 'Required';
            if (!item.category) errs[`item_${idx}_category`] = 'Required';
            if (!item.billNumber) errs[`item_${idx}_bill`] = 'Required';
            if (!item.billDate) errs[`item_${idx}_date`] = 'Required';
 
            // Per-item budget check (total comparison)
            if (formData.budgetHeadId && item.amount) {
                const headId = formData.budgetHeadId.toString();
                const allocation = allocations.find(a => (a.budgetHead?._id || a.budgetHeadId || a.budgetHead)?.toString() === headId);
                const avail = allocation ? (allocation.remainingAmount ?? (allocation.allocatedAmount - allocation.spentAmount)) : 0;
                
                const totalReq = formData.expenseItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

                if (totalReq > avail && overspendPolicy === 'disallow') {
                    errs[`item_${idx}_amount`] = `Exceeds budget (₹${avail.toLocaleString()})`;
                }
            }
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const submissionData = new FormData();
            submissionData.append('eventName', formData.eventName);
            submissionData.append('eventType', formData.expenseItems[0]?.category || 'MISCELLANEOUS');
            submissionData.append('eventDate', formData.eventDate);
            submissionData.append('budgetHead', formData.budgetHeadId);
            submissionData.append('description', formData.description);

            const expenseItems = formData.expenseItems.map(item => ({
                budgetHead: formData.budgetHeadId,
                category: item.category || 'MISCELLANEOUS',
                vendorName: item.vendorName,
                amount: item.amount,
                billNumber: item.billNumber,
                billDate: item.billDate || new Date().toISOString().split('T')[0],
                description: item.description,
                fileCount: item.attachments?.length || 0
            }));
            submissionData.append('expenseItems', JSON.stringify(expenseItems));

            formData.expenseItems.forEach(item => {
                item.attachments?.forEach(file => {
                    submissionData.append('attachments', file);
                });
            });

            await expenditureAPI.resubmitExpenditure(id, submissionData);
            navigate('/expenditures', { state: { message: 'Resubmitted successfully' } });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resubmit');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="submit-expenditure-container">
            <PageHeader title="Resubmit Event Budget" subtitle="Correct and resubmit your event budget request" />

            <div className="stepper">
                <div className={`step-item ${step >= 1 ? 'active' : ''}`}>1. Info</div>
                <div className={`step-item ${step >= 2 ? 'active' : ''}`}>2. Items</div>
                <div className={`step-item ${step >= 3 ? 'active' : ''}`}>3. Submit</div>
            </div>

            <div className="expenditure-form-container card-standard">
                {error && <div className="alert alert-danger mb-4">{error}</div>}

                {step === 1 && (
                    <div className="form-step">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Event Name *</label>
                                <input type="text" name="eventName" value={formData.eventName} onChange={handleEventChange} className={errors.eventName ? 'error' : ''} />
                                {errors.eventName && <span className="text-danger text-xs">{errors.eventName}</span>}
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Budget Head *</label>
                                <select 
                                    name="budgetHeadId" 
                                    value={formData.budgetHeadId} 
                                    onChange={handleEventChange} 
                                    className={errors.budgetHeadId ? 'error' : ''}
                                >
                                    <option value="">Select Budget Head</option>
                                    {budgetHeads.map(head => (
                                        <option key={head._id} value={head._id}>{head.name}</option>
                                    ))}
                                </select>
                                {formData.budgetHeadId && (
                                    <div className="text-info font-semibold" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                        {(() => {
                                            const alloc = allocations.find(a => (a.budgetHead?._id || a.budgetHeadId || a.budgetHead)?.toString() === formData.budgetHeadId?.toString());
                                            const balance = alloc ? (alloc.allocatedAmount - alloc.spentAmount) : 0;
                                            return `Available Balance: ${formatCurrency(balance)}`;
                                        })()}
                                    </div>
                                )}
                                {errors.budgetHeadId && <span className="text-danger text-xs">{errors.budgetHeadId}</span>}
                            </div>
                            <div className="form-group">
                                <label>Event Date *</label>
                                <input type="date" name="eventDate" value={formData.eventDate} onChange={handleEventChange} className={errors.eventDate ? 'error' : ''} />
                                {errors.eventDate && <span className="text-danger text-xs">{errors.eventDate}</span>}
                            </div>
                        </div>
                        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={() => validateStep1() && setStep(2)}>Next <ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="form-step">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3>Items</h3>
                            <button className="btn btn-outline btn-sm" onClick={addItem}><Plus size={16} /> Add</button>
                        </div>
                        {errors.budget && <div className="alert alert-danger mb-2">{errors.budget}</div>}
                        <div className="items-scroll" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {formData.expenseItems.map((item, idx) => (
                                <div key={idx} className="mb-4 p-3 border rounded">
                                     <div className="form-row">
                                        <div className="form-group">
                                            <label>Event Category *</label>
                                            <select 
                                                name="category" 
                                                value={item.category} 
                                                onChange={(e) => handleItemChange(idx, e)}
                                                className={errors[`item_${idx}_category`] ? 'error' : ''}
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                                                ))}
                                                <option value="MISCELLANEOUS">Miscellaneous</option>
                                            </select>
                                            {errors[`item_${idx}_category`] && <span className="text-danger text-xs">{errors[`item_${idx}_category`]}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label>Vendor *</label>
                                            <input type="text" name="vendorName" value={item.vendorName} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_vendor`] ? 'error' : ''} />
                                            {errors[`item_${idx}_vendor`] && <span className="text-danger text-xs">{errors[`item_${idx}_vendor`]}</span>}
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Amount *</label>
                                            <input type="number" name="amount" value={item.amount} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_amount`] ? 'error' : ''} />
                                            {errors[`item_${idx}_amount`] && <span className="text-danger text-xs">{errors[`item_${idx}_amount`]}</span>}
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Bill Number *</label>
                                            <input type="text" name="billNumber" value={item.billNumber} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_bill`] ? 'error' : ''} />
                                            {errors[`item_${idx}_bill`] && <span className="text-danger text-xs">{errors[`item_${idx}_bill`]}</span>}
                                        </div>
                                        <div className="form-group">
                                            <label>Bill Date *</label>
                                            <input type="date" name="billDate" value={item.billDate} onChange={(e) => handleItemChange(idx, e)} className={errors[`item_${idx}_date`] ? 'error' : ''} />
                                            {errors[`item_${idx}_date`] && <span className="text-danger text-xs">{errors[`item_${idx}_date`]}</span>}
                                        </div>
                                    </div>
                                    <div className="form-group mt-3">
                                        <label>Attachments (Add New Bills)</label>
                                        <input type="file" multiple onChange={(e) => handleFileChange(idx, e)} accept="image/*,.pdf" className="form-control-file" />
                                        <div className="mt-2" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {item.attachments?.map((file, fIdx) => (
                                                <span key={fIdx} style={{ background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {file.name} <X size={12} onClick={() => removeItemFile(idx, fIdx)} style={{ cursor: 'pointer' }} />
                                                </span>
                                            ))}
                                            {item.fileCount > 0 && item.attachments?.length === 0 && (
                                                <span style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                                                    {item.fileCount} existing files attached
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button className="btn btn-link text-danger p-0 mt-2" onClick={() => removeItem(idx)}>Remove Item</button>
                                </div>
                            ))}
                        </div>
                        <div className="form-actions mt-4">
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                            <button className="btn btn-primary" onClick={() => validateStep2() && setStep(3)}>Review</button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="form-step">
                        <h3>Confirm Resubmission</h3>
                        <div className="p-4 bg-light rounded mt-3">
                            <div><strong>Event:</strong> {formData.eventName}</div>
                            <div><strong>Budget Head:</strong> {budgetHeads.find(h => h._id === formData.budgetHeadId)?.name || 'N/A'}</div>
                            <div><strong>Total Amount:</strong> {formatCurrency(calculateTotal())}</div>
                            <div className="mt-2 text-sm text-gray-600">
                                <strong>Documents:</strong> {formData.expenseItems.reduce((acc, item) => acc + (item.attachments?.length || 0), 0)} new files selected
                                {formData.expenseItems.some(i => i.fileCount > 0) && " + original files"}
                            </div>
                        </div>
                        <div className="form-actions mt-4">
                            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Confirm Resubmit'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
