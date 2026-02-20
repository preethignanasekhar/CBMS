import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { reportAPI } from '../services/api';
import { getCurrentFinancialYear } from '../utils/dateUtils';
import PageHeader from '../components/Common/PageHeader';
import StatCard from '../components/Common/StatCard';
import ContentCard from '../components/Common/ContentCard';
import AIInsightsPanel from '../components/AI/AIInsightsPanel';
import {
  Wallet,
  PieChart,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import './Dashboard.scss';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      requested: { value: 0, trend: 0 },
      approved: { value: 0, trend: 0 },
      utilized: { value: 0, trend: 0 },
      pending: { value: 0, trend: 0 },
      balance: { value: 0, trend: 0 }
    },
    activities: []
  });
  const [barChartOption, setBarChartOption] = useState({});
  const [pieChartOption, setPieChartOption] = useState({});
  const [hasBarData, setHasBarData] = useState(false);
  const [hasPieData, setHasPieData] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const { socket } = useSocket();

  // Real-time update listener
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      console.log('Real-time update received:', data);
      fetchData();
    };

    socket.on('dashboard_update', handleUpdate);

    return () => {
      socket.off('dashboard_update', handleUpdate);
    };
  }, [socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const currentFY = getCurrentFinancialYear();
      const response = await reportAPI.getDashboardReport({ financialYear: currentFY });

      if (response.data.success) {
        const { consolidated } = response.data.data;
        processDashboardData(consolidated);
      }
    } catch (error) {
      console.error("Dashboard fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  const processDashboardData = (data) => {
    // 1. Update Stats based on 5-Pillar requirement
    const requested = data.totalRequested || 0;
    const approved = data.totalAllocated || 0;
    const utilized = data.totalUtilized || 0;
    const pending = data.totalPendingApprovals || 0;
    const balance = data.remainingBalance || 0;

    setDashboardData({
      stats: {
        requested: { value: requested, trend: 0 },
        approved: { value: approved, trend: 0 },
        utilized: { value: utilized, trend: 0 },
        pending: { value: pending, trend: 0 },
        balance: { value: balance, trend: 0 }
      },
      activities: []
    });

    // 2. Process Bar Chart (Monthly Trend) - SAME LOGIC AS BEFORE
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const expenditureData = [];
    const trendMap = data.monthlyTrend || {};
    const [startYearStr] = data.financialYear.split('-');
    const startYear = parseInt(startYearStr);

    const orderedMonthsISO = [
      `${startYear}-04`, `${startYear}-05`, `${startYear}-06`,
      `${startYear}-07`, `${startYear}-08`, `${startYear}-09`,
      `${startYear}-10`, `${startYear}-11`, `${startYear}-12`,
      `${startYear + 1}-01`, `${startYear + 1}-02`, `${startYear + 1}-03`
    ];

    orderedMonthsISO.forEach(key => {
      expenditureData.push(trendMap[key] || 0);
    });

    const averageBudget = allocated / 12;
    const budgetData = Array(12).fill(Math.round(averageBudget));
    const hasAnyExpenditure = expenditureData.some(val => val > 0);
    setHasBarData(hasAnyExpenditure);

    setBarChartOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Avg. Monthly Budget', 'Expenditure'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: monthNames,
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      series: [
        {
          name: 'Avg. Monthly Budget',
          type: 'bar',
          data: budgetData,
          itemStyle: { color: '#0f172a', borderRadius: [4, 4, 0, 0] },
          barWidth: 12
        },
        {
          name: 'Expenditure',
          type: 'bar',
          data: expenditureData,
          itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
          barWidth: 12
        }
      ]
    });

    // 3. Process Pie Chart (Department Breakdown) - SAME LOGIC AS BEFORE
    const deptBreakdown = data.departmentBreakdown || {};
    const pieData = Object.keys(deptBreakdown).map((deptName, index) => ({
      value: deptBreakdown[deptName].spent,
      name: deptName,
      itemStyle: {
        color: ['#0f172a', '#2563eb', '#64748b', '#059669', '#d97706'][index % 5]
      }
    })).filter(item => item.value > 0);

    setHasPieData(pieData.length > 0);

    setPieChartOption({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: { bottom: 0, left: 'center' },
      series: [
        {
          name: 'Expenditure Distribution',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          data: pieData.length > 0 ? pieData : [{ value: 0, name: 'No Data' }]
        }
      ]
    });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Dashboard"
        subtitle="Financial Overview & Analytics"
      />

      {/* Top Stats Row - Using 5 Pillar Layout */}
      <div className="stats-grid-5">
        <StatCard
          title="Requested Amount"
          value={formatCurrency(dashboardData.stats.requested.value)}
          icon={<FileText size={20} />}
          tooltipText="Total amount proposed in initial budget proposals"
        />
        <StatCard
          title="Approved Budget"
          value={formatCurrency(dashboardData.stats.approved.value)}
          icon={<CheckCircle size={20} />}
          tooltipText="Total approved/allocated budget for the year"
        />
        <StatCard
          title="Utilized Amount"
          value={formatCurrency(dashboardData.stats.utilized.value)}
          icon={<CreditCard size={20} />}
          color="var(--success)"
          tooltipText="Total expenditure finalized and deducted"
        />
        <StatCard
          title="Pending Approval"
          value={formatCurrency(dashboardData.stats.pending.value)}
          icon={<Clock size={20} />}
          isPending={true}
          disclaimer="Not yet adjusted from approved budget"
          tooltipText="Expenditures awaiting final office approval"
        />
        <StatCard
          title="Remaining Balance"
          value={formatCurrency(dashboardData.stats.balance.value)}
          icon={<Wallet size={20} />}
          tooltipText="Approved Budget minus Utilized Amount"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-section">
        <ContentCard title="Budget vs. Expenditure (Financial Year)">
          {hasBarData ? (
            <ReactECharts option={barChartOption} style={{ height: '320px', width: '100%' }} />
          ) : (
            <div className="no-data-display">
              <AlertCircle size={40} />
              <p>No expenditure data available for this year</p>
            </div>
          )}
        </ContentCard>

        <ContentCard title="Department-wise Distribution">
          {hasPieData ? (
            <ReactECharts option={pieChartOption} style={{ height: '320px', width: '100%' }} />
          ) : (
            <div className="no-data-display">
              <AlertCircle size={40} />
              <p>No department expenditure data available</p>
            </div>
          )}
        </ContentCard>
      </div>

      {/* Recent Activity - Placeholder/Empty for now unless we fetch it separately or pass from main */}
      {/* 
         Since getDashboardReport doesn't return activities list, we might want to keep the old separate call
         OR just hide this section if no data. 
         For now, I'll assume we want to focus on charts. 
         But reusing the old 'expenditureAPI.getExpenditures' is safer if we want this table.
      */}

      {/* AI Insights Panel - Only visible to admin/office roles */}
      {['admin', 'office', 'principal', 'vice_principal'].includes(user?.role) && (
        <div className="ai-section">
          <AIInsightsPanel financialYear={getCurrentFinancialYear()} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
