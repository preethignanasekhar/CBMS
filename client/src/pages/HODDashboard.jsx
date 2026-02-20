import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { expenditureAPI, budgetProposalAPI, allocationAPI, reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { CheckCircle, Paperclip, Check, X, ArrowRight, Wallet, PieChart, FileText, CreditCard, AlertCircle, Clock, Eye } from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import StatusBadge from '../components/Common/StatusBadge';
import StatCard from '../components/Common/StatCard';
import ContentCard from '../components/Common/ContentCard';
import './HODDashboard.scss';

const HODDashboard = () => {
  const { user } = useAuth();
  const [expenditures, setExpenditures] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedExpenditure, setSelectedExpenditure] = useState(null);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [previousYearStats, setPreviousYearStats] = useState({});

  const { socket } = useSocket();
  const [statusFilter] = useState('pending'); // Action Zone: Only Pending Verification
  const [dashboardData, setDashboardData] = useState({
    stats: {
      requested: { value: 0 },
      approved: { value: 0 },
      utilized: { value: 0 },
      pending: { value: 0 }
    }
  });
  const [barChartOption, setBarChartOption] = useState({});
  const [pieChartOption, setPieChartOption] = useState({});
  const [eventChartOption, setEventChartOption] = useState({});
  const [hasBarData, setHasBarData] = useState(false);
  const [hasPieData, setHasPieData] = useState(false);
  const [hasEventData, setHasEventData] = useState(false);
  const [overallChartOption, setOverallChartOption] = useState({});

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      console.log('Real-time HOD update received:', data);
      fetchData(); // Refresh data on new notification
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, statusFilter]);

  const getProposalSectionTitle = () => {
    switch (statusFilter) {
      case 'pending': return 'Budget Proposals Awaiting Verification';
      case 'verified': return 'Verified Budget Proposals';
      case 'approved': return 'Sanctioned Budget Proposals';
      case 'rejected': return 'Rejected Budget Proposals';
      default: return 'Budget Proposals';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchExpenditures(),
      fetchProposals(),
      fetchDashboardStats()
    ]);
    setLoading(false);
  };

  const fetchDashboardStats = async () => {
    try {
      const currentYear = getCurrentFinancialYear();
      const response = await reportAPI.getDashboardReport({ financialYear: currentYear });
      if (response?.data?.success) {
        const consolidated = response?.data?.data?.consolidated;
        if (consolidated) processDashboardData(consolidated);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const processDashboardData = (data) => {
    setDashboardData({
      stats: {
        requested: { value: data.totalRequested || 0 },
        approved: { value: data.totalAllocated || 0 },
        utilized: { value: data.totalUtilized || 0 },
        pending: { value: data.totalPending || 0 }
      }
    });

    // Monthly Trend Chart
    const financialYear = data.financialYear || getCurrentFinancialYear();
    const startYear = parseInt(financialYear.split('-')[0]);
    const trendMap = data.monthlyTrend || {};

    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const monthlySpending = [];
    const orderedMonthsISO = [
      `${startYear}-04`, `${startYear}-05`, `${startYear}-06`,
      `${startYear}-07`, `${startYear}-08`, `${startYear}-09`,
      `${startYear}-10`, `${startYear}-11`, `${startYear}-12`,
      `${startYear + 1}-01`, `${startYear + 1}-02`, `${startYear + 1}-03`
    ];

    orderedMonthsISO.forEach(key => {
      monthlySpending.push(trendMap[key] || 0);
    });

    setHasBarData(monthlySpending.some(v => v > 0));

    setBarChartOption({
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params) => {
          const item = params[0];
          return `<b>${item.name}</b><br/>Total: ₹${item.value.toLocaleString('en-IN')}`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: monthNames,
        axisLabel: { color: '#374151', fontWeight: '600' }
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v) => `₹${v / 1000}k` } },
      series: [{
        name: 'Spending',
        type: 'line',
        smooth: true,
        data: monthlySpending,
        areaStyle: { opacity: 0.1 },
        itemStyle: { color: '#2563eb' }
      }]
    });

    // Recent Events Chart (Requested: Show X-axis labels (dates/events))
    const recentEvents = data.recentEvents || [];
    setHasEventData(recentEvents.length > 0);

    setEventChartOption({
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params) => {
          const ev = recentEvents[params.dataIndex];
          return `<b>${ev.name}</b><br/>Date: ${new Date(ev.date).toLocaleDateString()}<br/>Amount: <b>₹${ev.amount.toLocaleString('en-IN')}</b>`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '30%', containLabel: true },
      xAxis: {
        type: 'category',
        data: recentEvents.map(e => e.name.substring(0, 15) + (e.name.length > 15 ? '...' : '')),
        axisLabel: {
          interval: 0,
          rotate: 45,
          color: '#1f2937',
          fontWeight: '700',
          fontSize: 10
        }
      },
      yAxis: { type: 'value' },
      series: [{
        name: 'Event Expenditure',
        type: 'bar',
        data: recentEvents.map(e => e.amount),
        itemStyle: {
          color: (params) => ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6'][params.dataIndex % 5],
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: 30
      }]
    });

    // Budget Head Distribution
    const bhBreakdown = data.budgetHeadBreakdown || {};
    const pieData = Object.keys(bhBreakdown).map((name, index) => ({
      value: bhBreakdown[name].spent,
      name: name
    })).filter(item => item.value > 0);

    setPieChartOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', confine: true },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: pieData,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 }
      }]
    });

    // Overall Budget Status Chart (Unexpended vs Utilized)
    const totalAllocated = data.totalAllocated || 0;
    const totalUtilized = data.totalUtilized || 0;
    const totalRemaining = Math.max(0, totalAllocated - totalUtilized);

    setOverallChartOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['60%', '85%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '18', fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: totalUtilized, name: 'Utilized', itemStyle: { color: '#2563eb' } },
          { value: totalRemaining, name: 'Unexpended', itemStyle: { color: '#e2e8f0' } }
        ]
      }]
    });
  };

  const getCurrentFinancialYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const fetchExpenditures = async () => {
    try {
      const params = {
        departmentId: user.department?._id || user.department,
        status: statusFilter
      };

      // If pending, we specifically want items waiting for HOD
      if (statusFilter === 'pending') {
        params.currentApprover = 'hod';
      }

      const response = await expenditureAPI.getExpenditures(params);
      setExpenditures(Array.isArray(response?.data?.data?.expenditures) ? response.data.data.expenditures : []);
    } catch (err) {
      console.error('Error fetching expenditures:', err);
      // Don't set global error yet, just log
    }
  };

  const fetchProposals = async () => {
    try {
      setProposalsLoading(true);
      const params = {
        department: user.department?._id || user.department
      };

      // Map dashboard filter to proposal status
      if (statusFilter === 'pending') {
        params.status = 'submitted';
      } else if (statusFilter === 'verified') {
        // HOD verified means it's with Principal or Office now or simply verified by HOD
        params.status = 'verified_by_hod';
      } else if (statusFilter === 'approved') {
        params.status = 'approved';
      } else if (statusFilter === 'rejected') {
        params.status = 'rejected';
      }

      const response = await budgetProposalAPI.getBudgetProposals(params);
      setProposals(Array.isArray(response?.data?.data?.proposals) ? response.data.data.proposals : []);
    } catch (err) {
      console.error('Error fetching budget proposals:', err);
    } finally {
      setProposalsLoading(false);
    }
  };

  const handleApprove = (expenditure) => {
    setSelectedExpenditure(expenditure);
    setSelectedProposal(null);
    setApprovalRemarks('');
    setShowApprovalModal(true);
  };

  const handleReject = (expenditure) => {
    setSelectedExpenditure(expenditure);
    setSelectedProposal(null);
    setApprovalRemarks('');
    setShowApprovalModal(true);
  };

  const handleProposalVerify = async (proposal) => {
    setSelectedProposal(proposal);
    setSelectedExpenditure(null);
    setApprovalRemarks('');
    setShowProposalModal(true);
    setPreviousYearStats({});

    // Auto-mark as read
    budgetProposalAPI.markProposalAsRead(proposal._id).catch(err => {
      console.error('Failed to mark proposal as read:', err);
    });

    // Fetch Previous Year Stats
    try {
      const currentFY = proposal.financialYear;
      const [startYear, endYear] = currentFY.split('-').map(Number);

      if (!isNaN(startYear) && !isNaN(endYear)) {
        const prevFY = `${startYear - 1}-${endYear - 1}`;
        // For HOD Dashboard, we know the department is user's department
        const deptId = user.department?._id || user.department;

        if (deptId) {
          const allocRes = await allocationAPI.getAllocations({
            financialYear: prevFY,
            department: deptId
          });

          if (allocRes.data.success) {
            const statsMap = {};
            allocRes.data.data.allocations.forEach(alloc => {
              const bhId = alloc.budgetHead._id || alloc.budgetHead;
              statsMap[bhId] = {
                allocated: alloc.allocatedAmount,
                spent: alloc.spentAmount || 0,
              };
            });
            setPreviousYearStats(statsMap);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch previous year stats:', err);
    }
  };

  const handleProposalReject = (proposal) => {
    setSelectedProposal(proposal);
    setSelectedExpenditure(null);
    setApprovalRemarks('');
    setShowProposalModal(true);
  };

  const processApproval = async (action) => {
    setProcessing(true);
    try {
      if (selectedExpenditure) {
        if (action === 'approve') {
          await expenditureAPI.verifyExpenditure(selectedExpenditure._id, {
            remarks: approvalRemarks
          });
        } else {
          await expenditureAPI.rejectExpenditure(selectedExpenditure._id, {
            remarks: approvalRemarks
          });
        }
        setShowApprovalModal(false);
        setSelectedExpenditure(null);
      } else if (selectedProposal) {
        if (action === 'approve') {
          await budgetProposalAPI.verifyBudgetProposal(selectedProposal._id, {
            remarks: approvalRemarks
          });
        } else {
          await budgetProposalAPI.rejectBudgetProposal(selectedProposal._id, {
            remarks: approvalRemarks
          });
        }
        setShowProposalModal(false);
        setSelectedProposal(null);
      }

      setApprovalRemarks('');
      await fetchData(); // Refresh all data
    } catch (err) {
      const verb = action === 'approve' ? 'verify' : 'reject';
      const noun = selectedExpenditure ? 'expenditure' : 'proposal';
      setError(`Failed to ${verb} ${noun}. ${err.response?.data?.message || err.message}`);
      console.error(`Error ${action}ing:`, err);
    } finally {
      setProcessing(false);
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
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="hod-dashboard-container">
        <div className="loading">Loading HOD dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-container hod-dashboard-container">
      <PageHeader
        title="HOD Dashboard"
        subtitle="Manage expenditures from your department"
      />

      <div className="stats-grid-4 mb-5">
        <StatCard
          title="Total Requested"
          value={formatCurrency(dashboardData.stats.requested.value)}
          icon={<FileText size={20} />}
          subtitle="Pending Event Requests"
        />
        <StatCard
          title="Approved Budget"
          value={formatCurrency(dashboardData.stats.approved.value)}
          icon={<CheckCircle size={20} />}
          subtitle="Annual Allocated Fund"
        />
        <StatCard
          title="Utilized Amount"
          value={formatCurrency(dashboardData.stats.utilized.value)}
          icon={<CreditCard size={20} />}
          color="var(--success)"
          subtitle="Finalized Expenditures"
        />
        <StatCard
          title="Pending Amount"
          value={formatCurrency(dashboardData.stats.pending.value)}
          icon={<Clock size={20} />}
          isPending={true}
          subtitle="Awaiting Final Sanction"
        />
      </div>

      <div className="charts-section mb-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <ContentCard title="Budget Utilization (Finalized)">
          <div style={{ position: 'relative', height: '300px' }}>
            <ReactECharts option={overallChartOption} style={{ height: '300px' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Utilized</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>
                {dashboardData.stats.approved.value > 0
                  ? Math.round((dashboardData.stats.utilized.value / dashboardData.stats.approved.value) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        </ContentCard>

        <ContentCard title="Expenditure Trend (Finalized)">
          {hasBarData ? (
            <ReactECharts option={barChartOption} style={{ height: '350px' }} />
          ) : (
            <div className="no-data-display p-5 text-center text-gray-500 flex flex-col items-center justify-center" style={{ height: '350px' }}>
              <AlertCircle size={40} className="mb-2 opacity-20" />
              <p>No finalized expenditure trend data available</p>
            </div>
          )}
        </ContentCard>

        <ContentCard title="Budget Head Utilization">
          {hasPieData ? (
            <ReactECharts option={pieChartOption} style={{ height: '350px' }} />
          ) : (
            <div className="no-data-display p-5 text-center text-gray-500 flex flex-col items-center justify-center" style={{ height: '350px' }}>
              <Wallet size={40} className="mb-2 opacity-20" />
              <p>No utilization data available</p>
            </div>
          )}
        </ContentCard>
      </div>

      {error && (
        <div className="error-message mb-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="approvals-section">
        <div className="section-header">
          <div className="header-left">
            <h2>Pending Approvals & Requests</h2>
            <span className="count-badge">{proposals.length + expenditures.length}</span>
          </div>
        </div>

        <div className="table-container card-standard p-0 overflow-hidden border-0 shadow-sm">
          <table className="approvals-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Event / Proposal Name</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.length === 0 && expenditures.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-gray-500">
                    <div className="flex flex-col items-center gap-2 py-8">
                      <CheckCircle size={48} className="text-gray-200" />
                      <p className="font-medium">No pending requests for verification</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Render Proposals */}
                  {proposals.map(proposal => (
                    <tr key={proposal._id}>
                      <td><span className="type-tag proposal">Budget Proposal</span></td>
                      <td>
                        <div className="font-bold">Annual Budget {proposal.financialYear}</div>
                        <div className="text-xs text-gray-500">{proposal.department?.name}</div>
                      </td>
                      <td>{formatDate(proposal.submittedAt || proposal.createdAt)}</td>
                      <td className="font-bold text-blue-600">{formatCurrency(proposal.totalProposedAmount)}</td>
                      <td><StatusBadge status={proposal.status} /></td>
                      <td>
                        <div className="action-buttons-mini" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn-verify" onClick={() => handleProposalVerify(proposal)}>
                            <Check size={14} /> Verify
                          </button>
                          <button className="btn-reject-mini" onClick={() => handleProposalReject(proposal)}>
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Render Expenditures */}
                  {expenditures.map(exp => (
                    <tr key={exp._id}>
                      <td><span className="type-tag expenditure">Event Expenditure</span></td>
                      <td>
                        <div className="font-bold">{exp.eventName}</div>
                        <div className="text-xs text-gray-500">{exp.eventType} | {exp.budgetHead?.name}</div>
                      </td>
                      <td>{formatDate(exp.eventDate)}</td>
                      <td className="font-bold text-emerald-600">{formatCurrency(exp.totalAmount)}</td>
                      <td><StatusBadge status={exp.status} /></td>
                      <td>
                        <div className="action-buttons-mini" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn-verify" onClick={() => handleApprove(exp)}>
                            <Check size={14} /> Verify
                          </button>
                          <button className="btn-reject-mini" onClick={() => handleReject(exp)}>
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proposal Approval Modal */}
      {showProposalModal && selectedProposal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-4xl">
            <div className="modal-header">
              <h3>Verify Budget Proposal: FY {selectedProposal.financialYear}</h3>
              <button className="modal-close" onClick={() => setShowProposalModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid mb-6">
                <div className="detail-item">
                  <label>Department</label>
                  <div>{selectedProposal.departmentName || selectedProposal.department?.name}</div>
                </div>
                <div className="detail-item">
                  <label>Financial Year</label>
                  <div>{selectedProposal.financialYear}</div>
                </div>
                <div className="detail-item">
                  <label>Submitted By</label>
                  <div>{selectedProposal.submittedBy?.name}</div>
                </div>
                <div className="detail-item">
                  <label>Total Proposed Amount</label>
                  <div className="text-lg font-bold text-blue-600">{formatCurrency(selectedProposal.totalProposedAmount)}</div>
                </div>
              </div>

              <div className="section-title mb-3">Itemized Budget Heads</div>
              <div className="table-container mb-6">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Budget Head</th>
                      <th style={{ textAlign: 'right' }}>Prev. Year Allocated</th>
                      <th style={{ textAlign: 'right' }}>Prev. Year Spent</th>
                      <th style={{ textAlign: 'right' }}>Proposed Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProposal.proposalItems?.map((item, idx) => {
                      const bhId = item.budgetHead?._id || item.budgetHead;
                      const stats = previousYearStats[bhId] || {};
                      return (
                        <tr key={idx}>
                          <td>
                            <div className="font-medium">{item.budgetHead?.name}</div>
                            <div className="text-xs text-gray-500">{item.budgetHead?.category}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{stats.allocated ? formatCurrency(stats.allocated) : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{stats.allocated ? formatCurrency(stats.spent || 0) : '-'}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(item.proposedAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="font-bold">Total</td>
                      <td style={{ textAlign: 'right' }} className="font-bold text-lg text-blue-700">
                        {formatCurrency(selectedProposal.totalProposedAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedProposal.description && (
                <div className="description-box mb-6">
                  <label>Justification / Description</label>
                  <p>{selectedProposal.description}</p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="proposalRemarks">Verification Remarks <span className="text-xs font-normal text-gray-400">(Required for rejection)</span></label>
                <textarea
                  id="proposalRemarks"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Enter your remarks here..."
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProposalModal(false)} disabled={processing}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => processApproval('reject')} disabled={processing || !approvalRemarks.trim()}>
                Reject Proposal
              </button>
              <button className="btn btn-success" onClick={() => processApproval('approve')} disabled={processing}>
                {processing ? 'Processing...' : 'Verify & Forward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenditure Approval Modal */}
      {showApprovalModal && selectedExpenditure && (
        <div className="modal-overlay">
          <div className="modal-content max-w-5xl">
            <div className="modal-header">
              <h3>Verify Event Expenditure</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid mb-6">
                <div className="detail-item">
                  <label>Event Name</label>
                  <div className="font-bold">{selectedExpenditure.eventName}</div>
                </div>
                <div className="detail-item">
                  <label>Type</label>
                  <div>{selectedExpenditure.eventType}</div>
                </div>
                <div className="detail-item">
                  <label>Event Date</label>
                  <div>{formatDate(selectedExpenditure.eventDate)}</div>
                </div>
                <div className="detail-item">
                  <label>Budget Head</label>
                  <div>{selectedExpenditure.budgetHead?.name}</div>
                </div>
                <div className="detail-item">
                  <label>Coordinator</label>
                  <div>{selectedExpenditure.submittedBy?.name}</div>
                </div>
                <div className="detail-item">
                  <label>Total Amount</label>
                  <div className="text-xl font-black text-emerald-700">{formatCurrency(selectedExpenditure.totalAmount)}</div>
                </div>
              </div>

              <div className="section-title mb-3">Itemized Expense Breakdown</div>
              <div className="table-container mb-6 overflow-x-auto">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Vendor Details</th>
                      <th>Bill Info</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedExpenditure.expenseItems?.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.vendorName}</td>
                        <td>
                          <div className="text-sm font-medium">{item.billNumber}</div>
                          <div className="text-xs text-gray-500">{formatDate(item.billDate)}</div>
                        </td>
                        <td><span className="badge-gray">{item.category}</span></td>
                        <td className="text-xs max-w-xs">{item.description}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50">
                      <td colSpan="4" className="font-bold">Total Claimed</td>
                      <td style={{ textAlign: 'right' }} className="font-bold text-lg text-emerald-800">
                        {formatCurrency(selectedExpenditure.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="form-group">
                <label htmlFor="remarks">Remarks <span className="text-xs font-normal text-gray-400">(Required for rejection)</span></label>
                <textarea
                  id="remarks"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Enter your verification remarks..."
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApprovalModal(false)} disabled={processing}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => processApproval('reject')} disabled={processing || !approvalRemarks.trim()}>
                Reject
              </button>
              <button className="btn btn-primary" onClick={() => processApproval('approve')} disabled={processing}>
                {processing ? 'Processing...' : 'Verify & Forward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODDashboard;
