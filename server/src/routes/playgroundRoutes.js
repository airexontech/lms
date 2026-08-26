const express = require('express');
const { spawn, execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDB } = require('../db/db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticateToken);

// ── Resolve matched javac/java binaries ──────────────────────
// On Windows, 'java' in PATH may be a different (older) JRE than
// the 'javac' that compiled the code, causing UnsupportedClassVersionError.
// We find javac's directory and use the java.exe sitting next to it.
function resolveJavaBinaries() {
  try {
    // Use 'where javac' (Windows) or 'which javac' (*nix) to get the real path
    const cmd   = process.platform === 'win32' ? 'where' : 'which';
    const out   = execFileSync(cmd, ['javac'], { encoding: 'utf8' }).trim();
    // 'where' may return multiple lines; take the first
    const javacExe = out.split(/\r?\n/)[0].trim();
    const binDir   = path.dirname(javacExe);
    const javaExe  = path.join(binDir, process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(javaExe)) {
      console.log(`[playground] Using matched Java runtime: ${javaExe}`);
      return { javac: javacExe, java: javaExe };
    }
  } catch (_) {}
  // Fallback to bare commands and hope PATH is consistent
  return { javac: 'javac', java: 'java' };
}

const JAVA_BIN = resolveJavaBinaries();

// ── Execution limits ─────────────────────────────────────────
const LIMITS = {
  java:       { compileTimeout: 20000, runTimeout: 12000, maxMemoryMb: 256, maxOutputBytes: 65536 },
  python:     { runTimeout: 12000, maxOutputBytes: 65536 },
  javascript: { runTimeout: 10000, maxOutputBytes: 65536 },
  c:          { compileTimeout: 15000, runTimeout: 10000, maxOutputBytes: 65536 },
  cpp:        { compileTimeout: 15000, runTimeout: 10000, maxOutputBytes: 65536 },
};

// ── Kill a process tree (Windows-safe) ───────────────────────
function killProcess(child) {
  try {
    if (process.platform === 'win32') {
      // taskkill /F /T kills the entire process tree
      execFile('taskkill', ['/F', '/T', '/PID', String(child.pid)], () => {});
    } else {
      child.kill('SIGKILL');
    }
  } catch (_) {}
}

// ── Spawn with timeout + output cap ──────────────────────────
function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const {
      timeout        = 10000,
      maxOutputBytes = 65536,
      stdin          = '',
      cwd,
    } = opts;

    const startTime = Date.now();
    let stdout  = '';
    let stderr  = '';
    let settled = false;

    // Use shell:true ONLY for bare command names (no path separators).
    // For full absolute paths (which may contain spaces) use shell:false
    // so the OS receives them as a proper argument rather than a shell token.
    const isBareName = !cmd.includes(path.sep) && !cmd.includes('/');
    const useShell   = process.platform === 'win32' && isBareName;

    const child = spawn(cmd, args, {
      cwd,
      shell: useShell,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    function finish(exitCode, timedOut) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout:    stdout.slice(0, maxOutputBytes),
        stderr:    stderr.slice(0, maxOutputBytes),
        exitCode,
        timedOut,
        durationMs: Date.now() - startTime,
      });
    }

    const timer = setTimeout(() => {
      killProcess(child);
      finish(null, true);
    }, timeout);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > maxOutputBytes) {
        stdout = stdout.slice(0, maxOutputBytes);
        killProcess(child);
      }
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > maxOutputBytes) stderr = stderr.slice(0, maxOutputBytes);
    });

    // Write stdin then close
    if (stdin) {
      try { child.stdin.write(stdin); } catch (_) {}
    }
    try { child.stdin.end(); } catch (_) {}

    child.on('close',  (code) => finish(code ?? 0, false));
    child.on('error',  (err)  => finish(-1, false, stderr + '\n' + err.message));
  });
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ── Language runners ─────────────────────────────────────────

