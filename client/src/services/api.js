import axios from 'axios';

const getBaseUrl = () => {
  if (!import.meta.env.PROD) return '/api';

  let url = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || 'https://localhost:5000/api';
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
};

const baseURL = getBaseUrl();

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data instanceof FormData) {
      console.log('  FormData keys:', Array.from(config.data.keys()));
    }
    const token = localStorage.getItem('token');
    console.log('[Auth Token]', token ? 'Found' : 'Not found in localStorage');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[Authorization Header Set] Bearer token added');
    } else {
      console.warn('[Warning] No token found in localStorage. User may not be authenticated.');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  register: (userData) => api.post('/auth/register', userData),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
  uploadProfilePicture: (formData) => api.put('/auth/profile/picture', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
};

// Users API
export const usersAPI = {
  getUsers: (params) => api.get('/users', { params }),
  createUser: (data) => api.post('/users', data),
  getUserById: (id) => api.get(`/users/${id}`),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getUsersByRole: (role, params) => api.get(`/users/role/${role}`, { params }),
  getUsersByDepartment: (departmentId, params) => api.get(`/users/department/${departmentId}`, { params }),
  getUserStats: () => api.get('/users/stats'),
};

// Departments API
export const departmentsAPI = {
  getDepartments: (params) => api.get('/departments', { params }),
  getDepartmentById: (id) => api.get(`/departments/${id}`),
  getDepartmentDetail: (id, params) => api.get(`/departments/${id}/detail`, { params }),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),
  getDepartmentStats: () => api.get('/departments/stats'),
};

// Budget Heads API
export const budgetHeadsAPI = {
  getBudgetHeads: (params) => api.get('/budget-heads', { params }),
  getBudgetHeadById: (id) => api.get(`/budget-heads/${id}`),
  createBudgetHead: (data) => api.post('/budget-heads', data),
  updateBudgetHead: (id, data) => api.put(`/budget-heads/${id}`, data),
  deleteBudgetHead: (id) => api.delete(`/budget-heads/${id}`),
  getBudgetHeadStats: () => api.get('/budget-heads/stats'),
};

// Categories API (Mock implementation using localStorage)
const STORAGE_KEY = 'cbms_categories';
const DEFAULT_CATEGORIES = [
  { id: 'academic', name: 'Academic', code: 'ACAD', color: '#28a745', description: 'Academic related expenses', isActive: true },
  { id: 'infrastructure', name: 'Infrastructure', code: 'INFRA', color: '#007bff', description: 'Building and infrastructure', isActive: true },
  { id: 'lab_equipment', name: 'Lab Equipment', code: 'LAB', color: '#17a2b8', description: 'Laboratory equipment and supplies', isActive: true },
  { id: 'events', name: 'Events', code: 'EVENT', color: '#ffc107', description: 'College events and functions', isActive: true },
  { id: 'maintenance', name: 'Maintenance', code: 'MAINT', color: '#6f42c1', description: 'Regular maintenance work', isActive: true },
  { id: 'operations', name: 'Operations', code: 'OPS', color: '#fd7e14', description: 'Daily operations', isActive: true },
  { id: 'other', name: 'Other', code: 'OTHER', color: '#6c757d', description: 'Miscellaneous expenses', isActive: true }
];

const getStoredCategories = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  return JSON.parse(stored);
};

export const categoriesAPI = {
  getCategories: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return { data: { success: true, data: { categories: getStoredCategories() } } };
  },
  getCategoryById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const categories = getStoredCategories();
    const category = categories.find(c => c.id === id);
    return { data: { success: !!category, data: { category } } };
  },
  createCategory: async (data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const categories = getStoredCategories();
    const newCategory = { ...data, id: data.name.toLowerCase().replace(/\s+/g, '_') };
    categories.push(newCategory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    return { data: { success: true, data: { category: newCategory } } };
  },
  updateCategory: async (id, data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    let categories = getStoredCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...data };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
      return { data: { success: true, data: { category: categories[index] } } };
    }
    return { data: { success: false, message: 'Category not found' } };
  },
  deleteCategory: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    let categories = getStoredCategories();
    categories = categories.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    return { data: { success: true } };
  }
};

// Allocations API
export const allocationAPI = {
  getAllocations: (params) => api.get('/allocations', { params }),
  getAllocationById: (id) => api.get(`/allocations/${id}`),
  createAllocation: (data) => api.post('/allocations', data),
  updateAllocation: (id, data) => api.put(`/allocations/${id}`, data),
  deleteAllocation: (id) => api.delete(`/allocations/${id}`),
  getAllocationStats: (params) => api.get('/allocations/stats', { params }),
  bulkCreateAllocations: (data) => api.post('/allocations/bulk', data),
  getYearComparison: (params) => api.get('/allocations/year-comparison', { params }),
  getCSVTemplate: () => api.get('/allocations/csv-template', { responseType: 'blob' }),
  bulkUploadCSV: (data) => api.post('/allocations/bulk-csv', data, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
};

// Expenditures API
export const expenditureAPI = {
  getExpenditures: (params) => api.get('/expenditures', { params }),
  getExpenditureById: (id) => api.get(`/expenditures/${id}`),
  submitExpenditure: (data) => api.post('/expenditures', data, {
    headers: {
      'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json'
    }
  }),
  approveExpenditure: (id, data) => api.put(`/expenditures/${id}/approve`, data),
  rejectExpenditure: (id, data) => api.put(`/expenditures/${id}/reject`, data),
  resubmitExpenditure: (id, data) => api.post(`/expenditures/${id}/resubmit`, data, {
    headers: {
      'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json'
    }
  }),
  verifyExpenditure: (id, data) => api.put(`/expenditures/${id}/verify`, data),
  getExpenditureStats: (params) => api.get('/expenditures/stats', { params }),
};

// Notifications API
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  getNotificationStats: () => api.get('/notifications/stats'),
  createNotification: (data) => api.post('/notifications', data),
  sendSystemAnnouncement: (data) => api.post('/notifications/announcement', data),
};

