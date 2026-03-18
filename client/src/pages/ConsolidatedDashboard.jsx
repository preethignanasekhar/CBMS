import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { allocationAPI, expenditureAPI, departmentsAPI, reportAPI, financialYearAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import { IndianRupee, CreditCard, Wallet, PieChart, List, Receipt, TrendingUp, TrendingDown, AlertCircle, RefreshCw, ArrowRight, Calendar, Building, Search, X, Code, Cpu, Layers, Globe, Shield, Zap, Wrench, Droplet, HardHat, Hospital, Car, Monitor, Database, Microscope, Atom, Activity, Library, BookOpen } from 'lucide-react';
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
        dashboardReportResponse,
        financialYearsResponse
      ] = await Promise.all([
        allocationAPI.getAllocations({ ...params, limit: 1000 }),
        expenditureAPI.getExpenditures({ ...params, status: ['verified', 'approved', 'finalized'], limit: 1000 }),
        departmentsAPI.getDepartments({ limit: 1000 }),
        allocationAPI.getAllocationStats(params),
        reportAPI.getDashboardReport({ financialYear: selectedFinancialYear, includeComparison: 'true' }),
        financialYearAPI.getFinancialYears({ limit: 100 })
      ]);

      const depts = departmentsResponse.data.data.departments;
      setAllocations(allocationsResponse.data.data.allocations);
      setExpenditures(expendituresResponse.data.data.expenditures);
      setDepartments(depts);

      // Merge normal stats with consolidated report data
      setStats({
        ...statsResponse.data.data,
        consolidated: dashboardReportResponse.data.data?.consolidated || {}
      });

      if (financialYearsResponse?.data?.data?.financialYears) {
        setFinancialYears(financialYearsResponse.data.data.financialYears.map(fy => fy.year));
      }

      setYearComparison(dashboardReportResponse.data.data?.consolidated?.yearComparison || null);

      setYearComparison(dashboardReportResponse.data.data?.consolidated?.yearComparison || null);

      // Set year comparison data if available
      if (dashboardReportResponse.data.data?.consolidated?.yearComparison) {
        setYearComparison(dashboardReportResponse.data.data.consolidated.yearComparison);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching consolidated data:', err);
      setError('Failed to fetch consolidated dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFYProgress = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    let monthsElapsed = 0;
    if (currentMonth >= 3) {
      monthsElapsed = currentMonth - 2;
    } else {
      monthsElapsed = currentMonth + 10;
    }
    return Math.min(Math.round((monthsElapsed / 12) * 100), 100);
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

    const budgetDistribution = deptAllocations.reduce((acc, alloc) => {
      const headName = alloc.budgetHead?.name || 'Other';
      acc[headName] = (acc[headName] || 0) + alloc.allocatedAmount;
      return acc;
    }, {});

    const distributionData = Object.entries(budgetDistribution)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);

    return {
      ...dept,
      totalAllocated,
      totalSpent,
      totalRemaining,
      utilization,
      allocationCount: deptAllocations.length,
      expenditureCount: deptExpenditures.length,
      distributionData
    };
  });



  const getSmallPieOption = (data) => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => `${params.name}: ${formatCurrency(params.value)}`
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: data,
          itemStyle: {
            borderRadius: 4
          }
        }
      ]
    };
  };

  const getDepartmentIcon = (code) => {
    const iconSize = 60;
    const normalizedCode = code.toUpperCase();
    
    if (normalizedCode === 'AIDS') return <Hospital size={iconSize} />;
    if (normalizedCode === 'AUTO') return <Car size={iconSize} />;
    if (normalizedCode.includes('CYBER')) return <Shield size={iconSize} />;
    if (normalizedCode === 'AIML') return <Atom size={iconSize} />;
    if (normalizedCode === 'CSE') return <Monitor size={iconSize} />;
    if (normalizedCode === 'ECE') return <Cpu size={iconSize} />;
    if (normalizedCode === 'EEE') return <Zap size={iconSize} />;
    if (normalizedCode === 'CIVIL') return <Building size={iconSize} />;
    if (normalizedCode === 'IT') return <Globe size={iconSize} />;
    if (normalizedCode === 'MECH') return <Wrench size={iconSize} />;
    if (normalizedCode === 'VLSI') return <Microscope size={iconSize} />;
    if (normalizedCode === 'MCA') return <Database size={iconSize} />;
    if (normalizedCode === 'S&H') return <BookOpen size={iconSize} />;
    if (normalizedCode === 'LIB') return <Library size={iconSize} />;
    if (normalizedCode === 'PED') return <Activity size={iconSize} />;
    
    return <Building size={iconSize} />;
  };

  const getDepartmentColor = (code) => {
    const normalizedCode = code.toUpperCase();
    if (normalizedCode === 'AIDS') return '#f472b6'; // pink-400
    if (normalizedCode === 'AUTO') return '#38bdf8'; // sky-400
    if (normalizedCode.includes('CYBER')) return '#4f46e5'; // indigo-600
    if (normalizedCode === 'AIML') return '#1e293b'; // slate-800
    if (normalizedCode === 'CSE') return '#3b82f6'; // blue-500
    if (normalizedCode === 'ECE') return '#6366f1'; // indigo-500
    if (normalizedCode === 'EEE') return '#f59e0b'; // amber-500
    if (normalizedCode === 'CIVIL') return '#10b981'; // emerald-500
    if (normalizedCode === 'VLSI') return '#8b5cf6'; // purple-500
    if (normalizedCode === 'MCA') return '#0ea5e9'; // sky-500
    if (normalizedCode === 'S&H') return '#a855f7'; // violet-500
    if (normalizedCode === 'LIB') return '#f97316'; // orange-500
    if (normalizedCode === 'PED') return '#ef4444'; // red-500
    return 'var(--primary)';
  };

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
      >
        <div className="header-actions-group">
          <div className="flexible-year-input">
            <Calendar size={14} className="text-secondary" />
            <input
              className="year-input"
              value={tempFY}
              onChange={(e) => setTempFY(e.target.value)}
              placeholder="YYYY-YYYY"
            />
            <div className="date-picker-helper">
              <input
                type="date"
                className="hidden-date-picker"
                onChange={handleDateToFY}
              />
              <Calendar size={12} />
            </div>
          </div>
          <button className="btn btn-primary search-btn" onClick={handleSearch} style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}>
            <Search size={16} />
          </button>
          <button className="btn btn-secondary" onClick={fetchData} style={{ width: '32px', height: '32px', padding: '0' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
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
          <div className="department-cards-large">
            {departmentStats.map((dept) => {
              const deptColor = getDepartmentColor(dept.code);

              return (
                <div
                  key={dept._id}
                  className="dept-card-large"
                  onClick={() => navigate(`/department-detail/${dept._id}`)}
                >
                  <div className="dept-icon-box" style={{ color: deptColor }}>
                    {getDepartmentIcon(dept.code)}
                  </div>
                  <div className="dept-name-large">
                    {dept.name} ({dept.code})
                  </div>
                  
                  <div className="dept-mini-chart">
                    {dept.distributionData && dept.distributionData.length > 0 ? (
                      <ReactECharts
                        option={getSmallPieOption(dept.distributionData)}
                        style={{ height: '80px', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                      />
                    ) : (
                      <div className="no-data-hint" style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        No spending data
                      </div>
                    )}
                  </div>
                  
                  <div className="dept-total-allocated">
                    {formatCurrency(dept.totalAllocated)}
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
