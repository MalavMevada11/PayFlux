import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from './authContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Items from './pages/Items';
import InvoiceBuilder from './pages/InvoiceBuilder';
import InvoiceDetail from './pages/InvoiceDetail';
import Profile from './pages/Profile';

// Icons (inline SVG)
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  ),
  customers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  items: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  ),
  invoices: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
};

function PrivateLayout({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className={`app-shell ${isSidebarOpen ? 'sidebar-is-open' : ''}`}>
      {/* Top Navbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button 
            type="button" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: '#FFF', border: 'none', cursor: 'pointer' }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="logo-mark">
            <div className="logo-icon">P</div>
            <span>PayFlux</span>
          </div>
        </div>

        <div className="topbar-center">
          <input type="text" className="search-input" placeholder="Quick Search..." />
        </div>

        <div className="topbar-right">
          <NavLink to="/profile" className="user-profile-btn" style={{ textDecoration: 'none' }}>
            <div className="user-avatar">
              {/* Fallback to user email first letter */}
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-email-col">
              <span className="user-brand">{user?.email?.split('@')[0] || 'User'}</span>
              <span className="user-email-text">{user?.email}</span>
            </div>
          </NavLink>
        </div>
      </header>

      <div className="main-wrapper">
        {/* Sidebar (floating pill of icons) */}
        <aside className={`sidebar ${isSidebarOpen ? 'expanded' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title="Dashboard">
            {Icons.dashboard}
            <span className="nav-link-text">Dashboard</span>
          </NavLink>
          <NavLink to="/invoices/new" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title="New Invoice">
            {Icons.invoices}
            <span className="nav-link-text">New Invoice</span>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title="Customers">
            {Icons.customers}
            <span className="nav-link-text">Customers</span>
          </NavLink>
          <NavLink to="/items" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title="Items">
            {Icons.items}
            <span className="nav-link-text">Items</span>
          </NavLink>

          <div className="sidebar-footer">
            <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title="Settings">
              {Icons.settings}
              <span className="nav-link-text">Settings</span>
            </NavLink>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-content">
          <div className="page-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />

      <Route path="/" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/customers" element={<PrivateLayout><Customers /></PrivateLayout>} />
      <Route path="/items" element={<PrivateLayout><Items /></PrivateLayout>} />
      <Route path="/invoices/new" element={<PrivateLayout><InvoiceBuilder /></PrivateLayout>} />
      <Route path="/invoices/:id" element={<PrivateLayout><InvoiceDetail /></PrivateLayout>} />
      <Route path="/invoices/:id/edit" element={<PrivateLayout><InvoiceBuilder /></PrivateLayout>} />
      <Route path="/profile" element={<PrivateLayout><Profile /></PrivateLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
