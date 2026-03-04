import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import FloatingAIChat from '../AI/FloatingAIChat';
import './Layout.scss';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const location = useLocation();

  return (
    <div className="layout">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <div className={`main-wrapper ${isSidebarExpanded ? 'expanded' : ''}`}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="main-content">
          <Outlet key={location.pathname} />
        </main>
      </div>
      <FloatingAIChat />
    </div>
  );
};

export default Layout;
