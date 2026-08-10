import React, { useState } from 'react';
import Login from './components/Login';
import Customers from './components/Customers';
import Products from './components/Products';
import Challans from './components/Challans';
import './App.css';

const ROLE_COLORS: Record<string, string> = {
  admin: '#7c3aed', sales: '#1a73e8', warehouse: '#0891b2', accounts: '#059669',
};
const ROLE_ICONS: Record<string, string> = {
  admin: '🛡️', sales: '💼', warehouse: '🏭', accounts: '💰',
};

type Module = 'customers' | 'products' | 'challans';

function App() {
  const stored = localStorage.getItem('user');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState<any>(stored ? JSON.parse(stored) : null);
  const [activeModule, setActiveModule] = useState<Module>('customers');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = (t: string, u: any) => { setToken(t); setUser(u); };
  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setToken(''); setUser(null);
  };

  if (!token) return <Login onLogin={handleLogin} />;

  const role = user?.role || 'sales';
  const roleColor = ROLE_COLORS[role] || '#1a73e8';

  const navItems: { key: Module; label: string; icon: string; roles: string[] }[] = [
    { key: 'customers', label: 'Customers',       icon: '👥', roles: ['admin', 'sales', 'warehouse', 'accounts'] },
    { key: 'products',  label: 'Products & Stock', icon: '📦', roles: ['admin', 'warehouse', 'accounts', 'sales'] },
    { key: 'challans',  label: 'Sales Challans',   icon: '📋', roles: ['admin', 'sales', 'accounts'] },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{ '--role-color': roleColor } as any}>
        <div className="sidebar-brand">
          <span className="brand">CRM</span>
          {sidebarOpen && <span className="brand-sub">Management</span>}
        </div>
        <nav className="sidebar-nav">
          {navItems.filter(n => n.roles.includes(role)).map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeModule === item.key ? 'nav-item-active' : ''}`}
              onClick={() => setActiveModule(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-role-icon">{ROLE_ICONS[role]}</span>
            {sidebarOpen && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name}</span>
                <span className="sidebar-user-role">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button className="sidebar-logout" onClick={handleLogout}>Logout</button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="app-main">
        <header className="topbar" style={{ background: roleColor }}>
          <button className="topbar-toggle" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <span className="topbar-title">
            {navItems.find(n => n.key === activeModule)?.icon}{' '}
            {navItems.find(n => n.key === activeModule)?.label}
          </span>
          <div className="topbar-right">
            <span className="role-badge-nav">{ROLE_ICONS[role]} {role.charAt(0).toUpperCase() + role.slice(1)}</span>
            <span className="user-name">{user?.name}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <main className="main-content">
          {activeModule === 'customers' && <Customers userRole={role} />}
          {activeModule === 'products'  && <Products  userRole={role} />}
          {activeModule === 'challans'  && <Challans  userRole={role} />}
        </main>
      </div>
    </div>
  );
}

export default App;
