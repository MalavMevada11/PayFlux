import React, { useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { LayoutDashboard, FileText, CreditCard, Settings, Menu, LogOut, Building2 } from 'lucide-react';

export default function CustomerLayout({ children }) {
  const { user, isAuthenticated, isCustomer, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const nav = useNavigate();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isCustomer) return <Navigate to="/dashboard" replace />;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const getNavClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-all duration-200 ` +
    (isActive
      ? 'bg-background shadow-sm border border-border text-emerald-600'
      : 'text-muted-foreground hover:bg-black/5 hover:text-foreground');

  return (
    <div className="flex h-screen w-full bg-slate-50/50">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex bg-emerald-50/80 backdrop-blur-md border-r border-emerald-200/50' : 'hidden'} lg:static lg:flex w-24 flex-col border-r bg-emerald-50/40 shrink-0 transition-all duration-200 ease-in-out`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center pt-4 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-sm ring-1 ring-emerald-600/20">
            P
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-2 p-3 flex-1 mt-4">
          <NavLink to="/portal" end className={getNavClass}>
            <LayoutDashboard className="h-5 w-5 mb-0.5" />
            Dashboard
          </NavLink>
          <NavLink to="/portal/invoices" className={getNavClass}>
            <FileText className="h-5 w-5 mb-0.5" />
            Invoices
          </NavLink>
          <NavLink to="/portal/payments" className={getNavClass}>
            <CreditCard className="h-5 w-5 mb-0.5" />
            Payments
          </NavLink>
          <NavLink to="/portal/businesses" className={getNavClass}>
            <Building2 className="h-5 w-5 mb-0.5" />
            Businesses
          </NavLink>
        </nav>
        <div className="p-3 mb-2 mt-auto">
          <NavLink to="/portal/settings" className={getNavClass}>
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
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #059669, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PayFlux Portal</span>
          </div>

          <div className="flex items-center gap-4 ml-auto relative">
            {isProfileMenuOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
            )}
            <div className="relative z-50">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 hover:bg-emerald-50 p-1.5 pr-4 rounded-full transition-colors border border-transparent hover:border-emerald-200/50 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-semibold border border-emerald-200">
                  {(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-semibold leading-none text-foreground">{user?.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : (user?.email?.split('@')[0] || 'Customer')}</span>
                  <span className="text-[10px] text-emerald-600 leading-snug mt-0.5 font-semibold">Customer</span>
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md shadow-xl border bg-background z-[100] overflow-hidden flex flex-col">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); nav('/portal/settings'); }}
                    className="flex items-center w-full px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); logout(); }}
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
