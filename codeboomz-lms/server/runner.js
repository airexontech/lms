// Code Lab runner: executes student code against test cases in a separate, time-limited process.
// NOTE: for a public production deployment, run this inside a container sandbox (e.g. Docker / Judge0 / Firecracker).
const { spawn } = require('node:child_process');
const os = require('node:os');

const TIMEOUT_MS = 4000;
const MAX_OUTPUT = 20000;

const JS_HARNESS = `
const vm = require('node:vm');
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  const { code, fn, tests } = JSON.parse(input);
  const logs = [];
  const sandbox = { console: { log: (...a) => logs.push(a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')) } };
  const ctx = vm.createContext(sandbox);
  const out = { results: [], logs, error: null };
  try {
    vm.runInContext(code + '\\n;globalThis.__fn = (typeof ' + fn + ' !== "undefined") ? ' + fn + ' : undefined;', ctx, { timeout: 1500 });
  } catch (e) { out.error = String(e && e.message || e); }
  if (!out.error && typeof ctx.__fn !== 'function') out.error = 'Function "' + fn + '" was not found. Keep the given function name.';
  if (!out.error) {
    for (const t of tests) {
      const r = { passed: false };
      try {
        ctx.__args = JSON.parse(JSON.stringify(t.args));
        const got = vm.runInContext('__fn(...__args)', ctx, { timeout: 1500 });
        r.got = got === undefined ? null : got;
        r.passed = JSON.stringify(got) === JSON.stringify(t.expected);
      } catch (e) { r.error = String(e && e.message || e); }
      out.results.push(r);
      if (r.error && /timed out/i.test(r.error)) { out.error = 'Time limit exceeded. Check for infinite loops.'; break; }
    }
  }
  process.stdout.write(JSON.stringify(out));
});`;

const PY_HARNESS = `
import sys, json, io, contextlib
data = json.loads(sys.stdin.read())
code, fn, tests = data['code'], data['fn'], data['tests']
out = {'results': [], 'logs': [], 'error': None}
buf = io.StringIO()
env = {'__name__': '__student__'}
try:
    with contextlib.redirect_stdout(buf):
        exec(compile(code, 'solution.py', 'exec'), env)
except Exception as e:
    out['error'] = type(e).__name__ + ': ' + str(e)
f = env.get(fn)
if not out['error'] and not callable(f):
    out['error'] = 'Function "' + fn + '" was not found. Keep the given function name.'
if not out['error']:
    for t in tests:
        r = {'passed': False}
        try:
            with contextlib.redirect_stdout(buf):
                got = f(*json.loads(json.dumps(t['args'])))
            if isinstance(got, tuple): got = list(got)
            r['got'] = got
            r['passed'] = json.dumps(got, sort_keys=True) == json.dumps(t['expected'], sort_keys=True)
        except Exception as e:
            r['error'] = type(e).__name__ + ': ' + str(e)
        out['results'].append(r)
out['logs'] = [l for l in buf.getvalue().splitlines()][:200]
try:
    sys.stdout.write(json.dumps(out, default=str))
except Exception as e:
    sys.stdout.write(json.dumps({'results': [], 'logs': [], 'error': 'Could not serialise result: ' + str(e)}))
`;

function runCode({ language, code, functionName, tests }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const cmd = language === 'python'
      ? ['python3', ['-I', '-c', PY_HARNESS]]
      : [process.execPath, ['--max-old-space-size=64', '-e', JS_HARNESS]];
    const child = spawn(cmd[0], cmd[1], {
      cwd: os.tmpdir(),
      env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { if (stdout.length < MAX_OUTPUT * 5) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < MAX_OUTPUT) stderr += d; });
    child.on('close', () => {
      clearTimeout(timer);
      const runtime_ms = Date.now() - started;
      if (killed) return resolve({ error: `Time limit exceeded (${TIMEOUT_MS / 1000}s). Check for infinite loops.`, results: [], logs: [], runtime_ms });
      try {
        const out = JSON.parse(stdout);
        out.runtime_ms = runtime_ms;
        resolve(out);
      } catch {
        resolve({ error: (stderr || 'Execution failed').slice(0, 2000), results: [], logs: [], runtime_ms });
      }
    });
    child.stdin.end(JSON.stringify({ code, fn: functionName, tests }));
  });
}

// Shape results for the client: hidden tests reveal only pass/fail.
async function evaluate(challenge, code) {
  const tests = JSON.parse(challenge.tests);
  const out = await runCode({ language: challenge.language, code, functionName: challenge.function_name, tests });
  const results = tests.map((t, i) => {
    const r = out.results[i] || { passed: false, error: out.error ? 'Not run' : undefined };
    return t.hidden
      ? { hidden: true, passed: r.passed }
      : { hidden: false, passed: r.passed, args: t.args, expected: t.expected, got: r.got, error: r.error };
  });
  const passed = results.filter((r) => r.passed).length;
  return { passed, total: tests.length, results, logs: (out.logs || []).slice(0, 100), error: out.error, runtime_ms: out.runtime_ms };
}

module.exports = { evaluate };
