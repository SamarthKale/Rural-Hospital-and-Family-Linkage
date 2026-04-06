import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Home, Bell, Settings,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Heart
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useAlertStore from '../../stores/alertStore';
import { useAlerts } from '../../hooks/useApi';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'doctor', 'field_worker', 'supervisor'] },
  { path: '/villages', label: 'Villages', icon: MapPin, roles: ['admin', 'supervisor'] },
  { path: '/households', label: 'Households', icon: Home, roles: ['admin', 'doctor', 'field_worker', 'supervisor'] },
  { path: '/alerts', label: 'Alerts', icon: Bell, roles: ['admin', 'doctor', 'field_worker', 'supervisor'] },
  { path: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role, clearAuth } = useAuthStore();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch alert count
  const { data: alertData } = useAlerts({ status: 'active', limit: 1 });

  useEffect(() => {
    if (alertData?.pagination?.total !== undefined) {
      useAlertStore.getState().setUnreadCount(alertData.pagination.total);
    }
  }, [alertData]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col bg-white border-r border-neutral-200 shadow-sm
          transition-all duration-300 ease-in-out shrink-0
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
        `}
      >
        {/* Logo Block */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-neutral-200 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl gradient-header flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-base font-bold text-neutral-800 truncate">GraamSwasthya</h1>
              <p className="text-[11px] text-neutral-400 truncate">Rural Healthcare</p>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150 relative group
                  ${isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Alert badge */}
                {item.path === '/alerts' && unreadCount > 0 && (
                  <span className={`
                    ${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'}
                    inline-flex items-center justify-center min-w-[20px] h-5
                    px-1.5 text-[11px] font-bold rounded-full
                    bg-danger text-white
                  `}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}

                {/* Collapsed label tooltip */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2 py-1 bg-neutral-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info */}
        <div className={`border-t border-neutral-200 p-3 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-700 truncate">{user?.fullName || 'User'}</p>
                <p className="text-xs text-neutral-400 capitalize truncate">{role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-neutral-200 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Top Bar + Drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-neutral-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-7 h-7 rounded-lg gradient-header flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-neutral-800">GraamSwasthya</span>
        </div>
        <NavLink to="/alerts" className="relative p-2">
          <Bell className="w-5 h-5 text-neutral-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 text-[10px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </NavLink>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-72 bg-white shadow-xl animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-200">
              <span className="text-sm font-bold text-neutral-800">Navigation</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive ? 'bg-primary-light text-primary' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {item.path === '/alerts' && unreadCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-danger text-white">
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-neutral-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-neutral-400 capitalize">{role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-neutral-600 hover:text-danger transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:pt-0 pt-14">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
