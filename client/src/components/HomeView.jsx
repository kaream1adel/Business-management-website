import { useMemo } from 'react';
import TaskList from './TaskList.jsx';
import { IconPlus, IconArrowRight } from './Icons.jsx';
import { longDate, today, taskStats, byFocus, plural } from '../utils.js';
import './Home.css';

const PER_BIZ = 5;

// Every business on one page: a band each, with its numbers on the left
// and the tasks that need attention on the right.
export default function HomeView({ tasks, bizList, listProps, onOpenBiz, onDrill, onNewTask }) {
  const t = today();

  const bands = useMemo(() => bizList.map(b => {
    const mine = tasks.filter(x => x.bizId === b.id);
    const open = mine.filter(x => x.status !== 'Done').sort(byFocus);
    return { b, stats: taskStats(mine), focus: open.slice(0, PER_BIZ), more: Math.max(0, open.length - PER_BIZ) };
  }), [tasks, bizList]);

  const all = useMemo(() => taskStats(tasks), [tasks]);

  const kpis = [
    { key: 'open',     label: 'Open',             n: all.open,       drill: null },
    { key: 'overdue',  label: 'Overdue',          n: all.overdue,    drill: 'overdue', late: all.overdue > 0 },
    { key: 'today',    label: 'Due today',        n: all.today,      drill: 'today' },
    { key: 'progress', label: 'In progress',      n: all.inProgress, drill: 'inProgress' },
    { key: 'blocked',  label: 'Blocked',          n: all.blocked,    drill: 'blocked' },
    { key: 'week',     label: 'Done this week',   n: all.doneWeek,   drill: 'doneWeek' },
  ];

  return (
    <div className="page page-wide home">
      <header className="page-head">
        <div>
          <h1 className="page-title">{longDate(t)}</h1>
          <p className="page-sub">{plural(bizList.length, 'business', 'businesses')} · {plural(all.open, 'open task')}</p>
        </div>
      </header>

      <div className="kpis" role="list">
        {kpis.map(k => (
          <button key={k.key} role="listitem" className={`kpi ${k.late ? 'is-late' : ''}`}
            onClick={() => onDrill(k.drill || 'open')} title={`Show ${k.label.toLowerCase()} tasks`}>
            <span className="kpi-n num">{k.n}</span>
            <span className="kpi-label">{k.label}</span>
          </button>
        ))}
      </div>

      <div className="bands">
        {bands.map(({ b, stats, focus, more }) => (
          <section key={b.id} className="band" style={{ '--biz': b.color }}>
            <div className="band-side">
              <button className="band-name" onClick={() => onOpenBiz(b.id)} dir="auto">{b.name}</button>
              <p className="band-line">
                <span className="num">{stats.open}</span> open
                {stats.overdue > 0 && <> · <button className="drill is-late" onClick={() => onDrill('overdue', b.id)}>{stats.overdue} overdue</button></>}
                {stats.blocked > 0 && <> · <button className="drill" onClick={() => onDrill('blocked', b.id)}>{stats.blocked} blocked</button></>}
              </p>
              <div className="band-mini">
                <span><b className="num">{stats.today}</b> today</span>
                <span><b className="num">{stats.inProgress}</b> in progress</span>
                <span><b className="num">{stats.doneWeek}</b> done this week</span>
              </div>
              <div className="progress" title={`${stats.done} of ${stats.total} done`}>
                <div className="progress-bar"><i style={{ width: `${stats.pct}%` }} /></div>
                <span className="num">{stats.done}/{stats.total}</span>
              </div>
              <div className="band-actions">
                <button className="btn btn-sm" onClick={() => onNewTask(b.id)}><IconPlus size={13} /> Task</button>
                <button className="btn btn-quiet btn-sm" onClick={() => onOpenBiz(b.id)}>Open <IconArrowRight size={13} /></button>
              </div>
            </div>

            <div className="band-tasks">
              <TaskList tasks={focus} {...listProps} showBiz={false}
                empty={stats.total ? 'Nothing open. All caught up.' : 'No tasks yet. Add the first one.'} />
              {more > 0 && (
                <button className="band-more" onClick={() => onOpenBiz(b.id, 'all')}>
                  {plural(more, 'more open task')} <IconArrowRight size={12} />
                </button>
              )}
            </div>
          </section>
        ))}
        {bizList.length === 0 && <p className="list-empty">No businesses yet. Add one in Settings.</p>}
      </div>
    </div>
  );
}
