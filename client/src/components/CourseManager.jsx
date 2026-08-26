import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { contentAPI } from '../api/apiClient';

// ── Default form factories ────────────────────────────────────
const emptyC  = () => ({ code:'', title:'', description:'', instructor:'', credits:3, image_url:'' });
const emptyM  = () => ({ title:'', summary:'', order_index:1 });
const emptyL  = () => ({ title:'', content:'', video_url:'', duration:15, order_index:1 });
const emptyQ  = () => ({ title:'', description:'', difficulty:'Easy', starter_code:`public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`, solution_code:'', test_cases:'[{"input":"","expected":""}]', hints:'', order_index:1 });
const emptyQz = () => ({ title:'', description:'', time_limit_minutes:30, passing_score:60, order_index:1 });
const emptyMcq= () => ({ question:'', option_a:'', option_b:'', option_c:'', option_d:'', correct_answer:'A', explanation:'', order_index:1 });
const emptyA  = () => ({ title:'', description:'', instructions:'', due_date:'', max_score:100, order_index:1 });

const DIFF_COLORS = { Easy:'badge-green', Medium:'badge-amber', Hard:'badge-red' };
const ANSWER_LABELS = { A:'Option A', B:'Option B', C:'Option C', D:'Option D' };

// ── Small reusable pieces ─────────────────────────────────────
function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
      <span className="card-title">{title}</span>
      {onAdd && <button className="btn btn-teal btn-sm" onClick={onAdd}>{addLabel || '+ Add'}</button>}
    </div>
  );
}

function EmptyCard({ icon='📭', title='Nothing here yet', desc='' }) {
  return (
    <div className="empty-state" style={{ padding:'36px 0' }}>
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
    </div>
  );
}

