import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEPTS = ['Computer Science','Information Technology','Data Science','Electrical Engineering','Mathematics','Business Administration','General'];

export default function Register({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [form, setForm]   = useState({ name:'', email:'', password:'', role:'student', department:'Computer Science' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = e => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };

  const onSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError('All fields are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try { await register(form); }
    catch (err) { setError(err.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 60% at 70% 30%, rgba(106,13,173,0.22) 0%, transparent 55%)',pointerEvents:'none' }} />
        <div className="auth-left-body">
          <div className="nav-logo" style={{ marginBottom:44 }}>
            <div className="nav-logo-mark">E</div>
            <span className="nav-logo-text" style={{ fontSize:'1.15rem' }}>Edu<span>Portal</span></span>
          </div>
          <div className="hero-eyebrow" style={{ marginBottom:14 }}>✨ Join thousands of learners</div>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'clamp(1.8rem,3.5vw,2.5rem)', color:'white', lineHeight:1.15, marginBottom:14, letterSpacing:'-0.02em' }}>
            Start your learning<br />
            <span style={{ color:'var(--orange-light)' }}>journey today</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.65, maxWidth:400, marginBottom:32 }}>
            Create your account in seconds and get instant access to structured courses, practice problems, quizzes, and a live code playground.
          </p>
          {[
            { icon:'🚀', text:'Instant access after signup — no delays' },
            { icon:'📈', text:'Visual progress tracking per course' },
            { icon:'👨‍🏫', text:'Content curated by expert instructors' },
          ].map((f,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'var(--radius-md)', marginBottom:8 }}>
              <span style={{ fontSize:'1rem' }}>{f.icon}</span>
              <span style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.72)' }}>{f.text}</span>
            </div>
          ))}
          <div style={{ marginTop:36, borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&auto=format&fit=crop&q=80" alt="Students" style={{ width:'100%', display:'block', opacity:0.8 }} />
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box fade-in">
          <div className="nav-logo" style={{ marginBottom:36 }}>
            <div className="nav-logo-mark">E</div>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem', color:'var(--text-dark)' }}>Edu<span style={{ color:'var(--purple)' }}>Portal</span></span>
          </div>

          <h2 className="auth-title">Create your account</h2>
          <p className="auth-sub">Fill in your details to get started</p>

          {error && <div className="alert alert-error" style={{ marginBottom:16 }}><span>⚠</span> {error}</div>}

          <form className="auth-form" onSubmit={onSubmit}>
            {/* Role picker */}
            <div>
              <div className="form-label" style={{ marginBottom:6 }}>Account type</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[{v:'student',l:'Student',i:'🎓',d:'Enroll & learn'},{v:'admin',l:'Admin',i:'🛡',d:'Manage platform'}].map(r => (
                  <button key={r.v} type="button" onClick={() => setForm(p=>({...p,role:r.v}))} style={{
                    padding:'9px 12px', borderRadius:'var(--radius-md)',
                    border:`1.5px solid ${form.role===r.v?'var(--purple)':'var(--border)'}`,
                    background: form.role===r.v ? 'var(--purple-xlight)' : 'var(--gray-50)',
                    cursor:'pointer', textAlign:'center', transition:'all var(--tr)',
                  }}>
                    <div style={{ fontSize:'1rem', marginBottom:2 }}>{r.i}</div>
                    <div style={{ fontSize:'0.85rem', fontWeight:700, color: form.role===r.v ? 'var(--purple)' : 'var(--text-dark)' }}>{r.l}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-light)' }}>{r.d}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full name</label>
              <div className="input-wrap has-ico-l">
                <svg className="input-ico ico-l" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                </svg>
                <input className="form-input" type="text" name="name" value={form.name} onChange={onChange} placeholder="Alex Johnson" autoFocus />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-wrap has-ico-l">
                <svg className="input-ico ico-l" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <input className="form-input" type="email" name="email" value={form.email} onChange={onChange} placeholder="you@school.edu" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" name="department" value={form.department} onChange={onChange}>
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrap has-ico-l">
                <svg className="input-ico ico-l" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                </svg>
                <input className="form-input" type="password" name="password" value={form.password} onChange={onChange} placeholder="Min. 6 characters" autoComplete="new-password" />
              </div>
            </div>

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop:4 }}>
              {loading ? <><div className="spinner spinner-sm spinner-white" /> Creating account…</> : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:22, fontSize:'0.875rem', color:'var(--text-light)' }}>
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--purple)', fontWeight:600, fontSize:'inherit' }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
