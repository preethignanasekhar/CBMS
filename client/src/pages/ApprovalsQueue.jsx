import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenditureAPI, budgetProposalAPI, aiAPI, allocationAPI } from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import { 
  Check, X, Search, FileText, DollarSign, ClipboardList, Sparkles, 
  ArrowUpDown, Filter, Calendar, Paperclip, TrendingUp, IndianRupee 
} from 'lucide-react';
import Button from '../components/Common/Button';
import PageHeader from '../components/Common/PageHeader';
import StatusBadge from '../components/Common/StatusBadge';
import './ApprovalsQueue.scss';

const ApprovalsQueue = () => {
  const { user } = useAuth();
  const [approvalItems, setApprovalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'pending_approval' });
  const [aiSortEnabled, setAiSortEnabled] = useState(false);
  const [aiPriorityMap, setAiPriorityMap] = useState({});
  const [previousYearStats, setPreviousYearStats] = useState({});

  const fetchApprovals = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const getPropStatus = () => {
        if (filters.status === 'pending_approval') return 'pending_approval';
        if (filters.status === 'pending') return 'submitted';
        if (filters.status === 'verified') return 'verified_by_hod';
        if (filters.status === 'approved') return 'verified_by_principal';
        return filters.status;
      };

      const propParams = { ...filters };
      const expParams = { ...filters };

      if (filters.status === 'pending_approval') {
        if (['principal', 'vice_principal'].includes(user.role)) {
          propParams.status = 'verified_by_hod,verified';
          expParams.status = 'verified';
        } else if (['office', 'admin'].includes(user.role)) {
          propParams.status = 'verified_by_principal';
          expParams.status = 'approved';
        } else if (user.role === 'hod') {
          // HODs only see new submissions that need their verification
          propParams.status = 'submitted,revised';
          expParams.status = 'pending';
          
          // CRITICAL: HODs must be filtered by their department
          const deptId = user.department?._id || user.department;
          if (deptId) {
            propParams.department = deptId;
            expParams.departmentId = deptId;
          }
        }
      } else {
        propParams.status = getPropStatus();
      }

      const [expRes, propRes] = await Promise.all([
        expenditureAPI.getExpenditures(expParams),
        budgetProposalAPI.getBudgetProposals(propParams)
      ]);
      const expenditures = (expRes.data?.data?.expenditures || []).map(item => ({
        ...item,
        itemType: 'expenditure',
        reference: item.eventName || item.billNumber || 'Event-based Expenditure',
        amount: item.totalAmount || item.billAmount || 0,
        date: item.eventDate || item.billDate || item.createdAt
      }));

      const proposals = (propRes.data?.data?.proposals || propRes.data?.data?.budgetProposals || []).map(item => ({
        ...item,
        itemType: 'proposal',
        reference: item.department?.name || 'Department Proposal',
        amount: item.totalProposedAmount || item.proposalItems?.reduce((sum, i) => sum + (i.proposedAmount || 0), 0) || 0,
        date: item.createdAt
      }));

      const allItems = [...expenditures, ...proposals].sort((a, b) => new Date(b.date) - new Date(a.date));
      setApprovalItems(allItems);
    } catch (error) {
      console.error("Error fetching approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [filters, user]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const handleAction = async (item, type) => {
    if (item.itemType === 'proposal') {
      try {
        const response = await budgetProposalAPI.getBudgetProposalById(item._id);
        const proposal = response?.data?.data || item;
        setSelectedItem(proposal);

        // Fetch Previous Year Stats for context "the box containing everything"
        try {
          const currentFY = proposal.financialYear;
          const [startYear, endYear] = currentFY.split('-').map(Number);
          if (!isNaN(startYear) && !isNaN(endYear)) {
            const prevFY = `${startYear - 1}-${endYear - 1}`;
            const deptId = proposal.department?._id || proposal.department;
            if (deptId) {
              const [allocRes] = await Promise.all([
                allocationAPI.getAllocations({ financialYear: prevFY, department: deptId })
              ]);
              if (allocRes.data.success) {
                const statsMap = {};
                allocRes.data.data.allocations.forEach(alloc => {
                  const bhId = alloc.budgetHead?._id || alloc.budgetHead;
                  statsMap[bhId] = {
                    allocated: alloc.allocatedAmount,
                    spent: alloc.spentAmount || 0,
                  };
                });
                setPreviousYearStats(statsMap);
              }
            }
          }
        } catch (sErr) {
          console.error('Failed to fetch historical stats for verification:', sErr);
        }
      } catch (err) {
        console.error('Failed to fetch full proposal detail:', err);
        setSelectedItem(item);
      }
    } else {
      setSelectedItem(item);
    }
    setActionType(type);
    setRemarks('');
    setShowModal(true);
  };

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

  const getProposalMonthlySum = (proposal) => {
    const totals = calculateMonthlyTotals(proposal.proposalItems);
    return Object.values(totals).reduce((sum, val) => sum + val, 0);
  };

  const processAction = async () => {
    try {
      if (actionType === 'reject' && !remarks) {
        alert("Please provide remarks for rejection");
        return;
      }

      const api = selectedItem.itemType === 'expenditure' ? expenditureAPI : budgetProposalAPI;
      const id = selectedItem._id;

      if (selectedItem.itemType === 'expenditure') {
        if (actionType === 'verify') await api.verifyExpenditure(id, { remarks });
        else if (actionType === 'approve') await api.approveExpenditure(id, { remarks });
        else if (actionType === 'finalize') await api.finalizeExpenditure(id, { remarks });
        else if (actionType === 'reject') await api.rejectExpenditure(id, { remarks });
      } else {
        // Governance: Must mark as read if verifying or approving a proposal
        if (['verify', 'approve'].includes(actionType)) {
          try { await budgetProposalAPI.markProposalAsRead(id); } catch (e) { }
        }

        if (actionType === 'verify') await api.verifyBudgetProposal(id, { remarks });
        else if (actionType === 'approve') await api.approveBudgetProposal(id, { notes: remarks });
        else if (actionType === 'reject') await api.rejectBudgetProposal(id, { rejectionReason: remarks });
      }

      setShowModal(false);
      setSelectedItem(null);
      fetchApprovals();
    } catch (error) {
      console.error("Error processing action:", error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || "Failed to process action";
      alert(errorMsg);
    }
  };

  return (
    <div className="page-container approvals-queue-container">
      <PageHeader
        title="Approvals Queue"
        subtitle="Verify and approve departmental budget requests in this dashboard"
      />

      <div className="filters-section mb-4">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search by department or event name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="filter-dropdowns">
          <div className="filter-item">
            <span className="text-sm font-medium text-slate-500">Showing only pending requests</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state p-5 text-center">
          <div className="spinner-md mb-3"></div>
          <p className="text-gray-500">Loading approval items...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="approvals-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvalItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data-cell">
                    <div className="no-data-display">
                      <Sparkles size={48} />
                      <p>All caught up! No pending approvals found.</p>
                      <span className="no-data-hint">Any new requests from your department will appear here.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                approvalItems.map((item) => (
                  <tr key={item._id}>
                    <td className="date-cell">
                      <div className="date-wrapper">
                        <span className="date-text">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td className="type-cell">
                      <span className={`item-type-tag ${item.itemType === 'expenditure' ? 'exp' : 'prop'}`}>
                        {item.itemType === 'expenditure' ? <DollarSign size={12} /> : <ClipboardList size={12} />}
                        <span>{item.itemType.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="reference-cell">
                      <div className="reference-info">
                        <span className="reference-text text-gray-900 font-bold">{item.reference}</span>
                        <div className="text-xs text-gray-500">
                          {item.itemType === 'expenditure' ? (
                            <>
                              {item.eventType} | <span className="text-primary font-medium">{item.budgetHead?.name || 'Loading BH...'}</span>
                            </>
                          ) : (
                            <>
                              Annual Budget {item.financialYear} | {item.proposalItems?.length || 0} Items
                            </>
                          )}
                        </div>
                        {item.department?.name && user.role !== 'hod' && (
                          <span className="dept-tag text-gray-500">{item.department.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="amount-cell">
                      <span className="amount-text text-primary font-bold">{formatCurrency(item.amount)}</span>
                    </td>
                    <td className="status-cell">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="actions-cell text-right">
                      <div className="flex items-center space-x-2">
                        {/* HOD Action: Verify or Reject (Their Dept Only - API filters) */}
                        {
                          user?.role === 'hod' && (
                            <>
                              {((item.itemType === 'expenditure' && item.status === 'pending') ||
                                (item.itemType === 'proposal' && (item.status === 'submitted' || item.status === 'revised'))) && (
                                  <>
                                    <Tooltip text="Verify & Send Forward" position="top">
                                      <button className="btn-icon approve" onClick={() => handleAction(item, 'verify')}>
                                        <Check size={16} />
                                      </button>
                                    </Tooltip>
                                    <Tooltip text="Reject" position="top">
                                      <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                        <X size={16} />
                                      </button>
                                    </Tooltip>
                                  </>
                                )}
                            </>
                          )
                        }

                        {/* VP/Principal Action: Approve or Reject (Both Types) */}
                        {
                          ['vice_principal', 'principal'].includes(user?.role) &&
                          ((item.itemType === 'expenditure' && item.status === 'verified') ||
                            (item.itemType === 'proposal' && (item.status === 'verified_by_hod'))) && (
                            <>
                              <Tooltip text={item.itemType === 'expenditure' ? "Approve" : "Verify & Accept"} position="top">
                                <button
                                  className="btn-icon approve"
                                  onClick={() => handleAction(item, item.itemType === 'expenditure' ? 'approve' : 'verify')}
                                >
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                              <Tooltip text="Reject" position="top">
                                <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                  <X size={16} />
                                </button>
                              </Tooltip>
                            </>
                          )
                        }

                        {/* Office Action: Verify/Approve or Reject */}
                        {
                          ['office', 'admin'].includes(user?.role) && (
                            <>
                              {/* Expenditure Flow: Office only sanctions items approved by Management */}
                              {item.itemType === 'expenditure' && item.status === 'approved' && (
                                <Tooltip text="Final Sanction (Deduct Budget)" position="top">
                                  <button className="btn-icon approve" onClick={() => handleAction(item, 'finalize')}>
                                    <Check size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {item.itemType === 'expenditure' && item.status === 'approved' && (
                                <Tooltip text="Reject" position="top">
                                  <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                    <X size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {item.itemType === 'proposal' && item.status === 'verified_by_principal' && (
                                <Tooltip text="Allocate & Approve" position="top">
                                  <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                                    <Check size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {item.itemType === 'proposal' && item.status === 'verified_by_principal' && (
                                <Tooltip text="Reject" position="top">
                                  <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                    <X size={16} />
                                  </button>
                                </Tooltip>
                              )}
                            </>
                          )
                        }

                        {/* Hyphen Fallback - show only if user has no actions on this specific item */}
                        {!((user?.role === 'hod' && ((item.itemType === 'expenditure' && item.status === 'pending') || (item.itemType === 'proposal' && (item.status === 'submitted' || item.status === 'revised')))) ||
                          (['vice_principal', 'principal'].includes(user?.role) && ((item.itemType === 'expenditure' && item.status === 'verified') || (item.itemType === 'proposal' && item.status === 'verified_by_hod'))) ||
                          (['office', 'admin'].includes(user?.role) && ((item.itemType === 'expenditure' && item.status === 'approved') || (item.itemType === 'proposal' && item.status === 'verified_by_principal'))))
                          && <span className="date-text text-gray-400">-</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="approvals-modal">
            <div className="modal-header">
              <h3>
                {actionType === 'verify' && `Verify & Accept ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'} in principle`}
                {actionType === 'approve' && `${user.role === 'office' ? 'Allocate & Approve' : 'Approve'} ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
                {actionType === 'reject' && `Reject ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">

                {/* Detailed Item Information */}
                {selectedItem && (
                  <div className="item-details" style={{ 
                    margin: '1rem 0', 
                    padding: '1.25rem', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '16px', 
                    background: '#fff', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}>
                    <h4 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem' }}>
                      <FileText size={18} className="text-primary" />
                      Detailed Information
                    </h4>

                    {selectedItem.itemType === 'expenditure' ? (
                      <div className="expenditure-details" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                          <div className="detail-field">
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Event Name</span>
                            <strong style={{ color: '#0f172a' }}>{selectedItem.eventName}</strong>
                          </div>
                          <div className="detail-field">
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Type</span>
                            <strong style={{ color: '#0f172a' }}>{selectedItem.eventType}</strong>
                          </div>
                          <div className="detail-field">
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Budget Head</span>
                            <strong className="text-info" style={{ color: '#0284c7' }}>{selectedItem.budgetHead?.name || 'N/A'}</strong>
                          </div>
                          <div className="detail-field">
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Event Date</span>
                            <strong style={{ color: '#0f172a' }}>{selectedItem.eventDate ? new Date(selectedItem.eventDate).toLocaleDateString() : 'N/A'}</strong>
                          </div>
                          <div className="detail-field">
                            <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Total Amount</span>
                            <strong className="text-primary text-xl" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>{formatCurrency(selectedItem.totalAmount)}</strong>
                          </div>
                        </div>

                        <div className="items-list-preview" style={{ marginTop: '0.25rem' }}>
                          <h5 style={{ marginBottom: '0.75rem', color: '#334155', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                            <ClipboardList size={18} className="text-primary" /> Itemized Expenses
                          </h5>
                          <div className="overflow-x-auto rounded-lg border border-slate-100">
                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                                  <th style={{ padding: '8px 12px', color: '#64748b' }}>Vendor / Description</th>
                                  <th style={{ padding: '8px 12px', color: '#64748b' }}>Bill Info</th>
                                  <th style={{ padding: '8px 12px', color: '#64748b', textAlign: 'right' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedItem.expenseItems?.map((item, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px 20px' }}>
                                      <div className="font-bold text-slate-800" style={{ fontSize: '0.95rem' }}>{item.vendorName}</div>
                                      <div className="text-xs text-slate-500 mt-1.5">{item.description}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                      <div className="text-slate-700 font-bold">{item.billNumber}</div>
                                      <div className="text-xs text-slate-400 mt-1">{item.billDate ? new Date(item.billDate).toLocaleDateString() : ''}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>{formatCurrency(item.amount)}</div>
                                      {item.attachments && item.attachments.length > 0 && (
                                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                          {item.attachments.map((file, fIdx) => (
                                            <a 
                                              key={fIdx} 
                                              href={file.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              style={{ 
                                                fontSize: '0.65rem', 
                                                background: '#f1f5f9', 
                                                color: '#475569', 
                                                padding: '2px 6px', 
                                                borderRadius: '4px',
                                                textDecoration: 'none',
                                                border: '1px solid #e2e8f0',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: '600'
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
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="proposal-details" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: '#f8fafc', padding: '1.125rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Department</span>
                            <strong style={{ color: '#0f172a', fontSize: '1.1rem', wordBreak: 'break-word' }}>{selectedItem.department?.name || selectedItem.department}</strong>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Financial Year</span>
                            <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{selectedItem.financialYear}</strong>
                          </div>
                        </div>
                        
                        <div className="proposal-items-list" style={{ width: '100%', overflow: 'hidden' }}>
                          <h5 style={{ marginBottom: '1rem', color: '#1e293b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                            <ClipboardList size={20} className="text-primary" /> Budget Head Breakdown
                          </h5>
                          <div className="overflow-x-auto rounded-lg border border-slate-100">
                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                  <th style={{ padding: '8px 16px', color: '#475569', borderBottom: '2px solid #e2e8f0', fontWeight: '800' }}>Budget Head</th>
                                  <th style={{ padding: '8px 16px', color: '#475569', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: '800' }}>Prev Alloc</th>
                                  <th style={{ padding: '8px 16px', color: '#475569', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: '800' }}>Prev Spent</th>
                                  <th style={{ padding: '8px 16px', color: '#475569', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: '800' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedItem.proposalItems?.map((pItem, idx) => {
                                  const bhId = pItem.budgetHead?._id || pItem.budgetHead;
                                  const stats = previousYearStats[bhId] || {};
                                  return (
                                    <React.Fragment key={idx}>
                                      <tr style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                        <td style={{ padding: '12px 16px', borderBottom: pItem.monthlyBreakdown ? 'none' : '1px solid #f1f5f9' }}>
                                          <div className="font-bold text-slate-800" style={{ fontSize: '0.95rem' }}>{pItem.budgetHeadName || pItem.budgetHead?.name || 'N/A'}</div>
                                          {pItem.justification && <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>{pItem.justification}</div>}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: pItem.monthlyBreakdown ? 'none' : '1px solid #f1f5f9', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                                          {stats.allocated ? formatCurrency(stats.allocated) : '₹0'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: pItem.monthlyBreakdown ? 'none' : '1px solid #f1f5f9', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                                          {stats.allocated ? formatCurrency(stats.spent || 0) : '₹0'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: pItem.monthlyBreakdown ? 'none' : '1px solid #f1f5f9', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>
                                          {formatCurrency(pItem.proposedAmount)}
                                        </td>
                                      </tr>
                                      {pItem.monthlyBreakdown && (
                                        <tr>
                                          <td colSpan="4" style={{ padding: '0 20px 24px 20px', borderBottom: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <Calendar size={14} className="text-primary" /> Monthly Expenditure Plan
                                            </div>
                                            <div style={{ 
                                              display: 'grid', 
                                              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                              gap: '16px', 
                                              fontSize: '0.8rem',
                                              background: '#f8fafc',
                                              padding: '1.5rem',
                                              borderRadius: '12px',
                                              border: '1px solid #e2e8f0',
                                              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
                                              boxSizing: 'border-box'
                                            }}>
                                              {['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'].map(m => (
                                                <div key={m} style={{ display: 'flex', flexDirection: 'column' }}>
                                                  <span style={{ color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.6rem' }}>{m}</span>
                                                  <span style={{ color: '#334155', fontWeight: '700' }}>{formatCurrency(pItem.monthlyBreakdown?.[m] || 0)}</span>
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
                                <tr style={{ background: '#f0f4f8' }}>
                                  <td colSpan="4" style={{ padding: '16px' }}>
                                    <div style={{ 
                                        fontSize: '0.9rem', 
                                        fontWeight: '800', 
                                        color: '#1e293b', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '10px',
                                        marginBottom: '1rem' 
                                    }}>
                                      <TrendingUp size={18} className="text-primary" /> Consolidated Monthly Expenditure Totals (Sum Data)
                                    </div>
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                                      gap: '12px',
                                      background: '#fff',
                                      padding: '1.25rem',
                                      borderRadius: '10px',
                                      border: '1px solid #cbd5e1'
                                    }}>
                                      {Object.entries(calculateMonthlyTotals(selectedItem.proposalItems)).map(([month, total]) => (
                                        <div key={month} style={{ display: 'flex', flexDirection: 'column', borderLeft: '3px solid var(--primary)', paddingLeft: '8px' }}>
                                          <span style={{ color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.65rem' }}>{month} SUM</span>
                                          <span style={{ color: '#0f172a', fontWeight: '800', fontSize: '0.9rem' }}>{formatCurrency(total)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                                <tr style={{ background: '#f8fafc', fontWeight: '800' }}>
                                  <td style={{ padding: '12px 16px', color: '#1e293b', fontSize: '0.95rem' }}>Grand Total Proposed</td>
                                  <td colSpan="2"></td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontSize: '1.25rem' }}>{formatCurrency(selectedItem.totalProposedAmount || selectedItem.amount)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                        {selectedItem.notes && (
                          <div style={{ marginTop: '1.5rem', background: '#fefce8', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #facc15' }}>
                            <span style={{ color: '#854d0e', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Proposal Notes</span>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#713f12', whiteSpace: 'pre-wrap' }}>{selectedItem.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {selectedItem?.approvalSteps?.length > 0 && (
                <div className="approval-history" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.85rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#495057' }}>Activity History:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(() => {
                      const steps = selectedItem.approvalSteps || [];
                      const lastSubmitIndex = [...steps].reverse().findIndex(s => s.decision === 'submit' || s.decision === 'resubmit');
                      const startIndex = lastSubmitIndex === -1 ? 0 : steps.length - 1 - lastSubmitIndex;
                      
                      const currentCycleSteps = steps.slice(startIndex);
                      const hasSubmissionInSteps = currentCycleSteps.some(s => s.decision === 'submit' || s.decision === 'resubmit');

                      return (
                        <>
                          {!hasSubmissionInSteps && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6c757d' }}></span>
                              <span style={{ color: '#6c757d' }}>Submitted</span>
                              <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                                {new Date(selectedItem.submittedAt || selectedItem.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                          )}
                          {currentCycleSteps.map((step, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: step.decision === 'reject' ? '#dc3545' : 
                                           (['submit', 'resubmit'].includes(step.decision)) ? '#1c7ed6' : '#28a745' 
                              }}></span>
                              <span>
                                <strong>
                                  {step.decision === 'verify' ? 'Verified' : 
                                   step.decision === 'approve' ? 'Approved' : 
                                   step.decision === 'submit' ? 'Submitted' :
                                   step.decision === 'resubmit' ? 'Edited & Submitted' : 
                                   step.decision}
                                </strong>
                                <span style={{ color: '#6c757d', marginLeft: '4px' }}>by {step.role?.toUpperCase()}</span>
                              </span>
                              <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>({new Date(step.timestamp).toLocaleDateString()})</span>
                              {step.remarks && <span style={{ fontStyle: 'italic', color: '#6c757d' }}>- "{step.remarks}"</span>}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">
                  Remarks {actionType === 'reject' && <span style={{ color: 'red' }}>*</span>}
                </label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={actionType === 'reject' ? 'Reason for rejection is required' : 'Optional remarks'}
                ></textarea>
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                variant={actionType === 'reject' ? 'danger' : 'success'}
                onClick={processAction}
                disabled={actionType === 'reject' && !remarks.trim()}
              >
                Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsQueue;