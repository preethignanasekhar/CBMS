import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { allocationAPI, expenditureAPI, departmentsAPI, reportAPI, financialYearAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import { IndianRupee, CreditCard, Wallet, PieChart, List, Receipt, TrendingUp, TrendingDown, AlertCircle, ArrowRight, Calendar, Building, Search, X } from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
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
  const [financialYears, setFinancialYears] = useState([]);
  const [tempFY, setTempFY] = useState(selectedFinancialYear);

  const { socket } = useSocket();

  useEffect(() => {
    fetchFinancialYears();
  }, []);

  const fetchFinancialYears = async () => {
    try {
      const response = await financialYearAPI.getFinancialYears();
      const yearsData = response?.data?.data?.financialYears || [];
      const years = Array.isArray(yearsData) ? yearsData.map(fy => fy.year) : [];
      setFinancialYears(years);
    } catch (err) {
      console.error('Error fetching financial years:', err);
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

  const handleSearch = () => {
    setSelectedFinancialYear(tempFY);
  };

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

      // Merge normal stats with consolidated report data
      setStats({
        ...statsResponse.data.data,
        consolidated: dashboardReportResponse.data.data.consolidated
      });

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
    <div className="page-container consolidated-dashboard-container">
      <PageHeader
        title="Consolidated Budget Dashboard"
        subtitle="Complete overview of budget allocations and expenditures across all departments"
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

      {stats && (
        <div className="overview-stats">
          <div className="stat-card primary">
            <div className="stat-icon">
              <IndianRupee size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary?.totalAllocated || 0)}</div>
              <div className="stat-label">Total Budget Allotted</div>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon">
              <CreditCard size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary?.totalSpent || 0)}</div>
              <div className="stat-label">Expenses Incurred Till Date</div>
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-icon">
              <Wallet size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{formatCurrency(stats.summary?.totalRemaining || 0)}</div>
              <div className="stat-label">Value of Un-utilized Budget</div>
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-icon">
              <PieChart size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.summary?.utilizationPercentage || 0}%</div>
              <div className="stat-label">Percentage Utilized</div>
            </div>
          </div>
        </div>
      )}




      <div className="dashboard-content">
        <div className="department-breakdown">
          <h2 style={{ color: 'black', marginBottom: '2rem', fontWeight: 700, fontSize: '1.5rem', textShadow: 'none' }}>Department-wise Breakdown</h2>
          <div className="department-cards">
            {departmentStats.map((dept, index) => {
              const colors = ['primary', 'success', 'info', 'warning'];
              const cardClass = colors[index % 4];

              return (
                <div
                  key={dept._id}
                  className={`stat-card ${cardClass}`}
                  onClick={() => navigate(`/department-detail/${dept._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="stat-icon">
                    <Building size={32} color="white" />
                  </div>
                  <div className="stat-info">
                    <div className="stat-number">{dept.code}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};

export default ConsolidatedDashboard;