// Settings API
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  getPublicSettings: () => api.get('/settings/public'),
  updateSettings: (data) => api.put('/settings', data),
  resetSettings: (data) => api.post('/settings/reset', data),
  getSystemInfo: () => api.get('/settings/system-info'),
};

// Reports API
export const reportAPI = {
  getExpenditureReport: (params) => {
    const isCsv = params?.format === 'csv';
    return api.get('/reports/expenditures', {
      params,
      ...(isCsv ? { responseType: 'blob' } : {})
    });
  },
  getAllocationReport: (params) => api.get('/reports/allocations', { params }),
  getDashboardReport: (params) => api.get('/reports/dashboard', { params }),
  getBudgetProposalReport: (params) => api.get('/reports/proposals', { params }),
  getAuditReport: (params) => api.get('/reports/audit', { params }),
  getConsolidatedBudgetReport: (params) => api.get('/consolidated-reports', { params }),
  getBudgetUtilizationDashboard: (params) => api.get('/consolidated-reports/utilization', { params }),
  getFundUtilizationTrend: (params) => api.get('/consolidated-reports/trend', { params }),
};

// Budget Proposals API
export const budgetProposalAPI = {
  getBudgetProposals: (params) => api.get('/budget-proposals', { params }),
  getBudgetProposalById: (id) => api.get(`/budget-proposals/${id}`),
  createBudgetProposal: (data) => api.post('/budget-proposals', data),
  updateBudgetProposal: (id, data) => api.put(`/budget-proposals/${id}`, data),
  submitBudgetProposal: (id) => api.put(`/budget-proposals/${id}/submit`),
  verifyBudgetProposal: (id, data) => api.put(`/budget-proposals/${id}/verify`, data),
  approveBudgetProposal: (id, data) => api.put(`/budget-proposals/${id}/approve`, data),
  rejectBudgetProposal: (id, data) => api.put(`/budget-proposals/${id}/reject`, data),
  resubmitBudgetProposal: (id) => api.post(`/budget-proposals/${id}/resubmit`),
  deleteBudgetProposal: (id) => api.delete(`/budget-proposals/${id}`),
  getBudgetProposalsStats: (params) => api.get('/budget-proposals/stats', { params }),
  markProposalAsRead: (id) => api.put(`/budget-proposals/${id}/read`),
};

// Files API
export const fileAPI = {
  uploadFiles: (data) => api.post('/files/upload', data, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  getFileInfo: (fileId) => api.get(`/files/${fileId}`),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  getDownloadUrl: (fileId) => api.get(`/files/${fileId}/download`),
  cleanupFiles: (data) => api.post('/files/cleanup', data),
  getFileStats: () => api.get('/files/stats'),
};

// Audit Logs API
export const auditLogAPI = {
  getAuditLogs: (params) => api.get('/audit-logs', { params }),
  getAuditLogById: (id) => api.get(`/audit-logs/${id}`),
  getAuditLogStats: (params) => api.get('/audit-logs/stats', { params }),
  createAuditLog: (data) => api.post('/audit-logs', data),
  exportAuditLogs: (params) => api.get('/audit-logs/export', { params }),
};

// Income API - Financial Governance
export const incomeAPI = {
  getIncomes: (params) => api.get('/income', { params }),
  getIncomeById: (id) => api.get(`/income/${id}`),
  getIncomeStats: (params) => api.get('/income/stats', { params }),
  createIncome: (data) => api.post('/income', data),
  updateIncome: (id, data) => api.put(`/income/${id}`, data),
  verifyIncome: (id, data) => api.put(`/income/${id}/verify`, data),
  deleteIncome: (id) => api.delete(`/income/${id}`)
};

// Financial Year API - Financial Governance
export const financialYearAPI = {
  getFinancialYears: (params) => api.get('/financial-years', { params }),
  getActiveYear: () => api.get('/financial-years/active'),
  getYearById: (id) => api.get(`/financial-years/${id}`),
  getYearSummary: (id) => api.get(`/financial-years/${id}/summary`),
  createYear: (data) => api.post('/financial-years', data),
  lockYear: (id, data) => api.put(`/financial-years/${id}/lock`, data),
  closeYear: (id, data) => api.put(`/financial-years/${id}/close`, data),
  recalculateTotals: (id) => api.put(`/financial-years/${id}/recalculate`)
};

// System API
export const systemAPI = {
  getConcurrencyStatus: () => api.get('/system/concurrency-status'),
  bulkSetup: (data) => api.post('/system/bulk-setup', data),
};

// AI Insights API - Intelligent Budget Analysis
export const aiAPI = {
  // Get all AI data for dashboard
  getDashboard: (params) => api.get('/ai/dashboard', { params }),
  // Anomaly detection
  getAnomalies: (params) => api.get('/ai/anomalies', { params }),
  // Risk scoring for departments
  getRiskScores: (params) => api.get('/ai/risk-scores', { params }),
  // AI-prioritized approval queue
  getApprovalPriority: () => api.get('/ai/approval-priority'),
  // Year-over-year comparison analysis
  getYearComparison: (params) => api.get('/ai/year-comparison', { params }),
  // Natural language insights
  getInsights: (params) => api.get('/ai/insights', { params }),
  // System health monitoring (admin only)
  getSystemHealth: (params) => api.get('/ai/health', { params }),
};

export default api;