async function runJava(sourceCode, stdin, limits) {
  const classMatch = sourceCode.match(/public\s+class\s+(\w+)/);
  const className  = classMatch ? classMatch[1] : 'Main';
  const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), 'javarun-'));
  const srcFile    = path.join(tmpDir, `${className}.java`);

  try {
    fs.writeFileSync(srcFile, sourceCode, 'utf8');

    // Step 1: compile — use the resolved javac path
    const compile = await runProcess(JAVA_BIN.javac, [srcFile], {
      timeout:        limits.compileTimeout,
      maxOutputBytes: limits.maxOutputBytes,
      cwd:            tmpDir,
    });

    if (compile.timedOut) {
      return { status: 'compile_error', compileOutput: 'Compilation timed out.', stdout: '', stderr: '', exitCode: null, durationMs: compile.durationMs };
    }
    if (compile.exitCode !== 0) {
      return { status: 'compile_error', compileOutput: compile.stderr || compile.stdout || 'Unknown compile error.', stdout: '', stderr: '', exitCode: compile.exitCode, durationMs: compile.durationMs };
    }

    // Step 2: run — use the SAME JDK's java.exe (avoids class version mismatch)
    const run = await runProcess(
      JAVA_BIN.java,
      [`-Xmx${limits.maxMemoryMb}m`, '-Xms32m', '-cp', tmpDir, className],
      { timeout: limits.runTimeout, maxOutputBytes: limits.maxOutputBytes, stdin, cwd: tmpDir }
    );

    if (run.timedOut) {
      return { status: 'time_limit', compileOutput: '', stdout: run.stdout, stderr: `Execution timed out (${limits.runTimeout / 1000}s limit).`, exitCode: null, durationMs: run.durationMs };
    }
    return {
      status: run.exitCode === 0 ? 'success' : 'runtime_error',
      compileOutput: '', stdout: run.stdout, stderr: run.stderr,
      exitCode: run.exitCode, durationMs: run.durationMs,
    };
  } finally {
    cleanupDir(tmpDir);
  }
}

async function runPython(sourceCode, stdin, limits) {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'pyrun-'));
  const srcFile = path.join(tmpDir, 'main.py');
  try {
    fs.writeFileSync(srcFile, sourceCode, 'utf8');
    // On Windows 'python' is the right command; 'python3' may not exist
    const cmd = process.platform === 'win32' ? 'python' : 'python3';
    const run = await runProcess(cmd, [srcFile], {
      timeout: limits.runTimeout, maxOutputBytes: limits.maxOutputBytes, stdin, cwd: tmpDir,
    });
    if (run.timedOut) return { status: 'time_limit', compileOutput: '', stdout: run.stdout, stderr: 'Execution timed out.', exitCode: null, durationMs: run.durationMs };
    return { status: run.exitCode === 0 ? 'success' : 'runtime_error', compileOutput: '', stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode, durationMs: run.durationMs };
  } finally { cleanupDir(tmpDir); }
}

async function runJavaScript(sourceCode, stdin, limits) {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'jsrun-'));
  const srcFile = path.join(tmpDir, 'main.js');
  try {
    fs.writeFileSync(srcFile, sourceCode, 'utf8');
    const run = await runProcess(
      process.execPath, [srcFile],
      { timeout: limits.runTimeout, maxOutputBytes: limits.maxOutputBytes, stdin, cwd: tmpDir }
    );
    if (run.timedOut) return { status: 'time_limit', compileOutput: '', stdout: run.stdout, stderr: 'Execution timed out.', exitCode: null, durationMs: run.durationMs };
    return { status: run.exitCode === 0 ? 'success' : 'runtime_error', compileOutput: '', stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode, durationMs: run.durationMs };
  } finally { cleanupDir(tmpDir); }
}

