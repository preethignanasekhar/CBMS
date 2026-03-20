import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Tooltip from '../Tooltip/Tooltip';
import {
  LayoutDashboard,
  LineChart,
  Users,
  Building2,
  Wallet,
  Settings,
  ClipboardList,
  CheckSquare,
  Calculator,
  User,
  LogOut,
  FileText,
  Search,
  PlusCircle,
  Files,
  GraduationCap,
  Menu,
  TrendingUp,
  Layers,
  BarChart3,
  Gauge,
  History as HistoryIcon,
  Sparkles
} from 'lucide-react';
import './Sidebar.scss';

const Sidebar = ({ isOpen, onClose, isExpanded, onToggleExpand }) => {
  const { user, logout } = useAuth();

  const toggleSidebar = () => {
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  const getNavigationItems = () => {
    if (!user) return [];

    const historyItem = { path: '/history', label: 'History', icon: <HistoryIcon size={20} /> };
    const baseItems = [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    ];

    switch (user.role) {
      case 'admin':
        return [
          ...baseItems,
          { path: '/users', label: 'Users', icon: <Users size={20} /> },
          { path: '/budget-heads', label: 'Budget Heads', icon: <Wallet size={20} /> },
          { path: '/departments', label: 'Departments', icon: <Building2 size={20} /> },
          historyItem
        ];
      case 'office':
        return [
          ...baseItems,
          { path: '/approvals', label: 'Approvals', icon: <CheckSquare size={20} /> },
          { path: '/consolidated-view', label: 'Consolidated', icon: <TrendingUp size={20} /> },
          { path: '/budget-heads', label: 'Budget Heads', icon: <Wallet size={20} /> },
          { path: '/expenditures', label: 'Expenditures', icon: <Calculator size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem,
          { path: '/categories', label: 'Category', icon: <Layers size={20} /> }
        ];
      case 'department':
        return [
          ...baseItems,
          { path: '/budget-proposals', label: 'Budget Proposals', icon: <FileText size={20} /> },
          { path: '/expenditures', label: 'My Expenditures', icon: <Calculator size={20} /> },
          { path: '/submit-expenditure', label: 'Submit Expenditure', icon: <PlusCircle size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem
        ];
      case 'hod':
        return [
          { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { path: '/hod-analytics', label: 'Analytics', icon: <LineChart size={20} /> },
          { path: '/budget-proposals', label: 'My Budget Proposals', icon: <FileText size={20} /> },
          { path: '/expenditures', label: 'My Expenditures', icon: <Calculator size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem
        ];
      case 'vice_principal':
      case 'principal':
        return [
          { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { path: '/approvals', label: 'Approvals', icon: <CheckSquare size={20} /> },
          { path: '/consolidated-view', label: 'Consolidated', icon: <TrendingUp size={20} /> },
          { path: '/budget-heads', label: 'Budget Heads', icon: <Wallet size={20} /> },
          { path: '/expenditures', label: 'Expenditures', icon: <Calculator size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem
        ];
      case 'auditor':
        return [
          ...baseItems,
          { path: '/audit-logs', label: 'Audit Logs', icon: <Search size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem
        ];
      case 'coordinator':
      case 'coordinater':
        return [
          ...baseItems,
          { path: '/expenditures', label: 'My Expenditures', icon: <Calculator size={20} /> },
          { path: '/submit-expenditure', label: 'Submit Expenditure', icon: <PlusCircle size={20} /> },
          { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
          historyItem
        ];
      default:
        return [...baseItems, historyItem];
    }
  };

  return (
    <>
      <div
        className={`mobile-overlay ${isOpen ? 'show' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-header">
          <Tooltip text={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"} position="right">
            <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
              <div className="sidebar-logo-icon">
                {isExpanded ? <Menu size={24} color="white" /> : <GraduationCap size={24} color="white" />}
              </div>
            </button>
          </Tooltip>

          <div className="sidebar-logo-text-container">
            <div className="sidebar-logo-text">CBMS</div>
            <div className="sidebar-subtitle">Finance Manager</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {getNavigationItems().map((item) => (
            <Tooltip
              key={item.path}
              text={!isExpanded ? item.label : ''}
              position="right"
              className="w-full"
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                onClick={() => window.innerWidth < 1024 && onClose()}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            </Tooltip>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
