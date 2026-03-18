import React from 'react';
import Tooltip from '../Tooltip/Tooltip';

const StatCard = ({ title, value, icon, trend, color, tooltipText, isPending, disclaimer, onClick, className, subtitle }) => {
  // Determine trend color
  const getTrendClass = (trendValue) => {
    if (!trendValue) return '';
    return trendValue > 0 ? 'positive' : trendValue < 0 ? 'negative' : 'neutral';
  };

  const trendClass = typeof trend === 'number' ? getTrendClass(trend) : '';
  const trendDisplay = typeof trend === 'number' ? `${trend > 0 ? '+' : ''}${trend}%` : trend;

  return (
    <div
      className={`metric-card ${isPending ? 'is-pending' : ''} ${className || ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', height: '100%' } : { height: '100%' }}
    >
      <div className="metric-icon" style={{ backgroundColor: isPending ? 'var(--warning)' : (color || 'var(--icon-bg-uniform)') }}>
        {icon}
      </div>
      <div className="metric-content">
        <Tooltip text={tooltipText || title} position="top">
          <h3 style={{ color: isPending ? 'var(--warning)' : 'inherit' }}>{value}</h3>
        </Tooltip>
        <p>{title}</p>
        
        {subtitle && (
          <span className="metric-subtitle" style={{ 
            fontSize: 'var(--font-xs)', 
            color: 'var(--text-tertiary)',
            display: 'block',
            marginTop: '0.1rem'
          }}>
            {subtitle}
          </span>
        )}

        {trend && !isPending && (
          <span className={`metric-change ${trendClass}`} style={{
            color: trend > 0 ? 'var(--success)' : trend < 0 ? 'var(--error)' : 'var(--text-secondary)',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            {trendDisplay}
          </span>
        )}
        {isPending && disclaimer && (
          <span className="metric-disclaimer" style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            display: 'block',
            marginTop: '0.25rem'
          }}>
            *{disclaimer}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
