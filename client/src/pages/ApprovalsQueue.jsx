import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenditureAPI, budgetProposalAPI, aiAPI, allocationAPI } from '../services/api';
import Tooltip from '../components/Tooltip/Tooltip';
import { Check, X, Search, FileText, DollarSign, ClipboardList, Sparkles, ArrowUpDown, Filter } from 'lucide-react';
import Button from '../components/Common/Button';
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
    try {
      setLoading(true);
      const getPropStatus = () => {
        if (filters.status === 'pending_approval') {
          // If filtering for "My Approvals", we let the backend handle the role-based complex query
          return 'pending_approval'; // Actually, let's use a special flag or just 'submitted,verified'
        }
        if (filters.status === 'pending') return 'submitted';
        return filters.status;
      };

      const propParams = { ...filters };
      if (filters.status === 'pending_approval') {
        // Special mapping for budgetProposalAPI.getBudgetProposals to hit our new controller logic
        if (user.role === 'hod') propParams.status = 'submitted';
        else if (['principal', 'vice_principal'].includes(user.role)) propParams.status = 'verified_by_hod';
        else if (user.role === 'office') propParams.status = 'verified_by_principal';
      } else {
        propParams.status = getPropStatus();
      }

      const [expRes, propRes] = await Promise.all([
        expenditureAPI.getExpenditures(filters),
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
        amount: item.totalProposedAmount || item.items?.reduce((sum, i) => sum + (i.proposedAmount || 0), 0) || 0,
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

  const handleAction = (item, type) => {
    setSelectedItem(item);
    setActionType(type);
    setRemarks('');
    setShowModal(true);
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
        else if (actionType === 'reject') await api.rejectExpenditure(id, { remarks });
      } else {
        if (actionType === 'verify') await api.verifyBudgetProposal(id, { remarks });
        else if (actionType === 'approve') await api.approveBudgetProposal(id, { remarks });
        else if (actionType === 'reject') await api.rejectBudgetProposal(id, { remarks });
      }

      setShowModal(false);
      setSelectedItem(null);
      fetchApprovals();
    } catch (error) {
      console.error("Error processing action:", error);
      alert("Failed to process action");
    }
  };

  return (
    <div className="page-container approvals-queue-container">
      <div className="approvals-header mb-5">
        <div className="header-left">
          <h1 className="page-title">Approvals Queue</h1>
          <p className="page-subtitle">Verify and approve departmental budget requests</p>
        </div>
        <div className="header-right">
          <div className="queue-stats">
            <div className="stat-badge pending">
              <ClipboardList size={16} />
              <span>{approvalItems.filter(i => i.status.includes('pending') || i.status === 'submitted').length} Pending</span>
            </div>
          </div>
        </div>
      </div>

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
            <Filter size={16} />
            <select
              className="filter-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="pending_approval">Pending My Approval</option>
              <option value="verified">Verified by HOD</option>
              <option value="approved">Approved by Principal</option>
              <option value="finalized">Finalized</option>
              <option value="rejected">Rejected</option>
            </select>
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
                        {item.department?.name && <span className="dept-tag text-gray-500">{item.department.name}</span>}
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
                          user?.role === 'office' && (
                            <>
                              {/* Expenditure Flow: Office only sanctions items approved by Management */}
                              {item.itemType === 'expenditure' && item.status === 'approved' && (
                                <Tooltip text="Final Sanction (Deduct Budget)" position="top">
                                  <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                                    <Check size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {item.itemType === 'expenditure' && ['approved'].includes(item.status) && (
                                <Tooltip text="Reject" position="top">
                                  <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                    <X size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {/* Proposal Flow: Office only allocates items verified by Management */}
                              {item.itemType === 'proposal' && item.status === 'verified_by_principal' && (
                                <Tooltip text="Allocate & Approve" position="top">
                                  <button className="btn-icon approve" onClick={() => handleAction(item, 'approve')}>
                                    <Check size={16} />
                                  </button>
                                </Tooltip>
                              )}
                              {item.itemType === 'proposal' && ['verified_by_principal'].includes(item.status) && (
                                <Tooltip text="Reject" position="top">
                                  <button className="btn-icon reject" onClick={() => handleAction(item, 'reject')}>
                                    <X size={16} />
                                  </button>
                                </Tooltip>
                              )}
                            </>
                          )
                        }

                        {['approved', 'rejected', 'verified'].includes(item.status) && <span className="date-text">-</span>}
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
          <div className="modal">
            <div className="modal-header">
              <h3>
                {actionType === 'verify' && `Verify & Accept ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
                {actionType === 'approve' && `${user.role === 'office' ? 'Allocate & Approve' : 'Approve'} ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
                {actionType === 'reject' && `Reject ${selectedItem?.itemType === 'expenditure' ? 'Expenditure' : 'Budget Proposal'}`}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to {actionType} <strong>{selectedItem?.reference}</strong>?</p>

              {/* Detailed Item Information */}
              {selectedItem && (
                <div className="item-details" style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #dee2e6', borderRadius: '4px', background: '#fff' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#212529', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Details</h4>

                  {selectedItem.itemType === 'expenditure' ? (
                    <div className="expenditure-details">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                        <div><span style={{ color: '#6c757d' }}>Event Name:</span> <strong>{selectedItem.eventName}</strong></div>
                        <div><span style={{ color: '#6c757d' }}>Event Type:</span> <strong>{selectedItem.eventType}</strong></div>
                        <div><span style={{ color: '#6c757d' }}>Event Date:</span> <strong>{selectedItem.eventDate ? new Date(selectedItem.eventDate).toLocaleDateString() : 'N/A'}</strong></div>
                        <div><span style={{ color: '#6c757d' }}>Total Amount:</span> <strong className="text-primary">{formatCurrency(selectedItem.totalAmount)}</strong></div>
                      </div>

                      <div className="items-list-preview" style={{ marginTop: '1rem' }}>
                        <h5 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Expense Items</h5>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                              <th style={{ padding: '4px' }}>Vendor</th>
                              <th style={{ padding: '4px' }}>Bill #</th>
                              <th style={{ padding: '4px', textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.expenseItems?.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '4px', borderBottom: '1px solid #f8f9fa' }}>{item.vendorName}</td>
                                <td style={{ padding: '4px', borderBottom: '1px solid #f8f9fa' }}>{item.billNumber}</td>
                                <td style={{ padding: '4px', borderBottom: '1px solid #f8f9fa', textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="proposal-details">
                      <div style={{ marginBottom: '10px' }}>
                        <span style={{ color: '#6c757d' }}>Department:</span> <strong>{selectedItem.department}</strong>
                      </div>
                      <div className="proposal-items-list">
                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                              <th style={{ padding: '6px', borderBottom: '1px solid #dee2e6' }}>Budget Head</th>
                              <th style={{ padding: '6px', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>Prev Alloc</th>
                              <th style={{ padding: '6px', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>Prev Spent</th>
                              <th style={{ padding: '6px', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItem.proposalItems?.map((pItem, idx) => {
                              const bhId = pItem.budgetHead?._id || pItem.budgetHead;
                              const stats = previousYearStats[bhId] || {};
                              return (
                                <tr key={idx}>
                                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                                    {pItem.budgetHeadName || pItem.budgetHead?.name || 'N/A'}
                                    {pItem.justification && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{pItem.justification}</div>}
                                  </td>
                                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', color: '#6c757d' }}>
                                    {stats.allocated ? formatCurrency(stats.allocated) : '-'}
                                  </td>
                                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', color: '#6c757d' }}>
                                    {stats.allocated ? formatCurrency(stats.spent || 0) : '-'}
                                  </td>
                                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
                                    {formatCurrency(pItem.proposedAmount)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td style={{ padding: '6px', fontWeight: 'bold' }}>Total</td>
                              <td colSpan="2"></td>
                              <td style={{ padding: '6px', fontWeight: 'bold', textAlign: 'right' }}>{formatCurrency(selectedItem.totalProposedAmount || selectedItem.amount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {selectedItem.notes && (
                        <div style={{ marginTop: '10px' }}>
                          <span style={{ color: '#6c757d' }}>Proposal Notes:</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{selectedItem.notes}</p>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6c757d' }}></span>
                      <span style={{ color: '#6c757d' }}>Submitted</span>
                      <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                        {new Date(selectedItem.submittedAt || selectedItem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedItem.approvalSteps.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: step.decision === 'reject' ? '#dc3545' : '#28a745' }}></span>
                        <span>
                          <strong>{step.decision === 'verify' ? 'Verified' : step.decision === 'approve' ? 'Approved' : step.decision}</strong>
                          <span style={{ color: '#6c757d', marginLeft: '4px' }}>by {step.role?.toUpperCase()}</span>
                        </span>
                        <span style={{ color: '#adb5bd', fontSize: '0.8rem' }}>({new Date(step.timestamp).toLocaleDateString()})</span>
                        {step.remarks && <span style={{ fontStyle: 'italic', color: '#6c757d' }}>- "{step.remarks}"</span>}
                      </div>
                    ))}
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
                variant={actionType === 'approve' ? 'primary' : 'danger'}
                onClick={processAction}
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