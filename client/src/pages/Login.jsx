import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [form, setForm]   = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const fillDemo = (email, password) => { setForm({ email, password }); setError(''); };

  const onSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try { await login(form); }
    catch (err) { setError(err.message || 'Invalid email or password.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 60% at 80% 40%, rgba(106,13,173,0.25) 0%, transparent 55%)',pointerEvents:'none' }} />
        <div className="auth-left-body">
          <div className="nav-logo" style={{ marginBottom: 44 }}>
            <div className="nav-logo-mark">E</div>
            <span className="nav-logo-text" style={{ fontSize:'1.15rem' }}>Edu<span>Portal</span></span>
          </div>

          <div className="hero-eyebrow" style={{ marginBottom: 14 }}>🎓 Learning Management System</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.8rem,3.5vw,2.5rem)', color:'white', lineHeight:1.15, marginBottom:14, letterSpacing:'-0.02em' }}>
            Your gateway to<br />
            <span style={{ color:'var(--orange-light)' }}>smarter learning</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.65, maxWidth:400, marginBottom:32 }}>
            Access structured courses with modules, lessons, quizzes, coding practice and assignments — all in one place.
          </p>

          {[
            { icon:'📚', text:'Structured course content with modules & lessons' },
            { icon:'💻', text:'Built-in Java, Python & JavaScript code playground' },
            { icon:'📊', text:'Real-time progress tracking & completion badges' },
          ].map((f, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'var(--radius-md)', marginBottom:8 }}>
              <span style={{ fontSize:'1rem' }}>{f.icon}</span>
              <span style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.72)' }}>{f.text}</span>
            </div>
          ))}

          <div style={{ marginTop:36, borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=700&auto=format&fit=crop&q=80" alt="Students" style={{ width:'100%', display:'block', opacity:0.8 }} />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-box fade-in">
          <div className="nav-logo" style={{ marginBottom: 36 }}>
            <div className="nav-logo-mark">E</div>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem', color:'var(--text-dark)' }}>Edu<span style={{ color:'var(--purple)' }}>Portal</span></span>
          </div>

          <h2 className="auth-title">Sign in to your account</h2>
          <p className="auth-sub">Welcome back — enter your credentials below</p>

          {error && <div className="alert alert-error" style={{ marginBottom:16 }}><span>⚠</span> {error}</div>}

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-wrap has-ico-l">
                <svg className="input-ico ico-l" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <input className="form-input" type="email" name="email" value={form.email} onChange={onChange} placeholder="you@school.edu" autoComplete="email" autoFocus />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrap has-ico-l">
                <svg className="input-ico ico-l" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                </svg>
                <input className="form-input" type="password" name="password" value={form.password} onChange={onChange} placeholder="••••••••" autoComplete="current-password" />
              </div>
            </div>
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop:4 }}>
              {loading ? <><div className="spinner spinner-sm spinner-white" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider" style={{ margin:'22px 0 14px' }}><span>Quick demo access</span></div>

          <div className="demo-cards">
            <button className="demo-card" onClick={() => fillDemo('admin@school.edu','admin123')}>
              <div className="demo-card-icon">🛡</div>
              <div className="demo-card-lbl">Admin</div>
              <div className="demo-card-val">admin@school.edu</div>
            </button>
            <button className="demo-card" onClick={() => fillDemo('student@school.edu','student123')}>
              <div className="demo-card-icon">🎓</div>
              <div className="demo-card-lbl">Student</div>
              <div className="demo-card-val">student@school.edu</div>
            </button>
          </div>

          <p style={{ textAlign:'center', marginTop:24, fontSize:'0.875rem', color:'var(--text-light)' }}>
            Don't have an account?{' '}
            <button type="button" onClick={onSwitchToRegister} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontWeight:600, fontSize:'inherit' }}>
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
