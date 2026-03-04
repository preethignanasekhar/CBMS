import React, { useState, useEffect } from 'react';
import { reportAPI, departmentsAPI, budgetHeadsAPI, usersAPI, financialYearAPI } from '../services/api';
import { Receipt, IndianRupee, PieChart, Download, FileText, Calendar, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import PageHeader from '../components/Common/PageHeader';
import './Reports.scss';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportType, setReportType] = useState('expenditures');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    departmentId: '',
    budgetHeadId: '',
    status: '',
    submittedBy: '',
    financialYear: '',
    includeComparison: false
  });
  const [departments, setDepartments] = useState([]);
  const [budgetHeads, setBudgetHeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [departmentsRes, budgetHeadsRes, usersRes, yearsRes] = await Promise.all([
        departmentsAPI.getDepartments(),
        budgetHeadsAPI.getBudgetHeads(),
        usersAPI.getUsers({ limit: 1000 }),
        financialYearAPI.getFinancialYears()
      ]);

      setDepartments(departmentsRes.data.data.departments);
      setBudgetHeads(budgetHeadsRes.data.data.budgetHeads);
      setUsers(usersRes.data.data.users);
      setFinancialYears(yearsRes.data.data.financialYears || []);
    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReportTypeChange = (type) => {
    setReportType(type);
    setReportData(null);
    setError(null);
    if (type === 'dashboard') {
      setFilters(prev => ({ ...prev, includeComparison: false }));
    }
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;
      if (filters.departmentId) params.department = filters.departmentId;
      if (filters.budgetHeadId) params.budgetHead = filters.budgetHeadId;
      if (filters.submittedBy) params.submittedBy = filters.submittedBy;
      if (filters.financialYear) params.financialYear = filters.financialYear;
      if (filters.includeComparison) params.includeComparison = filters.includeComparison;

      let response;
      switch (reportType) {
        case 'expenditures':
          response = await reportAPI.getExpenditureReport(params);
          break;
        case 'allocations':
          response = await reportAPI.getAllocationReport(params);
          break;
        case 'dashboard':
          response = await reportAPI.getDashboardReport(params);
          break;
        case 'audit':
          response = await reportAPI.getAuditReport(params);
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Always download as CSV
      downloadAsCSV(response.data.data);
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Failed to generate report';
      setError(serverMsg);
      console.error('Error generating report:', err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const downloadAsCSV = (data) => {
    let rows = [];

    if (reportType === 'expenditures' && data?.expenditures) {
      data.expenditures.forEach(exp => {
        const items = exp.expenseItems && exp.expenseItems.length > 0
          ? exp.expenseItems
          : [{ billNumber: exp.billNumber || 'N/A', billDate: exp.billDate, amount: exp.billAmount || exp.totalAmount || 0, vendorName: exp.partyName || 'N/A' }];
        items.forEach(item => {
          rows.push({
            'Event Name': exp.eventName,
            'Event Type': exp.eventType,
            'Event Date': formatDate(exp.eventDate),
            'Bill Number': item.billNumber,
            'Bill Date': item.billDate ? formatDate(item.billDate) : 'N/A',
            'Amount': item.amount,
            'Vendor': item.vendorName || 'N/A',
            'Department': exp.department?.name || 'N/A',
            'Budget Head': exp.budgetHead?.name || 'N/A',
            'Status': exp.status,
            'Financial Year': exp.financialYear,
            'Submitted By': exp.submittedBy?.name || 'N/A',
          });
        });
      });
    } else if (reportType === 'allocations' && data?.allocations) {
      rows = data.allocations.map(alloc => ({
        'Financial Year': alloc.financialYear,
        'Department': alloc.department?.name || 'N/A',
        'Budget Head': alloc.budgetHead?.name || 'N/A',
        'Allocated Amount': alloc.allocatedAmount,
        'Spent Amount': alloc.spentAmount,
        'Remaining Amount': alloc.remainingAmount,
        'Utilization %': alloc.allocatedAmount > 0 ? Math.round((alloc.spentAmount / alloc.allocatedAmount) * 100) : 0,
      }));
    } else if (reportType === 'dashboard') {
      const consolidated = data?.consolidated || data;
      rows = [
        { Metric: 'Total Allocated', Value: consolidated.totalAllocated },
        { Metric: 'Total Spent', Value: consolidated.totalSpent },
        { Metric: 'Total Remaining', Value: consolidated.totalRemaining || (consolidated.totalAllocated - consolidated.totalSpent) },
        { Metric: 'Utilization %', Value: consolidated.utilizationPercentage },
      ];
      if (consolidated.departmentBreakdown) {
        rows.push({ Metric: '' });
        rows.push({ Metric: '--- Department Breakdown ---' });
        Object.entries(consolidated.departmentBreakdown).forEach(([dept, d]) => {
          rows.push({ Metric: dept, Allocated: d.allocated, Spent: d.spent, Remaining: d.remaining, 'Utilization %': d.utilization });
        });
      }
    } else if (reportType === 'audit' && data?.auditLogs) {
      rows = data.auditLogs.map(log => ({
        'Timestamp': new Date(log.createdAt).toLocaleString(),
        'Event Type': log.eventType,
        'Actor': log.actor?.name || 'System',
        'Role': log.actor?.role || 'N/A',
        'Entity': log.targetEntity,
        'ID': log.targetId,
      }));
    }

    if (rows.length === 0) {
      setError('No data available to export for the selected filters.');
      return;
    }

    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 200);
    } catch (err) {
      console.error('CSV export error:', err);
      setError('Failed to generate CSV file. Please try again.');
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
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderExpenditureReport = () => {
    if (!reportData) return null;

    return (
      <div className="report-content">
        <div className="report-summary">
          <h3>Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Total Expenditures:</span>
              <span className="value">{reportData.summary.totalExpenditures}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Amount:</span>
              <span className="value">{formatCurrency(reportData.summary.totalAmount)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Approved Amount:</span>
              <span className="value approved">{formatCurrency(reportData.summary.approvedAmount)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Pending Amount:</span>
              <span className="value pending">{formatCurrency(reportData.summary.pendingAmount)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Rejected Amount:</span>
              <span className="value rejected">{formatCurrency(reportData.summary.rejectedAmount)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Average Amount:</span>
              <span className="value">{formatCurrency(reportData.summary.averageAmount)}</span>
            </div>
          </div>
        </div>

        <div className="report-breakdown">
          <h3>Expenditure Register (Bill-wise)</h3>
          <div className="breakdown-table table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Event Date</th>
                  <th>Bill #</th>
                  <th>Bill Date</th>
                  <th>Department</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData.expenditures.flatMap((exp, expIdx) => {
                  const items = exp.expenseItems && exp.expenseItems.length > 0
                    ? exp.expenseItems
                    : [{ billNumber: exp.billNumber || 'N/A', billDate: exp.billDate, amount: exp.billAmount || exp.totalAmount, vendorName: exp.partyName || 'N/A' }];

                  return items.map((item, itemIdx) => (
                    <tr key={`${expIdx}-${itemIdx}`}>
                      <td data-label="Event">{exp.eventName}</td>
                      <td data-label="Event Date">{formatDate(exp.eventDate)}</td>
                      <td data-label="Bill #">{item.billNumber}</td>
                      <td data-label="Bill Date">{item.billDate ? formatDate(item.billDate) : 'N/A'}</td>
                      <td data-label="Department">{exp.department.name}</td>
                      <td data-label="Amount">{formatCurrency(item.amount)}</td>
                      <td className={`status ${exp.status}`} data-label="Status">{exp.status}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAllocationReport = () => {
    if (!reportData) return null;

    return (
      <div className="report-content">
        <div className="report-summary">
          <h3>Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Total Allocations:</span>
              <span className="value">{reportData.summary.totalAllocations}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Allocated:</span>
              <span className="value">{formatCurrency(reportData.summary.totalAllocated)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Spent:</span>
              <span className="value">{formatCurrency(reportData.summary.totalSpent)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Remaining:</span>
              <span className="value">{formatCurrency(reportData.summary.totalRemaining)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Utilization:</span>
              <span className="value">{reportData.summary.averageUtilization.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="report-breakdown">
          <h3>Department Breakdown</h3>
          <div className="breakdown-table table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Allocations</th>
                  <th>Total Allocated</th>
                  <th>Total Spent</th>
                  <th>Remaining</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.summary.byDepartment).map(([deptName, deptData], index) => (
                  <tr key={index}>
                    <td data-label="Department">{deptName}</td>
                    <td data-label="Allocations">{deptData.count}</td>
                    <td data-label="Total Allocated">{formatCurrency(deptData.allocated)}</td>
                    <td data-label="Total Spent">{formatCurrency(deptData.spent)}</td>
                    <td data-label="Remaining">{formatCurrency(deptData.remaining)}</td>
                    <td data-label="Utilization %">{deptData.allocated > 0 ? ((deptData.spent / deptData.allocated) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="report-breakdown">
          <h3>Detailed Allocations</h3>
          <div className="breakdown-table table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Financial Year</th>
                  <th>Department</th>
                  <th>Budget Head</th>
                  <th>Allocated</th>
                  <th>Spent</th>
                  <th>Remaining</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {reportData.allocations.map((alloc, index) => {
                  const util = alloc.allocatedAmount > 0 ? (alloc.spentAmount / alloc.allocatedAmount) * 100 : 0;
                  return (
                    <tr key={index}>
                      <td data-label="FY">{alloc.financialYear}</td>
                      <td data-label="Department">{alloc.department.name}</td>
                      <td data-label="Budget Head">{alloc.budgetHead.name}</td>
                      <td data-label="Allocated">{formatCurrency(alloc.allocatedAmount)}</td>
                      <td data-label="Spent">{formatCurrency(alloc.spentAmount)}</td>
                      <td data-label="Remaining">{formatCurrency(alloc.remainingAmount)}</td>
                      <td data-label="Utilization %">{util.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardReport = () => {
    if (!reportData) return null;

    // Use reportData directly or reportData.consolidated depending on what backend sends
    const data = reportData.consolidated || reportData;

    return (
      <div className="report-content">
        <div className="report-summary">
          <h3>Overall Statistics ({data.financialYear})</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Total Allocated:</span>
              <span className="value">{formatCurrency(data.totalAllocated)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Spent:</span>
              <span className="value">{formatCurrency(data.totalSpent)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Remaining:</span>
              <span className="value">{formatCurrency(data.totalRemaining || (data.totalAllocated - data.totalSpent))}</span>
            </div>
            <div className="summary-item">
              <span className="label">Utilization:</span>
              <span className="value">{data.utilizationPercentage ? data.utilizationPercentage.toFixed(2) : 0}%</span>
            </div>
            <div className="summary-item">
              <span className="label">Pending Bills:</span>
              <span className="value pending">{formatCurrency(data.totalPending)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Approved Bills:</span>
              <span className="value approved">{formatCurrency(data.totalApproved)}</span>
            </div>
          </div>
        </div>

        {data.yearComparison && (
          <div className="report-comparison">
            <h3>Year-over-Year Comparison ({data.yearComparison.previousYear} vs {data.yearComparison.currentYear})</h3>
            <div className="comparison-grid">
              <div className="comparison-item">
                <span className="label">Allocated Change</span>
                <span className={`value ${data.yearComparison.summary.changes.allocatedChange >= 0 ? 'positive' : 'negative'}`}>
                  {data.yearComparison.summary.changes.allocatedChange.toFixed(2)}%
                </span>
              </div>
              <div className="comparison-item">
                <span className="label">Spent Change</span>
                <span className={`value ${data.yearComparison.summary.changes.spentChange >= 0 ? 'positive' : 'negative'}`}>
                  {data.yearComparison.summary.changes.spentChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="report-breakdown">
          <h3>Department Performance</h3>
          <div className="breakdown-table table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Allocated</th>
                  <th>Spent</th>
                  <th>Remaining</th>
                  <th>Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {data.departmentBreakdown && Object.entries(data.departmentBreakdown).map(([deptName, deptData], index) => (
                  <tr key={index}>
                    <td data-label="Department">{deptName}</td>
                    <td data-label="Allocated">{formatCurrency(deptData.allocated)}</td>
                    <td data-label="Spent">{formatCurrency(deptData.spent)}</td>
                    <td data-label="Remaining">{formatCurrency(deptData.remaining)}</td>
                    <td data-label="Utilization %">{deptData.utilization ? deptData.utilization.toFixed(2) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="reports-container">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate comprehensive reports for budget allocations and expenditures"
      />

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

      <div className="reports-controls">
        <div className="report-type-selector">
          <h3>Report Type</h3>
          <div className="type-buttons">
            <button
              className={`type-btn ${reportType === 'expenditures' ? 'active' : ''}`}
              onClick={() => handleReportTypeChange('expenditures')}
            >
              <Receipt size={24} />
              Expenditure Report
            </button>
            <button
              className={`type-btn ${reportType === 'allocations' ? 'active' : ''}`}
              onClick={() => handleReportTypeChange('allocations')}
            >
              <IndianRupee size={24} />
              Allocation Report
            </button>
            <button
              className={`type-btn ${reportType === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleReportTypeChange('dashboard')}
            >
              <PieChart size={24} />
              Dashboard Report
            </button>

          </div>
        </div>

        <div className="report-filters">
          <h3>Filters</h3>
          <div className="filters-grid">


            {reportType === 'expenditures' && (
              <>
                <div className="filter-group">
                  <label htmlFor="startDate">Start Date</label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="endDate">End Date</label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="filter-input"
                  />
                </div>
              </>
            )}

            <div className="filter-group">
              <label htmlFor="departmentId">Department</label>
              <select
                id="departmentId"
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
              <label htmlFor="budgetHeadId">Budget Head</label>
              <select
                id="budgetHeadId"
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
              <label htmlFor="financialYear">Financial Year</label>
              <div className="flexible-year-input">
                <input
                  list="fy-suggestions"
                  id="financialYear"
                  name="financialYear"
                  value={filters.financialYear}
                  onChange={handleFilterChange}
                  className="filter-input"
                  placeholder="e.g. 2025-2026"
                />
                <datalist id="fy-suggestions">
                  {financialYears.map(fy => (
                    <option key={fy._id} value={fy.year} />
                  ))}
                </datalist>
                <div className="date-picker-helper" title="Choose date to set Year">
                  <Calendar size={18} />
                  <input
                    type="date"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (isNaN(date.getTime())) return;
                      const month = date.getMonth();
                      const year = date.getFullYear();
                      const startYear = month >= 3 ? year : year - 1;
                      setFilters(prev => ({ ...prev, financialYear: `${startYear}-${startYear + 1}` }));
                    }}
                    className="hidden-date-picker"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="report-actions">
          <button
            className="btn btn-primary"
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? (
              'Downloading...'
            ) : (
              <>
                <FileText size={16} />
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>


    </div >
  );
};

export default Reports;