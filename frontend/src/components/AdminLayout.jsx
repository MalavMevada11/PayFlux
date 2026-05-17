import React, { useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { LayoutDashboard, Users, Building2, CreditCard, Settings, Menu, LogOut, Shield } from 'lucide-react';

export default function AdminLayout({ children }) {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const nav = useNavigate();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const getNavClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-all duration-200 ` +
    (isActive
      ? 'bg-background shadow-sm border border-border text-violet-600'
      : 'text-muted-foreground hover:bg-black/5 hover:text-foreground');

  return (
    <div className="flex h-screen w-full bg-slate-50/50">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex bg-violet-50/80 backdrop-blur-md border-r border-violet-200/50' : 'hidden'} lg:static lg:flex w-24 flex-col border-r bg-violet-50/40 shrink-0 transition-all duration-200 ease-in-out`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center pt-4 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white font-bold text-xl shadow-sm ring-1 ring-violet-600/20">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-2 p-3 flex-1 mt-4">
          <NavLink to="/admin" end className={getNavClass}>
            <LayoutDashboard className="h-5 w-5 mb-0.5" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={getNavClass}>
            <Users className="h-5 w-5 mb-0.5" />
            Users
          </NavLink>
          <NavLink to="/admin/businesses" className={getNavClass}>
            <Building2 className="h-5 w-5 mb-0.5" />
            Businesses
          </NavLink>
          <NavLink to="/admin/payments" className={getNavClass}>
            <CreditCard className="h-5 w-5 mb-0.5" />
            Payments
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
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PayFlux Admin</span>
          </div>

          <div className="flex items-center gap-4 ml-auto relative">
            {isProfileMenuOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
            )}
            <div className="relative z-50">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-3 hover:bg-violet-50 p-1.5 pr-4 rounded-full transition-colors border border-transparent hover:border-violet-200/50 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-semibold border border-violet-200">
                  {(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-semibold leading-none text-foreground">{user?.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : (user?.email?.split('@')[0] || 'Admin')}</span>
                  <span className="text-[10px] text-violet-600 leading-snug mt-0.5 font-semibold">Super Admin</span>
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-md shadow-xl border bg-background z-[100] overflow-hidden flex flex-col">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); nav('/profile'); }}
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
