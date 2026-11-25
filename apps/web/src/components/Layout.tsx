import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { NotificationDTO } from '@campus/shared';
import { webApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await webApi.listNotifications();
      setNotifications(Array.isArray(res?.items) ? res.items : []);
      setUnreadCount(typeof res?.unreadCount === 'number' ? res.unreadCount : 0);
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications();
    }, 20000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  async function handleReadAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await webApi.markAllNotificationsRead();
    } catch {
      // ignore
    }
  }

  async function handleOpenNotification(item: NotificationDTO) {
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setNotifOpen(false);
    try {
      const res = await webApi.markNotificationRead(item.id);
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // ignore
    }
    if (item.ticketId) {
      navigate(`/tickets/${item.ticketId}`);
    }
  }

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
          <button
            type="button"
            className="nav-link"
            style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => {
              setNotifOpen((prev) => !prev);
              setMenuOpen(false);
            }}
          >
            <span>🔔 Notifications</span>
            {unreadCount > 0 && <span className="notif-count-pill">{unreadCount}</span>}
          </button>
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
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Notifications"
              style={{ padding: '6px 10px', position: 'relative' }}
            >
              🔔
              {unreadCount > 0 && <span className="notif-count-pill">{unreadCount}</span>}
            </button>
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

        {notifOpen && (
          <div className="notif-drawer">
            <div className="notif-drawer-header">
              <strong>Notifications ({unreadCount} unread)</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={handleReadAll}>
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNotifOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: '12px 0 0', fontSize: 13 }}>
                No notifications yet.
              </p>
            ) : (
              <div className="notif-list">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`notif-item ${!n.read ? 'unread' : ''}`}
                    onClick={() => handleOpenNotification(n)}
                  >
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-body">{n.body}</div>
                    <div className="notif-item-time">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
