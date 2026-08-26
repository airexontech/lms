import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../components/Modal';
import CourseManager from '../components/CourseManager';
import StudentManagement from '../components/StudentManagement';
import Playground from './Playground';
import CodingPractice from './CodingPractice';
import { adminAPI } from '../api/apiClient';

export default function AdminDashboard({ tab, setTab }) {
  const [stats, setStats]       = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [users, setUsers]       = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModal, setUserModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [userForm, setUserForm]   = useState({ name:'', email:'', password:'', role:'student', department:'Computer Science' });
  const [userFormErr, setUserFormErr] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [logs, setLogs]           = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { const d = await adminAPI.getStats(); setStats(d.stats); } catch (_) {}
    finally { setStatsLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { const d = await adminAPI.getUsers(); setUsers(d.users || []); } catch (_) {}
    finally { setUsersLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try { const d = await adminAPI.getLogs(); setLogs(d.logs || []); } catch (_) {}
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'logs')  loadLogs();
  }, [tab]);

  const openCreate = () => {
    setModalMode('create');
    setUserForm({ name:'', email:'', password:'', role:'student', department:'Computer Science' });
    setUserFormErr(''); setUserModal(true);
  };
  const openEdit = u => {
    setModalMode('edit');
    setUserForm({ id:u.id, name:u.name, email:u.email, role:u.role, department:u.department, password:'' });
    setUserFormErr(''); setUserModal(true);
  };
  const saveUser = async () => {
    if (!userForm.name || !userForm.email) { setUserFormErr('Name and email are required.'); return; }
    if (modalMode === 'create' && !userForm.password) { setUserFormErr('Password is required.'); return; }
    setSavingUser(true); setUserFormErr('');
    try {
      if (modalMode === 'create') await adminAPI.createUser(userForm);
      else await adminAPI.updateUser(userForm.id, { name:userForm.name, role:userForm.role, department:userForm.department });
      setUserModal(false); loadUsers(); loadStats();
    } catch (err) { setUserFormErr(err.message || 'Save failed.'); }
    finally { setSavingUser(false); }
  };
  const deleteUser = async id => {
    if (!window.confirm('Delete this user permanently?')) return;
    setDeletingUser(id);
    try { await adminAPI.deleteUser(id); setUsers(p => p.filter(u => u.id !== id)); loadStats(); }
    catch (_) {} finally { setDeletingUser(null); }
  };

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (roleFilter === 'all' || u.role === roleFilter);
  });

  const LOG_COLORS = {
    USER_LOGIN:'#16a34a', USER_REGISTERED:'#0369a1',
    ADMIN_CREATE_USER:'#6a0dad', ADMIN_UPDATE_USER:'#d97706',
    ADMIN_DELETE_USER:'#dc2626', ADMIN_ENROLL_STUDENT:'#16a34a',
    ADMIN_REMOVE_ENROLLMENT:'#dc2626', STUDENT_ENROLL:'#16a34a', STUDENT_DROP_COURSE:'#dc2626',
  };

  return (
    <div className="page-body fade-in">

      {/* ── Overview ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <h2 style={{ marginBottom:4 }}>Admin Dashboard</h2>
            <p style={{ fontSize:'0.875rem' }}>Manage courses, users, enrollments and monitor platform activity</p>
          </div>

          <div className="stats-grid">
            {[
              { icon:'👥', label:'Total Users',   value:stats?.totalUsers,  cls:'si-purple' },
              { icon:'🎓', label:'Students',      value:stats?.students,    cls:'si-teal'   },
              { icon:'📚', label:'Courses',       value:stats?.courses,     cls:'si-green'  },
              { icon:'📋', label:'Enrollments',   value:stats?.enrollments, cls:'si-orange' },
              { icon:'🛡', label:'Admins',         value:stats?.admins,      cls:'si-gray'   },
            ].map((s,i) => (
              <div key={i} className={`stat-card fade-in d${i+1}`}>
                <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
                <div className="stat-value">{statsLoading ? <div className="spinner spinner-sm" /> : (s.value ?? '—')}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Quick Actions</span></div>
            <div className="card-body" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:10 }}>
              {[
                { label:'Manage Courses',  icon:'📚', id:'courses'    },
                { label:'Manage Students', icon:'👥', id:'students'   },
                { label:'Create User',     icon:'➕', cb: () => { setTab('users'); setTimeout(openCreate,80); } },
                { label:'Code Playground', icon:'💻', id:'playground' },
                { label:'Audit Logs',      icon:'📋', id:'logs'       },
              ].map((a,i) => (
                <button key={i} className="btn btn-secondary" onClick={a.cb || (() => setTab(a.id))}
                  style={{ justifyContent:'flex-start', gap:8, padding:'11px 14px' }}>
                  <span style={{ fontSize:'1rem' }}>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Courses ──────────────────────────────────────── */}
      {tab === 'courses' && (
        <div className="fade-in">
          <div className="section-hd" style={{ marginBottom:20 }}>
            <h2>Course Builder</h2>
          </div>
          <CourseManager />
        </div>
      )}

      {/* ── Students ─────────────────────────────────────── */}
      {tab === 'students' && (
        <div className="fade-in">
          <div className="section-hd" style={{ marginBottom:20 }}>
            <h2>Student Management</h2>
          </div>
          <StudentManagement />
        </div>
      )}

      {/* ── Users ────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="section-hd">
            <h2>User Accounts</h2>
            <button className="btn btn-primary" onClick={openCreate}>+ Create User</button>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <div className="search-wrap" style={{ flex:1, minWidth:200 }}>
              <svg className="search-ico" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input className="form-input" style={{ paddingLeft:34 }} placeholder="Search users…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width:140 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="student">Student</option>
            </select>
          </div>
          {usersLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Joined</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredUsers.length === 0
                      ? <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'var(--text-light)' }}>No users found</td></tr>
                      : filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:34, height:34, borderRadius:'50%', background: u.role==='admin'?'var(--purple)':'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.75rem', color:'white', flexShrink:0 }}>
                                {u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-dark)' }}>{u.name}</div>
                                <div style={{ fontSize:'0.75rem', color:'var(--text-light)' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className={`badge ${u.role==='admin'?'badge-purple':'badge-teal'}`}>{u.role==='admin'?'🛡':'🎓'} {u.role}</span></td>
                          <td style={{ fontSize:'0.82rem' }}>{u.department}</td>
                          <td style={{ fontSize:'0.78rem', color:'var(--text-light)', whiteSpace:'nowrap' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                              <button className="btn btn-danger btn-sm" disabled={deletingUser===u.id} onClick={() => deleteUser(u.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ── Practice ─────────────────────────────────────── */}
      {tab === 'practice' && (
        <div className="fade-in" style={{ margin: '-28px' }}>
          <CodingPractice />
        </div>
      )}

      {/* ── Playground ───────────────────────────────────── */}
      {tab === 'playground' && (
        <div className="fade-in" style={{ margin:'-28px' }}>
          <Playground />
        </div>
      )}

      {/* ── Logs ─────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="section-hd">
            <h2>Audit Logs</h2>
            <button className="btn btn-secondary btn-sm" onClick={loadLogs}>↺ Refresh</button>
          </div>
          {logsLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                  <tbody>
                    {logs.length === 0
                      ? <tr><td colSpan={4} style={{ textAlign:'center', padding:32, color:'var(--text-light)' }}>No logs yet</td></tr>
                      : logs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize:'0.75rem', color:'var(--text-light)', whiteSpace:'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                          <td>
                            <div style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-dark)' }}>{log.user_name||'—'}</div>
                            <div style={{ fontSize:'0.72rem', color:'var(--text-light)' }}>{log.user_email}</div>
                          </td>
                          <td>
                            <code style={{ fontSize:'0.72rem', fontFamily:'var(--font-mono)', color: LOG_COLORS[log.action]||'var(--purple)', background:'var(--gray-50)', padding:'2px 7px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                              {log.action}
                            </code>
                          </td>
                          <td style={{ fontSize:'0.82rem', color:'var(--text-mid)' }}>{log.details}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* User modal */}
      <Modal isOpen={userModal} onClose={() => setUserModal(false)}
        title={modalMode==='create'?'Create New User':'Edit User'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setUserModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveUser} disabled={savingUser}>
            {savingUser ? <><div className="spinner spinner-sm spinner-white" /> Saving…</> : modalMode==='create'?'Create':'Save'}
          </button>
        </>}
      >
        {userFormErr && <div className="alert alert-error" style={{ marginBottom:14 }}><span>⚠</span> {userFormErr}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {['student','admin'].map(r => (
              <button key={r} type="button" onClick={() => setUserForm(p=>({...p,role:r}))} style={{
                padding:'9px 12px', borderRadius:'var(--radius-md)',
                border:`1.5px solid ${userForm.role===r?'var(--purple)':'var(--border)'}`,
                background: userForm.role===r?'var(--purple-xlight)':'var(--gray-50)',
                cursor:'pointer', textAlign:'center', transition:'all var(--tr)',
                color: userForm.role===r?'var(--purple)':'var(--text-mid)', fontWeight: userForm.role===r?700:500, fontSize:'0.875rem',
              }}>
                {r==='admin'?'🛡 Admin':'🎓 Student'}
              </button>
            ))}
          </div>
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={userForm.name} onChange={e=>setUserForm(p=>({...p,name:e.target.value}))} placeholder="Jane Smith" /></div>
          <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={userForm.email} onChange={e=>setUserForm(p=>({...p,email:e.target.value}))} placeholder="jane@school.edu" disabled={modalMode==='edit'} /></div>
          <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={userForm.department} onChange={e=>setUserForm(p=>({...p,department:e.target.value}))} placeholder="Computer Science" /></div>
          {modalMode==='create' && <div className="form-group"><label className="form-label">Password *</label><input className="form-input" type="password" value={userForm.password} onChange={e=>setUserForm(p=>({...p,password:e.target.value}))} placeholder="Min. 6 characters" /></div>}
        </div>
      </Modal>
    </div>
  );
}
