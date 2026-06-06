import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, ShoppingCart, MonitorSmartphone,
  ShoppingBag, BookOpen, BarChart2, UserCheck, Star, Settings, Store,
  LogOut, Zap
} from 'lucide-react';
import { getUser, logout } from '../lib/auth.js';

const NAV = [
  { section: 'Main' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: MonitorSmartphone, label: 'Point of Sale' },
  { section: 'Transactions' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/purchases', icon: ShoppingBag, label: 'Purchases' },
  { section: 'Master' },
  { to: '/items', icon: Package, label: 'Items & Stock' },
  { to: '/parties', icon: Users, label: 'Parties' },
  { section: 'Finance' },
  { to: '/accounting', icon: BookOpen, label: 'Accounting' },
  { section: 'More' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/loyalty', icon: Star, label: 'Loyalty' },
  { to: '/staff', icon: UserCheck, label: 'Staff' },
  { to: '/online-store', icon: Store, label: 'Online Store' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Shell() {
  const user = getUser();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Zap size={22} color="#4d9ef7" />
          <div>
            RetailOne
            <div><span>v1.0</span></div>
          </div>
        </div>

        <nav style={{ flex: 1, paddingBottom: 8 }}>
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="sidebar-section">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'sidebar-item' + (isActive ? ' active' : '')}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-user">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#c9d1de', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 11 }}>{user?.email}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout" style={{ color: '#7a8fa6' }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}
