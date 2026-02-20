import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { allocationAPI, expenditureAPI, departmentsAPI, reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import { IndianRupee, CreditCard, Wallet, PieChart, List, Receipt, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import './ConsolidatedDashboard.scss';

const ConsolidatedDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [yearComparison, setYearComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  const currentFY = getCurrentFinancialYear();
  const previousFY = getPreviousFinancialYear();
  // Simple logic to get a year before previous for the dropdown
  const getFYMinus2 = () => {
    const [start] = previousFY.split('-');
    const year = parseInt(start) - 1;
    return `${year}-${year + 1}`;
  };
  const fyMinus2 = getFYMinus2();

  const [selectedFinancialYear, setSelectedFinancialYear] = useState(currentFY);

  const { socket } = useSocket();

  useEffect(() => {
    fetchData();
  }, [selectedDepartment, selectedFinancialYear]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      console.log('Real-time consolidated update received:', data);
      fetchData(); // Refresh data on new notification
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, selectedDepartment, selectedFinancialYear]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const params = {};
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedFinancialYear) params.financialYear = selectedFinancialYear;

      const [
        allocationsResponse,
        expendituresResponse,
        departmentsResponse,
        statsResponse,
        dashboardReportResponse
      ] = await Promise.all([
        allocationAPI.getAllocations(params),
        expenditureAPI.getExpenditures(params),
        departmentsAPI.getDepartments(),
        allocationAPI.getAllocationStats(params),
        reportAPI.getDashboardReport({ financialYear: selectedFinancialYear, includeComparison: 'true' })
      ]);

      setAllocations(allocationsResponse.data.data.allocations);
      setExpenditures(expendituresResponse.data.data.expenditures);
      setDepartments(departmentsResponse.data.data.departments);
      setStats(statsResponse.data.data);

      // Set year comparison data if available
      if (dashboardReportResponse.data.data.consolidated.yearComparison) {
        setYearComparison(dashboardReportResponse.data.data.consolidated.yearComparison);
      }

      setError(null);
    } catch (err) {
      setError('Failed to fetch consolidated data');
      console.error('Error fetching consolidated data:', err);
    } finally {
      setLoading(false);
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

  // Calculate department-wise statistics
  const departmentStats = departments.map(dept => {
    const deptAllocations = allocations.filter(allocation =>
      (allocation.department?._id || allocation.department) === dept._id
    );
    const deptExpenditures = expenditures.filter(expenditure =>
      (expenditure.department?._id || expenditure.department) === dept._id
    );

    const totalAllocated = deptAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);
    const totalSpent = deptAllocations.reduce((sum, allocation) => sum + allocation.spentAmount, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const utilization = getUtilizationPercentage(totalAllocated, totalSpent);

    return {
      ...dept,
      totalAllocated,
      totalSpent,
      totalRemaining,
      utilization,
      allocationCount: deptAllocations.length,
      expenditureCount: deptExpenditures.length
    };
  });

  if (loading) {
    return (
      <div className="consolidated-dashboard-container">
        <div className="loading">Loading consolidated dashboard...</div>
      </div>
    );
  }

  return (
    <div className="consolidated-dashboard-container">
      <div className="dashboard-header">
        <h1>Consolidated Budget Dashboard</h1>
        <p>Complete overview of budget allocations and expenditures across all departments</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="dashboard-filters">
        <div className="filter-group">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="financialYear">Financial Year</label>
          <select
            id="financialYear"
            value={selectedFinancialYear}
            onChange={(e) => setSelectedFinancialYear(e.target.value)}
            className="filter-select"
          >
            <option value={currentFY}>{currentFY}</option>
            <option value={previousFY}>{previousFY}</option>
            <option value={fyMinus2}>{fyMinus2}</option>
          </select>
        </div>
      </div>

      {stats && (
        <div className="overview-stats">
          <div className="stat-card primary">
            <div className="stat-icon">
              <IndianRupee size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary.totalAllocated)}</div>
              <div className="stat-label">Total Budget Allotted</div>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon">
              <CreditCard size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary.totalSpent)}</div>
              <div className="stat-label">Expenses Incurred Till Date</div>
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-icon">
              <Wallet size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary.totalRemaining)}</div>
              <div className="stat-label">Value of Un-utilized Budget</div>
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-icon">
              <PieChart size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.summary.utilizationPercentage}%</div>
              <div className="stat-label">Percentage Utilized</div>
            </div>
          </div>
        </div>
      )}

      {yearComparison && yearComparison.summary ? (
        <div className="year-comparison-section">
          <h2>Year-over-Year Comparison</h2>
          <div className="comparison-cards">
            <div className="comparison-card">
              <div className="comparison-header">
                <h3>Total Budget Allocated</h3>
                <div className="trend-icon">
                  {yearComparison.summary.changes.allocatedChange >= 0 ? (
                    <TrendingUp size={20} className="trend-up" />
                  ) : (
                    <TrendingDown size={20} className="trend-down" />
                  )}
                </div>
              </div>
              <div className="comparison-values">
                <div className="value-row">
                  <span className="label">Previous Year ({yearComparison.previousYear}):</span>
                  <span className="value">{formatCurrency(yearComparison.summary.previous.totalAllocated)}</span>
                </div>
                <div className="value-row">
                  <span className="label">Current Year ({yearComparison.currentYear}):</span>
                  <span className="value">{formatCurrency(yearComparison.summary.current.totalAllocated)}</span>
                </div>
                <div className="change-indicator">
                  <span className={yearComparison.summary.changes.allocatedChange >= 0 ? 'positive' : 'negative'}>
                    {yearComparison.summary.changes.allocatedChange >= 0 ? '+' : ''}
                    {yearComparison.summary.changes.allocatedChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="comparison-card">
              <div className="comparison-header">
                <h3>Total Expenses Incurred</h3>
                <div className="trend-icon">
                  {yearComparison.summary.changes.spentChange >= 0 ? (
                    <TrendingUp size={20} className="trend-up" />
                  ) : (
                    <TrendingDown size={20} className="trend-down" />
                  )}
                </div>
              </div>
              <div className="comparison-values">
                <div className="value-row">
                  <span className="label">Previous Year ({yearComparison.previousYear}):</span>
                  <span className="value">{formatCurrency(yearComparison.summary.previous.totalSpent)}</span>
                </div>
                <div className="value-row">
                  <span className="label">Current Year ({yearComparison.currentYear}):</span>
                  <span className="value">{formatCurrency(yearComparison.summary.current.totalSpent)}</span>
                </div>
                <div className="change-indicator">
                  <span className={yearComparison.summary.changes.spentChange >= 0 ? 'warning' : 'positive'}>
                    {yearComparison.summary.changes.spentChange >= 0 ? '+' : ''}
                    {yearComparison.summary.changes.spentChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="comparison-card">
              <div className="comparison-header">
                <h3>Fund Utilization Rate</h3>
                <div className="trend-icon">
                  {yearComparison.summary.changes.utilizationChange >= 0 ? (
                    <TrendingUp size={20} className="trend-up" />
                  ) : (
                    <TrendingDown size={20} className="trend-down" />
                  )}
                </div>
              </div>
              <div className="comparison-values">
                <div className="value-row">
                  <span className="label">Previous Year ({yearComparison.previousYear}):</span>
                  <span className="value">{yearComparison.summary.previous.utilization.toFixed(2)}%</span>
                </div>
                <div className="value-row">
                  <span className="label">Current Year ({yearComparison.currentYear}):</span>
                  <span className="value">{yearComparison.summary.current.utilization.toFixed(2)}%</span>
                </div>
                <div className="change-indicator">
                  <span className={yearComparison.summary.changes.utilizationChange >= 0 ? 'neutral' : 'neutral'}>
                    {yearComparison.summary.changes.utilizationChange >= 0 ? '+' : ''}
                    {yearComparison.summary.changes.utilizationChange.toFixed(2)}% points
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="year-comparison-section">
          <h2>Year-over-Year Comparison</h2>
          <div className="no-data-message-section">
            <AlertCircle size={64} />
            <h3>No Previous Year Data Available</h3>
            <p>Year-over-year comparison requires allocation and expenditure data for the previous financial year.</p>
            <p className="no-data-hint">Please ensure data exists for both 2023-2024 and 2024-2025 financial years.</p>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        <div className="department-breakdown">
          <h2 style={{ color: 'black', marginBottom: '2rem', fontWeight: 700, fontSize: '1.5rem', textShadow: 'none' }}>Department-wise Breakdown</h2>
          <div className="department-cards">
            {departmentStats.map((dept) => (
              <div
                key={dept._id}
                className="department-card"
                onClick={() => navigate(`/department-detail/${dept._id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="department-header">
                  <h3 className="department-name">{dept.name}</h3>
                  <span className="department-code">{dept.code}</span>
                </div>

                <div className="department-stats">
                  <div className="stat-row">
                    <span className="label">Allocated:</span>
                    <span className="value">{formatCurrency(dept.totalAllocated)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Spent:</span>
                    <span className="value spent">{formatCurrency(dept.totalSpent)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Remaining:</span>
                    <span className="value remaining">{formatCurrency(dept.totalRemaining)}</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Utilization:</span>
                    <span className="value">{dept.utilization}%</span>
                  </div>
                </div>

                <div className="utilization-bar">
                  <div className="utilization-fill" style={{
                    width: `${dept.utilization}%`,
                    backgroundColor: getUtilizationColor(dept.utilization)
                  }}></div>
                </div>

                <div className="department-meta">
                  <div className="meta-item">
                    <List size={14} />
                    <span>{dept.allocationCount} Allocations</span>
                  </div>
                  <div className="meta-item">
                    <Receipt size={14} />
                    <span>{dept.expenditureCount} Expenditures</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-activities">
          <h2>Recent Activities</h2>
          <div className="activity-list">
            {expenditures.slice(0, 10).map((expenditure) => (
              <div key={expenditure._id} className="activity-item">
                <div className="activity-icon">
                  <Receipt size={20} />
                </div>
                <div className="activity-content">
                  <div className="activity-title">
                    {expenditure.billNumber} - {expenditure.department?.name || expenditure.departmentName || 'N/A'}
                  </div>
                  <div className="activity-details">
                    {expenditure.budgetHead?.name || expenditure.budgetHeadName || 'N/A'} • {expenditure.partyName}
                  </div>
                  <div className="activity-meta">
                    <span className="amount">{formatCurrency(expenditure.billAmount)}</span>
                    <span className="date">{formatDate(expenditure.submittedAt)}</span>
                  </div>
                </div>
                <div className="activity-status">
                  <span
                    className={`status-badge ${expenditure.status}`}
                    style={{ backgroundColor: getUtilizationColor(expenditure.status === 'approved' ? 100 : expenditure.status === 'pending' ? 50 : 0) }}
                  >
                    {expenditure.status.charAt(0).toUpperCase() + expenditure.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="budget-head-breakdown">
        <h2>Budget Head-wise Breakdown</h2>
        <div className="breakdown-table table-responsive">
          <table>
            <thead>
              <tr>
                <th>Budget Head</th>
                <th>Total Allocated</th>
                <th>Total Spent</th>
                <th>Remaining</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {stats?.budgetHeadStats?.map((budgetHead) => (
                <tr key={budgetHead.budgetHeadCode}>
                  <td data-label="Budget Head">
                    <div className="budget-head-info">
                      <span className="head-name">{budgetHead.budgetHeadName}</span>
                      <span className="head-code">{budgetHead.budgetHeadCode}</span>
                    </div>
                  </td>
                  <td className="amount" data-label="Total Allocated">{formatCurrency(budgetHead.totalAllocated)}</td>
                  <td className="amount" data-label="Total Spent">{formatCurrency(budgetHead.totalSpent)}</td>
                  <td className="amount" data-label="Remaining">{formatCurrency(budgetHead.totalRemaining)}</td>
                  <td data-label="Utilization">
                    <div className="utilization-cell">
                      <div className="utilization-bar-small">
                        <div
                          className="utilization-fill-small"
                          style={{
                            width: `${getUtilizationPercentage(budgetHead.totalAllocated, budgetHead.totalSpent)}%`,
                            backgroundColor: getUtilizationColor(getUtilizationPercentage(budgetHead.totalAllocated, budgetHead.totalSpent))
                          }}
                        ></div>
                      </div>
                      <span className="utilization-text-small">
                        {getUtilizationPercentage(budgetHead.totalAllocated, budgetHead.totalSpent)}%
                      </span>
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

export default ConsolidatedDashboard;
