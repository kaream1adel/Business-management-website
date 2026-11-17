export const STATUSES   = ['Not Started', 'In Progress', 'Blocked', 'Done'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2, '': 3 };

// Muted colours that sit well on paper and in dark mode
export const BIZ_COLORS = [
  '#2f5d8a', '#8a5a3c', '#5a7d3a', '#a3372a', '#b7791f',
  '#6b4f8a', '#2f7a74', '#4f5d6b', '#8a3c63', '#6b6b4f',
];

export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return localDateStr();
}

export function addDays(n, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function isOverdue(task) {
  if (task.status === 'Done') return false;
  const t = today();
  if (task.deadline && task.deadline < t) return true;
  if (task.plannedDate && task.plannedDate < t) return true;
  return false;
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === today();
}

const parse = (s) => new Date(s.slice(0, 10) + 'T00:00:00');

// "16 Nov", or "16 Nov 2025" when not this year
export function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = parse(dateStr);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

// "Today", "Tomorrow", "Yesterday", "Mon 16 Nov" (within a week), else shortDate
export function dayLabel(dateStr) {
  if (!dateStr) return '';
  const s = dateStr.slice(0, 10);
  if (s === today()) return 'Today';
  if (s === addDays(1)) return 'Tomorrow';
  if (s === addDays(-1)) return 'Yesterday';
  const diff = Math.round((parse(s) - parse(today())) / 86400000);
  if (diff > 1 && diff < 7) return parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return shortDate(s);
}

export function longDate(dateStr) {
  return parse(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDate(dateStr) {
  return dateStr ? shortDate(dateStr) : '—';
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === 'light' || theme === 'dark') el.dataset.theme = theme;
  else delete el.dataset.theme;
}

// Thrown when the server says another device saved first (HTTP 409).
// `current` is the server's latest copy.
export class ConflictError extends Error {
  constructor(current) {
    super('Changed on another device');
    this.current = current;
  }
}

// Counts for one business (or any task list)
export function taskStats(tasks) {
  const t = today();
  const weekAgo = addDays(-7);
  const s = { open: 0, notStarted: 0, inProgress: 0, blocked: 0, overdue: 0, today: 0, done: 0, doneWeek: 0, total: tasks.length };
  for (const x of tasks) {
    if (x.status === 'Done') {
      s.done++;
      if ((x.completedAt || x.lastEdited || '').slice(0, 10) >= weekAgo) s.doneWeek++;
      continue;
    }
    s.open++;
    if (x.status === 'In Progress') s.inProgress++;
    else if (x.status === 'Blocked') s.blocked++;
    else s.notStarted++;
    if (isOverdue(x)) s.overdue++;
    else if (x.plannedDate === t || x.deadline === t) s.today++;
  }
  s.pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return s;
}

// What needs looking at first: overdue, today, blocked, in progress,
// then the next dated tasks, then the rest by priority.
export function focusRank(x) {
  const t = today();
  if (isOverdue(x)) return 0;
  if (x.plannedDate === t || x.deadline === t) return 1;
  if (x.status === 'Blocked') return 2;
  if (x.status === 'In Progress') return 3;
  if (x.plannedDate || x.deadline) return 4;
  return 5;
}
export function byFocus(a, b) {
  const r = focusRank(a) - focusRank(b);
  if (r) return r;
  const da = a.plannedDate || a.deadline || '9999', db = b.plannedDate || b.deadline || '9999';
  if (da !== db) return da.localeCompare(db);
  return PRIORITY_RANK[a.priority || ''] - PRIORITY_RANK[b.priority || ''];
}
