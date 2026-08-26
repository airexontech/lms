import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ tabs = [], activeTab, onTabChange }) {
  const { user, logout, isAdmin } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        {/* Brand */}
        <div className="nav-logo">
          <div className="nav-logo-mark">E</div>
          <span className="nav-logo-text">Edu<span>Portal</span></span>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="nav-tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => onTabChange(t.id)}
              >
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="nav-right">
          {user && (
            <>
              <span className={`nav-badge ${isAdmin ? 'nav-badge-admin' : 'nav-badge-student'}`}>
                {isAdmin ? '🛡 Admin' : '🎓 Student'}
              </span>
              <div className="nav-user">
                <div className="nav-avatar">{initials}</div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span className="nav-username">{user.name}</span>
                  <span className="nav-role">{user.department}</span>
                </div>
              </div>
              <button className="btn btn-dark btn-sm" onClick={logout} style={{ gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
