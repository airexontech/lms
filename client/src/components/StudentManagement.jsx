import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { adminAPI, contentAPI } from '../api/apiClient';

export default function StudentManagement() {
  const [students, setStudents]     = useState([]);
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');

  const [progressModal, setProgressModal] = useState(false);
  const [progressData, setProgressData]   = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const [enrollModal, setEnrollModal]   = useState(false);
  const [enrollStudent, setEnrollStudent] = useState(null);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrolling, setEnrolling]       = useState(false);
  const [enrollErr, setEnrollErr]       = useState('');

  const [courseModal, setCourseModal]   = useState(false);
  const [courseEnrollments, setCourseEnrollments] = useState(null);
  const [courseModalLoading, setCourseModalLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [removing, setRemoving]         = useState(null);
  const [gradeEdit, setGradeEdit]       = useState({});
  const [savingGrade, setSavingGrade]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([adminAPI.getStudents(), contentAPI.getCourses()]);
      setStudents(s.students || []);
      setCourses(c.courses || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openProgress = async (student) => {
    setProgressModal(true); setProgressData(null); setProgressLoading(true);
    try { const d = await adminAPI.getStudentProgress(student.id); setProgressData(d); }
    catch (_) {} finally { setProgressLoading(false); }
  };

  const openEnroll = (student) => {
    setEnrollStudent(student); setEnrollCourseId(''); setEnrollErr(''); setEnrollModal(true);
  };

  const handleEnroll = async () => {
    if (!enrollCourseId) { setEnrollErr('Please select a course.'); return; }
    setEnrolling(true); setEnrollErr('');
    try {
      await adminAPI.enrollStudent({ student_id: enrollStudent.id, course_id: Number(enrollCourseId) });
      setEnrollModal(false); load();
    } catch (err) { setEnrollErr(err.message || 'Enrollment failed.'); }
    finally { setEnrolling(false); }
  };

  const handleRemove = async (studentId, courseId) => {
    if (!window.confirm('Remove student from this course?')) return;
    const key = `${studentId}_${courseId}`;
    setRemoving(key);
    try {
      await adminAPI.removeEnrollment(studentId, courseId);
      if (courseModal && selectedCourseId) await loadCourseEnrollments(selectedCourseId);
      if (progressModal && progressData?.student?.id === studentId) {
        const d = await adminAPI.getStudentProgress(studentId); setProgressData(d);
      }
      load();
    } catch (_) {} finally { setRemoving(null); }
  };

  const saveGrade = async (studentId, courseId) => {
    const key = `${studentId}_${courseId}`;
    const grade = gradeEdit[key];
    if (!grade) return;
    setSavingGrade(key);
    try {
      await adminAPI.updateGrade(studentId, courseId, grade);
      setGradeEdit(p => { const n = { ...p }; delete n[key]; return n; });
      if (courseModal && selectedCourseId) await loadCourseEnrollments(selectedCourseId);
      if (progressModal && progressData) {
        const d = await adminAPI.getStudentProgress(studentId); setProgressData(d);
      }
    } catch (_) {} finally { setSavingGrade(null); }
  };

  const loadCourseEnrollments = useCallback(async (courseId) => {
    setCourseModalLoading(true);
    try { const d = await adminAPI.getCourseEnrollments(courseId); setCourseEnrollments(d); }
    catch (_) {} finally { setCourseModalLoading(false); }
  }, []);

  const openCourseModal = async (courseId) => {
    setSelectedCourseId(courseId); setCourseModal(true); setCourseEnrollments(null);
    await loadCourseEnrollments(courseId);
  };

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  const GradeCell = ({ studentId, courseId, currentGrade }) => {
    const key = `${studentId}_${courseId}`;
    const val = gradeEdit[key] !== undefined ? gradeEdit[key] : currentGrade;
    return (
      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <input
          style={{ width:80, padding:'4px 8px', fontSize:'0.78rem', background:'var(--bg-subtle)',
            border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)' }}
          value={val}
          onChange={e => setGradeEdit(p => ({ ...p, [key]: e.target.value }))}
          placeholder="Grade"
        />
        {gradeEdit[key] !== undefined && (
          <button className="btn btn-success btn-sm" style={{ padding:'4px 9px' }}
            disabled={savingGrade === key}
            onClick={() => saveGrade(studentId, courseId)}>
            {savingGrade === key ? '…' : '✓'}
          </button>
        )}
        <button className="btn btn-danger btn-sm btn-icon" disabled={!!removing}
          onClick={() => handleRemove(studentId, courseId)} title="Remove">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div className="search-wrap" style={{ flex:1, minWidth:220 }}>
          <svg className="search-ico" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
          <input className="form-input" style={{ paddingLeft:34 }} placeholder="Search students…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', alignSelf:'center' }}>View by course:</span>
          {courses.slice(0, 5).map(c => (
            <button key={c.id} className="btn btn-secondary btn-sm" onClick={() => openCourseModal(c.id)}>{c.code}</button>
          ))}
          {courses.length > 5 && (
            <select className="form-select" style={{ height:34, fontSize:'0.82rem', minWidth:130 }}
              onChange={e => { if (e.target.value) openCourseModal(e.target.value); e.target.value=''; }}>
              <option value="">More…</option>
              {courses.slice(5).map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="card"><div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No students found</div></div></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student</th><th>Department</th><th>Courses</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{
                            width:34, height:34, borderRadius:'50%', background:'var(--teal)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:700, fontSize:'0.78rem', color:'white', flexShrink:0,
                          }}>
                            {s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.875rem' }}>{s.name}</div>
                            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:'0.82rem' }}>{s.department}</td>
                      <td><span className="badge badge-teal">{s.enrolled_count} course{s.enrolled_count!==1?'s':''}</span></td>
                      <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openProgress(s)}>📊 Progress</button>
                          <button className="btn btn-teal btn-sm" onClick={() => openEnroll(s)}>+ Enroll</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      {/* Progress modal */}
      <Modal isOpen={progressModal} onClose={() => setProgressModal(false)}
        title="Student Progress" subtitle={progressData?.student?.name} size="lg">
        {progressLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
          : progressData
            ? (
              <div>
                <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
                  {[
                    { label:'Enrolled', value: progressData.enrollments.length, color:'var(--navy)' },
                    { label:'Completed', value: progressData.enrollments.filter(e => e.progress_pct===100).length, color:'var(--success)' },
                  ].map((m, i) => (
                    <div key={i} style={{ padding:'10px 18px', background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
                      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{m.label}</div>
                      <div style={{ fontWeight:800, fontSize:'1.5rem', color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {progressData.enrollments.length === 0
                  ? <div className="empty-state" style={{ padding:'20px 0' }}><div className="empty-icon">📭</div><div className="empty-title">Not enrolled in any courses</div></div>
                  : progressData.enrollments.map(en => (
                    <div key={en.course_id} style={{ padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8, flexWrap:'wrap' }}>
                        <div>
                          <span className="badge badge-navy" style={{ marginRight:8 }}>{en.code}</span>
                          <span style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)' }}>{en.title}</span>
                        </div>
                        <GradeCell studentId={progressData.student.id} courseId={en.course_id} currentGrade={en.grade} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="progress-bar" style={{ flex:1 }}>
                          <div className="progress-fill green" style={{ width:`${en.progress_pct}%` }} />
                        </div>
                        <span style={{ fontSize:'0.78rem', fontWeight:700, color: en.progress_pct===100?'var(--success)':'var(--text-secondary)', minWidth:36, textAlign:'right' }}>{en.progress_pct}%</span>
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>{en.completed_lessons}/{en.total_lessons} lessons completed</div>
                    </div>
                  ))
                }
              </div>
            )
            : <div className="alert alert-error"><span>⚠</span> Failed to load progress data.</div>
        }
      </Modal>

      {/* Enroll modal */}
      <Modal isOpen={enrollModal} onClose={() => setEnrollModal(false)}
        title="Enroll Student" subtitle={enrollStudent?.name}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setEnrollModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? <><div className="spinner spinner-sm" style={{ borderTopColor:'white' }} /> Enrolling…</> : 'Enroll'}
          </button>
        </>}
      >
        {enrollErr && <div className="alert alert-error" style={{ marginBottom:14 }}><span>⚠</span> {enrollErr}</div>}
        <div className="form-group">
          <label className="form-label">Select Course</label>
          <select className="form-select" value={enrollCourseId}
            onChange={e => { setEnrollCourseId(e.target.value); setEnrollErr(''); }}>
            <option value="">Choose a course…</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
      </Modal>

      {/* Course enrollments modal */}
      <Modal isOpen={courseModal} onClose={() => setCourseModal(false)}
        title="Course Enrollments"
        subtitle={courseEnrollments?.course ? `${courseEnrollments.course.code} · ${courseEnrollments.course.title}` : ''}
        size="lg">
        {courseModalLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>
          : courseEnrollments
            ? courseEnrollments.enrollments.length === 0
              ? <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">No students enrolled yet</div></div>
              : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>
                    {courseEnrollments.enrollments.length} student{courseEnrollments.enrollments.length!==1?'s':''} enrolled
                  </div>
                  {courseEnrollments.enrollments.map(en => (
                    <div key={en.student_id} style={{ padding:'12px 14px', background:'var(--bg-subtle)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--teal)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.72rem', color:'white', flexShrink:0 }}>
                          {en.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-primary)' }}>{en.name}</div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{en.email}</div>
                        </div>
                        <GradeCell studentId={en.student_id} courseId={courseEnrollments.course.id} currentGrade={en.grade} />
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="progress-bar" style={{ flex:1 }}>
                          <div className="progress-fill green" style={{ width:`${en.progress_pct}%` }} />
                        </div>
                        <span style={{ fontSize:'0.78rem', fontWeight:700, color: en.progress_pct===100?'var(--success)':'var(--text-secondary)', minWidth:36, textAlign:'right' }}>{en.progress_pct}%</span>
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:3 }}>
                        {en.completed_lessons}/{en.total_lessons} lessons · enrolled {new Date(en.enrolled_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )
            : null
        }
      </Modal>
    </div>
  );
}
