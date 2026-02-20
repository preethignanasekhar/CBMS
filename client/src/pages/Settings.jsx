import React, { useState, useEffect } from 'react';
import { settingsAPI, systemAPI } from '../services/api';
import PageHeader from '../components/Common/PageHeader';
import ContentCard from '../components/Common/ContentCard';
import { Settings as SettingsIcon, IndianRupee, Bell, Shield, Server, RotateCcw, Save, Database, AlertTriangle, Loader2 } from 'lucide-react';
import './Settings.scss';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({});
  const [bulkSetupLoading, setBulkSetupLoading] = useState(false);
  const [bulkSetupResult, setBulkSetupResult] = useState(null);

  const tabs = [
    { id: 'general', label: 'General', icon: <SettingsIcon /> },
    { id: 'budget', label: 'Budget', icon: <IndianRupee /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell /> },
    { id: 'security', label: 'Security', icon: <Shield /> },
    { id: 'system', label: 'System', icon: <Server /> }
  ];

  useEffect(() => {
    fetchSettings();
    fetchSystemInfo();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings();
      setSettings(response.data.data.settings || {});
      setFormData(response.data.data.settings || {});
      setError(null);
    } catch (err) {
      setError('Failed to fetch settings');
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await settingsAPI.getSystemInfo();
      setSystemInfo(response.data.data.systemInfo);
    } catch (err) {
      console.error('Error fetching system info:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await settingsAPI.updateSettings({
        category: activeTab,
        settings: formData[activeTab]
      });

      setSuccess(`${tabs.find(tab => tab.id === activeTab).label} settings updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update settings');
      console.error('Error updating settings:', err);
    }
  };

  const handleReset = async () => {
    if (window.confirm(`Are you sure you want to reset ${tabs.find(tab => tab.id === activeTab).label} settings to default?`)) {
      try {
        await settingsAPI.resetSettings({ category: activeTab });
        fetchSettings();
        setSuccess(`${tabs.find(tab => tab.id === activeTab).label} settings reset to default`);
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError('Failed to reset settings');
        console.error('Error resetting settings:', err);
      }
    }
  };

  const handleBulkSetup = async () => {
    if (window.confirm('CRITICAL: This will reset roles and passwords for all institutional accounts. Proceed with bulk configuration?')) {
      try {
        setBulkSetupLoading(true);
        setError(null);
        const response = await systemAPI.bulkSetup({ emailDomain: 'bms.edu.in' });
        setBulkSetupResult(response.data);
        setSuccess('Institutional bulk setup completed successfully!');
        setTimeout(() => setSuccess(null), 5000);
      } catch (err) {
        setError(err.response?.data?.message || 'Bulk setup failed');
        console.error('Bulk setup error:', err);
      } finally {
        setBulkSetupLoading(false);
      }
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <PageHeader
        title="System Settings"
        subtitle="Manage your CBMS system configuration and preferences"
      />

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <div className="settings-content">
        <div className="settings-sidebar">
          <div className="tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-main">
          <div className="settings-panel">
            <div className="panel-header">
              <h2>{tabs.find(tab => tab.id === activeTab).label} Settings</h2>
              <button className="btn btn-secondary" onClick={handleReset}>
                <RotateCcw size={16} /> Reset to Default
              </button>
            </div>

            <form onSubmit={handleSubmit} className="settings-form">
              {activeTab === 'general' && (
                <div className="form-section">
                  <div className="form-group">
                    <label htmlFor="collegeName">College Name</label>
                    <input
                      type="text"
                      id="collegeName"
                      name="collegeName"
                      value={formData?.general?.collegeName || ''}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="collegeCode">College Code</label>
                    <input
                      type="text"
                      id="collegeCode"
                      name="collegeCode"
                      value={formData?.general?.collegeCode || ''}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="academicYear">Academic Year</label>
                      <input
                        type="text"
                        id="academicYear"
                        name="academicYear"
                        value={formData?.general?.academicYear || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="financialYear">Financial Year</label>
                      <input
                        type="text"
                        id="financialYear"
                        name="financialYear"
                        value={formData?.general?.financialYear || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="currency">Currency</label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData?.general?.currency || ''}
                        onChange={handleInputChange}
                        className="form-select"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="timezone">Timezone</label>
                      <select
                        id="timezone"
                        name="timezone"
                        value={formData?.general?.timezone || ''}
                        onChange={handleInputChange}
                        className="form-select"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="Europe/London">Europe/London</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'budget' && (
                <div className="form-section">
                  <div className="form-group">
                    <label htmlFor="defaultAllocationPeriod">Default Allocation Period</label>
                    <select
                      id="defaultAllocationPeriod"
                      name="defaultAllocationPeriod"
                      value={formData.budget?.defaultAllocationPeriod || ''}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="maxAllocationAmount">Max Allocation Amount</label>
                      <input
                        type="number"
                        id="maxAllocationAmount"
                        name="maxAllocationAmount"
                        value={formData.budget?.maxAllocationAmount || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="minAllocationAmount">Min Allocation Amount</label>
                      <input
                        type="number"
                        id="minAllocationAmount"
                        name="minAllocationAmount"
                        value={formData.budget?.minAllocationAmount || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="approvalRequiredAmount">Approval Required Amount</label>
                      <input
                        type="number"
                        id="approvalRequiredAmount"
                        name="approvalRequiredAmount"
                        value={formData.budget?.approvalRequiredAmount || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="autoApprovalAmount">Auto Approval Amount</label>
                      <input
                        type="number"
                        id="autoApprovalAmount"
                        name="autoApprovalAmount"
                        value={formData.budget?.autoApprovalAmount || ''}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="budgetCarryForward"
                        checked={formData.budget?.budgetCarryForward || false}
                        onChange={handleInputChange}
                      />
                      Allow Budget Carry Forward
                    </label>
                  </div>

                  <div className="form-group">
                    <label htmlFor="budgetCarryForwardPercentage">Carry Forward Percentage</label>
                    <input
                      type="number"
                      id="budgetCarryForwardPercentage"
                      name="budgetCarryForwardPercentage"
                      value={formData.budget?.budgetCarryForwardPercentage || ''}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      className="form-input"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="form-section">
                  <h3 className="section-title">Email Notifications</h3>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="emailNotifications"
                        checked={formData.notifications?.emailNotifications || false}
                        onChange={handleInputChange}
                      />
                      Enable Email Notifications
                    </label>
                    <small className="help-text">Receive email notifications for important events like submissions, approvals, and rejections</small>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="smsNotifications"
                        checked={formData.notifications?.smsNotifications || false}
                        onChange={handleInputChange}
                      />
                      Enable SMS Notifications
                    </label>
                    <small className="help-text">Get SMS alerts for critical actions</small>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="pushNotifications"
                        checked={formData.notifications?.pushNotifications || false}
                        onChange={handleInputChange}
                      />
                      Enable Push Notifications
                    </label>
                    <small className="help-text">Receive browser push notifications when logged in</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="notificationFrequency">Notification Frequency</label>
                    <select
                      id="notificationFrequency"
                      name="notificationFrequency"
                      value={formData.notifications?.notificationFrequency || ''}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="hourly">Hourly Digest</option>
                      <option value="daily">Daily Digest</option>
                      <option value="weekly">Weekly Digest</option>
                    </select>
                    <small className="help-text">How often you want to receive notification emails</small>
                  </div>

                  <h3 className="section-title">Auto-Reminder Settings</h3>
                  <div className="info-box">
                    <p>configure automatic reminder emails for pending approvals. The system checks daily at 9:00 AM and sends reminders to approvers with pending requests older than the configured threshold.</p>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="reminderDays">Pending Approval Reminder Threshold (Days)</label>
                      <input
                        type="number"
                        id="reminderDays"
                        name="reminderDays"
                        value={formData.notifications?.reminderDays || '5'}
                        onChange={handleInputChange}
                        min="1"
                        max="30"
                        className="form-input"
                      />
                      <small className="help-text">Send reminder emails for approvals pending longer than this many days (default: 5 days)</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="escalationDays">Escalation Threshold (Days)</label>
                      <input
                        type="number"
                        id="escalationDays"
                        name="escalationDays"
                        value={formData.notifications?.escalationDays || '10'}
                        onChange={handleInputChange}
                        min="1"
                        max="30"
                        className="form-input"
                      />
                      <small className="help-text">Number of days before escalating to higher authorities (default: 10 days)</small>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="form-section">
                  <div className="form-group">
                    <label htmlFor="passwordMinLength">Minimum Password Length</label>
                    <input
                      type="number"
                      id="passwordMinLength"
                      name="passwordMinLength"
                      value={formData.security?.passwordMinLength || ''}
                      onChange={handleInputChange}
                      min="6"
                      max="20"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="passwordRequireSpecialChars"
                        checked={formData.security?.passwordRequireSpecialChars || false}
                        onChange={handleInputChange}
                      />
                      Require Special Characters
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="passwordRequireNumbers"
                        checked={formData.security?.passwordRequireNumbers || false}
                        onChange={handleInputChange}
                      />
                      Require Numbers
                    </label>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="sessionTimeout">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        id="sessionTimeout"
                        name="sessionTimeout"
                        value={formData.security?.sessionTimeout || ''}
                        onChange={handleInputChange}
                        min="5"
                        max="480"
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="maxLoginAttempts">Max Login Attempts</label>
                      <input
                        type="number"
                        id="maxLoginAttempts"
                        name="maxLoginAttempts"
                        value={formData.security?.maxLoginAttempts || ''}
                        onChange={handleInputChange}
                        min="3"
                        max="10"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="lockoutDuration">Lockout Duration (minutes)</label>
                    <input
                      type="number"
                      id="lockoutDuration"
                      name="lockoutDuration"
                      value={formData.security?.lockoutDuration || ''}
                      onChange={handleInputChange}
                      min="5"
                      max="60"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="twoFactorAuth"
                        checked={formData.security?.twoFactorAuth || false}
                        onChange={handleInputChange}
                      />
                      Enable Two-Factor Authentication
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="form-section">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="maintenanceMode"
                        checked={formData.system?.maintenanceMode || false}
                        onChange={handleInputChange}
                      />
                      Enable Maintenance Mode
                    </label>
                  </div>

                  <div className="form-group">
                    <label htmlFor="maintenanceMessage">Maintenance Message</label>
                    <textarea
                      id="maintenanceMessage"
                      name="maintenanceMessage"
                      value={formData.system?.maintenanceMessage || ''}
                      onChange={handleInputChange}
                      rows="3"
                      className="form-textarea"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="maxFileUploadSize">Max File Upload Size (bytes)</label>
                    <input
                      type="number"
                      id="maxFileUploadSize"
                      name="maxFileUploadSize"
                      value={formData.system?.maxFileUploadSize || ''}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="auditLogRetention">Audit Log Retention (days)</label>
                    <input
                      type="number"
                      id="auditLogRetention"
                      name="auditLogRetention"
                      value={formData.system?.auditLogRetention || ''}
                      onChange={handleInputChange}
                      min="30"
                      max="3650"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="backupFrequency">Backup Frequency</label>
                    <select
                      id="backupFrequency"
                      name="backupFrequency"
                      value={formData.system?.backupFrequency || ''}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>


                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #eee' }}></div>

                  <h3 className="section-title">Production Administration</h3>
                  <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <AlertTriangle size={24} style={{ color: '#e53e3e', flexShrink: 0 }} />
                    <div className="warning-content">
                      <h4 style={{ color: '#c53030', margin: '0 0 0.5rem 0' }}>Institutional Bulk Setup</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#742a2a' }}>This will automatically configure 10 departments and 34 users according to official role mappings. <strong>Existing accounts will be updated.</strong> This action should only be performed once during initial deployment.</p>
                    </div>
                  </div>

                  <div className="bulk-setup-action">
                    <button
                      type="button"
                      className="btn"
                      style={{
                        backgroundColor: bulkSetupLoading ? '#cbd5e0' : '#e53e3e',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onClick={handleBulkSetup}
                      disabled={bulkSetupLoading}
                    >
                      {bulkSetupLoading ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                        </>
                      ) : (
                        <>
                          <Database size={16} /> Run Institutional Bulk Setup
                        </>
                      )}
                    </button>
                    {bulkSetupResult && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: '0.375rem' }}>
                        <p style={{ color: '#276749', margin: 0, fontSize: '0.875rem' }}>✅ {bulkSetupResult.message} ({bulkSetupResult.log?.length} items processed)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Settings
                </button>
              </div>
            </form>
          </div>

          {
            systemInfo && (
              <div className="system-info-panel">
                <h3>System Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Version</label>
                    <span>{systemInfo.version}</span>
                  </div>
                  <div className="info-item">
                    <label>Build Date</label>
                    <span>{systemInfo.buildDate}</span>
                  </div>
                  <div className="info-item">
                    <label>Node Version</label>
                    <span>{systemInfo.nodeVersion}</span>
                  </div>
                  <div className="info-item">
                    <label>Platform</label>
                    <span>{systemInfo.platform}</span>
                  </div>
                  <div className="info-item">
                    <label>Uptime</label>
                    <span>{formatUptime(systemInfo.uptime)}</span>
                  </div>
                  <div className="info-item">
                    <label>Memory Usage</label>
                    <span>{formatBytes(systemInfo.memoryUsage.heapUsed)} / {formatBytes(systemInfo.memoryUsage.heapTotal)}</span>
                  </div>
                  <div className="info-item">
                    <label>Environment</label>
                    <span>{systemInfo.environment}</span>
                  </div>
                  <div className="info-item">
                    <label>Database</label>
                    <span>{systemInfo.database}</span>
                  </div>
                  <div className="info-item">
                    <label>Last Backup</label>
                    <span>{new Date(systemInfo.lastBackup).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          }
        </div >
      </div >
    </div >
  );
};

export default Settings;
