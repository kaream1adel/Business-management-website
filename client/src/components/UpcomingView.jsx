import { useMemo } from 'react';
import TaskList from './TaskList.jsx';
import { addDays, dayLabel, longDate, plural } from '../utils.js';

// Open tasks dated after today, grouped by day.
// A task's day is its planned date, or its deadline if it has no plan.
export default function UpcomingView({ tasks, listProps, embedded = false }) {
  const tomorrow = addDays(1);

  const groups = useMemo(() => {
    const map = new Map();
    tasks
      .filter(t => t.status !== 'Done')
      .map(t => [t.plannedDate || t.deadline, t])
      .filter(([d]) => d && d >= tomorrow)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([d, t]) => {
        if (!map.has(d)) map.set(d, []);
        map.get(d).push(t);
      });
    return [...map.entries()];
  }, [tasks, tomorrow]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className={embedded ? 'tab-body' : 'page'}>
      <header className={embedded ? 'tab-head' : 'page-head'}>
        <div>
          {!embedded && <h1 className="page-title">Upcoming</h1>}
          <p className="page-sub">{total ? `${plural(total, 'task')} planned after today` : 'Nothing planned after today.'}</p>
        </div>
      </header>

      {groups.map(([date, list]) => {
        const label = dayLabel(date);
        const isNamed = label === 'Tomorrow';
        return (
          <section key={date} className="section">
            <h2 className="section-title">
              {isNamed ? <>Tomorrow <span className="muted">· {longDate(date)}</span></> : longDate(date)}
              <span className="count">{list.length}</span>
            </h2>
            <TaskList tasks={list} {...listProps} />
          </section>
        );
      })}
    </div>
  );
}
