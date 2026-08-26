import React, { useState, useEffect, useCallback } from 'react';
import { studentAPI } from '../api/apiClient';

export default function CourseViewer({ courseId, onBack }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [openMods, setOpenMods]     = useState({});
  const [toggling, setToggling]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentAPI.getCourseView(courseId);
      setData(res);
      if (res.modules?.length > 0) {
        const first = res.modules[0];
        setOpenMods({ [first.id]: true });
        if (first.lessons?.length > 0) setActiveLesson(first.lessons[0]);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const toggleComplete = async (lesson) => {
    setToggling(lesson.id);
    try {
      const res = await studentAPI.toggleLessonComplete(lesson.id);
      setData(prev => ({
        ...prev,
        modules: prev.modules.map(m => ({
          ...m,
          lessons: m.lessons.map(l => l.id === lesson.id ? { ...l, is_completed: res.completed } : l)
        }))
      }));
      if (activeLesson?.id === lesson.id) setActiveLesson(p => ({ ...p, is_completed: res.completed }));
    } catch (_) {}
    finally { setToggling(null); }
  };

  const allLessons  = data?.modules?.flatMap(m => m.lessons || []) || [];
  const totalL      = allLessons.length;
  const completedL  = allLessons.filter(l => l.is_completed).length;
  const pct         = totalL > 0 ? Math.round((completedL / totalL) * 100) : 0;
  const curIdx      = activeLesson ? allLessons.findIndex(l => l.id === activeLesson.id) : -1;

  const goTo = (lesson) => {
    setActiveLesson(lesson);
    const parent = data?.modules?.find(m => m.lessons?.some(l => l.id === lesson.id));
    if (parent) setOpenMods(p => ({ ...p, [parent.id]: true }));
  };

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:300, flexDirection:'column', gap:12 }}>
      <div className="spinner" />
      <span style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Loading course content…</span>
    </div>
  );

  if (!data) return (
    <div className="alert alert-error">
      <span>⚠</span> Failed to load course content.
      <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginLeft:12 }}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Back bar */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ gap:5 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
          </svg>
          Back
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--text-primary)', marginBottom:3 }}>{data.course.title}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span className="badge badge-navy">{data.course.code}</span>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>👤 {data.course.instructor}</span>
          </div>
        </div>
        {/* Overall progress */}
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:200 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>
              <span>Progress</span>
              <span style={{ fontWeight:700, color: pct===100 ? 'var(--success)' : 'var(--text-secondary)' }}>{completedL}/{totalL}</span>
            </div>
            <div className="progress-bar"><div className="progress-fill green" style={{ width:`${pct}%` }} /></div>
          </div>
          <span style={{ fontSize:'1rem', fontWeight:800, color: pct===100 ? 'var(--success)' : 'var(--text-primary)', minWidth:40, textAlign:'right' }}>{pct}%</span>
        </div>
      </div>

      {/* Layout */}
      <div className="viewer-layout">

        {/* Sidebar */}
        <div className="viewer-sidebar">
          <div className="viewer-sidebar-head">
            <div style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-primary)', marginBottom:3 }}>Course Content</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
              {data.modules.length} module{data.modules.length!==1?'s':''} · {totalL} lesson{totalL!==1?'s':''}
            </div>
          </div>
          <div className="viewer-sidebar-scroll">
            <div className="content-tree" style={{ gap:4 }}>
              {data.modules.map((mod, mi) => {
                const isOpen    = !!openMods[mod.id];
                const modDone   = (mod.lessons||[]).filter(l => l.is_completed).length;
                const modTotal  = (mod.lessons||[]).length;
                return (
                  <div key={mod.id} className={`mod-item ${isOpen ? 'open' : ''}`}>
                    <button className="mod-header" onClick={() => setOpenMods(p => ({ ...p, [mod.id]: !p[mod.id] }))}>
                      <svg className="mod-chevron" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                      </svg>
                      <div className="mod-num">{mi + 1}</div>
                      <div className="mod-info">
                        <div className="mod-title">{mod.title}</div>
                        <div className="mod-meta">{modDone}/{modTotal} done{modDone===modTotal&&modTotal>0?' · ✓ Complete':''}</div>
                      </div>
                      {/* Mini circular progress */}
                      <svg viewBox="0 0 32 32" style={{ width:28, height:28, flexShrink:0, transform:'rotate(-90deg)' }}>
                        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border)" strokeWidth="2.5"/>
                        {modTotal > 0 && (
                          <circle cx="16" cy="16" r="12" fill="none"
                            stroke={modDone===modTotal ? 'var(--success)' : 'var(--teal)'}
                            strokeWidth="2.5"
                            strokeDasharray={`${(modDone/modTotal)*75.4} 75.4`}
                          />
                        )}
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="mod-lessons">
                        {(mod.lessons||[]).length===0 && (
                          <div style={{ padding:'8px 12px', fontSize:'0.78rem', color:'var(--text-muted)', fontStyle:'italic' }}>No lessons yet</div>
                        )}
                        {(mod.lessons||[]).map((lesson, li) => {
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <button key={lesson.id}
                              className={`lesson-row ${isActive ? 'active' : ''} ${lesson.is_completed ? 'done' : ''}`}
                              onClick={() => goTo(lesson)}
                              style={{ width:'100%' }}
                            >
                              <div className="lesson-dot">
                                {lesson.is_completed ? '✓' : li + 1}
                              </div>
                              <div className="lesson-info" style={{ textAlign:'left' }}>
                                <div className="lesson-title">{lesson.title}</div>
                                <div className="lesson-dur">⏱ {lesson.duration}m</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="viewer-main">
          {!activeLesson ? (
            <div className="card">
              <div className="empty-state" style={{ padding:'56px 24px' }}>
                <div className="empty-icon">▶️</div>
                <div className="empty-title">Select a lesson to begin</div>
                <div className="empty-desc">Choose any lesson from the sidebar.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Video */}
              {activeLesson.video_url && (
                <div className="video-frame">
                  <iframe src={activeLesson.video_url} title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen />
                </div>
              )}

              {/* Lesson card */}
              <div className="lesson-content-card">
                <div className="lesson-content-head">
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                    <div>
                      <h3 style={{ fontSize:'1.1rem', fontWeight:800, color:'var(--text-primary)', marginBottom:6 }}>{activeLesson.title}</h3>
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>⏱ {activeLesson.duration} min</span>
                        {activeLesson.is_completed && (
                          <span style={{ fontSize:'0.78rem', color:'var(--success)', fontWeight:600 }}>✓ Completed</span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`btn ${activeLesson.is_completed ? 'btn-secondary' : 'btn-success'} btn-sm`}
                      onClick={() => toggleComplete(activeLesson)}
                      disabled={toggling === activeLesson.id}
                      style={{ gap:5, flexShrink:0 }}
                    >
                      {toggling === activeLesson.id
                        ? <><div className="spinner spinner-sm" style={{ borderTopColor:'white' }} /> Updating…</>
                        : activeLesson.is_completed
                          ? '↩ Mark Incomplete'
                          : '✓ Mark Complete'
                      }
                    </button>
                  </div>
                </div>
                <div className="lesson-content-body">
                  {activeLesson.content
                    ? <div className="lesson-text">{activeLesson.content}</div>
                    : <p style={{ color:'var(--text-muted)', fontStyle:'italic', fontSize:'0.875rem' }}>No written content for this lesson.</p>
                  }
                </div>
              </div>

              {/* Prev / Next */}
              <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                <button className="btn btn-secondary" disabled={curIdx <= 0}
                  onClick={() => goTo(allLessons[curIdx - 1])} style={{ gap:6 }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Previous
                </button>
                <button
                  className={`btn ${curIdx < allLessons.length - 1 ? 'btn-primary' : 'btn-teal'}`}
                  disabled={curIdx >= allLessons.length - 1 && pct < 100}
                  onClick={() => curIdx < allLessons.length - 1 && goTo(allLessons[curIdx + 1])}
                  style={{ gap:6 }}
                >
                  {curIdx >= allLessons.length - 1
                    ? (pct === 100 ? '🎉 Course Complete!' : 'Last Lesson')
                    : <>Next <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg></>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
