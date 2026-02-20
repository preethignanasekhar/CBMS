import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { categoriesAPI } from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import { Plus, Pencil, Trash2, Layers, CheckCircle, XCircle, Tag, AlertCircle, Save, X, ArrowLeft, Palette, AlignLeft, Hash } from 'lucide-react';
import './Categories.scss';

const CategoryForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        color: '#1a237e',
        description: '',
        isActive: true
    });

    const [loading, setLoading] = useState(isEditMode);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const presetColors = [
        '#1a237e', '#28a745', '#007bff', '#17a2b8',
        '#ffc107', '#6f42c1', '#fd7e14', '#6c757d',
        '#c62828', '#2e7d32', '#0277bd', '#f57c00'
    ];

    useEffect(() => {
        if (isEditMode) {
            fetchCategory();
        }
    }, [id]);

    const fetchCategory = async () => {
        try {
            setLoading(true);
            const response = await categoriesAPI.getCategoryById(id);
            if (response.data.success) {
                const category = response.data.data.category;
                setFormData({
                    name: category.name,
                    code: category.code,
                    color: category.color || '#1a237e',
                    description: category.description || '',
                    isActive: category.isActive
                });
            }
        } catch (err) {
            setError('Failed to fetch category details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'name' && !isEditMode) {
            // Auto-generate code from name
            const autoCode = value.trim().substring(0, 5).toUpperCase().replace(/\s+/g, '');
            setFormData(prev => ({
                ...prev,
                name: value,
                code: autoCode
            }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleColorSelect = (color) => {
        setFormData(prev => ({ ...prev, color }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            if (isEditMode) {
                await categoriesAPI.updateCategory(id, formData);
            } else {
                await categoriesAPI.createCategory(formData);
            }
            navigate('/categories');
        } catch (err) {
            setError('Failed to save category');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="form-page-container">
                <div className="loading">Loading category data...</div>
            </div>
        );
    }

    return (
        <div className="form-page-container">
            <PageHeader
                title={isEditMode ? "Edit Category" : "Add New Category"}
                subtitle={isEditMode ? `Updating ${formData.name}` : "Create a new organization category for budget heads"}
            >
                <button className="btn btn-secondary" onClick={() => navigate('/categories')}>
                    <ArrowLeft size={18} /> Back to Categories
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
                            <Layers size={18} />
                            Category Identity
                        </h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Category Name *</label>
                                <div className="input-with-icon">
                                    <span className="input-icon-wrapper"><Tag size={16} /></span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="form-input has-icon"
                                        placeholder="e.g., Research & Development"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Category Code *</label>
                                <div className="input-with-icon">
                                    <span className="input-icon-wrapper"><Hash size={16} /></span>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        required
                                        className="form-input has-icon"
                                        placeholder="e.g., R-D"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
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
                                        placeholder="Explain what this category covers..."
                                        rows="3"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            <Palette size={18} />
                            Visual Styling
                        </h3>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label className="form-label">Accent Color</label>
                                <div className="color-picker-container">
                                    <div
                                        className="color-preview-large"
                                        style={{ backgroundColor: formData.color }}
                                    >
                                        <div className="preview-label">Sample Badge</div>
                                    </div>
                                    <div className="preset-colors-grid">
                                        {presetColors.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`color-preset-btn ${formData.color === color ? 'selected' : ''}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => handleColorSelect(color)}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                    <input
                                        type="color"
                                        name="color"
                                        value={formData.color}
                                        onChange={handleChange}
                                        className="custom-color-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">
                            Management
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
                                        {formData.isActive ? 'Active - Available for budget heads' : 'Inactive - Hidden from forms'}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/categories')}
                            disabled={saving}
                        >
                            <X size={18} /> Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                        >
                            <Save size={18} /> {saving ? 'Saving...' : (isEditMode ? 'Update Category' : 'Create Category')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CategoriesList = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await categoriesAPI.getCategories();
            if (response.data.success) {
                const cats = response.data.data.categories;
                setCategories(cats);

                // Calculate stats
                setStats({
                    total: cats.length,
                    active: cats.filter(c => c.isActive).length,
                    inactive: cats.filter(c => !c.isActive).length
                });
            }
        } catch (err) {
            setError('Failed to fetch categories');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this category? Any budget heads using this category will need to be updated.')) {
            try {
                await categoriesAPI.deleteCategory(id);
                fetchCategories();
            } catch (err) {
                setError('Failed to delete category');
                console.error(err);
            }
        }
    };

    if (loading) {
        return (
            <div className="categories-container">
                <div className="loading-state">Loading categories...</div>
            </div>
        );
    }

    return (
        <div className="categories-container">
            <PageHeader
                title="Category Management"
                subtitle="Manage and organize budget head categories"
            >
                <Link to="/categories/add" className="btn btn-primary">
                    <Plus size={18} /> Add Category
                </Link>
            </PageHeader>

            <div className="stats-grid">
                <StatCard
                    title="Total Categories"
                    value={stats.total}
                    icon={<Layers size={24} />}
                    color="#1a237e"
                />
                <StatCard
                    title="Active"
                    value={stats.active}
                    icon={<CheckCircle size={24} />}
                    color="#2e7d32"
                />
                <StatCard
                    title="Inactive"
                    value={stats.inactive}
                    icon={<XCircle size={24} />}
                    color="#c62828"
                />
            </div>

            <div className="categories-card">
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Category Name</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category) => (
                                <tr key={category.id}>
                                    <td>
                                        <div className="category-name-cell">
                                            <div
                                                className="color-preview"
                                                style={{ backgroundColor: category.color }}
                                            ></div>
                                            <span>{category.name}</span>
                                        </div>
                                    </td>
                                    <td><span className="code-badge">{category.code}</span></td>
                                    <td><span className="description-text">{category.description || 'N/A'}</span></td>
                                    <td>
                                        <span className={`status-badge ${category.isActive ? 'status-active' : 'status-inactive'}`}>
                                            {category.isActive ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div className="action-buttons">
                                            <Tooltip text="Edit Category">
                                                <Link
                                                    to={`/categories/edit/${category.id}`}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    <Pencil size={16} />
                                                </Link>
                                            </Tooltip>
                                            <Tooltip text="Delete Category">
                                                <button
                                                    onClick={() => handleDelete(category.id)}
                                                    className="btn btn-sm btn-danger"
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
        </div>
    );
};

const Categories = () => {
    const location = useLocation();
    const isFormMode = location.pathname.includes('/add') || location.pathname.includes('/edit');

    if (isFormMode) {
        return <CategoryForm />;
    }
    return <CategoriesList />;
};

export default Categories;

