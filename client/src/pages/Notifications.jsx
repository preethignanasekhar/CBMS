import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';
import { CheckCheck, Bell, BellOff, CheckCircle, User, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import './Notifications.scss';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    priority: '',
    unreadOnly: false
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalNotifications: 0
  });

  useEffect(() => {
    fetchNotifications();
    fetchStats();
  }, [filters, pagination.currentPage]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: 20,
        ...filters
      };

      const response = await notificationAPI.getNotifications(params);
      setNotifications(response.data.data.notifications);
      setPagination(response.data.data.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await notificationAPI.getNotificationStats();
      setStats(response.data.data);
    } catch (err) {
      console.error('Error fetching notification stats:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, read: true } : notif
        )
      );
      if (stats) {
        setStats(prev => ({
          ...prev,
          unreadNotifications: prev.unreadNotifications - 1,
          readNotifications: prev.readNotifications + 1
        }));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
      if (stats) {
        setStats(prev => ({
          ...prev,
          unreadNotifications: 0,
          readNotifications: prev.totalNotifications
        }));
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      if (stats) {
        setStats(prev => ({
          ...prev,
          totalNotifications: prev.totalNotifications - 1,
          unreadNotifications: prev.unreadNotifications - 1
        }));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'expenditure_submitted': 'fas fa-paper-plane',
      'expenditure_approved': 'fas fa-check-circle',
      'expenditure_rejected': 'fas fa-times-circle',
      'budget_exhaustion_warning': 'fas fa-exclamation-triangle',
      'approval_reminder': 'fas fa-clock',
      'attachments_missing': 'fas fa-paperclip',
      'system_announcement': 'fas fa-bullhorn',
      'user_created': 'fas fa-user-plus',
      'user_updated': 'fas fa-user-edit',
      'department_created': 'fas fa-building',
      'budget_allocation_created': 'fas fa-money-bill-wave'
    };
    return icons[type] || 'fas fa-bell';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'high': '#dc3545',
      'medium': '#ffc107',
      'low': '#6c757d'
    };
    return colors[priority] || '#6c757d';
  };

  const getTypeColor = (type) => {
    const colors = {
      'expenditure_submitted': '#17a2b8',
      'expenditure_approved': '#28a745',
      'expenditure_rejected': '#dc3545',
      'budget_exhaustion_warning': '#ffc107',
      'approval_reminder': '#17a2b8',
      'attachments_missing': '#dc3545',
      'system_announcement': '#6f42c1',
      'user_created': '#20c997',
      'user_updated': '#fd7e14',
      'department_created': '#007bff',
      'budget_allocation_created': '#28a745'
    };
    return colors[type] || '#6c757d';
  };

  const formatDate = (date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMinutes = Math.floor((now - notificationDate) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;

    return notificationDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="notifications-container">
        <div className="loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <div className="header-actions">
          {stats && stats.unreadNotifications > 0 && (
            <button className="btn btn-primary" onClick={handleMarkAllAsRead}>
              <CheckCheck size={16} />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Bell size={16} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.totalNotifications}</div>
              <div className="stat-label">Total Notifications</div>
            </div>
          </div>
          <div className="stat-card unread">
            <div className="stat-icon">
              <BellOff size={16} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.unreadNotifications}</div>
              <div className="stat-label">Unread</div>
            </div>
          </div>
          <div className="stat-card read">
            <div className="stat-icon">
              <CheckCircle size={16} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.readNotifications}</div>
              <div className="stat-label">Read</div>
            </div>
          </div>
        </div>
      )}

      <div className="filters-section">
        <div className="filter-group">
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="expenditure_submitted">Expenditure Submitted</option>
            <option value="expenditure_approved">Expenditure Approved</option>
            <option value="expenditure_rejected">Expenditure Rejected</option>
            <option value="budget_exhaustion_warning">Budget Exhaustion Warning</option>
            <option value="approval_reminder">Approval Reminder</option>
            <option value="attachments_missing">Attachments Missing</option>
            <option value="system_announcement">System Announcement</option>
          </select>
        </div>
        <div className="filter-group">
          <select
            name="priority"
            value={filters.priority}
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="unreadOnly"
              checked={filters.unreadOnly}
              onChange={handleFilterChange}
            />
            <span className="checkmark"></span>
            Unread Only
          </label>
        </div>
      </div>

      <div className="notifications-list">
        {notifications.map((notification) => (
          <div
            key={notification._id}
            className={`notification-item ${notification.read ? 'read' : 'unread'}`}
          >
            <div className="notification-icon">
              <i
                className={getNotificationIcon(notification.type)}
                style={{ color: getTypeColor(notification.type) }}
              ></i>
            </div>

            <div className="notification-content">
              <div className="notification-header">
                <h3 className="notification-title">{notification.title}</h3>
                <div className="notification-meta">
                  <span
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(notification.priority) }}
                  >
                    {notification.priority}
                  </span>
                  <span className="notification-time">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
              </div>

              <p className="notification-message">{notification.message}</p>

              {notification.senderName && (
                <div className="notification-sender">
                  <User size={16} />
                  <span>From: {notification.senderName}</span>
                </div>
              )}

              {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                <div className="notification-metadata">
                  {Object.entries(notification.metadata).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="metadata-item">
                      <span className="metadata-key">{key}:</span>
                      <span className="metadata-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="notification-actions">
              {!notification.read && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleMarkAsRead(notification._id)}
                >
                  <Check size={16} />
                </button>
              )}
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDeleteNotification(notification._id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="no-notifications">
          <div className="no-notifications-icon">
            <BellOff size={48} />
          </div>
          <h3>No Notifications</h3>
          <p>No notifications found matching the current filters.</p>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <span className="page-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          <button
            className="btn btn-secondary"
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
