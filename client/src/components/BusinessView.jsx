import { useMemo } from 'react';
import TodayView from './TodayView.jsx';
import UpcomingView from './UpcomingView.jsx';
import AllTasksView from './AllTasksView.jsx';
import DoneView from './DoneView.jsx';
import CalendarView from './CalendarView.jsx';
import { IconPlus } from './Icons.jsx';
import { taskStats, addDays } from '../utils.js';

export const BIZ_TABS = [
  ['today', 'Today'],
  ['calendar', 'Calendar'],
  ['upcoming', 'Upcoming'],
  ['all', 'All'],
  ['done', 'Done'],
];

// One business, full page: its numbers, then its tasks in tabs.
export default function BusinessView({
  biz, tasks, tab, onTab, onHome, onNewTask, onDrill, allProps, listProps,
}) {
  const s = useMemo(() => taskStats(tasks), [tasks]);
  const tomorrow = addDays(1);
  const tabCount = {
    today: s.overdue + s.today,
    upcoming: tasks.filter(t => t.status !== 'Done' && (t.plannedDate || t.deadline || '') >= tomorrow).length,
    all: s.open,
    done: s.done,
  };

  return (
    <div className="page page-mid bizpage" style={{ '--biz': biz.color }}>
      <nav className="crumbs"><button onClick={onHome}>Home</button> <span>/</span></nav>
      <header className="biz-head">
        <div className="biz-head-main">
          <h1 className="page-title" dir="auto">{biz.name}</h1>
          <div className="biz-stats">
            <Stat n={s.open} label="open" />
            <Stat n={s.overdue} label="overdue" late={s.overdue > 0} onClick={s.overdue ? () => onDrill('overdue') : null} />
            <Stat n={s.inProgress} label="in progress" onClick={s.inProgress ? () => onDrill('inProgress') : null} />
            <Stat n={s.blocked} label="blocked" onClick={s.blocked ? () => onDrill('blocked') : null} />
            <Stat n={s.doneWeek} label="done this week" />
          </div>
          <div className="progress progress-wide" title={`${s.done} of ${s.total} done`}>
            <div className="progress-bar"><i style={{ width: `${s.pct}%` }} /></div>
            <span className="num">{s.pct}% done · {s.done}/{s.total}</span>
          </div>
        </div>
        <button className="btn btn-ink" onClick={() => onNewTask(biz.id)}><IconPlus size={14} /> New task</button>
      </header>

      <div className="tabs" role="tablist">
        {BIZ_TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>
            {label} {tabCount[id] > 0 && <span className="num">{tabCount[id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'today' && <TodayView tasks={tasks} listProps={listProps} />}
      {tab === 'calendar' && (
        <CalendarView key={biz.id} tasks={tasks} businesses={listProps.businesses} showBiz={false} embedded
          onOpen={listProps.onOpen} onQuickUpdate={listProps.onQuickUpdate} onNewTask={(d) => onNewTask(biz.id, d)} />
      )}
      {tab === 'upcoming' && <UpcomingView tasks={tasks} listProps={listProps} embedded />}
      {tab === 'all' && <AllTasksView key={biz.id} tasks={tasks} listProps={listProps} embedded {...allProps} />}
      {tab === 'done' && <DoneView key={biz.id} tasks={tasks} listProps={listProps} embedded />}
    </div>
  );
}

function Stat({ n, label, late, onClick }) {
  const inner = <><b className="num">{n}</b> {label}</>;
  return onClick
    ? <button className={`biz-stat drill-stat ${late ? 'is-late' : ''}`} onClick={onClick}>{inner}</button>
    : <span className={`biz-stat ${late ? 'is-late' : ''}`}>{inner}</span>;
}
