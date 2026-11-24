import { api, post } from '../api.js';
import { esc, icon, md, langPill, diffPill, statusPill, empty, modal, toast, toastError, kpi, timeAgo, $, $$ } from '../ui.js';
import { state, go, rerender, refreshMe } from '../app.js';

let filter = { lang: '', diff: '' };
export async function list(el) {
  const items = await api('/challenges');
  const isStudent = state.user.role === 'student';
  const solved = items.filter((c) => c.status === 'solved').length;
  const shown = items.filter((c) => (!filter.lang || c.language === filter.lang) && (!filter.diff || c.difficulty === filter.diff));
  el.innerHTML = `
  <div class="page-head"><div><h1>Code Lab 💻</h1><p>Write, run and auto-grade JavaScript & Python right in the browser — no setup needed.</p></div>
    ${!isStudent ? `<button class="btn" id="add">${icon('plus', 16)} New challenge</button>` : ''}</div>
  ${isStudent ? `<div class="grid g-3">${kpi({ label: 'Solved', value: `${solved}/${items.length}`, ico: 'check', color: 'var(--ok)' })}${kpi({ label: 'XP available', value: items.filter((c) => c.status !== 'solved').reduce((n, c) => n + c.xp, 0), ico: 'bolt', color: 'var(--accent)' })}${kpi({ label: 'In progress', value: items.filter((c) => c.status === 'attempted').length, ico: 'code' })}</div>` : ''}
  <div class="row mt-3 wrap">
    <div class="tabs" id="lang">${[['', 'All'], ['javascript', 'JavaScript'], ['python', 'Python']].map(([v, l]) => `<button data-v="${v}" class="${filter.lang === v ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="tabs" id="diff">${[['', 'Any level'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([v, l]) => `<button data-v="${v}" class="${filter.diff === v ? 'active' : ''}">${l}</button>`).join('')}</div>
  </div>
  <div class="grid g-3 mt-3">${shown.map((c) => `<div class="card ch-card" data-id="${c.id}">
      <div class="row between">${langPill(c.language)}${isStudent ? statusPill(c.status) : `<span class="small muted">${c.solvers}/${c.students} solved</span>`}</div>
      <h2>${esc(c.title)}</h2>
      <div class="row small"><span class="muted">${esc(c.topic || '')}</span><span class="faint">·</span>${diffPill(c.difficulty)}<span style="margin-left:auto;font-weight:700;color:var(--accent)">+${c.xp} XP</span></div>
      ${!isStudent ? `<div class="bar thin"><i style="width:${(c.solvers / Math.max(1, c.students)) * 100}%"></i></div>` : ''}
    </div>`).join('') || `<div class="card" style="grid-column:1/-1">${empty('No challenges match')}</div>`}</div>`;
  $$('#lang button', el).forEach((b) => (b.onclick = () => { filter.lang = b.dataset.v; rerender(); }));
  $$('#diff button', el).forEach((b) => (b.onclick = () => { filter.diff = b.dataset.v; rerender(); }));
  $$('.ch-card', el).forEach((c) => (c.onclick = () => go('codelab/' + c.dataset.id)));
  const add = $('#add', el);
  if (add) add.onclick = () => modal({
    title: 'New Code Lab challenge', submit: 'Create challenge', wide: true,
    fields: [{ name: 'title', label: 'Title', required: true, placeholder: 'e.g. Find the Missing Number' },
      { name: 'language', label: 'Language', type: 'select', half: true, options: [{ value: 'javascript', label: 'JavaScript' }, { value: 'python', label: 'Python' }] },
      { name: 'difficulty', label: 'Difficulty', type: 'select', half: true, options: ['easy', 'medium', 'hard'].map((d) => ({ value: d, label: d })) },
      { name: 'function_name', label: 'Function name', required: true, half: true, placeholder: 'missingNumber' }, { name: 'xp', label: 'XP reward', type: 'number', value: 30, half: true },
      { name: 'topic', label: 'Topic', placeholder: 'Arrays' },
      { name: 'description', label: 'Problem statement (use `backticks` for code)', type: 'textarea', rows: 4, required: true },
      { name: 'starter_code', label: 'Starter code', type: 'textarea', mono: true, rows: 4, required: true, value: 'function missingNumber(nums) {\n  // your code here\n}\n' },
      { name: 'tests', label: 'Test cases (JSON). Add "hidden": true to keep a test secret.', type: 'textarea', mono: true, rows: 4, required: true, value: '[\n  {"args": [[3,0,1]], "expected": 2},\n  {"args": [[0,1]], "expected": 2, "hidden": true}\n]' }],
    onSubmit: async (d) => { const r = await post('/challenges', d); toast('Challenge created', 'ok'); go('codelab/' + r.id); },
  });
}

export async function editor(el, id) {
  const c = await api('/challenges/' + id);
  const isStudent = state.user.role === 'student';
  const draftKey = `cbz-draft-${state.user.id}-${c.id}`;
  let saved = null; try { saved = localStorage.getItem(draftKey); } catch {}
  const initial = saved || c.lastAttempt?.code || c.starter_code;
  const ext = c.language === 'python' ? 'py' : 'js';
  el.innerHTML = `
  <div class="page-head"><div><a href="#/codelab" class="small">← Code Lab</a><h1 class="mt-1">${esc(c.title)}</h1>
    <div class="row mt-1">${langPill(c.language)}${diffPill(c.difficulty)}<span class="small muted">${esc(c.topic || '')}</span><span class="pill" style="color:var(--accent)">+${c.xp} XP</span>${c.solved ? '<span class="pill ok">✓ Solved</span>' : ''}</div></div></div>
  <div class="lab">
    <div class="card problem">
      <h2>Problem</h2>
      <div class="desc md">${md(c.description)}</div>
      <h3 class="mt-3">Examples</h3>
      ${c.sampleTests.map((t) => `<div class="sample"><span class="faint">Input:</span> ${esc(c.function_name)}(${t.args.map((a) => esc(JSON.stringify(a))).join(', ')})<br><span class="faint">Output:</span> ${esc(JSON.stringify(t.expected))}</div>`).join('')}
      <p class="small muted mt-2">🔒 ${c.hiddenCount} hidden test${c.hiddenCount === 1 ? '' : 's'} run when you submit.</p>
      ${!isStudent ? `<h3 class="mt-3">Recent attempts</h3><div class="list">${(c.recentAttempts || []).map((a) => `<div class="list-item"><div class="grow"><b>${esc(a.name)}</b><div class="meta">${timeAgo(a.created_at)}</div></div><span class="pill ${a.passed === a.total ? 'ok' : 'warn'}">${a.passed}/${a.total}</span></div>`).join('') || empty('No attempts yet')}</div>` : ''}
    </div>
    <div class="card editor-card">
      <div class="editor-bar"><div class="dots"><i></i><i></i><i></i></div><span class="file">solution.${ext}</span><span style="margin-left:auto" class="small">${c.language === 'python' ? 'Python 3' : 'JavaScript (Node)'}</span>
        <button class="btn ghost sm" id="reset" style="background:#23263f;border-color:#2d3150;color:#c8cbe0">Reset</button></div>
      <div class="editor"><div class="gutter" id="gutter"></div><textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(initial)}</textarea></div>
      <div class="editor-actions"><span class="hint">Ctrl/⌘ + Enter to run · Tab indents</span>
        <button class="btn ghost sm" id="run" style="background:#23263f;border-color:#2d3150;color:#e6e8f5">${icon('play', 14)} Run samples</button>
        ${isStudent ? `<button class="btn sm ok" id="submit">${icon('send', 14)} Submit</button>` : ''}</div>
      <div class="console" id="console"><span class="t-dim">// Output will appear here. Run your code against the sample tests, then submit to run hidden tests too.</span></div>
    </div>
  </div>`;
  const ta = $('#code', el), gutter = $('#gutter', el), out = $('#console', el);
  const indent = c.language === 'python' ? '    ' : '  ';
  const lines = () => { gutter.innerHTML = ta.value.split('\n').map((_, i) => i + 1).join('<br>'); gutter.scrollTop = ta.scrollTop; };
  ta.addEventListener('scroll', () => (gutter.scrollTop = ta.scrollTop));
  ta.addEventListener('input', () => { lines(); try { localStorage.setItem(draftKey, ta.value); } catch {} });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText(indent, s, ta.selectionEnd, 'end'); lines(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exec(false); }
    else if (e.key === 'Enter') {
      const s = ta.selectionStart, line = ta.value.slice(0, s).split('\n').pop();
      let pad = line.match(/^\s*/)[0];
      if (/[:{[(]\s*$/.test(line)) pad += indent;
      e.preventDefault(); ta.setRangeText('\n' + pad, s, ta.selectionEnd, 'end'); lines();
    }
  });
  lines();
  $('#reset', el).onclick = () => { ta.value = c.starter_code; try { localStorage.removeItem(draftKey); } catch {} lines(); };

  const show = (r, submitted) => {
    let html = '';
    if (r.error) html += `<div class="t-bad">✗ ${esc(r.error)}</div>`;
    if (r.logs?.length) html += `<div class="t-dim mt-1">stdout</div>${r.logs.map((l) => `<div>${esc(l)}</div>`).join('')}`;
    html += r.results.map((t, i) => t.hidden
      ? `<div class="case">${t.passed ? '<span class="t-ok">✓</span>' : '<span class="t-bad">✗</span>'} Hidden test ${i + 1} <span class="t-dim">🔒</span></div>`
      : `<div class="case">${t.passed ? '<span class="t-ok">✓ Passed</span>' : '<span class="t-bad">✗ Failed</span>'} <span class="t-dim">${esc(c.function_name)}(${t.args.map((a) => esc(JSON.stringify(a))).join(', ')})</span>
         <div class="t-dim">expected <span style="color:#c8cbe0">${esc(JSON.stringify(t.expected))}</span> · got <span style="color:${t.passed ? '#51cf66' : '#ff6b6b'}">${t.error ? esc(t.error) : esc(JSON.stringify(t.got ?? null))}</span></div></div>`).join('');
    const all = r.passed === r.total;
    html += `<div class="mt-2" style="font-weight:700" class="${all ? 't-ok' : 't-warn'}"><span class="${all ? 't-ok' : 't-warn'}">${r.passed}/${r.total} tests passed</span> <span class="t-dim">· ${r.runtime_ms ?? '?'} ms</span></div>`;
    if (submitted && all) html += `<div class="t-ok mt-1">🎉 Accepted!${r.xpEarned ? ` +${r.xpEarned} XP` : ' (already solved — no extra XP)'}</div>`;
    if (submitted && r.autoGraded?.length) html += r.autoGraded.map((g) => `<div class="t-warn">⚡ Auto-graded "${esc(g.assignment)}": ${g.marks}/${g.max}</div>`).join('');
    out.innerHTML = html;
  };
  async function exec(submit) {
    const btn = $(submit ? '#submit' : '#run', el);
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Running…';
    out.innerHTML = '<span class="t-dim">Running…</span>';
    try {
      const r = await post(`/challenges/${c.id}/${submit ? 'submit' : 'run'}`, { code: ta.value });
      show(r, submit);
      if (submit) {
        if (r.allPassed && r.xpEarned) toast(`🎉 Solved! +${r.xpEarned} XP`, 'xp');
        else if (!r.allPassed) toast(`${r.passed}/${r.total} tests passed — keep going!`, '');
        for (const b of r.badges || []) toast(`${b.icon} Badge unlocked: <b>${esc(b.name)}</b>`, 'xp');
        refreshMe();
      }
    } catch (e) { toastError(e); out.innerHTML = `<span class="t-bad">${esc(e.message)}</span>`; }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }
  $('#run', el).onclick = () => exec(false);
  const sb = $('#submit', el); if (sb) sb.onclick = () => exec(true);
}
