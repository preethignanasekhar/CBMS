import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { expenditureAPI, budgetProposalAPI, allocationAPI, reportAPI, financialYearAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { CheckCircle, Paperclip, Check, X, ArrowRight, Wallet, PieChart, FileText, CreditCard, AlertCircle, Clock, Eye, IndianRupee, TrendingUp, ShieldCheck, Calendar, RefreshCw, Search } from 'lucide-react';
import { getCurrentFinancialYear } from '../utils/dateUtils';
import PageHeader from '../components/Common/PageHeader';
import StatusBadge from '../components/Common/StatusBadge';
import StatCard from '../components/Common/StatCard';
import ContentCard from '../components/Common/ContentCard';
import './HODDashboard.scss';

const HODDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [financialYears, setFinancialYears] = useState([]);
  const [targetYear, setTargetYear] = useState(getCurrentFinancialYear());
  const [tempYear, setTempYear] = useState(targetYear);
  const [statusFilter] = useState('pending'); // Action Zone: Only Pending Verification
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalAllocated: 0,
      totalUtilized: 0,
      totalRemaining: 0
    },
    budgetHeadBreakdown: {}
  });

  const calculateMonthlyTotals = (items) => {
    const totals = { 
        apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0 
    };
    if (!items) return totals;
    
    items.forEach(item => {
        if (item.monthlyBreakdown) {
            Object.keys(totals).forEach(month => {
                totals[month] += (item.monthlyBreakdown[month] || 0);
            });
        }
    });
    return totals;
  };

  useEffect(() => {
    fetchData();
    fetchFinancialYears();
  }, [statusFilter, targetYear]);

  const fetchFinancialYears = async () => {
    try {
      const response = await financialYearAPI.getFinancialYears();
      const years = response?.data?.data?.financialYears || [];
      setFinancialYears(Array.isArray(years) ? years.map(fy => fy.year) : []);
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
    setTempYear(`${startYear}-${startYear + 1}`);
  };

  const handleYearSearch = () => {
    setTargetYear(tempYear);
  };

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchExpenditures(),
        fetchProposals(),
        fetchDashboardStats()
      ]);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetYear, user.department]);

  const fetchDashboardStats = async () => {
    try {
      const response = await reportAPI.getDashboardReport({ financialYear: targetYear });
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
        totalAllocated: data.totalAllocated || 0,
        totalUtilized: data.totalUtilized || 0,
        totalRemaining: Math.max(0, (data.totalAllocated || 0) - (data.totalUtilized || 0))
      },
      budgetHeadBreakdown: data.budgetHeadBreakdown || {}
    });
  };

  const fetchExpenditures = async () => {
    try {
      const params = {
        departmentId: user.department?._id || user.department,
        status: statusFilter,
        financialYear: targetYear
      };

      // If pending, we specifically want items waiting for HOD
      if (statusFilter === 'pending') {
        params.currentApprover = 'hod';
      }

      const response = await expenditureAPI.getExpenditures({ ...params, limit: 1000 });
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
        department: user.department?._id || user.department,
        financialYear: targetYear
      };

      // Map dashboard filter to proposal status
      if (statusFilter === 'pending') {
        params.status = 'submitted,revised';
      } else if (statusFilter === 'verified') {
        // HOD verified means it's with Principal or Office now or simply verified by HOD
        params.status = 'verified_by_hod';
      } else if (statusFilter === 'approved') {
        params.status = 'approved';
      } else if (statusFilter === 'rejected') {
        params.status = 'rejected';
      }

      const response = await budgetProposalAPI.getBudgetProposals({ ...params, limit: 1000 });
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
    setLoading(true);
    try {
      const response = await budgetProposalAPI.getBudgetProposalById(proposal._id);
      if (response?.data?.success) {
        setSelectedProposal(response.data.data);
      } else {
        setSelectedProposal(proposal); 
      }
    } catch (err) {
      console.error('Failed to fetch full proposal detail:', err);
      setSelectedProposal(proposal);
    } finally {
      setLoading(false);
    }
    
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
        // Governance: Must mark as read if verifying or rejecting a proposal
        try { await budgetProposalAPI.markProposalAsRead(selectedProposal._id); } catch (e) { }

        if (action === 'approve') {
          await budgetProposalAPI.verifyBudgetProposal(selectedProposal._id, {
            remarks: approvalRemarks
          });
        } else {
          await budgetProposalAPI.rejectBudgetProposal(selectedProposal._id, {
            rejectionReason: approvalRemarks
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

  const chartOption = useMemo(() => {
    if (!dashboardData || !dashboardData.budgetHeadBreakdown || Object.keys(dashboardData.budgetHeadBreakdown).length === 0) {
      return null;
    }

    const data = Object.entries(dashboardData.budgetHeadBreakdown).map(([name, head]) => ({
      name,
      value: head.allocated
    })).filter(item => item.value > 0);

    if (data.length === 0) return null;

    return {
      title: {
        text: 'Budget Distribution',
        subtext: 'Allocation by Budget Head',
        left: 'center',
        top: '20px',
        textStyle: {
          fontSize: 24,
          fontWeight: '700',
          color: '#1e293b'
        },
        subtextStyle: {
          fontSize: 14,
          color: '#64748b'
        }
      },
      color: [
        '#2563eb', // Blue-600
        '#3b82f6', // Blue-500
        '#60a5fa', // Blue-400
        '#0ea5e9', // Sky-500
        '#38bdf8', // Sky-400
        '#4f46e5', // Indigo-600
        '#6366f1', // Indigo-500
        '#818cf8', // Indigo-400
        '#7c3aed', // Violet-600
        '#8b5cf6', // Violet-500
        '#a78bfa', // Lavender/Violet-400
        '#c4b5fd', // Light Lavender
        '#ddd6fe', // Extra Light Lavender
        '#9333ea', // Purple-600
        '#a855f7', // Purple-500
        '#c084fc', // Purple-400
        '#e9d5ff', // Purple-200
        '#1e40af', // Deep Blue-800
        '#3730a3', // Deep Indigo-800
        '#4c1d95'  // Deep Violet-900
      ],
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          return `${params.name}<br/>Allocated: ${formatCurrency(params.value)} (${params.percent}%)`;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#1e293b' }
      },
      legend: { 
        orient: 'vertical', 
        left: '5%',
        top: 'middle',
        itemGap: 15,
        textStyle: { 
          fontSize: 12,
          color: '#475569',
          fontWeight: '500'
        }
      },
      series: [{
        name: 'Budget Distribution',
        type: 'pie',
        radius: ['40%', '75%'],
        center: ['65%', '55%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold',
            formatter: '{d}%'
          },
          itemStyle: {
            shadowBlur: 15,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.15)'
          }
        },
        data: data
      }]
    };
  }, [dashboardData.budgetHeadBreakdown]);

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
        subtitle="Overview of departmental budget allocation, proposals, and event expenditures"
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
          <button className="btn btn-primary search-btn" onClick={handleYearSearch} style={{ minWidth: '32px', padding: '0', width: '32px', height: '32px' }}>
            <Search size={16} />
          </button>
          <button className="btn btn-secondary" onClick={fetchData} style={{ width: '32px', height: '32px', padding: '0' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </PageHeader>

      <div className="stats-grid-4 mb-5">
        <StatCard
          title="Total Budget"
          value={formatCurrency(dashboardData.stats.totalAllocated)}
          icon={<IndianRupee size={24} />}
          subtitle="Annual Allocation"
        />
        <StatCard
          title="Utilized Fund"
          value={formatCurrency(dashboardData.stats.totalUtilized)}
          icon={<TrendingUp size={24} />}
          color="var(--success)"
          subtitle="Finalized Expenses"
        />
        <StatCard
          title="Pending Queue"
          value={(expenditures.length + proposals.length)}
          icon={<Clock size={24} />}
          isPending={true}
          subtitle="Awaiting Your Review"
        />
        <StatCard
          title="Unspent Balance"
          value={formatCurrency(dashboardData.stats.totalRemaining)}
          icon={<Wallet size={24} />}
          subtitle={`Available for Sanction (${targetYear})`}
        />
      </div>



      {error && (
        <div className="error-message mb-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Budget Distribution Chart */}
      <div className="card-standard mb-5 p-0 overflow-hidden" style={{ minHeight: '450px' }}>
        {chartOption ? (
          <div className="chart-container" style={{ height: '450px', padding: '1rem' }}>
            <ReactECharts 
              option={chartOption} 
              style={{ height: '100%', width: '100%' }} 
              opts={{ renderer: 'svg' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-10 text-gray-400">
            <PieChart size={48} className="mb-2 opacity-20" />
            <p>No budget distribution data available for this year</p>
          </div>
        )}
      </div>

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

      <div className="quick-management mt-4">
        <div className="card-standard">
          <h3>Graphical Dashboard</h3>
          <p className="text-sm text-gray-500 mb-4">View detailed departmental analytics, budget charts, and localized reports.</p>
          <div className="flex gap-2">
            <button onClick={() => navigate('/hod-analytics')} className="btn btn-secondary flex items-center gap-2">
              <PieChart size={18} /> View Visual Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Proposal Approval Modal */}
      {showProposalModal && selectedProposal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-5xl">
            <div className="modal-header">
              <h3>Verify Budget Proposal: FY {selectedProposal.financialYear}</h3>
              <button className="modal-close" onClick={() => setShowProposalModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid mb-4">
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

              <div className="section-title mb-2">Itemized Budget Heads</div>
              <div className="table-container mb-4">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Budget Head</th>
                      <th style={{ textAlign: 'right' }}>Proposed Amount</th>
                      <th style={{ textAlign: 'right' }}>Reported Utilization</th>
                      <th style={{ textAlign: 'right' }}>Prev. Year Allocated</th>
                      <th style={{ textAlign: 'right' }}>Prev. Year Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProposal.proposalItems?.map((item, idx) => {
                      const bhId = item.budgetHead?._id || item.budgetHead;
                      const stats = previousYearStats[bhId] || {};
                      return (
                        <React.Fragment key={idx}>
                          <tr className="border-b hover:bg-gray-50">
                            <td>
                              <div className="font-bold text-gray-800">{item.budgetHead?.name || 'LoadingBudgetHead...'}</div>
                              {item.justification && <div className="text-xs text-gray-400 italic mt-1">{item.justification}</div>}
                            </td>
                            <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(item.proposedAmount)}</td>
                            <td style={{ textAlign: 'right' }}>{item.previousYearUtilization ? formatCurrency(item.previousYearUtilization) : '₹0'}</td>
                            <td style={{ textAlign: 'right' }}>{stats.allocated ? formatCurrency(stats.allocated) : '-'}</td>
                            <td style={{ textAlign: 'right' }}>{stats.allocated ? formatCurrency(stats.spent || 0) : '-'}</td>
                          </tr>
                          {item.proposedAmount > 0 && (
                            <tr>
                              <td colSpan="5" style={{ padding: '12px 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                                <div style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: '800', 
                                  color: '#64748b', 
                                  textTransform: 'uppercase', 
                                  marginBottom: '8px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px',
                                  letterSpacing: '0.025em'
                                }}>
                                  <Calendar size={14} style={{ color: 'var(--primary)' }} /> Monthly Expenditure Plan
                                </div>
                                <div style={{ 
                                          display: 'grid', 
                                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                                          gap: '10px 12px', 
                                          fontSize: '0.8rem',
                                          background: '#ffffff',
                                          padding: '1rem',
                                          borderRadius: '8px',
                                          border: '1px solid #e2e8f0',
                                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                                          boxSizing: 'border-box'
                                        }}>
                                          {['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'].map(m => (
                                            <div key={m} style={{ display: 'flex', flexDirection: 'column' }}>
                                              <span style={{ color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.6rem' }}>{m}</span>
                                              <span style={{ color: '#1e293b', fontWeight: '600' }}>{formatCurrency(item.monthlyBreakdown?.[m] || 0)}</span>
                                            </div>
                                          ))}
                                        </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Monthly Totals Summary Section */}
                  <tfoot style={{ borderTop: '2px solid #e2e8f0' }}>
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan="5" style={{ padding: '1.25rem' }}>
                        <div style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: '800', 
                            color: '#1e293b', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            marginBottom: '0.75rem',
                            textTransform: 'uppercase'
                        }}>
                          <TrendingUp size={16} style={{ color: 'var(--primary)' }} /> Consolidated Monthly Totals (Sum Data)
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                          gap: '10px 12px',
                          background: '#fff',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          {Object.entries(calculateMonthlyTotals(selectedProposal.proposalItems)).map(([month, total]) => (
                            <div key={month} style={{ display: 'flex', flexDirection: 'column', borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
                              <span style={{ color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.6rem' }}>{month} SUM</span>
                              <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.85rem' }}>{formatCurrency(total)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr style={{ background: '#f1f5f9', fontWeight: '800' }}>
                      <td colSpan="4" className="font-bold py-3 px-4">Grand Total Proposed</td>
                      <td style={{ textAlign: 'right' }} className="font-bold text-lg text-blue-700 py-3 px-4">
                        {formatCurrency(selectedProposal.totalProposedAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedProposal.notes && (
                <div className="notes-box mb-4" style={{ background: '#fff9db', padding: '0.75rem', borderRadius: '8px', borderLeft: '4px solid #fcc419' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#856404', display: 'block', marginBottom: '4px' }}>Proposal Notes / Information</label>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#495057', whiteSpace: 'pre-wrap' }}>{selectedProposal.notes}</p>
                </div>
              )}

              {selectedProposal.approvalSteps?.length > 0 && (
                <div className="approval-history mb-4" style={{ padding: '0.625rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #e9ecef' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#495057' }}>Activity History:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Show only the latest cycle of approval steps for clarity */}
                    {(() => {
                      const steps = selectedProposal.approvalSteps || [];
                      const lastSubmitIndex = [...steps].reverse().findIndex(s => s.decision === 'submit' || s.decision === 'resubmit');
                      const startIndex = lastSubmitIndex === -1 ? 0 : steps.length - 1 - lastSubmitIndex;
                      
                      const currentCycleSteps = steps.slice(startIndex);
                      const hasSubmissionInSteps = currentCycleSteps.some(s => s.decision === 'submit' || s.decision === 'resubmit');

                      return (
                        <>
                          {!hasSubmissionInSteps && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6c757d' }}></span>
                              <span style={{ color: '#6c757d' }}>Submitted</span>
                              <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                                {new Date(selectedProposal.submittedAt || selectedProposal.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {currentCycleSteps.map((step, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                background: step.decision === 'reject' ? '#dc3545' : 
                                           (['submit', 'resubmit'].includes(step.decision)) ? '#1c7ed6' : '#28a745' 
                              }}></span>
                              <span>
                                <strong style={{ textTransform: 'capitalize' }}>
                                  {step.decision === 'verify' ? 'Verified' : 
                                   step.decision === 'resubmit' ? 'Edited & Submitted' : 
                                   step.decision === 'submit' ? 'Submitted' : 
                                   step.decision}
                                </strong>
                                <span style={{ color: '#6c757d', marginLeft: '4px' }}>by {step.role?.toUpperCase()}</span>
                              </span>
                              <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>({new Date(step.timestamp).toLocaleDateString()})</span>
                              {step.remarks && <span style={{ fontStyle: 'italic', color: '#6c757d', marginLeft: '4px' }}>- "{step.remarks}"</span>}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="proposalRemarks">Verification Remarks <span className="text-xs font-normal text-gray-400">(Required for rejection)</span></label>
                <textarea
                  id="proposalRemarks"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Enter your remarks here..."
                  rows="2"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowProposalModal(false)} disabled={processing}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => processApproval('reject')} disabled={processing || !approvalRemarks.trim()}>
                Reject Proposal
              </button>
              <button className="btn btn-success btn-sm" onClick={() => processApproval('approve')} disabled={processing}>
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
              <div className="detail-grid mb-4">
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

              <div className="section-title mb-2">Itemized Expense Breakdown</div>
              <div className="table-container mb-4 overflow-x-auto">
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
                        <td style={{ textAlign: 'right' }}>
                          <div className="font-bold">{formatCurrency(item.amount)}</div>
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 justify-end">
                              {item.attachments.map((file, fIdx) => (
                                <a 
                                  key={fIdx} 
                                  href={file.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="attachment-link"
                                  title={file.originalName || 'View Bill'}
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    fontSize: '0.65rem', 
                                    background: '#e0f2f1', 
                                    color: '#00695c', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px',
                                    textDecoration: 'none',
                                    fontWeight: 'bold',
                                    border: '1px solid #b2dfdb'
                                  }}
                                >
                                  <Paperclip size={10} /> Bill {fIdx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
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

              {selectedExpenditure.approvalSteps?.length > 0 && (
                <div className="approval-history mb-4" style={{ padding: '0.625rem', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #e0f2fe' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0369a1' }}>Approval Trail:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedExpenditure.approvalSteps.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: step.decision === 'reject' ? '#dc3545' : '#10b981' }}></span>
                        <span>
                          <strong style={{ textTransform: 'capitalize' }}>{step.decision === 'verify' ? 'Verified' : step.decision}</strong>
                          <span style={{ color: '#64748b', marginLeft: '4px' }}>by {step.role?.toUpperCase()}</span>
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>({new Date(step.timestamp).toLocaleDateString()})</span>
                        {step.remarks && <span style={{ fontStyle: 'italic', color: '#475569', marginLeft: '4px' }}>- "{step.remarks}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="remarks">Remarks <span className="text-xs font-normal text-gray-400">(Required for rejection)</span></label>
                <textarea
                  id="remarks"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Enter your verification remarks..."
                  rows="2"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowApprovalModal(false)} disabled={processing}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => processApproval('reject')} disabled={processing || !approvalRemarks.trim()}>
                Reject
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => processApproval('approve')} disabled={processing}>
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
