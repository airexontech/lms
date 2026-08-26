import React, { useState, useEffect, useCallback } from 'react';
import CodeEditor from '../components/CodeEditor';
import { playgroundAPI } from '../api/apiClient';

/* ── Starter code per language ──────────────────────────────── */
const STARTERS = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, EduPortal!");

        // Read input:
        // java.util.Scanner sc = new java.util.Scanner(System.in);
        // String name = sc.nextLine();
        // System.out.println("Hello, " + name + "!");
    }
}`,
  python: `# Python Playground
def greet(name):
    return f"Hello, {name}!"

print(greet("EduPortal"))
`,
  javascript: `// JavaScript (Node.js)
const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("EduPortal"));
`,
  c: `#include <stdio.h>

int main() {
    printf("Hello, EduPortal!\\n");
    return 0;
}`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, EduPortal!" << endl;
    return 0;
}`,
};

const LANGS = [
  { value: 'java',       label: 'Java',       icon: '☕' },
  { value: 'python',     label: 'Python',     icon: '🐍' },
  { value: 'javascript', label: 'JavaScript', icon: '⚡' },
  { value: 'c',          label: 'C',          icon: '⚙' },
  { value: 'cpp',        label: 'C++',        icon: '🔧' },
];

const STATUS_META = {
  success:       { label: 'Accepted',      bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  compile_error: { label: 'Compile Error', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  runtime_error: { label: 'Runtime Error', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  time_limit:    { label: 'Time Limit',    bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  pending:       { label: 'Pending',       bg: 'var(--gray-100)', color: 'var(--text-gray)', border: 'var(--border)' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 9999,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
}

/* ── Component ──────────────────────────────────────────────── */
export default function Playground() {
  const [lang,         setLang]         = useState('java');
  const [code,         setCode]         = useState(STARTERS.java);
  const [stdin,        setStdin]        = useState('');
  const [title,        setTitle]        = useState('');
  const [result,       setResult]       = useState(null);
  const [running,      setRunning]      = useState(false);
  const [error,        setError]        = useState('');
  const [panel,        setPanel]        = useState('output');
  const [showHistory,  setShowHistory]  = useState(false);
  const [submissions,  setSubmissions]  = useState([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [loadingSub,   setLoadingSub]   = useState(null);

  const handleLangChange = (l) => {
    setLang(l); setCode(STARTERS[l] || ''); setResult(null); setError('');
  };

  const handleRun = useCallback(async () => {
    if (!code.trim()) { setError('Editor is empty.'); return; }
    setRunning(true); setResult(null); setError(''); setPanel('output');
    try {
      const res = await playgroundAPI.run({ source_code: code, language: lang, stdin, title });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Execution failed. Make sure the server is running.');
    } finally {
      setRunning(false);
    }
  }, [code, lang, stdin, title]);

  /* Ctrl + Enter */
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!running) handleRun();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [running, handleRun]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try { const d = await playgroundAPI.getSubmissions(); setSubmissions(d.submissions || []); }
    catch (_) {} finally { setHistLoading(false); }
  }, []);

  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, loadHistory]);

  const loadSubmission = async (id) => {
    setLoadingSub(id);
    try {
      const d = await playgroundAPI.getSubmission(id);
      const s = d.submission;
      setLang(s.language); setCode(s.source_code); setStdin(s.stdin || '');
      setTitle(s.title || '');
      setResult({ status: s.status, stdout: s.stdout, stderr: s.stderr,
        compileOutput: s.compile_output, exitCode: s.exit_code, durationMs: s.execution_time_ms });
      setShowHistory(false); setPanel('output');
    } catch (_) {} finally { setLoadingSub(null); }
  };

  const deleteSub = async (e, id) => {
    e.stopPropagation();
    try { await playgroundAPI.deleteSubmission(id); setSubmissions(p => p.filter(s => s.id !== id)); }
    catch (_) {}
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all submission history?')) return;
    try { await playgroundAPI.clearSubmissions(); setSubmissions([]); } catch (_) {}
  };

  /* ── Shared style tokens (matching new index.css) ─────────── */
  const S = {
    border:   'var(--border)',
    bg:       'var(--gray-100)',
    bgWhite:  'var(--bg-white)',
    textGray: 'var(--text-gray)',
    textDark: 'var(--text-dark)',
    purple:   'var(--purple)',
    radius:   '8px',
    mono:     'var(--font-mono)',
  };

  return (
    <div className="page-body fade-in">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 3 }}>💻 Code Playground</h2>
          <p style={{ fontSize: '0.875rem', color: S.textGray, margin: 0 }}>
            Write, compile and run code — Java, Python, JavaScript, C, C++
          </p>
        </div>
        <button
          className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowHistory(v => !v)}
          style={{ gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {showHistory ? 'Back to Editor' : 'Submission History'}
        </button>
      </div>

      {/* ── History view ───────────────────────────────────── */}
      {showHistory ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Submission History</span>
            {submissions.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={clearAll}>Clear All</button>
            )}
          </div>
          {histLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No submissions yet</div>
              <div className="empty-desc">Run some code to see history here.</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Language</th><th>Title</th>
                    <th>Status</th><th>Time</th><th>Run At</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => {
                    const lm = LANGS.find(l => l.value === s.language) || { icon: '📄', label: s.language };
                    return (
                      <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => loadSubmission(s.id)}>
                        <td style={{ color: S.textGray, fontSize: '0.78rem' }}>#{s.id}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: '0.85rem' }}>
                            {lm.icon} {lm.label}
                          </span>
                        </td>
                        <td>
                          <span className="truncate" style={{ display: 'block', maxWidth: 160, fontSize: '0.82rem' }}>
                            {s.title || <em style={{ color: S.textGray }}>Untitled</em>}
                          </span>
                        </td>
                        <td><StatusBadge status={s.status} /></td>
                        <td style={{ fontSize: '0.78rem', color: S.textGray, whiteSpace: 'nowrap' }}>
                          {s.execution_time_ms != null ? `${s.execution_time_ms}ms` : '—'}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: S.textGray, whiteSpace: 'nowrap' }}>
                          {new Date(s.created_at).toLocaleString()}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-danger btn-sm btn-icon"
                            onClick={e => deleteSub(e, s.id)} title="Delete">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {loadingSub === s.id && (
                            <div className="spinner spinner-sm" style={{ display: 'inline-block', marginLeft: 6 }} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Editor layout ─────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>

          {/* Left: toolbar + code editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 14px', background: S.bgWhite,
              border: `1px solid ${S.border}`, borderRadius: 10,
              boxShadow: 'var(--shadow-xs)',
            }}>
              {/* Language pills */}
              <div style={{ display: 'flex', gap: 3, padding: 3, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8 }}>
                {LANGS.map(l => (
                  <button key={l.value} onClick={() => handleLangChange(l.value)} style={{
                    padding: '5px 11px', borderRadius: 6, border: 'none',
                    background: lang === l.value ? '#1c1d1f' : 'transparent',
                    color: lang === l.value ? 'white' : S.textGray,
                    fontSize: '0.8rem', fontWeight: lang === l.value ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                  }}>
                    <span style={{ fontSize: '0.85rem' }}>{l.icon}</span> {l.label}
                  </button>
                ))}
              </div>

              {/* Solution title input */}
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Solution title (optional)"
                style={{ flex: 1, minWidth: 140, maxWidth: 260, height: 34, padding: '5px 10px', fontSize: '0.83rem' }}
              />

              {/* Ctrl+Enter hint + Run button */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.72rem', color: S.textGray }}>
                  <kbd style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, padding: '1px 5px', fontFamily: S.mono }}>Ctrl+Enter</kbd>
                </span>
                <button className="btn btn-primary" onClick={handleRun} disabled={running} style={{ gap: 6, minWidth: 90 }}>
                  {running ? (
                    <><div className="spinner spinner-sm spinner-white" /> Running…</>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Run
                    </>
                  )}
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
          </div>

          {/* Right: stdin / output + shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Panel tabs */}
            <div style={{ display: 'flex', borderBottom: `2px solid ${S.border}`, background: S.bgWhite, borderRadius: '10px 10px 0 0', overflow: 'hidden', border: `1px solid ${S.border}` }}>
              {[['stdin', '📥 Input'], ['output', '📤 Output']].map(([p, lbl]) => (
                <button key={p} onClick={() => setPanel(p)} style={{
                  padding: '9px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: panel === p ? 700 : 500,
                  color: panel === p ? S.purple : S.textGray,
                  borderBottom: `2px solid ${panel === p ? S.purple : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.15s',
                }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Stdin panel */}
            {panel === 'stdin' && (
              <div className="card fade-in" style={{ overflow: 'hidden', marginTop: -1 }}>
                <div className="card-header" style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: S.textGray }}>Standard Input</span>
                  {stdin && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setStdin('')}>Clear</button>
                  )}
                </div>
                <textarea
                  className="form-textarea"
                  value={stdin}
                  onChange={e => setStdin(e.target.value)}
                  placeholder="Enter program input here, one line at a time…"
                  style={{
                    border: 'none', borderRadius: 0, minHeight: 200,
                    fontFamily: S.mono, fontSize: '13px',
                    padding: 14, resize: 'vertical', background: S.bgWhite,
                  }}
                />
              </div>
            )}

            {/* Output panel */}
            {panel === 'output' && (
              <div className="card fade-in" style={{ overflow: 'hidden', marginTop: -1 }}>
                <div style={{
                  padding: '10px 14px', borderBottom: `1px solid ${S.border}`,
                  background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: S.textGray }}>Output</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {result && <StatusBadge status={result.status} />}
                    {result?.durationMs != null && (
                      <span style={{ fontSize: '0.72rem', color: S.textGray }}>⏱ {result.durationMs}ms</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: 14, minHeight: 200, maxHeight: 500, overflowY: 'auto' }}>
                  {error && (
                    <div className="alert alert-error" style={{ marginBottom: 10 }}>
                      <span>⚠</span> {error}
                    </div>
                  )}

                  {!result && !error && !running && (
                    <div className="empty-state" style={{ padding: '28px 0' }}>
                      <div style={{ fontSize: '1.8rem', opacity: 0.25 }}>▶</div>
                      <div style={{ fontSize: '0.85rem', color: S.textGray }}>
                        Click Run to execute your code
                      </div>
                    </div>
                  )}

                  {running && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0' }}>
                      <div className="spinner" />
                      <span style={{ fontSize: '0.85rem', color: S.textGray }}>Compiling and executing…</span>
                    </div>
                  )}

                  {result && !running && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.compileOutput && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                            Compile Output
                          </div>
                          <pre style={{ fontFamily: S.mono, fontSize: '12.5px', color: '#991b1b', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                            {result.compileOutput}
                          </pre>
                        </div>
                      )}

                      {result.stdout !== undefined && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                            Standard Output
                          </div>
                          <pre style={{ fontFamily: S.mono, fontSize: '12.5px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55, minHeight: 40 }}>
                            {result.stdout || <span style={{ color: S.textGray, fontStyle: 'italic' }}>No output produced</span>}
                          </pre>
                        </div>
                      )}

                      {result.stderr && (
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                            Standard Error
                          </div>
                          <pre style={{ fontFamily: S.mono, fontSize: '12.5px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                            {result.stderr}
                          </pre>
                        </div>
                      )}

                      {result.exitCode != null && (
                        <div style={{ fontSize: '0.72rem', color: S.textGray, textAlign: 'right' }}>
                          Exit code:{' '}
                          <span style={{ fontWeight: 700, color: result.exitCode === 0 ? '#16a34a' : '#dc2626' }}>
                            {result.exitCode}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shortcuts card */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.textGray, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                Shortcuts
              </div>
              {[
                ['Ctrl + Enter', 'Run code'],
                ['Tab',          'Indent 2 spaces'],
                ['Enter',        'Auto-indent'],
                ['{ ( [',         'Auto-close bracket'],
              ].map(([k, d]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <kbd style={{ fontSize: '0.73rem', background: S.bg, border: `1px solid ${S.border}`, padding: '2px 8px', borderRadius: 4, fontFamily: S.mono, color: S.purple }}>
                    {k}
                  </kbd>
                  <span style={{ fontSize: '0.78rem', color: S.textGray }}>{d}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '9px 11px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.55 }}>
                💡 <strong>Java tip:</strong> Your class must be named{' '}
                <code style={{ background: '#dbeafe', padding: '0 4px', borderRadius: 3 }}>Main</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