async function runC(sourceCode, stdin, limits, isCpp = false) {
  const ext      = isCpp ? 'cpp' : 'c';
  const compiler = isCpp ? 'g++' : 'gcc';
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), `${ext}run-`));
  const srcFile  = path.join(tmpDir, `main.${ext}`);
  const outFile  = path.join(tmpDir, process.platform === 'win32' ? 'main.exe' : 'main');

  try {
    fs.writeFileSync(srcFile, sourceCode, 'utf8');
    const compile = await runProcess(compiler, [srcFile, '-o', outFile], {
      timeout: limits.compileTimeout, maxOutputBytes: limits.maxOutputBytes, cwd: tmpDir,
    });
    if (compile.timedOut) return { status: 'compile_error', compileOutput: 'Compilation timed out.', stdout: '', stderr: '', exitCode: null, durationMs: compile.durationMs };
    if (compile.exitCode !== 0) return { status: 'compile_error', compileOutput: compile.stderr || compile.stdout, stdout: '', stderr: '', exitCode: compile.exitCode, durationMs: compile.durationMs };

    const run = await runProcess(outFile, [], { timeout: limits.runTimeout, maxOutputBytes: limits.maxOutputBytes, stdin, cwd: tmpDir });
    if (run.timedOut) return { status: 'time_limit', compileOutput: '', stdout: run.stdout, stderr: 'Execution timed out.', exitCode: null, durationMs: run.durationMs };
    return { status: run.exitCode === 0 ? 'success' : 'runtime_error', compileOutput: '', stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode, durationMs: run.durationMs };
  } finally { cleanupDir(tmpDir); }
}

