import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { notificationAPI } from '../../services/api';
import Tooltip from '../Tooltip/Tooltip';
import { Bell, FileText, CheckCircle, XCircle, DollarSign, AlertTriangle, Clock, Megaphone, Trash2 } from 'lucide-react';
import './NotificationBell.scss';

const NotificationBell = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (socket) {
      socket.on('notification', (newNotification) => {
        console.log('[SOCKET] New notification received:', newNotification);
        setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep only recent 10
        setUnreadCount(prev => prev + 1);

        // Play notification sound if browser allows
        try {
          const audio = new Audio('/notification.mp3'); // Ensure this file exists
          audio.play().catch(() => { }); // Ignore errors (e.g., user interaction required)
        } catch (e) { }
      });

      return () => {
        socket.off('notification');
      };
    }
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getNotifications({ limit: 10 });
      setNotifications(response.data.data.notifications);
      setUnreadCount(response.data.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId
            ? { ...notif, isRead: true, readAt: new Date() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      setUnreadCount(prev => {
        const deletedNotif = notifications.find(n => n._id === notificationId);
        return deletedNotif && !deletedNotif.isRead ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#6c757d',
      medium: '#17a2b8',
      high: '#ffc107',
      urgent: '#dc3545'
    };
    return colors[priority] || '#6c757d';
  };

  const getTypeIcon = (type) => {
    const icons = {
      expenditure_submitted: <FileText />,
      expenditure_verified: <CheckCircle />,
      expenditure_approved: <CheckCircle />,
      expenditure_rejected: <XCircle />,
      budget_allocation_created: <DollarSign />,
      budget_exhaustion_warning: <AlertTriangle />,
      approval_reminder: <Clock />,
      system_announcement: <Megaphone />,
      proposal_submitted: <FileText />,
      proposal_verified: <CheckCircle />,
      proposal_rejected: <XCircle />
    };
    return icons[type] || <FileText />;
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }

    setIsOpen(false);
  };

  return (
    <div className="notification-bell">
      <Tooltip text="Notifications" position="bottom" className="bell-tooltip">
        <button
          className="bell-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </button>
      </Tooltip>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="mark-all-read-btn"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <Bell size={48} />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-icon">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="notification-details">
                      <h4 className="notification-title">
                        {notification.title}
                      </h4>
                      <p className="notification-message">
                        {notification.message}
                      </p>
                      <div className="notification-meta">
                        <span className="notification-time">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        <span
                          className="notification-priority"
                          style={{ color: getPriorityColor(notification.priority) }}
                        >
                          {notification.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="notification-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification._id);
                      }}
                      className="delete-btn"
                      title="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <a href="/notifications" className="view-all-link">
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="notification-overlay"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default NotificationBell;
