import React, { useState, useEffect } from 'react';
import { aiAPI } from '../../services/api';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Shield, Info, ChevronDown, ChevronUp } from 'lucide-react';
import './AIInsightsPanel.scss';

/**
 * AIInsightsPanel - Displays AI-powered insights and anomaly detection results
 * Features:
 * - Overall status with NL explanation
 * - Anomaly alerts with severity indicators
 * - Risk score summary
 * - Collapsible sections
 */
const AIInsightsPanel = ({ financialYear, compact = false }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(!compact);

    useEffect(() => {
        fetchAIData();
    }, [financialYear]);

    const fetchAIData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await aiAPI.getDashboard({ financialYear });
            if (response.data.success) {
                setData(response.data.data);
            } else {
                setError('Failed to load AI insights');
            }
        } catch (err) {
            console.error('Error fetching AI data:', err);
            setError(err.response?.data?.message || 'Failed to load AI insights');
        } finally {
            setLoading(false);
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'critical':
                return <AlertTriangle className="icon critical" />;
            case 'warning':
                return <AlertTriangle className="icon warning" />;
            case 'info':
                return <Info className="icon info" />;
            default:
                return <Info className="icon" />;
        }
    };

    const getRiskIcon = (level) => {
        switch (level) {
            case 'High':
                return <TrendingUp className="icon high" />;
            case 'Medium':
                return <Activity className="icon medium" />;
            case 'Low':
                return <TrendingDown className="icon low" />;
            default:
                return <Activity className="icon" />;
        }
    };

    if (loading) {
        return (
            <div className="ai-insights-panel loading">
                <div className="panel-header">
                    <Shield className="ai-icon" />
                    <span>AI Insights</span>
                </div>
                <div className="loading-skeleton">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ai-insights-panel error">
                <div className="panel-header">
                    <Shield className="ai-icon" />
                    <span>AI Insights</span>
                </div>
                <div className="error-message">
                    <AlertTriangle className="icon" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { insights, anomalies, riskScores, health } = data;

    return (
        <div className={`ai-insights-panel ${expanded ? 'expanded' : 'collapsed'}`}>
            <div className="panel-header" onClick={() => setExpanded(!expanded)}>
                <div className="header-left">
                    <div className="flex items-center gap-2">
                        <Shield className="ai-icon" />
                        <div>
                            <span className="title">AI Insights</span>
                            <p className="text-xs text-gray-500 flex items-center gap-1" style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                                Safe AI Analysis &bull; Decision Support Only
                            </p>
                        </div>
                    </div>
                    {!expanded && anomalies.total > 0 && (
                        <span className="badge anomaly">{anomalies.total} alerts</span>
                    )}
                </div>
                <button className="expand-btn">
                    {expanded ? <ChevronUp /> : <ChevronDown />}
                </button>
            </div>

            {expanded && (
                <div className="panel-content">
                    {/* Overall Status */}
                    <div className="insight-section status-section">
                        <p className="status-text">{insights.overallStatus}</p>
                        <p className="explanation-text">{insights.utilizationExplanation}</p>
                    </div>

                    {/* Risk Summary */}
                    <div className="insight-section risk-section">
                        <h4>Risk Overview</h4>
                        <div className="risk-bars">
                            <div className="risk-bar high">
                                <span className="label">High Risk</span>
                                <div className="bar-container">
                                    <div
                                        className="bar-fill"
                                        style={{ width: `${(riskScores.summary.high / riskScores.total) * 100 || 0}%` }}
                                    ></div>
                                </div>
                                <span className="count">{riskScores.summary.high}</span>
                            </div>
                            <div className="risk-bar medium">
                                <span className="label">Medium</span>
                                <div className="bar-container">
                                    <div
                                        className="bar-fill"
                                        style={{ width: `${(riskScores.summary.medium / riskScores.total) * 100 || 0}%` }}
                                    ></div>
                                </div>
                                <span className="count">{riskScores.summary.medium}</span>
                            </div>
                            <div className="risk-bar low">
                                <span className="label">Low Risk</span>
                                <div className="bar-container">
                                    <div
                                        className="bar-fill"
                                        style={{ width: `${(riskScores.summary.low / riskScores.total) * 100 || 0}%` }}
                                    ></div>
                                </div>
                                <span className="count">{riskScores.summary.low}</span>
                            </div>
                        </div>
                    </div>

                    {/* Anomaly Alerts */}
                    {anomalies.total > 0 && (
                        <div className="insight-section anomaly-section">
                            <h4>Detected Anomalies</h4>
                            <div className="anomaly-list">
                                {anomalies.items.map((anomaly, index) => (
                                    <div key={index} className={`anomaly-item ${anomaly.severity}`}>
                                        {getSeverityIcon(anomaly.severity)}
                                        <span className="anomaly-text">{anomaly.explanation}</span>
                                    </div>
                                ))}
                                {anomalies.total > 5 && (
                                    <div className="more-link">
                                        +{anomalies.total - 5} more anomalies
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* System Health (if available) */}
                    {health && (
                        <div className={`insight-section health-section ${health.healthStatus.toLowerCase()}`}>
                            <h4>System Health</h4>
                            <div className="health-score">
                                <div className="score-circle">
                                    <span className="score">{health.healthScore}</span>
                                    <span className="label">/100</span>
                                </div>
                                <span className={`status-badge ${health.healthStatus.toLowerCase()}`}>
                                    {health.healthStatus}
                                </span>
                            </div>
                            {health.issues.length > 0 && (
                                <div className="health-issues">
                                    {health.issues.map((issue, index) => (
                                        <div key={index} className="issue-item">
                                            <AlertTriangle className="icon" />
                                            <span>{issue.description}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="panel-footer">
                        <span className="timestamp">
                            Updated: {new Date(insights.generatedAt).toLocaleTimeString()}
                        </span>
                        <button className="refresh-btn" onClick={fetchAIData}>
                            Refresh
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIInsightsPanel;
