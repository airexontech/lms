import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';

const ADMIN_TABS = [
  { id: 'overview',    label: 'Overview',    icon: '🏠' },
  { id: 'courses',     label: 'Courses',     icon: '📚' },
  { id: 'students',    label: 'Students',    icon: '👥' },
  { id: 'users',       label: 'Users',       icon: '👤' },
  { id: 'practice',   label: 'Practice',    icon: '🧩' },
  { id: 'playground',  label: 'Playground',  icon: '💻' },
  { id: 'logs',        label: 'Audit Logs',  icon: '📋' },
];

const STUDENT_TABS = [
  { id: 'dashboard',  label: 'Dashboard',   icon: '🏠' },
  { id: 'courses',    label: 'My Courses',  icon: '📚' },
  { id: 'catalog',    label: 'Catalog',     icon: '🏪' },
  { id: 'practice',  label: 'Practice',    icon: '🧩' },
  { id: 'playground', label: 'Playground',  icon: '💻' },
];

function MainApp() {
  const { user, loading, isAdmin, isStudent } = useAuth();
  const [authView, setAuthView]   = useState('login');
  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    if (isAdmin)   setActiveTab('overview');
    if (isStudent) setActiveTab('dashboard');
  }, [isAdmin, isStudent]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading EduPortal…</p>
      </div>
    );
  }

  if (!user) {
    return authView === 'login'
      ? <Login onSwitchToRegister={() => setAuthView('register')} />
      : <Register onSwitchToLogin={() => setAuthView('login')} />;
  }

  const tabs = isAdmin ? ADMIN_TABS : STUDENT_TABS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ flex: 1 }}>
        {isAdmin   && <AdminDashboard   tab={activeTab} setTab={setActiveTab} />}
        {isStudent && <StudentDashboard tab={activeTab} setTab={setActiveTab} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider><MainApp /></AuthProvider>
  );
}
