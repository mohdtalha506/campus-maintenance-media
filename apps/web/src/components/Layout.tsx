import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>Campus Copilot</h1>
          <p>Maintenance Operations</p>
        </div>
        <nav className="sidebar-nav" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Overview
          </NavLink>
          <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Work Queue
          </NavLink>
          <NavLink
            to="/verification"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Verification Queue
          </NavLink>
          <NavLink
            to="/locations"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Buildings &amp; Rooms
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={toggleTheme}>
            {isDark ? '☀️ Light Mode' : '🌙 Night Mode'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="mobile-header">
          <strong>Campus Copilot</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: '6px 10px' }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </header>
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
