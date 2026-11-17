import { useMemo, useState } from 'react';
import TaskList from './TaskList.jsx';
import { IconSearch } from './Icons.jsx';
import { plural } from '../utils.js';

const finishedAt = (t) => t.completedAt || t.lastEdited || '';

// Finished tasks, newest first, grouped by month.
export default function DoneView({ tasks, listProps, embedded = false }) {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    tasks
      .filter(t => t.status === 'Done')
      .filter(t => !q || [t.taskName, t.responsible, t.system, t.notes].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => finishedAt(b).localeCompare(finishedAt(a)))
      .forEach(t => {
        const d = finishedAt(t) ? new Date(finishedAt(t)) : null;
        const key = d ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Undated';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(t);
      });
    return [...map.entries()];
  }, [tasks, search]);

  const total = groups.reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className={embedded ? 'tab-body' : 'page'}>
      <header className={embedded ? 'tab-head' : 'page-head'}>
        <div>
          {!embedded && <h1 className="page-title">Done</h1>}
          <p className="page-sub">{plural(total, 'finished task')} · click the mark to reopen one</p>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <input className="input" placeholder="Search finished tasks" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
      </div>

      {groups.length === 0 && <p className="list-empty">{search ? 'No finished tasks match.' : 'Nothing finished yet.'}</p>}
      {groups.map(([month, list]) => (
        <section key={month} className="section">
          <h2 className="section-title">{month} <span className="count">{list.length}</span></h2>
          <TaskList tasks={list} {...listProps} />
        </section>
      ))}
    </div>
  );
}
