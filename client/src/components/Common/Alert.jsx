import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import '../../styles/common-components.scss';

const Alert = ({
    variant = 'info',
    title,
    message,
    dismissible = false,
    onDismiss,
    children,
    className = ''
}) => {
    const icons = {
        success: <CheckCircle size={20} />,
        error: <AlertCircle size={20} />,
        warning: <AlertTriangle size={20} />,
        info: <Info size={20} />
    };

    return (
        <div className={`alert alert-${variant} ${className}`}>
            <div className="alert-icon">{icons[variant]}</div>
            <div className="alert-content">
                {title && <div className="alert-title">{title}</div>}
                {message && <div className="alert-message">{message}</div>}
                {children}
            </div>
            {dismissible && (
                <button className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">
                    <X size={18} />
                </button>
            )}
        </div>
    );
};

export default Alert;
