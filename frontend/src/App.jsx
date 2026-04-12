import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './authContext';
import { LayoutDashboard, Users, FileText, Package, Settings, Menu, LogOut } from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Customers from './pages/Customers';
import Items from './pages/Items';
import InvoiceBuilder from './pages/InvoiceBuilder';
import InvoiceDetail from './pages/InvoiceDetail';
import Profile from './pages/Profile';
import CustomerDetail from './pages/CustomerDetail';
import ItemDetail from './pages/ItemDetail';
import LandingPage from './pages/LandingPage';


function PrivateLayout({ children }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const nav = useNavigate();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const getNavClass = ({ isActive }) => 
    `flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-all duration-200 ` + 
    (isActive 
      ? 'bg-background shadow-sm border border-border text-primary' 
      : 'text-muted-foreground hover:bg-black/5 hover:text-foreground');

  return (
    <div className="flex h-screen w-full bg-slate-50/50">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex bg-secondary/40 backdrop-blur-md border-r border-border/50' : 'hidden'} lg:static lg:flex w-24 flex-col border-r bg-secondary/30 shrink-0 transition-all duration-200 ease-in-out`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center pt-4 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-sm ring-1 ring-primary/20">
              P
            </div>
        </div>
        
        {/* Nav items */}
        <nav className="flex flex-col gap-2 p-3 flex-1 mt-4">
          <NavLink to="/dashboard" className={getNavClass}>
            <LayoutDashboard className="h-5 w-5 mb-0.5" />
            Dashboard
          </NavLink>
          <NavLink to="/invoices" className={getNavClass}>
            <FileText className="h-5 w-5 mb-0.5" />
            Invoices
          </NavLink>
          <NavLink to="/customers" className={getNavClass}>
            <Users className="h-5 w-5 mb-0.5" />
            Customers
          </NavLink>
          <NavLink to="/items" className={getNavClass}>
            <Package className="h-5 w-5 mb-0.5" />
            Items
          </NavLink>
        </nav>
        <div className="p-3 mb-2 mt-auto">
          <NavLink to="/profile" className={getNavClass}>
            <Settings className="h-5 w-5 mb-0.5" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main Content + Header area */}
      <div className="flex flex-1 flex-col overflow-hidden relative w-full">
        {/* Mobile Sidebar overlay */}
        {isSidebarOpen && (
           <div className="fixed inset-0 z-40 bg-black/20 lg:hidden backdrop-blur-sm transition-opacity" onClick={toggleSidebar} />
        )}
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={toggleSidebar} className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-md transition-colors">
              <Menu className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex-1 flex items-center lg:justify-start">
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(250, 80%, 55%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PayFlux</span>
          </div>

          <div className="flex items-center gap-4 ml-auto relative">
            {isProfileMenuOpen && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsProfileMenuOpen(false)} 
              />
            )}
            
            <div className="relative z-50">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 hover:bg-secondary/80 p-1.5 pr-4 rounded-full transition-colors border border-transparent hover:border-border/50 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                  {(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-semibold leading-none text-foreground">{user?.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : (user?.email?.split('@')[0] || 'User')}</span>
                  <span className="text-[10px] text-muted-foreground leading-snug mt-0.5 font-medium">Administrator</span>
                </div>
              </button>
              
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md shadow-xl border bg-background z-[100] overflow-hidden flex flex-col">
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      nav('/profile');
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors border-t"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          <div className="mx-auto w-full max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />

      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
      <Route path="/invoices" element={<PrivateLayout><Invoices /></PrivateLayout>} />
      <Route path="/invoices/create" element={<PrivateLayout><InvoiceBuilder /></PrivateLayout>} />
      <Route path="/invoices/new" element={<Navigate to="/invoices/create" replace />} />
      <Route path="/customers" element={<PrivateLayout><Customers /></PrivateLayout>} />
      <Route path="/customers/:id" element={<PrivateLayout><CustomerDetail /></PrivateLayout>} />
      <Route path="/items" element={<PrivateLayout><Items /></PrivateLayout>} />
      <Route path="/items/:id" element={<PrivateLayout><ItemDetail /></PrivateLayout>} />
      <Route path="/invoices/:id" element={<PrivateLayout><InvoiceDetail /></PrivateLayout>} />
      <Route path="/invoices/:id/edit" element={<PrivateLayout><InvoiceBuilder /></PrivateLayout>} />
      <Route path="/profile" element={<PrivateLayout><Profile /></PrivateLayout>} />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
