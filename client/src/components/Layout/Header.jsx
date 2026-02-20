import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import Tooltip from '../Tooltip/Tooltip';
import {
  Search,
  Menu,
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown
} from 'lucide-react';
import './Header.scss';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;

    // If it's a relative path starting with /uploads, and we're in dev,
    // we can let the Vite proxy handle it.
    if (import.meta.env.DEV && path.startsWith('/uploads')) {
      return path;
    }

    const apiBase = import.meta.env.REACT_APP_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    return `${apiBase}${path}`;
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Left Section: Mobile Menu & Search */}
        <div className="header-left">
          <Tooltip text="Toggle Menu" position="right">
            <button className="mobile-menu-btn" onClick={onMenuClick}>
              <Menu size={24} />
            </button>
          </Tooltip>

          <div className="header-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search..."
              className="search-input"
            />
          </div>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="header-right">
          <NotificationBell />

          <div className="user-dropdown">
            <div
              className="user-profile-btn"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="avatar">
                {user?.profilePicture ? (
                  <img src={getFullImageUrl(user.profilePicture)} alt="Profile" className="avatar-img" />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="user-info-header">
                <span className="user-name-header">{user?.name}</span>
                <span className="user-role-header">{user?.role}</span>
              </div>
              <ChevronDown size={16} color="#6b7280" />
            </div>

            {isProfileOpen && (
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item" onClick={() => setIsProfileOpen(false)}>
                  <User size={16} />
                  Profile
                </Link>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item logout-item">
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
