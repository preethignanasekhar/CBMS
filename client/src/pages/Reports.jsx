import React, { useState, useEffect } from 'react';
import { reportAPI, departmentsAPI, budgetHeadsAPI, usersAPI } from '../services/api';
import { Receipt, IndianRupee, PieChart, ClipboardList, Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import './Reports.scss';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportType, setReportType] = useState('expenditures');
  const [filters, setFilters] = useState({
    format: 'json',
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

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [departmentsRes, budgetHeadsRes, usersRes] = await Promise.all([
        departmentsAPI.getDepartments(),
        budgetHeadsAPI.getBudgetHeads(),
        usersAPI.getUsers({ limit: 1000 })
      ]);

      setDepartments(departmentsRes.data.data.departments);
      setBudgetHeads(budgetHeadsRes.data.data.budgetHeads);
      setUsers(usersRes.data.data.users);
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

      const params = { ...filters };

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

      if (filters.format === 'csv') {
        // Handle CSV download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (filters.format === 'excel') {
        handleExcelExport(response.data.data);
      } else if (filters.format === 'pdf') {
        handlePDFExport(response.data.data);
      } else {
        setReportData(response.data.data);
      }
    } catch (err) {
      setError('Failed to generate report');
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelExport = (data) => {
    let exportData = [];
    let fileName = `${reportType}-report.xlsx`;

    if (reportType === 'expenditures') {
      data.expenditures.forEach(exp => {
        if (exp.expenseItems && exp.expenseItems.length > 0) {
          exp.expenseItems.forEach(item => {
            exportData.push({
              'Event Name': exp.eventName,
              'Event Type': exp.eventType,
              'Event Date': formatDate(exp.eventDate),
              'Bill Number': item.billNumber,
              'Bill Date': formatDate(item.billDate),
              'Amount': item.amount,
              'Vendor': item.vendorName,
              'Department': exp.department?.name || 'N/A',
              'Budget Head': exp.budgetHead?.name || 'N/A',
              'Status': exp.status,
              'Financial Year': exp.financialYear,
              'Submitted By': exp.submittedBy?.name || 'N/A'
            });
          });
        } else {
          // Fallback for requests without bill items (or if backend sent legacy format)
          exportData.push({
            'Event Name': exp.eventName,
            'Event Type': exp.eventType,
            'Event Date': formatDate(exp.eventDate),
            'Bill Number': exp.billNumber || 'N/A',
            'Bill Date': exp.billDate ? formatDate(exp.billDate) : 'N/A',
            'Amount': exp.billAmount || exp.totalAmount || 0,
            'Vendor': exp.partyName || 'N/A',
            'Department': exp.department?.name || 'N/A',
            'Budget Head': exp.budgetHead?.name || 'N/A',
            'Status': exp.status,
            'Financial Year': exp.financialYear,
            'Submitted By': exp.submittedBy?.name || 'N/A'
          });
        }
      });
    } else if (reportType === 'allocations') {
      exportData = data.allocations.map(alloc => ({
        'Financial Year': alloc.financialYear,
        'Department': alloc.department.name,
        'Budget Head': alloc.budgetHead.name,
        'Allocated Amount': alloc.allocatedAmount,
        'Spent Amount': alloc.spentAmount,
        'Remaining Amount': alloc.remainingAmount,
        'Utilization %': Math.round((alloc.spentAmount / alloc.allocatedAmount) * 100)
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName);
  };

  const handlePDFExport = (data) => {
    const doc = new jsPDF();
    const fileName = `${reportType}-report.pdf`;

    doc.setFontSize(18);
    doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    let columns = [];
    let rows = [];

    if (reportType === 'expenditures') {
      columns = ['Event', 'Event Date', 'Bill #', 'Amount', 'Dept', 'Status'];
      data.expenditures.forEach(exp => {
        const items = exp.expenseItems && exp.expenseItems.length > 0
          ? exp.expenseItems
          : [{ billNumber: exp.billNumber || 'N/A', amount: exp.billAmount || exp.totalAmount || 0 }];

        items.forEach(item => {
          rows.push([
            exp.eventName,
            formatDate(exp.eventDate),
            item.billNumber,
            formatCurrency(item.amount),
            exp.department?.name || 'N/A',
            exp.status
          ]);
        });
      });
    } else if (reportType === 'allocations') {
      columns = ['FY', 'Dept', 'Budget Head', 'Allocated', 'Spent', 'Remaining'];
      rows = data.allocations.map(alloc => [
        alloc.financialYear,
        alloc.department.name,
        alloc.budgetHead.name,
        formatCurrency(alloc.allocatedAmount),
        formatCurrency(alloc.spentAmount),
        formatCurrency(alloc.remainingAmount)
      ]);
    }

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(fileName);
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
      <div className="reports-header">
        <h1>Reports & Analytics</h1>
        <p>Generate comprehensive reports for budget allocations and expenditures</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
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
            <button
              className={`type-btn ${reportType === 'audit' ? 'active' : ''}`}
              onClick={() => handleReportTypeChange('audit')}
            >
              <ClipboardList size={24} />
              Audit Report
            </button>
          </div>
        </div>

        <div className="report-filters">
          <h3>Filters</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="format">Format</label>
              <select
                id="format"
                name="format"
                value={filters.format}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="json">JSON (View)</option>
                <option value="csv">CSV (Download)</option>
                <option value="excel">Excel (Download)</option>
                <option value="pdf">PDF (Download)</option>
              </select>
            </div>

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
                <div className="filter-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
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
              <select
                id="financialYear"
                name="financialYear"
                value={filters.financialYear}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
              </select>
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
              'Generating...'
            ) : (
              <>
                <Download size={16} />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      {reportData && filters.format === 'json' && (
        <div className="report-results">
          {reportType === 'expenditures' && renderExpenditureReport()}
          {reportType === 'allocations' && renderAllocationReport()}
          {reportType === 'dashboard' && renderDashboardReport()}
          {reportType === 'audit' && (
            <div className="report-content">
              <div className="report-summary">
                <h3>Audit Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">Total Logs:</span>
                    <span className="value">{reportData.summary.totalLogs}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Event Types:</span>
                    <span className="value">{Object.keys(reportData.summary.logsByEventType).length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Actor Roles:</span>
                    <span className="value">{Object.keys(reportData.summary.logsByActorRole).length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;