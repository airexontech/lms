import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeEditor from '../components/CodeEditor';
import { contentAPI, playgroundAPI } from '../api/apiClient';

/* ── Constants ─────────────────────────────────────────────── */
const LANGS = [
  { value: 'java',       label: 'Java',       icon: '☕' },
  { value: 'python',     label: 'Python',     icon: '🐍' },
  { value: 'javascript', label: 'JavaScript', icon: '⚡' },
  { value: 'c',          label: 'C',          icon: '⚙' },
  { value: 'cpp',        label: 'C++',        icon: '🔧' },
];

const DIFF_META = {
  Easy:   { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#4ade80' },
  Medium: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#fbbf24' },
  Hard:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#f87171' },
};

const STARTERS = {
  java: (title) => `public class Main {
    public static void main(String[] args) {
        // Problem: ${title}
        // Write your solution here

    }
}`,
  python: (title) => `# Problem: ${title}
# Write your solution here

`,
  javascript: (title) => `// Problem: ${title}
// Write your solution here

`,
  c: (title) => `#include <stdio.h>

// Problem: ${title}
int main() {
    // Write your solution here

    return 0;
}`,
  cpp: (title) => `#include <iostream>
using namespace std;

// Problem: ${title}
int main() {
    // Write your solution here

    return 0;
}`,
};

/* ── Helpers ───────────────────────────────────────────────── */
function DiffBadge({ difficulty }) {
  const m = DIFF_META[difficulty] || DIFF_META.Easy;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 9999,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {difficulty}
    </span>
  );
}

