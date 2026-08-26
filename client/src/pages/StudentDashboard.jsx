import React, { useState, useEffect, useCallback } from 'react';
import CourseViewer from '../components/CourseViewer';
import Playground from './Playground';
import CodingPractice from './CodingPractice';
import Modal from '../components/Modal';
import { studentAPI } from '../api/apiClient';

export default function StudentDashboard({ tab, setTab }) {
  const [dashData, setDashData]         = useState(null);
  const [dashLoading, setDashLoading]   = useState(true);
  const [allCourses, setAllCourses]     = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [enrolling, setEnrolling]       = useState(null);
  const [dropping, setDropping]         = useState(null);
  const [viewingCourse, setViewingCourse] = useState(null);
  const [annModal, setAnnModal]         = useState(false);
  const [selectedAnn, setSelectedAnn]   = useState(null);

  const loadDash = useCallback(async () => {
    setDashLoading(true);
    try { const d = await studentAPI.getDashboard(); setDashData(d); }
    catch (_) {} finally { setDashLoading(false); }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try { const d = await studentAPI.getCourses(); setAllCourses(d.courses || []); }
    catch (_) {} finally { setCatalogLoading(false); }
  }, []);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { if (tab === 'catalog' || tab === 'courses') loadCatalog(); }, [tab]);

  const handleEnroll = async id => {
    setEnrolling(id);
    try { await studentAPI.enroll(id); await Promise.all([loadCatalog(), loadDash()]); }
    catch (_) {} finally { setEnrolling(null); }
  };
  const handleDrop = async id => {
    if (!window.confirm('Drop this course?')) return;
    setDropping(id);
    try { await studentAPI.dropCourse(id); await Promise.all([loadCatalog(), loadDash()]); }
    catch (_) {} finally { setDropping(null); }
  };

  if (viewingCourse) {
    return (
      <div className="page-body">
        <CourseViewer courseId={viewingCourse} onBack={() => setViewingCourse(null)} />
      </div>
    );
  }

  const enrolled = dashData?.enrolledCourses || [];

  return (
    <div className="page-body fade-in">

      {/* ── Dashboard ──────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

          {/* Hero */}
          <div className="hero-banner">
            <div className="hero-body">
              <div className="hero-eyebrow">🎓 Student Portal</div>
              <h1 className="hero-title">
                {dashLoading ? 'Loading…' : <>Welcome back, <span>{dashData?.student?.name?.split(' ')[0]}!</span></>}
              </h1>
              <p className="hero-sub">
                You have <strong style={{ color:'white' }}>{enrolled.length}</strong> active course{enrolled.length !== 1 ? 's' : ''} in progress. Keep learning!
              </p>
              <div className="hero-actions">
                <button className="btn btn-accent btn-lg" onClick={() => setTab('courses')}>
                  ▶ Continue Learning
                </button>
                <button className="btn" onClick={() => setTab('catalog')}
                  style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.25)' }}>
                  Browse Courses
                </button>
              </div>
            </div>
            <div className="hero-img-frame">
              <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80" alt="" />
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { icon:'📚', label:'Enrolled Courses', value:dashData?.summary?.enrolledCount,  cls:'si-purple' },
              { icon:'🎯', label:'Total Credits',    value:dashData?.summary?.totalCredits,    cls:'si-teal'   },
              { icon:'📈', label:'GPA',              value:dashData?.summary?.gpa,             cls:'si-green'  },
              { icon:'✅', label:'Completed',        value:enrolled.filter(c=>c.progress?.percentage===100).length, cls:'si-orange' },
            ].map((s,i) => (
              <div key={i} className={`stat-card fade-in d${i+1}`}>
                <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
                <div className="stat-value">{dashLoading ? <div className="spinner spinner-sm" /> : (s.value ?? '—')}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* In-progress courses */}
          {!dashLoading && enrolled.length > 0 && (
            <div>
              <div className="section-hd">
                <div className="section-title">📖 Continue Where You Left Off</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setTab('courses')}>View all →</button>
              </div>
              <div className="grid-auto">
                {enrolled.slice(0, 4).map(c => (
                  <CourseCard key={c.id} course={c} onLaunch={() => setViewingCourse(c.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Announcements */}
          {!dashLoading && dashData?.announcements?.length > 0 && (
            <div>
              <div className="section-hd"><div className="section-title">📢 Announcements</div></div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {dashData.announcements.map(a => (
                  <button key={a.id}
                    onClick={() => { setSelectedAnn(a); setAnnModal(true); }}
                    style={{
                      display:'flex', alignItems:'center', gap:14, padding:'13px 16px',
                      background:'white', border:'1px solid var(--border)',
                      borderRadius:'var(--radius-md)', cursor:'pointer', textAlign:'left',
                      transition:'all var(--tr)', width:'100%',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--purple)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <span style={{ fontSize:'1.1rem' }}>📣</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-dark)' }}>{a.title}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-light)', marginTop:2 }}>{a.category} · {a.date}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color:'var(--text-light)', flexShrink:0 }}>
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── My Courses ─────────────────────────────────── */}
      {tab === 'courses' && (
        <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="section-hd">
            <h2>My Enrolled Courses</h2>
            <button className="btn btn-teal btn-sm" onClick={() => setTab('catalog')}>+ Browse Catalog</button>
          </div>
          {dashLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
            : enrolled.length === 0
              ? (
                <div className="card"><div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <div className="empty-title">No enrolled courses yet</div>
                  <div className="empty-desc">Browse the catalog to find courses to enroll in.</div>
                  <button className="btn btn-primary" onClick={() => setTab('catalog')} style={{ marginTop:12 }}>Browse Catalog</button>
                </div></div>
              )
              : (
                <div className="grid-auto">
                  {enrolled.map(c => (
                    <CourseCard key={c.id} course={c}
                      onLaunch={() => setViewingCourse(c.id)}
                      onDrop={() => handleDrop(c.id)}
                      dropping={dropping === c.id}
                    />
                  ))}
                </div>
              )
          }
        </div>
      )}

      {/* ── Catalog ────────────────────────────────────── */}
      {tab === 'catalog' && (
        <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="section-hd">
            <h2>Course Catalog</h2>
            <span style={{ fontSize:'0.82rem', color:'var(--text-light)' }}>{allCourses.length} courses available</span>
          </div>
          {catalogLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
            : (
              <div className="grid-auto">
                {allCourses.map(c => (
                  <div key={c.id} className="course-card">
                    <div className="cc-img">
                      {c.image_url ? <img src={c.image_url} alt={c.title} /> : <div className="cc-img-placeholder">📘</div>}
                      <div className="cc-chip">{c.code}</div>
                      {c.is_enrolled && (
                        <div style={{ position:'absolute', top:10, right:10, padding:'2px 9px', background:'rgba(22,163,74,0.85)', borderRadius:'var(--radius-full)', fontSize:'0.68rem', fontWeight:700, color:'white' }}>✓ Enrolled</div>
                      )}
                    </div>
                    <div className="cc-body">
                      <div className="cc-title">{c.title}</div>
                      <div className="cc-inst">👤 {c.instructor}</div>
                      {c.description && (
                        <p style={{ fontSize:'0.78rem', color:'var(--text-light)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', margin:0 }}>
                          {c.description}
                        </p>
                      )}
                      <div className="cc-meta">
                        <span>🎯 {c.credits} credits</span>
                        {c.is_enrolled && c.grade && <span>📊 {c.grade}</span>}
                      </div>
                    </div>
                    <div className="cc-foot">
                      {c.is_enrolled ? (
                        <>
                          <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => setViewingCourse(c.id)}>▶ Continue</button>
                          <button className="btn btn-danger btn-sm" disabled={dropping===c.id} onClick={() => handleDrop(c.id)}>
                            {dropping===c.id ? <div className="spinner spinner-sm" /> : 'Drop'}
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-accent btn-sm" style={{ flex:1 }} disabled={enrolling===c.id} onClick={() => handleEnroll(c.id)}>
                          {enrolling===c.id ? <><div className="spinner spinner-sm spinner-white" /> Enrolling…</> : '+ Enroll Now'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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

      {/* ── Playground ─────────────────────────────────── */}
      {tab === 'playground' && (
        <div className="fade-in" style={{ margin:'-28px' }}>
          <Playground />
        </div>
      )}

      {/* Announcement modal */}
      <Modal isOpen={annModal} onClose={() => setAnnModal(false)} title={selectedAnn?.title || ''}>
        {selectedAnn && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="badge badge-purple">{selectedAnn.category}</span>
              <span style={{ fontSize:'0.78rem', color:'var(--text-light)' }}>📅 {selectedAnn.date}</span>
            </div>
            <p style={{ color:'var(--text-mid)', lineHeight:1.7, marginTop:8 }}>
              This announcement was posted by the administration. Stay updated with the latest campus news and events through your student portal.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CourseCard({ course, onLaunch, onDrop, dropping }) {
  const pct       = course.progress?.percentage ?? 0;
  const completed = course.progress?.completed ?? 0;
  const total     = course.progress?.total ?? 0;

  return (
    <div className="course-card">
      <div className="cc-img">
        {course.image_url ? <img src={course.image_url} alt={course.title} /> : <div className="cc-img-placeholder">📘</div>}
        <div className="cc-chip">{course.code}</div>
        {pct === 100 && (
          <div style={{ position:'absolute', top:10, right:10, padding:'2px 9px', background:'rgba(22,163,74,0.85)', borderRadius:'var(--radius-full)', fontSize:'0.68rem', fontWeight:700, color:'white' }}>🎉 Complete</div>
        )}
      </div>
      <div className="cc-body">
        <div className="cc-title">{course.title}</div>
        <div className="cc-inst">👤 {course.instructor}</div>
        {course.grade && (
          <div style={{ fontSize:'0.78rem', color:'var(--text-light)' }}>
            Grade: <span style={{ color:'var(--green)', fontWeight:600 }}>{course.grade}</span>
          </div>
        )}
        <div style={{ marginTop:4 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-light)', marginBottom:4 }}>
            <span>{completed}/{total} lessons</span>
            <span style={{ fontWeight:700, color: pct===100?'var(--green)':'var(--text-mid)' }}>{pct}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill green" style={{ width:`${pct}%` }} /></div>
        </div>
      </div>
      <div className="cc-foot">
        <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={onLaunch}>
          {pct === 0 ? '▶ Start' : pct === 100 ? '↺ Review' : '▶ Continue'}
        </button>
        {onDrop && (
          <button className="btn btn-danger btn-sm" disabled={dropping} onClick={onDrop}>
            {dropping ? <div className="spinner spinner-sm" /> : 'Drop'}
          </button>
        )}
      </div>
    </div>
  );
}
