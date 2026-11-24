// Date helpers (local calendar dates as YYYY-MM-DD)
function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}
function daysBetween(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5);
}
const today = () => ymd();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);

function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
      throw bad(`"${f}" is required`);
    }
  }
}

module.exports = { ymd, addDays, daysBetween, today, clamp, HttpError, bad, notFound, forbidden, requireFields };
