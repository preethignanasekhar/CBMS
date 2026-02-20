import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { allocationAPI, expenditureAPI, reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear, getPreviousFinancialYear } from '../utils/dateUtils';
import ErrorBoundary from '../components/ErrorBoundary';
import { RefreshCw, AlertCircle, Wallet, TrendingUp, PiggyBank, Percent } from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import './GraphicalDashboard.scss';

const GraphicalDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [yearComparison, setYearComparison] = useState(null);
  const [timeRange, setTimeRange] = useState('current');
  const [refreshInterval, setRefreshInterval] = useState(null);

  const currentFY = getCurrentFinancialYear();
  const previousFY = getPreviousFinancialYear();

  const { socket } = useSocket();

  useEffect(() => {
    fetchDashboardData();

    // Set up auto-refresh every 30 seconds (fallback)
    const interval = setInterval(fetchDashboardData, 30000);
    setRefreshInterval(interval);

    // Real-time updates
    if (socket) {
      const handleNotification = (data) => {
        console.log('Real-time analytics update received:', data);
        fetchDashboardData();
      };
      socket.on('notification', handleNotification);

      return () => {
        if (interval) clearInterval(interval);
        socket.off('notification', handleNotification);
      };
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const targetFY = timeRange === 'current' ? currentFY : previousFY;

      const [allocationResponse, expenditureResponse, reportResponse, comparisonReportResponse] = await Promise.all([
        allocationAPI.getAllocations({
          departmentId: ['department', 'hod'].includes(user.role) ? (user.department?._id || user.department) : undefined,
          financialYear: targetFY
        }),
        expenditureAPI.getExpenditures({
          departmentId: user.role === 'department' ? user.department : undefined,
          status: 'finalized'
        }),
        reportAPI.getDashboardReport({
          departmentId: ['department', 'hod'].includes(user.role) ? (user.department?._id || user.department) : undefined,
          financialYear: targetFY
        }),
        // Fetch year comparison data for current year
        reportAPI.getDashboardReport({
          departmentId: ['department', 'hod'].includes(user.role) ? (user.department?._id || user.department) : undefined,
          financialYear: currentFY,
          includeComparison: 'true'
        })
      ]);

      setDashboardData({
        allocations: allocationResponse.data.data.allocations || [],
        expenditures: expenditureResponse.data.data.expenditures || [],
        report: reportResponse.data.data || {}
      });

      // Set year comparison data if available
      if (comparisonReportResponse.data.data.consolidated.yearComparison) {
        setYearComparison(comparisonReportResponse.data.data.consolidated.yearComparison);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set empty data structure to prevent crashes
      setDashboardData({
        allocations: [],
        expenditures: [],
        report: {}
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBudgetUtilizationOption = () => {
    if (!dashboardData || !dashboardData.allocations || dashboardData.allocations.length === 0) {
      return null;
    }

    const allocations = dashboardData.allocations;
    const labels = allocations.map(allocation => allocation.budgetHeadName);
    const allocatedData = allocations.map(allocation => allocation.allocatedAmount);
    const spentData = allocations.map(allocation => allocation.spentAmount);
    const remainingData = allocations.map(allocation => allocation.remainingAmount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          return params.map(param =>
            `${param.seriesName}: ${formatCurrency(param.value)}`
          ).join('<br/>');
        }
      },
      legend: {
        data: ['Allocated', 'Spent', 'Remaining'],
        top: 10
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: labels },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value) => `₹${(value / 1000).toFixed(0)}K`
        }
      },
      series: [
        {
          name: 'Allocated',
          type: 'bar',
          data: allocatedData,
          itemStyle: { color: '#667eea' }
        },
        {
          name: 'Spent',
          type: 'bar',
          data: spentData,
          itemStyle: { color: '#28a745' }
        },
        {
          name: 'Remaining',
          type: 'bar',
          data: remainingData,
          itemStyle: { color: '#ffc107' }
        }
      ]
    };
  };

  const getDepartmentComparisonOption = () => {
    if (!dashboardData || user.role === 'department' || !dashboardData.allocations || dashboardData.allocations.length === 0) {
      return null;
    }

    const departments = [...new Set(dashboardData.allocations.map(a => a.departmentName))];
    const departmentData = departments.map(dept => {
      const deptAllocations = dashboardData.allocations.filter(a => a.departmentName === dept);
      const totalAllocated = deptAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      const totalSpent = deptAllocations.reduce((sum, a) => sum + a.spentAmount, 0);
      return {
        department: dept,
        utilization: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0
      };
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          return `${params[0].name}<br/>${params[0].seriesName}: ${params[0].value.toFixed(2)}%`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: departments },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' }
      },
      series: [{
        name: 'Budget Utilization',
        type: 'bar',
        data: departmentData.map(d => ({
          value: d.utilization,
          itemStyle: {
            color: d.utilization > 90 ? '#dc3545' :
              d.utilization > 75 ? '#ffc107' :
                d.utilization > 50 ? '#17a2b8' : '#28a745'
          }
        }))
      }]
    };
  };

  const getExpenditureTrendOption = () => {
    if (!dashboardData || !dashboardData.expenditures || dashboardData.expenditures.length === 0) {
      return null;
    }

    // Group expenditures by month
    const monthlyData = {};
    dashboardData.expenditures.forEach(exp => {
      const date = exp.eventDate || exp.billDate;
      const month = new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      if (!monthlyData[month]) {
        monthlyData[month] = 0;
      }
      monthlyData[month] += (exp.totalAmount || 0);
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA - dateB;
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          return `${params[0].name}<br/>${formatCurrency(params[0].value)}`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: sortedMonths, boundaryGap: false },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value) => `₹${(value / 1000).toFixed(0)}K`
        }
      },
      series: [{
        name: 'Monthly Expenditure',
        type: 'line',
        smooth: true,
        data: sortedMonths.map(month => monthlyData[month]),
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#667eea' },
        lineStyle: { width: 3 }
      }]
    };
  };

  const getBudgetHeadDistributionOption = () => {
    if (!dashboardData || !dashboardData.allocations || dashboardData.allocations.length === 0) {
      return null;
    }

    const budgetHeads = [...new Set(dashboardData.allocations.map(a => a.budgetHeadName))];
    const budgetHeadData = budgetHeads.map(head => {
      const headAllocations = dashboardData.allocations.filter(a => a.budgetHeadName === head);
      return {
        name: head,
        value: headAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          return `${params.name}<br/>${formatCurrency(params.value)} (${params.percent}%)`;
        }
      },
      legend: { orient: 'vertical', left: 'left' },
      series: [{
        type: 'pie',
        radius: '65%',
        data: budgetHeadData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  };

  const getYearComparisonOption = () => {
    if (!yearComparison || !yearComparison.departmentComparison) {
      return null;
    }

    const departments = Object.keys(yearComparison.departmentComparison);
    if (departments.length === 0) {
      return null;
    }
    const previousYearData = departments.map(dept => yearComparison.departmentComparison[dept].previous.spent);
    const currentYearData = departments.map(dept => yearComparison.departmentComparison[dept].current.spent);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          return params.map(param =>
            `${param.seriesName}: ${formatCurrency(param.value)}`
          ).join('<br/>');
        }
      },
      legend: {
        data: [
          `${yearComparison.previousYear} (Previous Year)`,
          `${yearComparison.currentYear} (Current Year)`
        ],
        top: 10
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: departments },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value) => `₹${(value / 1000).toFixed(0)}K`
        }
      },
      series: [
        {
          name: `${yearComparison.previousYear} (Previous Year)`,
          type: 'bar',
          data: previousYearData,
          itemStyle: { color: '#969696' }
        },
        {
          name: `${yearComparison.currentYear} (Current Year)`,
          type: 'bar',
          data: currentYearData,
          itemStyle: { color: '#667eea' }
        }
      ]
    };
  };

  const getDashboardTitle = () => {
    switch (user.role) {
      case 'department':
        return 'Department Budget Dashboard';
      case 'hod':
        return 'HOD Management Dashboard';
      case 'office':
        return 'Office Financial Dashboard';
      case 'vice_principal':
      case 'principal':
        return 'Management Overview Dashboard';
      case 'admin':
        return 'Administration Dashboard';
      default:
        return 'Budget Management Dashboard';
    }
  };

  const getKeyMetrics = () => {
    if (!dashboardData || !dashboardData.allocations || !dashboardData.expenditures) {
      return [
        { title: 'Total Budget', value: '₹0', icon: <Wallet size={24} />, color: '#667eea', change: '0%' },
        { title: 'Total Spent', value: '₹0', icon: <TrendingUp size={24} />, color: '#28a745', change: '0%' },
        { title: 'Remaining Budget', value: '₹0', icon: <PiggyBank size={24} />, color: '#ffc107', change: '0%' },
        { title: 'Utilization Rate', value: '0%', icon: <Percent size={24} />, color: '#17a2b8', change: '0%' }
      ];
    }

    const allocations = dashboardData.allocations;
    const expenditures = dashboardData.expenditures;

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const totalSpent = expenditures.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    const totalRemaining = totalAllocated - totalSpent;
    const utilizationPercentage = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    const getChange = (val, mockChange) => (val === 0 ? '0%' : mockChange);

    return [
      { title: 'Total Budget', value: formatCurrency(totalAllocated), icon: <Wallet size={24} />, color: 'var(--icon-bg-uniform)', change: null },
      { title: 'Total Spent', value: formatCurrency(totalSpent), icon: <TrendingUp size={24} />, color: 'var(--icon-bg-uniform)', change: null },
      { title: 'Remaining Budget', value: formatCurrency(totalRemaining), icon: <PiggyBank size={24} />, color: 'var(--icon-bg-uniform)', change: null },
      {
        title: 'Utilization Rate',
        value: `${utilizationPercentage.toFixed(1)}%`,
        icon: <Percent size={24} />,
        color: 'var(--icon-bg-uniform)',
        change: null
      }
    ];
  };

  if (loading) {
    return (
      <div className="graphical-dashboard-container">
        <div className="loading">
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="graphical-dashboard-container">
        <PageHeader
          title={getDashboardTitle()}
          subtitle="Real-time budget analytics and insights"
        >
          <div className="time-range-selector">
            <label>Time Range:</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="current">Current Year ({currentFY})</option>
              <option value="previous">Previous Year ({previousFY})</option>
            </select>
          </div>
          <button className="refresh-btn" onClick={fetchDashboardData}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </PageHeader>

        {/* Key Metrics */}
        <div className="metrics-grid">
          {getKeyMetrics().map((metric, index) => (
            <div key={index} className="card-standard metric-card">
              <div className="metric-icon" style={{ backgroundColor: metric.color, color: 'white' }}>
                {metric.icon}
              </div>
              <div className="metric-content">
                <h3>{metric.value}</h3>
                <p>{metric.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="charts-grid">
          {/* Budget Utilization Chart */}
          <div className="card-standard chart-card">
            <div className="card-standard-header">
              <h3>Budget Utilization by Head</h3>
              <p>Allocated vs Spent vs Remaining</p>
            </div>
            <div className="chart-container">
              {getBudgetUtilizationOption() ? (
                <ReactECharts option={getBudgetUtilizationOption()} style={{ height: '100%', width: '100%' }} />
              ) : (
                <div className="no-data-display">
                  <AlertCircle size={40} />
                  <p>No budget allocation data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Budget Head Distribution */}
          <div className="card-standard chart-card">
            <div className="card-standard-header">
              <h3>Budget Distribution</h3>
              <p>Allocation by Budget Head</p>
            </div>
            <div className="chart-container">
              {getBudgetHeadDistributionOption() ? (
                <ReactECharts option={getBudgetHeadDistributionOption()} style={{ height: '100%', width: '100%' }} />
              ) : (
                <div className="no-data-display">
                  <AlertCircle size={40} />
                  <p>No budget head data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Department Comparison (for Office/Management) */}
          {user.role !== 'department' && (
            <div className="card-standard chart-card">
              <div className="card-standard-header">
                <h3>Department Utilization</h3>
                <p>Budget utilization across departments</p>
              </div>
              <div className="chart-container">
                {getDepartmentComparisonOption() ? (
                  <ReactECharts option={getDepartmentComparisonOption()} style={{ height: '100%', width: '100%' }} />
                ) : (
                  <div className="no-data-display">
                    <AlertCircle size={40} />
                    <p>No department data available</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expenditure Trend */}
          <div className="card-standard chart-card">
            <div className="card-standard-header">
              <h3>Expenditure Trend</h3>
              <p>Monthly expenditure pattern</p>
            </div>
            <div className="chart-container">
              {getExpenditureTrendOption() ? (
                <ReactECharts option={getExpenditureTrendOption()} style={{ height: '100%', width: '100%' }} />
              ) : (
                <div className="no-data-display">
                  <AlertCircle size={40} />
                  <p>No expenditure data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Year-over-Year Comparison */}
          {user.role !== 'department' && (
            <div className="card-standard chart-card full-width">
              <div className="card-standard-header">
                <h3>Year-over-Year Spending Comparison</h3>
                {yearComparison ? (
                  <p>Compare department spending: {yearComparison.previousYear} vs {yearComparison.currentYear}</p>
                ) : (
                  <p>No comparison data available</p>
                )}
              </div>
              <div className="chart-container">
                {getYearComparisonOption() ? (
                  <ReactECharts option={getYearComparisonOption()} style={{ height: '100%', width: '100%' }} />
                ) : (
                  <div className="no-data-display">
                    <AlertCircle size={40} />
                    <p>No previous financial year data available</p>
                    <p className="no-data-hint">Please ensure data exists for both current and previous financial years</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Status */}
        {/* <div className="status-section">
          <div className="status-indicator">
            <div className="status-dot live"></div>
            <span>Live Data</span>
          </div>
          <div className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div> */}
      </div>
    </ErrorBoundary>
  );
};

export default GraphicalDashboard;
