import React, { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { allocationAPI, expenditureAPI, departmentsAPI, financialYearAPI, budgetProposalAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getCurrentFinancialYear } from '../utils/dateUtils';
import { 
  Building, 
  IndianRupee, 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Calendar, 
  RefreshCw,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  Zap,
  Target,
  ShieldCheck,
  Clock,
  Activity,
  CheckCircle2,
  Quote,
  Search
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import './InstitutionalDashboard.scss';

const InstitutionalDashboard = () => {
  const { user } = useAuth();
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [tempYear, setTempYear] = useState(financialYear);
  const [financialYears, setFinancialYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deptData, setDeptData] = useState([]);
  const [summary, setSummary] = useState({
    totalAllocated: 0,
    totalSpent: 0,
    utilization: 0
  });
  const [proposalStats, setProposalStats] = useState({
    submitted: 0,
    approved: 0,
    inReview: 0
  });

  const { socket } = useSocket();

  const fetchFinancialYears = async () => {
    try {
      const response = await financialYearAPI.getFinancialYears();
      const years = response?.data?.data?.financialYears || [];
      setFinancialYears(years.map(fy => fy.year));
    } catch (err) {
      console.error('Error fetching financial years:', err);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [deptsRes, allocsRes, expsRes, proposalsRes] = await Promise.all([
        departmentsAPI.getDepartments({ limit: 1000 }),
        allocationAPI.getAllocations({ financialYear, limit: 1000 }),
        expenditureAPI.getExpenditures({ financialYear, limit: 1000 }),
        budgetProposalAPI.getBudgetProposals({ financialYear, limit: 1000 })
      ]);

      const departments = deptsRes.data.data.departments;
      const allocations = allocsRes.data.data.allocations;
      const expenditures = expsRes.data.data.expenditures;

      const processedData = departments.map(dept => {
        const deptAllocations = allocations.filter(a => 
          (a.department?._id || a.department) === dept._id
        );
        const allocated = deptAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
        
        // Only count FINALIZED expenditures as actual spent (money truly disbursed)
        const deptExpenditures = expenditures.filter(e => 
          (e.department?._id || e.department) === dept._id
        );
        // Finalized = truly spent and deducted from allocation
        const spent = deptExpenditures
          .filter(e => e.status === 'finalized')
          .reduce((sum, e) => sum + (e.totalAmount || 0), 0);
        // Pending in pipeline (verified/approved but not yet finalized)
        const pipeline = deptExpenditures
          .filter(e => ['verified', 'approved'].includes(e.status))
          .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

        return {
          id: dept._id,
          name: dept.name,
          code: dept.code,
          allocated,
          spent,
          pipeline,
          remaining: allocated - spent,
          utilization: allocated > 0 ? (spent / allocated) * 100 : 0
        };
      }).filter(d => d.allocated > 0 || d.spent > 0 || d.pipeline > 0);

      const totalAllocated = processedData.reduce((sum, d) => sum + d.allocated, 0);
      const totalSpent = processedData.reduce((sum, d) => sum + d.spent, 0);

      const proposals = proposalsRes.data.data.proposals || [];
      const proposalData = {
        submitted: proposals.filter(p => p.status === 'submitted' || p.status === 'revised').length,
        approved: proposals.filter(p => p.status === 'approved' || p.status === 'verified_by_hod').length,
        inReview: proposals.filter(p => p.status === 'verified_by_hod').length
      };

      setDeptData(processedData);
      setProposalStats(proposalData);
      setSummary({
        totalAllocated,
        totalSpent,
        utilization: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching institutional dashboard data:', err);
      setError('Failed to load budget insights.');
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    fetchFinancialYears();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchData();
    socket.on('notification', handleUpdate);
    return () => socket.off('notification', handleUpdate);
  }, [socket, fetchData]);

  const handleDateToFY = (e) => {
    const date = new Date(e.target.value);
    if (isNaN(date.getTime())) return;
    const month = date.getMonth();
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    setTempYear(`${startYear}-${startYear + 1}`);
  };

  const handleYearSearch = () => {
    setFinancialYear(tempYear);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBarChartOption = () => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b' },
        formatter: (params) => {
          let res = `<div style="font-weight: 700; margin-bottom: 5px;">${params[0].name}</div>`;
          params.forEach(p => {
            res += `<div style="display: flex; justify-content: space-between; gap: 20px;">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight: 700;">${formatCurrency(p.value)}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { fontWeight: 600, color: '#64748b' }
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '15%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: deptData.map(d => d.code),
        axisLabel: { 
          fontWeight: 600, 
          color: '#64748b',
          interval: 0,
          rotate: 35
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value) => {
            if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
            if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
            return `₹${value / 1000}k`;
          },
          fontWeight: 600,
          color: '#64748b'
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
      },
      series: [
        {
          name: 'Total Budget Allocated',
          type: 'bar',
          data: deptData.map(d => d.allocated),
          itemStyle: {
            color: '#6366f1',
            borderRadius: [6, 6, 0, 0]
          },
          barMaxWidth: 30
        },
        {
          name: 'Total Amount Spent',
          type: 'bar',
          data: deptData.map(d => d.spent),
          itemStyle: {
            color: '#10b981',
            borderRadius: [6, 6, 0, 0]
          },
          barMaxWidth: 30
        }
      ]
    };
  };

  const getPieChartOption = () => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const dept = deptData.find(d => d.code === params.name);
          return `<div style="font-weight: 700;">${params.name} - ${dept?.name || ''}</div>
                  <div style="margin-top: 5px;">Allocation: ${formatCurrency(params.value)}</div>
                  <div>Share: ${params.percent}%</div>`;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b' }
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        type: 'scroll',
        icon: 'circle'
      },
      series: [
        {
          name: 'Budget Distribution',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              formatter: '{b}\n{d}%'
            }
          },
          data: deptData.map(d => ({
            name: d.code,
            value: d.allocated
          }))
        }
      ]
    };
  };

  const getFYProgress = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    // Academic year starts in April (index 3)
    let monthsElapsed = 0;
    if (currentMonth >= 3) {
      monthsElapsed = currentMonth - 2;
    } else {
      monthsElapsed = currentMonth + 10;
    }
    return Math.min(Math.round((monthsElapsed / 12) * 100), 100);
  };

  return (
    <div className="institutional-dashboard">
      <PageHeader 
        title="Institutional Financial Insights" 
        subtitle="Comprehensive visual analysis of budget vs expenditure across all departments"
      >
        <div className="header-actions-group">
           <div className="flexible-year-input">
              <Calendar size={14} className="text-secondary" />
              <input 
                className="year-input"
                value={tempYear}
                onChange={(e) => setTempYear(e.target.value)}
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
           <button className="btn btn-primary search-btn" onClick={handleYearSearch} style={{ minWidth: '32px', width: '32px', height: '32px', padding: '0' }}>
              <Search size={16} />
           </button>
           <button className="btn btn-secondary" onClick={fetchData} style={{ width: '32px', height: '32px', padding: '0' }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </PageHeader>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="stats-container">
        <StatCard 
          title="Consolidated Allocation" 
          value={formatCurrency(summary.totalAllocated)} 
          icon={<IndianRupee size={24} />}
          subtitle="Total institutional budget"
        />
        <StatCard 
          title="Total Expenditure" 
          value={formatCurrency(summary.totalSpent)} 
          icon={<TrendingUp size={24} />}
          color="#10b981"
          subtitle={`${summary.utilization.toFixed(1)}% of total budget`}
        />
        <StatCard 
          title="Departments Active" 
          value={deptData.length} 
          icon={<Building size={24} />}
          color="#6366f1"
          subtitle="Participating academic units"
        />
        <StatCard 
          title="Overall Balance" 
          value={formatCurrency(summary.totalAllocated - summary.totalSpent)} 
          icon={<Wallet size={24} />}
          color="#f59e0b"
          subtitle="Total available institutional fund"
        />
      </div>

      {/* AI Insights Section */}
      {!loading && (
        <div className="ai-insights-section">
          <div className="ai-container">
            <div className="ai-header">
              <div className="ai-title-group">
                <div className="title-main">
                  <Sparkles size={18} />
                  AI Insights
                </div>
                <div className="status-badges">
                  <div className="badge low-risk">
                    <ShieldCheck size={14} /> LOW RISK
                  </div>
                  <div className="badge behind">
                    <Clock size={14} /> Behind Schedule
                  </div>
                  <div className="badge trend">
                    <TrendingUp size={14} /> Trend: Stable
                  </div>
                </div>
              </div>
              <div className="update-time">
                <Clock /> Updated: Just now
              </div>
            </div>

            <div className="metrics-row">
              <div className="metric-mini-card">
                <label>Budget Utilization</label>
                <div className="value-large">{summary.utilization.toFixed(0)}%</div>
                <div className="sub-text">of {formatCurrency(summary.totalAllocated)} allocated</div>
                <div className="progress-bar-container">
                  <div className="fill" style={{ width: `${summary.utilization}%` }}></div>
                </div>
              </div>
              <div className="metric-mini-card">
                <label>Remaining Budget</label>
                <div className="value-large success">{formatCurrency(summary.totalAllocated - summary.totalSpent)}</div>
                <div className="sub-text">Spent: {formatCurrency(summary.totalSpent)}</div>
              </div>
            </div>

            <div className="metrics-row">
              <div className="metric-mini-card">
                <label>Budget Health</label>
                <div className="status-pill">Good</div>
                <div className="sub-text">Spending is within safe limits.</div>
              </div>
              <div className="metric-mini-card">
                <label>Burn Rate</label>
                <div className="sub-text" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  {summary.utilization < 10 ? 'Spending activity too low to estimate burn rate' : 'Normal spending velocity detected'}
                </div>
                <div className="sub-text">FY progress: {getFYProgress()}%</div>
              </div>
            </div>

            <div className="advisory-box">
              <div className="advisory-label">
                <Sparkles size={14} /> AI Advisory
              </div>
              <p>
                "Departments may consider scheduling planned activities or workshops to utilize the allocated budget effectively before year-end."
              </p>
            </div>

            <div className="activity-section">
              <div className="section-label">
                <Activity size={16} /> Proposal Activity
              </div>
              <div className="activity-grid">
                <div className="activity-item">
                  <span className="count">{proposalStats.submitted}</span>
                  <span className="label">Submitted</span>
                </div>
                <div className="activity-item">
                  <span className="count approved">{proposalStats.approved}</span>
                  <span className="label">Approved</span>
                </div>
                <div className="activity-item">
                  <span className="count">{proposalStats.inReview}</span>
                  <span className="label">In Review</span>
                </div>
              </div>
            </div>

            <div className="ai-footer">
              <div className="source">
                <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Data Source: Aggregated financial metrics
              </div>
              <div className="gen-tag">AI GENERATED INSIGHT</div>
            </div>
          </div>
        </div>
      )}

      <div className="charts-main-grid">
        {/* Bar Chart Section */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="title-box">
              <BarChart3 size={20} />
              <h3>Budget vs Expenditure Comparison</h3>
            </div>
            <p>Side-by-side analysis of allocated vs actual spending per department</p>
          </div>
          <div className="chart-body">
            {loading ? (
              <div className="chart-skeleton" />
            ) : (
              <ReactECharts option={getBarChartOption()} style={{ height: '400px', width: '100%' }} />
            )}
          </div>
        </div>

        {/* Pie Chart Section */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="title-box">
              <PieChart size={20} />
              <h3>Institution-wide Budget Share</h3>
            </div>
            <p>Percentage distribution of the total budget among departments</p>
          </div>
          <div className="chart-body">
            {loading ? (
              <div className="chart-skeleton" />
            ) : (
              <ReactECharts option={getPieChartOption()} style={{ height: '400px', width: '100%' }} />
            )}
          </div>
        </div>
      </div>

      {/* Department Quick List */}
      <div className="dept-quick-list-card">
        <div className="card-header">
          <h3>Department-wise Utilization Summary</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Allocated</th>
                <th>Spent</th>
                <th>Utilization</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {deptData.sort((a, b) => b.utilization - a.utilization).map(dept => (
                <tr key={dept.id}>
                  <td className="dept-cell">
                    <span className="code">{dept.code}</span>
                    <span className="name">{dept.name}</span>
                  </td>
                  <td>{formatCurrency(dept.allocated)}</td>
                  <td>{formatCurrency(dept.spent)}</td>
                  <td className="util-cell">
                    <span className={`badge ${dept.utilization > 90 ? 'high' : dept.utilization > 70 ? 'medium' : 'low'}`}>
                      {dept.utilization.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <div className="progress-mini">
                      <div 
                        className="fill" 
                        style={{ 
                          width: `${Math.min(dept.utilization, 100)}%`,
                          background: dept.utilization > 90 ? '#ef4444' : dept.utilization > 70 ? '#f59e0b' : '#10b981'
                        }} 
                      />
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

export default InstitutionalDashboard;