function ActionBtns({ onEdit, onDelete, deleting, extra }) {
  return (
    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
      {extra}
      <button className="btn btn-secondary btn-sm btn-icon" onClick={onEdit} title="Edit">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
      </button>
      <button className="btn btn-danger btn-sm btn-icon" disabled={deleting} onClick={onDelete} title="Delete">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd"/></svg>
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CourseManager() {
  const [courses, setCourses]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);  // selected course
  const [contentTab, setContentTab] = useState('modules'); // modules | questions | quizzes | assignments
  const [search, setSearch]       = useState('');
  const [deleting, setDeleting]   = useState(null);

  // Per-tab data
  const [openMods, setOpenMods]   = useState({});
  const [questions, setQuestions] = useState([]);
  const [quizzes, setQuizzes]     = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null); // quiz whose MCQs are expanded
  const [assignments, setAssignments] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Modal state
  const [modal, setModal]   = useState(null); // { type, mode, parentId, data }
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // ── Data loaders ────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoading(true);
    try { const d = await contentAPI.getCourses(); setCourses(d.courses || []); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  const loadModules = useCallback(async (id) => {
    try {
      const d = await contentAPI.getCourseDetails(id);
      setCourses(p => p.map(c => c.id === id ? { ...c, modules: d.modules } : c));
      setSelected(s => s?.id === id ? { ...s, modules: d.modules } : s);
    } catch (_) {}
  }, []);

  const loadTabData = useCallback(async (courseId, tab) => {
    if (!courseId) return;
    setTabLoading(true);
    try {
      if (tab === 'modules')     await loadModules(courseId);
      if (tab === 'questions') { const d = await contentAPI.getCodingQuestions(courseId);  setQuestions(d.questions || []); }
      if (tab === 'quizzes')   { const d = await contentAPI.getQuizzes(courseId);          setQuizzes(d.quizzes || []); }
      if (tab === 'assignments'){ const d = await contentAPI.getAssignments(courseId);     setAssignments(d.assignments || []); }
    } catch (_) {} finally { setTabLoading(false); }
  }, [loadModules]);

  const selectCourse = async (c) => {
    setSelected(c); setOpenMods({}); setActiveQuiz(null);
    setContentTab('modules');
    setTabLoading(true);
    try {
      const d = await contentAPI.getCourseDetails(c.id);
      const updated = { ...c, modules: d.modules };
      setCourses(p => p.map(x => x.id === c.id ? updated : x));
      setSelected(updated);
    } catch (_) {} finally { setTabLoading(false); }
  };

  const switchTab = (tab) => {
    setContentTab(tab);
    loadTabData(selected?.id, tab);
  };

  // ── Modal helpers ────────────────────────────────────────────
  const openModal = (type, mode = 'create', data = {}, parentId = null) => {
    setFormErr('');
    let defaults;
    if (type === 'course')     defaults = emptyC();
    else if (type === 'module')    defaults = emptyM();
    else if (type === 'lesson')    defaults = emptyL();
    else if (type === 'question')  defaults = emptyQ();
    else if (type === 'quiz')      defaults = emptyQz();
    else if (type === 'mcq')       defaults = emptyMcq();
    else if (type === 'assignment')defaults = emptyA();
    setForm(mode === 'edit' ? { ...data } : defaults);
    setModal({ type, mode, parentId });
  };

  const handleField = (e) => {
    const { name, value, type } = e.target;
    setForm(p => ({ ...p, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSave = async () => {
    setSaving(true); setFormErr('');
    const { type, mode, parentId } = modal;
    try {
      switch (type) {
        case 'course':
          if (!form.code || !form.title || !form.instructor) { setFormErr('Code, title and instructor are required.'); return; }
          mode === 'create' ? await contentAPI.createCourse(form) : await contentAPI.updateCourse(form.id, form);
          await loadCourses();
          break;
        case 'module':
          if (!form.title) { setFormErr('Title is required.'); return; }
          mode === 'create' ? await contentAPI.createModule({ ...form, course_id: parentId }) : await contentAPI.updateModule(form.id, form);
          await loadModules(selected.id);
          break;
        case 'lesson':
          if (!form.title) { setFormErr('Title is required.'); return; }
          mode === 'create' ? await contentAPI.createLesson({ ...form, module_id: parentId }) : await contentAPI.updateLesson(form.id, form);
          await loadModules(selected.id);
          break;
        case 'question':
          if (!form.title || !form.description) { setFormErr('Title and description are required.'); return; }
          mode === 'create' ? await contentAPI.createCodingQuestion({ ...form, course_id: selected.id }) : await contentAPI.updateCodingQuestion(form.id, form);
          await loadTabData(selected.id, 'questions');
          break;
        case 'quiz':
          if (!form.title) { setFormErr('Title is required.'); return; }
          mode === 'create' ? await contentAPI.createQuiz({ ...form, course_id: selected.id }) : await contentAPI.updateQuiz(form.id, form);
          await loadTabData(selected.id, 'quizzes');
          break;
        case 'mcq':
          if (!form.question || !form.option_a || !form.option_b || !form.option_c || !form.option_d) { setFormErr('All fields are required.'); return; }
          mode === 'create' ? await contentAPI.createQuizQuestion({ ...form, quiz_id: parentId }) : await contentAPI.updateQuizQuestion(form.id, form);
          await loadTabData(selected.id, 'quizzes');
          break;
        case 'assignment':
          if (!form.title || !form.description) { setFormErr('Title and description are required.'); return; }
          mode === 'create' ? await contentAPI.createAssignment({ ...form, course_id: selected.id }) : await contentAPI.updateAssignment(form.id, form);
          await loadTabData(selected.id, 'assignments');
          break;
        default: break;
      }
      setModal(null);
    } catch (err) {
      setFormErr(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type, id, extra) => {
    const labels = { course:'course', module:'module', lesson:'lesson', question:'coding question', quiz:'quiz', mcq:'question', assignment:'assignment' };
    if (!window.confirm(`Delete this ${labels[type]}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      if (type === 'course')    { await contentAPI.deleteCourse(id); setCourses(p => p.filter(c => c.id !== id)); if (selected?.id === id) setSelected(null); }
      if (type === 'module')    { await contentAPI.deleteModule(id); await loadModules(selected.id); }
      if (type === 'lesson')    { await contentAPI.deleteLesson(id); await loadModules(selected.id); }
      if (type === 'question')  { await contentAPI.deleteCodingQuestion(id); setQuestions(p => p.filter(q => q.id !== id)); }
      if (type === 'quiz')      { await contentAPI.deleteQuiz(id); setQuizzes(p => p.filter(q => q.id !== id)); if (activeQuiz === id) setActiveQuiz(null); }
      if (type === 'mcq')       { await contentAPI.deleteQuizQuestion(id); await loadTabData(selected.id, 'quizzes'); }
      if (type === 'assignment'){ await contentAPI.deleteAssignment(id); setAssignments(p => p.filter(a => a.id !== id)); }
    } catch (_) {} finally { setDeleting(null); }
  };

  const filtered = courses.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const CONTENT_TABS = [
    { id:'modules',     label:'📦 Modules & Lessons' },
    { id:'questions',   label:'💻 Coding Questions'  },
    { id:'quizzes',     label:'📝 Quizzes'            },
    { id:'assignments', label:'📋 Assignments'        },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>

      {/* ── Course Sidebar ───────────────────────────────── */}
      <div className="card" style={{ overflow:'hidden', position:'sticky', top:76 }}>
        <div className="card-header" style={{ flexDirection:'column', gap:8, padding:'12px 14px', alignItems:'stretch' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span className="card-title">Courses</span>
            <button className="btn btn-teal btn-sm" onClick={() => openModal('course','create')}>+ New</button>
          </div>
          <div className="search-wrap">
            <svg className="search-ico" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
            <input className="form-input" style={{ paddingLeft:34, fontSize:'0.83rem', height:34 }} placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ maxHeight:560, overflowY:'auto' }}>
          {loading
            ? <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="spinner" /></div>
            : filtered.length === 0
              ? <EmptyCard title="No courses yet" />
              : filtered.map(c => (
                <button key={c.id} onClick={() => selectCourse(c)} style={{
                  width:'100%', textAlign:'left', padding:'10px 14px',
                  background: selected?.id===c.id ? '#f0fdf9' : 'transparent',
                  borderLeft:`3px solid ${selected?.id===c.id ? 'var(--teal)' : 'transparent'}`,
                  border:'none', borderBottom:'1px solid var(--border)',
                  cursor:'pointer', transition:'all var(--transition)',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  {c.image_url
                    ? <img src={c.image_url} alt="" style={{ width:34, height:34, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:34, height:34, borderRadius:6, background:'#e0f2fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>📘</div>
                  }
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'0.83rem', fontWeight:700, color: selected?.id===c.id ? 'var(--teal-dark)' : 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{c.code} · {c.credits} cr</div>
                  </div>
                </button>
              ))
          }
        </div>
      </div>

      {/* ── Course Detail ─────────────────────────────────── */}
      {!selected
        ? <div className="card"><EmptyCard icon="👈" title="Select a course" desc="Choose from the sidebar or create a new course." /></div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Course header card */}
            <div className="card">
              <div style={{ padding:'16px 18px', display:'flex', alignItems:'flex-start', gap:14 }}>
                {selected.image_url
                  ? <img src={selected.image_url} alt="" style={{ width:72, height:54, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:72, height:54, borderRadius:8, background:'#e0f2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0 }}>📘</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span className="badge badge-navy">{selected.code}</span>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{selected.credits} credits</span>
                  </div>
                  <h3 style={{ fontSize:'1rem', fontWeight:700, marginBottom:3 }}>{selected.title}</h3>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>👤 {selected.instructor}</div>
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal('course','edit',selected)}>✏ Edit</button>
                  <button className="btn btn-danger btn-sm" disabled={deleting===selected.id} onClick={() => handleDelete('course',selected.id)}>🗑</button>
                </div>
              </div>
              {selected.description && (
                <div style={{ padding:'0 18px 14px', paddingTop:10, fontSize:'0.82rem', color:'var(--text-secondary)', borderTop:'1px solid var(--border)' }}>
                  {selected.description}
                </div>
              )}
            </div>

            {/* Content tabs */}
            <div style={{ display:'flex', gap:3, overflowX:'auto', paddingBottom:2 }}>
              {CONTENT_TABS.map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)} style={{
                  padding:'8px 14px', borderRadius:'var(--radius-md)',
                  border: `1.5px solid ${contentTab===t.id ? 'var(--teal)' : 'var(--border)'}`,
                  background: contentTab===t.id ? 'var(--teal-xlight)' : 'var(--bg-white)',
                  color: contentTab===t.id ? 'var(--teal-dark)' : 'var(--text-secondary)',
                  fontWeight: contentTab===t.id ? 700 : 500, fontSize:'0.82rem',
                  cursor:'pointer', transition:'all var(--transition)', whiteSpace:'nowrap', flexShrink:0,
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Modules & Lessons tab ─────────────────── */}
            {contentTab === 'modules' && (
              <div className="card" style={{ padding:18 }}>
                <SectionHeader title="Modules & Lessons" onAdd={() => openModal('module','create',{},selected.id)} addLabel="+ Add Module" />
                {tabLoading
                  ? <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="spinner" /></div>
                  : !selected.modules || selected.modules.length === 0
                    ? <EmptyCard title="No modules yet" desc="Add a module to start building course content." />
                    : (
                      <div className="content-tree">
                        {selected.modules.map(mod => {
                          const isOpen = !!openMods[mod.id];
                          return (
                            <div key={mod.id} className={`mod-item ${isOpen?'open':''}`}>
                              <div className="mod-header" onClick={() => setOpenMods(p => ({ ...p, [mod.id]:!p[mod.id] }))}>
                                <svg className="mod-chevron" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                                <div className="mod-num">{mod.order_index}</div>
                                <div className="mod-info">
                                  <div className="mod-title">{mod.title}</div>
                                  <div className="mod-meta">{(mod.lessons||[]).length} lesson{(mod.lessons||[]).length!==1?'s':''}</div>
                                </div>
                                <div className="mod-actions" onClick={e => e.stopPropagation()}>
                                  <ActionBtns onEdit={() => openModal('module','edit',mod)} onDelete={() => handleDelete('module',mod.id,selected.id)} deleting={deleting===mod.id}
                                    extra={<button className="btn btn-primary btn-sm" style={{ fontSize:'0.72rem', padding:'4px 9px' }} onClick={() => openModal('lesson','create',{},mod.id)}>+ Lesson</button>} />
                                </div>
                              </div>
                              {isOpen && (
                                <div className="mod-lessons">
                                  {mod.summary && <div style={{ padding:'6px 10px 9px', fontSize:'0.79rem', color:'var(--text-muted)', borderBottom:'1px solid var(--border)', marginBottom:3 }}>{mod.summary}</div>}
                                  {(mod.lessons||[]).length===0
                                    ? <div style={{ padding:'10px 12px', fontSize:'0.8rem', color:'var(--text-muted)', fontStyle:'italic' }}>No lessons yet</div>
                                    : (mod.lessons||[]).map(l => (
                                      <div key={l.id} className="lesson-row" style={{ cursor:'default' }}>
                                        <div className="lesson-dot">▶</div>
                                        <div className="lesson-info">
                                          <div className="lesson-title">{l.title}</div>
                                          <div className="lesson-dur">⏱ {l.duration} min · Order {l.order_index}</div>
                                        </div>
                                        <ActionBtns onEdit={() => openModal('lesson','edit',l)} onDelete={() => handleDelete('lesson',l.id,selected.id)} deleting={deleting===l.id} />
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                }
              </div>
            )}

            {/* ── Coding Questions tab ─────────────────── */}
            {contentTab === 'questions' && (
              <div className="card" style={{ padding:18 }}>
                <SectionHeader title="Coding Questions" onAdd={() => openModal('question','create')} addLabel="+ Add Question" />
                {tabLoading
                  ? <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="spinner" /></div>
                  : questions.length === 0
                    ? <EmptyCard icon="💻" title="No coding questions yet" desc="Add practice problems for this course." />
                    : (
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {questions.map((q, qi) => (
                          <div key={q.id} style={{ background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                              <div style={{ width:28, height:28, borderRadius:'var(--radius-sm)', background:'var(--navy)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.78rem', fontWeight:700, flexShrink:0 }}>{qi+1}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                                  <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)' }}>{q.title}</span>
                                  <span className={`badge ${DIFF_COLORS[q.difficulty]||'badge-slate'}`}>{q.difficulty}</span>
                                </div>
                                <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>{q.description}</p>
                                {q.hints && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}>💡 {q.hints}</div>}
                              </div>
                              <ActionBtns onEdit={() => openModal('question','edit',q)} onDelete={() => handleDelete('question',q.id)} deleting={deleting===q.id} />
                            </div>
                            {/* Test cases preview */}
                            {q.test_cases && q.test_cases !== '[]' && (() => {
                              try {
                                const tc = JSON.parse(q.test_cases);
                                return tc.length > 0 ? (
                                  <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
                                    {tc.slice(0,3).map((t,i) => (
                                      <div key={i} style={{ padding:'3px 10px', background:'#f0fdf9', border:'1px solid #99f6e4', borderRadius:4, fontSize:'0.72rem', fontFamily:'var(--font-mono)', color:'var(--teal-dark)' }}>
                                        {t.input ? `In: ${t.input}` : ''}{t.input && t.expected ? ' → ' : ''}{t.expected ? `Out: ${t.expected}` : ''}
                                      </div>
                                    ))}
                                    {tc.length > 3 && <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', alignSelf:'center' }}>+{tc.length-3} more</span>}
                                  </div>
                                ) : null;
                              } catch(_) { return null; }
                            })()}
                          </div>
                        ))}
                      </div>
                    )
                }
              </div>
            )}

            {/* ── Quizzes tab ───────────────────────────── */}
            {contentTab === 'quizzes' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="card" style={{ padding:18 }}>
                  <SectionHeader title="Quizzes" onAdd={() => openModal('quiz','create')} addLabel="+ Add Quiz" />
                  {tabLoading
                    ? <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="spinner" /></div>
                    : quizzes.length === 0
                      ? <EmptyCard icon="📝" title="No quizzes yet" desc="Create a quiz with MCQ questions for this course." />
                      : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {quizzes.map(qz => (
                            <div key={qz.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg-subtle)', cursor:'pointer' }}
                                onClick={() => setActiveQuiz(activeQuiz===qz.id ? null : qz.id)}>
                                <svg style={{ width:15, height:15, color:'var(--text-muted)', transform: activeQuiz===qz.id?'rotate(90deg)':'none', transition:'transform var(--transition)', flexShrink:0 }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)' }}>{qz.title}</div>
                                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                                    ⏱ {qz.time_limit_minutes} min · Pass: {qz.passing_score}% · {(qz.questions||[]).length} MCQ{(qz.questions||[]).length!==1?'s':''}
                                  </div>
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                  <ActionBtns
                                    onEdit={() => openModal('quiz','edit',qz)}
                                    onDelete={() => handleDelete('quiz',qz.id)}
                                    deleting={deleting===qz.id}
                                    extra={<button className="btn btn-primary btn-sm" style={{ fontSize:'0.72rem', padding:'4px 9px' }} onClick={e => { e.stopPropagation(); openModal('mcq','create',{},qz.id); }}>+ MCQ</button>}
                                  />
                                </div>
                              </div>
                              {/* MCQ list */}
                              {activeQuiz===qz.id && (
                                <div style={{ background:'var(--bg-white)' }}>
                                  {(qz.questions||[]).length===0
                                    ? <div style={{ padding:'12px 16px', fontSize:'0.82rem', color:'var(--text-muted)', fontStyle:'italic' }}>No MCQ questions yet. Click "+ MCQ" to add.</div>
                                    : (qz.questions||[]).map((mcq, mi) => (
                                      <div key={mcq.id} style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
                                        <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--teal)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.68rem', fontWeight:700, flexShrink:0, marginTop:1 }}>{mi+1}</div>
                                        <div style={{ flex:1, minWidth:0 }}>
                                          <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text-primary)', marginBottom:6 }}>{mcq.question}</div>
                                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px' }}>
                                            {['A','B','C','D'].map(opt => (
                                              <div key={opt} style={{
                                                fontSize:'0.78rem', padding:'3px 8px', borderRadius:4,
                                                background: mcq.correct_answer===opt ? 'var(--success-bg)' : 'var(--bg-subtle)',
                                                color: mcq.correct_answer===opt ? 'var(--success)' : 'var(--text-secondary)',
                                                border: `1px solid ${mcq.correct_answer===opt ? 'var(--success-border)' : 'var(--border)'}`,
                                                fontWeight: mcq.correct_answer===opt ? 700 : 400,
                                                display:'flex', gap:5, alignItems:'center',
                                              }}>
                                                <span style={{ fontWeight:700 }}>{opt}.</span> {mcq[`option_${opt.toLowerCase()}`]}
                                                {mcq.correct_answer===opt && <span style={{ marginLeft:'auto' }}>✓</span>}
                                              </div>
                                            ))}
                                          </div>
                                          {mcq.explanation && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:5 }}>💡 {mcq.explanation}</div>}
                                        </div>
                                        <ActionBtns onEdit={() => openModal('mcq','edit',mcq,qz.id)} onDelete={() => handleDelete('mcq',mcq.id)} deleting={deleting===mcq.id} />
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                  }
                </div>
              </div>
            )}

            {/* ── Assignments tab ───────────────────────── */}
            {contentTab === 'assignments' && (
              <div className="card" style={{ padding:18 }}>
                <SectionHeader title="Assignments" onAdd={() => openModal('assignment','create')} addLabel="+ Add Assignment" />
                {tabLoading
                  ? <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div className="spinner" /></div>
                  : assignments.length === 0
                    ? <EmptyCard icon="📋" title="No assignments yet" desc="Create assignments for students to work on." />
                    : (
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {assignments.map((a, ai) => (
                          <div key={a.id} style={{ background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                              <div style={{ width:28, height:28, borderRadius:'var(--radius-sm)', background:'var(--navy)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.78rem', fontWeight:700, flexShrink:0 }}>{ai+1}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                                  <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)' }}>{a.title}</span>
                                  {a.due_date && <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>📅 Due: {a.due_date}</span>}
                                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>🏆 {a.max_score} pts</span>
                                </div>
                                <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>{a.description}</p>
                                {a.instructions && (
                                  <details style={{ marginTop:8 }}>
                                    <summary style={{ fontSize:'0.78rem', color:'var(--teal)', cursor:'pointer', fontWeight:600 }}>View Instructions</summary>
                                    <pre style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginTop:6, whiteSpace:'pre-wrap', lineHeight:1.6, fontFamily:'inherit' }}>{a.instructions}</pre>
                                  </details>
                                )}
                              </div>
                              <ActionBtns onEdit={() => openModal('assignment','edit',a)} onDelete={() => handleDelete('assignment',a.id)} deleting={deleting===a.id} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                }
              </div>
            )}
          </div>
        )
      }

      {/* ── Modals ────────────────────────────────────────── */}
      {modal && (
        <Modal isOpen onClose={() => setModal(null)}
          size={['lesson','question','mcq','assignment'].includes(modal.type) ? 'lg' : ''}
          title={`${modal.mode==='create'?'Create':'Edit'} ${
            modal.type==='course'?'Course':modal.type==='module'?'Module':modal.type==='lesson'?'Lesson':
            modal.type==='question'?'Coding Question':modal.type==='quiz'?'Quiz':modal.type==='mcq'?'MCQ Question':'Assignment'
          }`}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><div className="spinner spinner-sm" style={{ borderTopColor:'white' }}/> Saving…</> : modal.mode==='create'?'Create':'Save Changes'}
            </button>
          </>}
        >
          {formErr && <div className="alert alert-error" style={{ marginBottom:14 }}><span>⚠</span> {formErr}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:13 }}>

            {/* ── Course form ── */}
            {modal.type==='course' && <>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Course Code *</label><input className="form-input" name="code" value={form.code||''} onChange={handleField} placeholder="JAVA101" /></div>
                <div className="form-group"><label className="form-label">Credits</label><input className="form-input" name="credits" type="number" min={1} max={10} value={form.credits||3} onChange={handleField} /></div>
              </div>
              <div className="form-group"><label className="form-label">Course Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Java Foundation" /></div>
              <div className="form-group"><label className="form-label">Instructor *</label><input className="form-input" name="instructor" value={form.instructor||''} onChange={handleField} placeholder="Dr. Jane Smith" /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" name="description" value={form.description||''} onChange={handleField} placeholder="Course overview…" /></div>
              <div className="form-group"><label className="form-label">Cover Image URL</label><input className="form-input" name="image_url" value={form.image_url||''} onChange={handleField} placeholder="https://…" /></div>
            </>}

            {/* ── Module form ── */}
            {modal.type==='module' && <>
              <div className="form-group"><label className="form-label">Module Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Module 1: Introduction" /></div>
              <div className="form-group"><label className="form-label">Summary</label><textarea className="form-textarea" name="summary" value={form.summary||''} onChange={handleField} placeholder="What this module covers…" /></div>
              <div className="form-group" style={{ maxWidth:140 }}><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
            </>}

            {/* ── Lesson form ── */}
            {modal.type==='lesson' && <>
              <div className="form-group"><label className="form-label">Lesson Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Lesson 1.1: Variables" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Duration (min)</label><input className="form-input" name="duration" type="number" min={1} value={form.duration||15} onChange={handleField} /></div>
                <div className="form-group"><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
              </div>
              <div className="form-group"><label className="form-label">Video / Resource URL</label><input className="form-input" name="video_url" value={form.video_url||''} onChange={handleField} placeholder="https://youtube.com/embed/…" /></div>
              <div className="form-group"><label className="form-label">Content Body</label><textarea className="form-textarea" name="content" value={form.content||''} onChange={handleField} placeholder="Lesson notes, explanations, code examples…" style={{ minHeight:140 }} /></div>
            </>}

            {/* ── Coding Question form ── */}
            {modal.type==='question' && <>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Print Sum of Two Numbers" /></div>
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select className="form-select" name="difficulty" value={form.difficulty||'Easy'} onChange={handleField}>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Description / Problem Statement *</label><textarea className="form-textarea" name="description" value={form.description||''} onChange={handleField} placeholder="Describe the problem clearly…" style={{ minHeight:80 }} /></div>
              <div className="form-group">
                <label className="form-label">Starter Code</label>
                <textarea className="form-textarea" name="starter_code" value={form.starter_code||''} onChange={handleField}
                  placeholder="public class Main { ... }" style={{ minHeight:100, fontFamily:'var(--font-mono)', fontSize:'12.5px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Solution Code</label>
                <textarea className="form-textarea" name="solution_code" value={form.solution_code||''} onChange={handleField}
                  placeholder="Complete solution…" style={{ minHeight:100, fontFamily:'var(--font-mono)', fontSize:'12.5px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Test Cases (JSON array)</label>
                <textarea className="form-textarea" name="test_cases" value={form.test_cases||'[]'} onChange={handleField}
                  placeholder='[{"input":"3 5","expected":"8"},{"input":"10 20","expected":"30"}]'
                  style={{ minHeight:70, fontFamily:'var(--font-mono)', fontSize:'12px' }} />
                <div className="form-hint">Format: {"[{\"input\":\"...\",\"expected\":\"...\"}]"}</div>
              </div>
              <div className="form-group"><label className="form-label">Hints</label><input className="form-input" name="hints" value={form.hints||''} onChange={handleField} placeholder="Use modulus operator (%) to check divisibility." /></div>
              <div className="form-group" style={{ maxWidth:140 }}><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
            </>}

            {/* ── Quiz form ── */}
            {modal.type==='quiz' && <>
              <div className="form-group"><label className="form-label">Quiz Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Java Basics Quiz" /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" name="description" value={form.description||''} onChange={handleField} placeholder="What this quiz tests…" style={{ minHeight:70 }} /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Time Limit (minutes)</label><input className="form-input" name="time_limit_minutes" type="number" min={1} value={form.time_limit_minutes||30} onChange={handleField} /></div>
                <div className="form-group"><label className="form-label">Passing Score (%)</label><input className="form-input" name="passing_score" type="number" min={1} max={100} value={form.passing_score||60} onChange={handleField} /></div>
              </div>
              <div className="form-group" style={{ maxWidth:140 }}><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
            </>}

            {/* ── MCQ Question form ── */}
            {modal.type==='mcq' && <>
              <div className="form-group"><label className="form-label">Question *</label><textarea className="form-textarea" name="question" value={form.question||''} onChange={handleField} placeholder="What is the default value of an int in Java?" style={{ minHeight:70 }} /></div>
              {['a','b','c','d'].map(opt => (
                <div key={opt} className="form-group">
                  <label className="form-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background: form.correct_answer===opt.toUpperCase()?'var(--success)':'var(--bg-subtle)', border:`1px solid ${form.correct_answer===opt.toUpperCase()?'var(--success)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.68rem', fontWeight:700, color: form.correct_answer===opt.toUpperCase()?'white':'var(--text-muted)', flexShrink:0 }}>{opt.toUpperCase()}</span>
                    Option {opt.toUpperCase()} {form.correct_answer===opt.toUpperCase() && <span style={{ fontSize:'0.7rem', color:'var(--success)' }}>(Correct)</span>}
                  </label>
                  <input className="form-input" name={`option_${opt}`} value={form[`option_${opt}`]||''} onChange={handleField} placeholder={`Option ${opt.toUpperCase()}…`} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Correct Answer</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                  {['A','B','C','D'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setForm(p => ({ ...p, correct_answer: opt }))}
                      style={{
                        padding:'8px 0', borderRadius:'var(--radius-md)',
                        border:`1.5px solid ${form.correct_answer===opt ? 'var(--success)' : 'var(--border)'}`,
                        background: form.correct_answer===opt ? 'var(--success-bg)' : 'var(--bg-subtle)',
                        color: form.correct_answer===opt ? 'var(--success)' : 'var(--text-secondary)',
                        fontWeight:700, cursor:'pointer', fontSize:'0.875rem',
                      }}>
                      {opt} {form.correct_answer===opt ? '✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Explanation</label><input className="form-input" name="explanation" value={form.explanation||''} onChange={handleField} placeholder="Why is this the correct answer?" /></div>
              <div className="form-group" style={{ maxWidth:140 }}><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
            </>}

            {/* ── Assignment form ── */}
            {modal.type==='assignment' && <>
              <div className="form-group"><label className="form-label">Assignment Title *</label><input className="form-input" name="title" value={form.title||''} onChange={handleField} placeholder="Assignment 1: Number Cruncher" /></div>
              <div className="form-group"><label className="form-label">Description *</label><textarea className="form-textarea" name="description" value={form.description||''} onChange={handleField} placeholder="Brief overview of what students need to build…" style={{ minHeight:80 }} /></div>
              <div className="form-group"><label className="form-label">Detailed Instructions</label><textarea className="form-textarea" name="instructions" value={form.instructions||''} onChange={handleField} placeholder="Step-by-step requirements, expected output format, examples…" style={{ minHeight:130 }} /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" name="due_date" type="date" value={form.due_date||''} onChange={handleField} /></div>
                <div className="form-group"><label className="form-label">Max Score (points)</label><input className="form-input" name="max_score" type="number" min={1} value={form.max_score||100} onChange={handleField} /></div>
              </div>
              <div className="form-group" style={{ maxWidth:140 }}><label className="form-label">Order</label><input className="form-input" name="order_index" type="number" min={1} value={form.order_index||1} onChange={handleField} /></div>
            </>}
          </div>
        </Modal>
      )}
    </div>
  );
}
