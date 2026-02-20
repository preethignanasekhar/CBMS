import React from 'react';
import { RefreshCw } from 'lucide-react';
const PageHeader = ({ title, subtitle, children }) => {
  return (
    <div className="page-header dashboard-header-card">
      <div className="header-content">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="header-controls">
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
