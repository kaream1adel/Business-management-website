import { useState, useMemo, useEffect, useRef } from 'react';
import TaskList from './TaskList.jsx';
import { IconSearch, IconX } from './Icons.jsx';
import { isOverdue, today, addDays, PRIORITY_RANK, plural } from '../utils.js';

const STATUS_FILTERS = [
  ['open', 'Open'],
  ['Not Started', 'Not started'],
  ['In Progress', 'In progress'],
  ['Blocked', 'Blocked'],
  ['Done', 'Done'],
  ['any', 'Any status'],
];

const SORTS = {
  edited:   ['Recently edited', (a, b) => (b.lastEdited || '').localeCompare(a.lastEdited || '')],
  planned:  ['Planned date',    (a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999')],
  deadline: ['Deadline',        (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')],
  priority: ['Priority',        (a, b) => PRIORITY_RANK[a.priority || ''] - PRIORITY_RANK[b.priority || '']],
  name:     ['Name',            (a, b) => (a.taskName || '').localeCompare(b.taskName || '')],
};

export const QUICK_FILTERS = {
  open:         ['Open',              t => t.status !== 'Done'],
  overdue:      ['Overdue',           t => isOverdue(t)],
  today:        ['Planned for today', t => t.status !== 'Done' && (t.plannedDate === today() || t.deadline === today())],
  blocked:      ['Blocked',           t => t.status === 'Blocked'],
  inProgress:   ['In progress',       t => t.status === 'In Progress'],
  doneWeek:     ['Done this week',    t => t.status === 'Done' && (t.completedAt || t.lastEdited || '').slice(0, 10) >= addDays(-7)],
  highPriority: ['High priority',     t => t.status !== 'Done' && t.priority === 'High'],
};

export default function AllTasksView({
  tasks, listProps, quickFilter, onClearQuick, searchRef, selectMode, onToggleSelectMode, onSelectAll, embedded = false,
}) {
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('open');
  const [priority, setPriority] = useState('any');
  const [sort, setSort]       = useState('edited');
  const localRef = useRef(null);

  useEffect(() => { if (searchRef) searchRef.current = localRef.current; });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const quick = quickFilter && QUICK_FILTERS[quickFilter]?.[1];
    return tasks
      .filter(t => {
        if (quick) { if (!quick(t)) return false; }
        else if (status === 'open') { if (t.status === 'Done') return false; }
        else if (status !== 'any' && t.status !== status) return false;
        if (priority !== 'any' && (t.priority || '') !== priority) return false;
        if (!q) return true;
        return [t.taskName, t.responsible, t.system, t.notes, t.blockingIssue]
          .some(v => (v || '').toLowerCase().includes(q));
      })
      .sort(SORTS[sort][1]);
  }, [tasks, search, status, priority, sort, quickFilter]);

  const ids = shown.map(t => t.id);

  return (
    <div className={embedded ? 'tab-body' : 'page'}>
      <header className={embedded ? 'tab-head' : 'page-head'}>
        <div>
          {!embedded && <h1 className="page-title">All tasks</h1>}
          <p className="page-sub">{plural(shown.length, 'task')}</p>
        </div>
        <div className="page-actions">
          {selectMode && <button className="btn btn-quiet btn-sm" onClick={() => onSelectAll(ids)}>Select all {shown.length}</button>}
          <button className={`btn btn-sm ${selectMode ? 'btn-ink' : ''}`} onClick={onToggleSelectMode}>
            {selectMode ? 'Done selecting' : 'Select'}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <input
            ref={localRef}
            className="input"
            placeholder="Search tasks, people, systems"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }}
          />
          <span className="kbd search-kbd">Ctrl K</span>
        </label>
        {quickFilter ? (
          <span className="chip">
            {QUICK_FILTERS[quickFilter]?.[0]}
            <button onClick={onClearQuick} aria-label="Clear filter"><IconX size={12} /></button>
          </span>
        ) : (
          <select className="select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <select className="select" value={priority} onChange={e => setPriority(e.target.value)} aria-label="Priority">
          <option value="any">Any priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
          <option value="">No priority</option>
        </select>
        <select className="select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>Sort: {l}</option>)}
        </select>
      </div>

      <TaskList tasks={shown} {...listProps} selecting={selectMode || listProps.selecting} empty="No tasks match these filters." />
    </div>
  );
}
