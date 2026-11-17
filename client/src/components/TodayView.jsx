import { useMemo } from 'react';
import TaskList from './TaskList.jsx';
import { isOverdue, today } from '../utils.js';

const byDate = (t) => t.plannedDate || t.deadline || '9999';

// A business's Today tab: what is late, what is due today, what is stuck,
// and what is already being worked on.
export default function TodayView({ tasks, listProps }) {
  const t = today();

  const { overdue, todays, blocked, inProgress } = useMemo(() => {
    const open = tasks.filter(x => x.status !== 'Done');
    const overdue = open.filter(isOverdue).sort((a, b) => byDate(a).localeCompare(byDate(b)));
    const shown = new Set(overdue.map(x => x.id));
    const todays = open.filter(x => !shown.has(x.id) && (x.plannedDate === t || x.deadline === t));
    todays.forEach(x => shown.add(x.id));
    const blocked = open.filter(x => x.status === 'Blocked' && !shown.has(x.id));
    blocked.forEach(x => shown.add(x.id));
    const inProgress = open.filter(x => x.status === 'In Progress' && !shown.has(x.id));
    return { overdue, todays, blocked, inProgress };
  }, [tasks, t]);

  return (
    <div className="tab-body">
      {overdue.length > 0 && (
        <section className="section">
          <h2 className="section-title is-late">Overdue <span className="count">{overdue.length}</span></h2>
          <TaskList tasks={overdue} {...listProps} />
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Today <span className="count">{todays.length}</span></h2>
        <TaskList tasks={todays} {...listProps} empty="Nothing planned for today. Give a task today's date and it shows up here." />
      </section>

      {blocked.length > 0 && (
        <section className="section">
          <h2 className="section-title">Blocked <span className="count">{blocked.length}</span></h2>
          <TaskList tasks={blocked} {...listProps} />
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="section">
          <h2 className="section-title">In progress <span className="count">{inProgress.length}</span></h2>
          <TaskList tasks={inProgress} {...listProps} />
        </section>
      )}
    </div>
  );
}