// ── POST /api/playground/run ─────────────────────────────────
router.post('/run', async (req, res) => {
  const { source_code, language = 'java', stdin = '', title = '' } = req.body;

  if (!source_code || !source_code.trim()) {
    return res.status(400).json({ message: 'source_code is required.' });
  }

  const lang   = language.toLowerCase();
  const limits = LIMITS[lang];
  if (!limits) {
    return res.status(400).json({ message: `Unsupported language "${lang}". Supported: java, python, javascript, c, cpp` });
  }

  let result;
  try {
    if      (lang === 'java')       result = await runJava(source_code, stdin, limits);
    else if (lang === 'python')     result = await runPython(source_code, stdin, limits);
    else if (lang === 'javascript') result = await runJavaScript(source_code, stdin, limits);
    else if (lang === 'c')          result = await runC(source_code, stdin, limits, false);
    else if (lang === 'cpp')        result = await runC(source_code, stdin, limits, true);
  } catch (err) {
    console.error('Playground run error:', err);
    return res.status(500).json({ message: 'Execution engine error: ' + err.message });
  }

  // Persist (non-fatal if DB fails)
  try {
    const db   = await getDB();
    const saved = await db.run(
      `INSERT INTO playground_submissions
         (user_id, language, title, source_code, stdin, stdout, stderr, compile_output, status, exit_code, execution_time_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, lang, title || null, source_code, stdin,
       result.stdout, result.stderr, result.compileOutput,
       result.status, result.exitCode, result.durationMs]
    );
    result.submission_id = saved.lastID;
  } catch (dbErr) {
    console.error('Failed to persist submission:', dbErr.message);
  }

  return res.json(result);
});

// ── GET /api/playground/submissions ─────────────────────────
router.get('/submissions', async (req, res) => {
  try {
    const db    = await getDB();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const lang  = req.query.language;
    let query   = `SELECT id, language, title, status, exit_code, execution_time_ms, created_at,
                          substr(source_code,1,200) AS source_preview
                   FROM playground_submissions WHERE user_id = ?`;
    const params = [req.user.id];
    if (lang) { query += ' AND language = ?'; params.push(lang); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const submissions = await db.all(query, params);
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch submissions.' });
  }
});

router.get('/submissions/:id', async (req, res) => {
  try {
    const db  = await getDB();
    const sub = await db.get(
      'SELECT * FROM playground_submissions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!sub) return res.status(404).json({ message: 'Submission not found.' });
    res.json({ submission: sub });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch submission.' });
  }
});

router.delete('/submissions/:id', async (req, res) => {
  try {
    const db     = await getDB();
    const result = await db.run(
      'DELETE FROM playground_submissions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.changes === 0) return res.status(404).json({ message: 'Submission not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete.' });
  }
});

router.delete('/submissions', async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM playground_submissions WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All submissions cleared.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear.' });
  }
});

module.exports = router;

// ── POST /api/playground/judge ────────────────────────────────
// Runs code against all test cases, returns per-case pass/fail
router.post('/judge', async (req, res) => {
  const { source_code, language = 'java', question_id } = req.body;

  if (!source_code || !source_code.trim()) {
    return res.status(400).json({ message: 'source_code is required.' });
  }
  if (!question_id) {
    return res.status(400).json({ message: 'question_id is required.' });
  }

  const lang   = language.toLowerCase();
  const limits = LIMITS[lang];
  if (!limits) {
    return res.status(400).json({ message: `Unsupported language: ${lang}` });
  }

  // Fetch test cases from DB
  let testCases = [];
  try {
    const db = await getDB();
    const q  = await db.get('SELECT * FROM coding_questions WHERE id = ?', [question_id]);
    if (!q) return res.status(404).json({ message: 'Question not found.' });
    try { testCases = JSON.parse(q.test_cases || '[]'); } catch (_) { testCases = []; }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load question.' });
  }

  if (testCases.length === 0) {
    // No test cases defined — just run the code freely
    let result;
    try {
      if      (lang === 'java')       result = await runJava(source_code, '', limits);
      else if (lang === 'python')     result = await runPython(source_code, '', limits);
      else if (lang === 'javascript') result = await runJavaScript(source_code, '', limits);
      else if (lang === 'c')          result = await runC(source_code, '', limits, false);
      else if (lang === 'cpp')        result = await runC(source_code, '', limits, true);
    } catch (err) {
      return res.status(500).json({ message: 'Execution error: ' + err.message });
    }
    return res.json({
      test_results: [],
      passed: 0, total: 0, score: 100,
      compile_output: result.compileOutput || '',
      overall_status: result.status,
    });
  }

  // Run against each test case
  const testResults = [];
  let compileError = null;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const stdin = tc.input || '';
    let result;
    try {
      if      (lang === 'java')       result = await runJava(source_code, stdin, limits);
      else if (lang === 'python')     result = await runPython(source_code, stdin, limits);
      else if (lang === 'javascript') result = await runJavaScript(source_code, stdin, limits);
      else if (lang === 'c')          result = await runC(source_code, stdin, limits, false);
      else if (lang === 'cpp')        result = await runC(source_code, stdin, limits, true);
    } catch (err) {
      result = { status: 'runtime_error', stdout: '', stderr: err.message, compileOutput: '', exitCode: -1, durationMs: 0 };
    }

    // Capture compile error from first case (same code = same compile result)
    if (result.status === 'compile_error' && !compileError) {
      compileError = result.compileOutput;
      // All remaining cases will also fail
      for (let j = i; j < testCases.length; j++) {
        testResults.push({
          case_num:   j + 1,
          input:      testCases[j].input || '',
          expected:   testCases[j].expected || '',
          actual:     '',
          passed:     false,
          status:     'compile_error',
          duration_ms: 0,
        });
      }
      break;
    }

    const actual   = (result.stdout || '').trim().replace(/\r\n/g, '\n');
    const expected = (tc.expected || '').trim().replace(/\r\n/g, '\n');
    const passed   = actual === expected;

    testResults.push({
      case_num:    i + 1,
      input:       stdin,
      expected,
      actual,
      passed,
      status:      result.status,
      duration_ms: result.durationMs || 0,
      stderr:      result.stderr || '',
    });
  }

  const passedCount = testResults.filter(t => t.passed).length;
  const score       = testCases.length > 0 ? Math.round((passedCount / testCases.length) * 100) : 100;
  const allPassed   = passedCount === testCases.length;

  // Persist solve record if all passed
  try {
    const db = await getDB();
    // Track in playground_submissions
    await db.run(
      `INSERT INTO playground_submissions
       (user_id, language, title, source_code, stdin, stdout, stderr, compile_output, status, exit_code, execution_time_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, lang,
        `Q${question_id} attempt`,
        source_code, '',
        testResults.map(t => t.actual).join('\n'),
        testResults.map(t => t.stderr || '').join('\n'),
        compileError || '',
        allPassed ? 'success' : 'runtime_error',
        allPassed ? 0 : 1,
        testResults.reduce((s, t) => s + (t.duration_ms || 0), 0),
      ]
    );
  } catch (dbErr) {
    console.error('Judge persist error:', dbErr.message);
  }

  return res.json({
    test_results:   testResults,
    passed:         passedCount,
    total:          testCases.length,
    score,
    compile_output: compileError || '',
    overall_status: allPassed ? 'accepted' : compileError ? 'compile_error' : 'wrong_answer',
  });
});
