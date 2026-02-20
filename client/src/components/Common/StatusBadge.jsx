import React from 'react';
import '../../styles/common-components.scss';

const StatusBadge = ({ status, className = '' }) => {
    const statusMap = {
        'draft': { label: 'Draft', class: 'pending' },
        'submitted': { label: 'Submitted', class: 'pending' },
        'pending': { label: 'Pending', class: 'pending' },
        'verified_by_hod': { label: 'Verified (HOD)', class: 'info' },
        'verified_by_principal': { label: 'Verified (Principal)', class: 'verified' },
        'verified': { label: 'Verified', class: 'info' },
        'approved': { label: 'Sanctioned', class: 'approved' },
        'finalized': { label: 'Sanctioned & Deducted', class: 'approved' },
        'rejected': { label: 'Rejected', class: 'rejected' },
        'pending_approval': { label: 'Pending Approval', class: 'warning' }
    };

    // Normalize: handle cases where status might be uppercase or slightly different? usually lowercase from backend
    const normalizedKey = status?.toLowerCase();
    const config = statusMap[normalizedKey] || { label: status || 'Unknown', class: 'neutral' };

    return (
        <span className={`status-badge status-${config.class} ${className}`}>
            {config.label}
        </span>
    );
};

export default StatusBadge;