function ScoreRing({ score }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score === 100 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="14" fontWeight="800" fontFamily="'Plus Jakarta Sans',sans-serif">
        {score}%
      </text>
    </svg>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function CodingPractice() {
  /* Problem list state */
  const [courses, setCourses]       = useState([]);
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterDiff, setFilterDiff] = useState('All');
  const [filterLang, setFilterLang] = useState('java');
  const [filterCourse, setFilterCourse] = useState('All');
  const [search, setSearch]         = useState('');
  const [solvedIds, setSolvedIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ep_solved') || '[]')); }
    catch (_) { return new Set(); }
  });

  /* Active problem + editor */
  const [activeProblem, setActiveProblem] = useState(null);
  const [code, setCode]             = useState('');
  const [lang, setLang]             = useState('java');
  const [running, setRunning]       = useState(false);
  const [judging, setJudging]       = useState(false);
  const [runResult, setRunResult]   = useState(null);   // free run
  const [judgeResult, setJudgeResult] = useState(null); // test case results
  const [activeTab, setActiveTab]   = useState('problem'); // problem | output | results
  const [stdin, setStdin]           = useState('');
  const resultRef = useRef(null);

  /* Load all courses + questions */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const coursesData = await contentAPI.getCourses();
      const allCourses  = coursesData.courses || [];
      setCourses(allCourses);

      // Fetch questions from every course
      const allQuestions = [];
      await Promise.all(
        allCourses.map(async (c) => {
          try {
            const d = await contentAPI.getCodingQuestions(c.id);
            (d.questions || []).forEach(q => {
              allQuestions.push({ ...q, course_code: c.code, course_title: c.title });
            });
          } catch (_) {}
        })
      );
      allQuestions.sort((a, b) => {
        const order = { Easy: 0, Medium: 1, Hard: 2 };
        return (order[a.difficulty] ?? 0) - (order[b.difficulty] ?? 0);
      });
      setQuestions(allQuestions);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* Open a problem */
  const openProblem = (q) => {
    setActiveProblem(q);
    setLang(filterLang);
    setCode(STARTERS[filterLang]?.(q.title) || '');
    setRunResult(null);
    setJudgeResult(null);
    setStdin('');
    setActiveTab('problem');
  };

  /* Change language inside the problem view */
  const handleLangChange = (l) => {
    setLang(l);
    setCode(STARTERS[l]?.(activeProblem?.title) || '');
    setRunResult(null);
    setJudgeResult(null);
  };

  /* Free run */
  const handleRun = async () => {
    if (!code.trim() || !activeProblem) return;
    setRunning(true);
    setRunResult(null);
    setJudgeResult(null);
    setActiveTab('output');
    try {
      const res = await playgroundAPI.run({
        source_code: code,
        language: lang,
        stdin,
        title: activeProblem.title,
      });
      setRunResult(res);
    } catch (err) {
      setRunResult({ status: 'runtime_error', stdout: '', stderr: err.message, compileOutput: '' });
    } finally {
      setRunning(false);
    }
  };

  /* Judge against test cases */
  const handleSubmit = async () => {
    if (!code.trim() || !activeProblem) return;
    setJudging(true);
    setRunResult(null);
    setJudgeResult(null);
    setActiveTab('results');
    try {
      const res = await playgroundAPI.judge({
        source_code: code,
        language: lang,
        question_id: activeProblem.id,
      });
      setJudgeResult(res);

      // Mark as solved if all passed
      if (res.overall_status === 'accepted') {
        setSolvedIds(prev => {
          const next = new Set(prev);
          next.add(activeProblem.id);
          localStorage.setItem('ep_solved', JSON.stringify([...next]));
          return next;
        });
      }
      // scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setJudgeResult({ overall_status: 'error', error: err.message, test_results: [], passed: 0, total: 0, score: 0 });
    } finally {
      setJudging(false);
    }
  };

  /* Filter questions */
  const filtered = questions.filter(q => {
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false;
    if (filterCourse !== 'All' && q.course_code !== filterCourse) return false;
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) &&
        !q.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSolved = questions.filter(q => solvedIds.has(q.id)).length;

  /* ── Problem list view ───────────────────────────────────── */
  if (!activeProblem) {
    return (
      <div className="page-body fade-in">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>💻 Coding Practice</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-gray)' }}>
                Solve programming problems, submit your code, and track your progress
              </p>
            </div>
            {/* Progress summary */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
              background: 'white', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: 'var(--shadow-xs)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--purple)', fontFamily: 'var(--font-display)' }}>
                  {totalSolved}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', fontWeight: 500 }}>Solved</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)', fontFamily: 'var(--font-display)' }}>
                  {questions.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', fontWeight: 500 }}>Total</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
              {['Easy', 'Medium', 'Hard'].map(d => (
                <div key={d} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: DIFF_META[d].color, fontFamily: 'var(--font-display)' }}>
                    {questions.filter(q => q.difficulty === d && solvedIds.has(q.id)).length}
                    <span style={{ color: 'var(--text-gray)', fontWeight: 400 }}>
                      /{questions.filter(q => q.difficulty === d).length}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: DIFF_META[d].color, fontWeight: 700 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {questions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-gray)', marginBottom: 5 }}>
                <span>Overall Progress</span>
                <span>{totalSolved}/{questions.length} solved</span>
              </div>
              <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${questions.length ? (totalSolved / questions.length) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, var(--purple) 0%, #a855f7 100%)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          marginBottom: 18, padding: '14px 16px',
          background: 'white', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-xs)',
        }}>
          {/* Search */}
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg className="search-ico" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input className="form-input" style={{ paddingLeft: 34 }}
              placeholder="Search problems…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Difficulty filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} onClick={() => setFilterDiff(d)} style={{
                padding: '6px 14px', borderRadius: 999, border: '1.5px solid',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: filterDiff === d ? (d === 'All' ? 'var(--purple)' : DIFF_META[d]?.color || 'var(--purple)') : 'var(--border)',
                background: filterDiff === d ? (d === 'All' ? 'var(--purple-xlight)' : DIFF_META[d]?.bg || 'var(--purple-xlight)') : 'var(--gray-50)',
                color: filterDiff === d ? (d === 'All' ? 'var(--purple)' : DIFF_META[d]?.color || 'var(--purple)') : 'var(--text-gray)',
              }}>
                {d}
              </button>
            ))}
          </div>

          {/* Course filter */}
          <select className="form-select" style={{ width: 190, height: 38 }}
            value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
            <option value="All">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.code}>{c.code} — {c.title}</option>)}
          </select>

          {/* Language filter */}
          <select className="form-select" style={{ width: 140, height: 38 }}
            value={filterLang} onChange={e => setFilterLang(e.target.value)}>
            {LANGS.map(l => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
          </select>
        </div>

        {/* Problem table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="card"><div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No problems found</div>
            <div className="empty-desc">Try changing your filters or search term.</div>
          </div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, idx) => {
                  const isSolved = solvedIds.has(q.id);
                  return (
                    <tr key={q.id} onClick={() => openProblem(q)}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ color: 'var(--text-gray)', fontSize: '0.82rem', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isSolved && (
                            <span style={{ color: '#16a34a', fontSize: '1rem' }}>✓</span>
                          )}
                          {q.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: 2, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.description}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--purple)',
                          background: 'var(--purple-xlight)', padding: '2px 8px', borderRadius: 999,
                          border: '1px solid #d8b4fe', whiteSpace: 'nowrap' }}>
                          {q.course_code}
                        </span>
                      </td>
                      <td><DiffBadge difficulty={q.difficulty} /></td>
                      <td>
                        {isSolved ? (
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '1rem' }}>✓</span> Solved
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>Not attempted</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); openProblem(q); }}>
                          Solve →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Problem solve view ──────────────────────────────────── */
  const testCases = (() => {
    try { return JSON.parse(activeProblem.test_cases || '[]'); } catch (_) { return []; }
  })();

  return (
    <div className="page-body fade-in" style={{ padding: '16px 24px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setActiveProblem(null)} style={{ gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          All Problems
        </button>
        <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)', fontWeight: 600 }}>
          {activeProblem.course_code}
        </span>
        <DiffBadge difficulty={activeProblem.difficulty} />
        {solvedIds.has(activeProblem.id) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 700, color: '#16a34a',
            background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 10px', borderRadius: 999 }}>
            ✓ Solved
          </span>
        )}
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Problem description ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Problem statement card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Card header with title */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border-light)',
              background: 'linear-gradient(135deg, #1c1d1f 0%, #2d1b69 100%)',
            }}>
              <h3 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 6 }}>
                {activeProblem.title}
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <DiffBadge difficulty={activeProblem.difficulty} />
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  {activeProblem.course_title}
                </span>
              </div>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Problem description */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Problem Statement
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-dark)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {activeProblem.description}
                </p>
              </div>

              {/* Test cases as examples */}
              {testCases.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Examples
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {testCases.slice(0, 3).map((tc, i) => (
                      <div key={i} style={{
                        background: '#f8f9ff', border: '1px solid #e0e7ff',
                        borderRadius: 10, padding: '12px 14px',
                        borderLeft: '3px solid var(--purple)',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--purple)', marginBottom: 8 }}>
                          Example {i + 1}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input:</span>
                            <pre style={{
                              display: 'inline-block', marginLeft: 8,
                              fontFamily: 'var(--font-mono)', fontSize: '12.5px',
                              background: '#1e1e2e', color: '#a5f3fc',
                              padding: '2px 10px', borderRadius: 5,
                            }}>{tc.input || '(none)'}</pre>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Output:</span>
                            <pre style={{
                              display: 'inline-block', marginLeft: 8,
                              fontFamily: 'var(--font-mono)', fontSize: '12.5px',
                              background: '#1e1e2e', color: '#86efac',
                              padding: '2px 10px', borderRadius: 5,
                            }}>{tc.expected || '(none)'}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hints */}
              {activeProblem.hints && (
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{
                    fontSize: '0.82rem', fontWeight: 700, color: 'var(--orange)',
                    userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>💡</span> Show Hint
                  </summary>
                  <div style={{
                    marginTop: 8, padding: '10px 14px',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 8, fontSize: '0.85rem', color: '#92400e', lineHeight: 1.6,
                  }}>
                    {activeProblem.hints}
                  </div>
                </details>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: 16, paddingTop: 4, borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                  🧪 <strong>{testCases.length}</strong> test case{testCases.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Test results panel (shown after submit) */}
          {judgeResult && (
            <div ref={resultRef} className="card fade-in" style={{ overflow: 'hidden' }}>
              {/* Result header */}
              <div style={{
                padding: '14px 18px',
                background: judgeResult.overall_status === 'accepted'
                  ? 'linear-gradient(135deg,#166534,#15803d)'
                  : judgeResult.overall_status === 'compile_error'
                  ? 'linear-gradient(135deg,#7f1d1d,#991b1b)'
                  : 'linear-gradient(135deg,#7c2d12,#c2410c)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.4rem' }}>
                    {judgeResult.overall_status === 'accepted' ? '🎉' : judgeResult.overall_status === 'compile_error' ? '⚠️' : '❌'}
                  </span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', color: 'white' }}>
                      {judgeResult.overall_status === 'accepted' ? 'All Test Cases Passed!'
                        : judgeResult.overall_status === 'compile_error' ? 'Compilation Error'
                        : `${judgeResult.passed}/${judgeResult.total} Test Cases Passed`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                      Score: {judgeResult.score}%
                    </div>
                  </div>
                </div>
                {judgeResult.total > 0 && <ScoreRing score={judgeResult.score} />}
              </div>

              {/* Compile error */}
              {judgeResult.compile_output && (
                <div style={{ padding: '12px 16px', background: '#fff5f5', borderBottom: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Compile Error</div>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.55 }}>
                    {judgeResult.compile_output}
                  </pre>
                </div>
              )}

              {/* Per-test-case results */}
              {judgeResult.test_results?.length > 0 && (
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {judgeResult.test_results.map((tr, i) => (
                    <div key={i} style={{
                      border: `1.5px solid ${tr.passed ? '#bbf7d0' : '#fecaca'}`,
                      borderRadius: 8, overflow: 'hidden',
                    }}>
                      {/* Case header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: tr.passed ? '#f0fdf4' : '#fef2f2',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: tr.passed ? '#16a34a' : '#dc2626', color: 'white',
                            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
                          }}>
                            {tr.passed ? '✓' : '✗'}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: tr.passed ? '#15803d' : '#b91c1c' }}>
                            Test Case {tr.case_num}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {tr.duration_ms > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-gray)' }}>⏱ {tr.duration_ms}ms</span>
                          )}
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999,
                            background: tr.passed ? '#dcfce7' : '#fee2e2',
                            color: tr.passed ? '#15803d' : '#b91c1c',
                          }}>
                            {tr.passed ? 'PASS' : tr.status?.toUpperCase().replace('_', ' ') || 'FAIL'}
                          </span>
                        </div>
                      </div>

                      {/* Case details (collapsed by default, expand on click) */}
                      <details>
                        <summary style={{
                          padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-gray)',
                          cursor: 'pointer', userSelect: 'none', listStyle: 'none',
                          borderTop: `1px solid ${tr.passed ? '#bbf7d0' : '#fecaca'}`,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          View details
                        </summary>
                        <div style={{ padding: '8px 12px 10px', display: 'flex', flexDirection: 'column', gap: 7, background: 'white' }}>
                          {[
                            { label: 'Input', value: tr.input, color: '#a5f3fc' },
                            { label: 'Expected', value: tr.expected, color: '#86efac' },
                            { label: 'Your Output', value: tr.actual, color: tr.passed ? '#86efac' : '#fca5a5' },
                          ].map(({ label, value, color }) => (
                            <div key={label}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}:</span>
                              <pre style={{ display: 'inline-block', marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: '12px', background: '#1e1e2e', color, padding: '1px 8px', borderRadius: 4 }}>
                                {value || '(empty)'}
                              </pre>
                            </div>
                          ))}
                          {tr.stderr && (
                            <div>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error:</span>
                              <pre style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#991b1b', background: '#fff5f5', padding: '6px 10px', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {tr.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Code editor + run/submit ────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 72 }}>

          {/* Editor toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', background: 'white',
            border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: 'var(--shadow-xs)',
          }}>
            {/* Language selector */}
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--gray-100)', border: '1px solid var(--border)', borderRadius: 8 }}>
              {LANGS.map(l => (
                <button key={l.value} onClick={() => handleLangChange(l.value)} style={{
                  padding: '5px 11px', borderRadius: 6, border: 'none',
                  background: lang === l.value ? '#1c1d1f' : 'transparent',
                  color: lang === l.value ? 'white' : 'var(--text-gray)',
                  fontSize: '0.78rem', fontWeight: lang === l.value ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}>
                  <span>{l.icon}</span> {l.label}
                </button>
              ))}
            </div>

            {/* Reset */}
            <button className="btn btn-secondary btn-sm" style={{ gap: 4 }}
              onClick={() => setCode(STARTERS[lang]?.(activeProblem.title) || '')}
              title="Reset to starter code">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Reset
            </button>

            {/* Copy */}
            <button className="btn btn-secondary btn-sm" style={{ gap: 4 }}
              onClick={() => navigator.clipboard.writeText(code)}
              title="Copy code">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Copy
            </button>

            {/* Run + Submit */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={handleRun} disabled={running || judging} style={{ gap: 5 }}>
                {running ? <><div className="spinner spinner-sm" /> Running…</> : <>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Run
                </>}
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={running || judging} style={{ gap: 5 }}>
                {judging ? <><div className="spinner spinner-sm spinner-white" /> Judging…</> : <>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Submit
                </>}
              </button>
            </div>
          </div>

          {/* Code editor */}
          <CodeEditor
            value={code}
            onChange={setCode}
            language={lang}
            minHeight={420}
          />

          {/* Output tabs: stdin | output */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--gray-50)' }}>
              {[['stdin', '📥 Input'], ['output', '📤 Output'], ['results', '🧪 Test Results']].map(([t, lbl]) => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: activeTab === t ? 700 : 500,
                  color: activeTab === t ? 'var(--purple)' : 'var(--text-gray)',
                  borderBottom: `2px solid ${activeTab === t ? 'var(--purple)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                  {lbl}
                  {t === 'results' && judgeResult && (
                    <span style={{
                      marginLeft: 6, fontSize: '0.68rem', fontWeight: 800,
                      padding: '1px 6px', borderRadius: 999,
                      background: judgeResult.overall_status === 'accepted' ? '#dcfce7' : '#fee2e2',
                      color: judgeResult.overall_status === 'accepted' ? '#15803d' : '#b91c1c',
                    }}>
                      {judgeResult.passed}/{judgeResult.total}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ minHeight: 140, maxHeight: 320, overflowY: 'auto', padding: 14 }}>
              {/* Stdin panel */}
              {activeTab === 'stdin' && (
                <textarea
                  className="form-textarea"
                  value={stdin}
                  onChange={e => setStdin(e.target.value)}
                  placeholder="Enter custom input for your program here…"
                  style={{ border: 'none', outline: 'none', minHeight: 110, fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'transparent', padding: 0, resize: 'none', width: '100%' }}
                />
              )}

              {/* Free run output */}
              {activeTab === 'output' && (
                <div>
                  {!runResult && !running && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                      <span style={{ fontSize: '1.8rem', opacity: 0.25 }}>▶</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>Click Run to execute your code</span>
                    </div>
                  )}
                  {running && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
                      <div className="spinner" />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>Compiling and running…</span>
                    </div>
                  )}
                  {runResult && !running && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {runResult.compileOutput && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Compile Error</div>
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#991b1b', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{runResult.compileOutput}</pre>
                        </div>
                      )}
                      {runResult.stdout !== undefined && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Output</div>
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, minHeight: 36 }}>
                            {runResult.stdout || <span style={{ color: 'var(--text-gray)', fontStyle: 'italic' }}>No output</span>}
                          </pre>
                        </div>
                      )}
                      {runResult.stderr && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Stderr</div>
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{runResult.stderr}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Test results summary tab */}
              {activeTab === 'results' && (
                <div>
                  {!judgeResult && !judging && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                      <span style={{ fontSize: '1.8rem', opacity: 0.25 }}>🧪</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>Click Submit to run against all test cases</span>
                    </div>
                  )}
                  {judging && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
                      <div className="spinner" />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>Running test cases…</span>
                    </div>
                  )}
                  {judgeResult && !judging && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', marginBottom: 4 }}>
                        Score: <strong style={{ color: judgeResult.score === 100 ? '#16a34a' : judgeResult.score >= 60 ? '#d97706' : '#dc2626' }}>{judgeResult.score}%</strong>
                        {' · '}{judgeResult.passed}/{judgeResult.total} test cases passed
                      </div>
                      {judgeResult.test_results?.map((tr, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: tr.passed ? '#f0fdf4' : '#fef2f2' }}>
                          <span style={{ fontSize: '0.95rem' }}>{tr.passed ? '✓' : '✗'}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: tr.passed ? '#15803d' : '#b91c1c' }}>
                            Test Case {tr.case_num}
                          </span>
                          {tr.duration_ms > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-gray)', marginLeft: 'auto' }}>{tr.duration_ms}ms</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Keyboard shortcut hint */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', textAlign: 'center' }}>
            <kbd style={{ background: 'var(--gray-100)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>Ctrl+Enter</kbd>
            {' '}to run &nbsp;·&nbsp; <kbd style={{ background: 'var(--gray-100)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>Tab</kbd> to indent
          </div>
        </div>
      </div>
    </div>
  );
}
