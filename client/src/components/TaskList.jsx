import { memo } from 'react';
import { Picker, DateButton } from './Picker.jsx';
import { StatusMark, BizMark } from './Icons.jsx';
import { STATUSES, PRIORITIES, isOverdue, dayLabel, shortDate, today } from '../utils.js';

export const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: s, icon: <StatusMark status={s} /> }));
export const PRIORITY_OPTIONS = [
  ...PRIORITIES.map(p => ({ value: p, label: p, icon: <PriorityMark priority={p} /> })),
  { value: '', label: 'No priority', icon: <PriorityMark priority="" /> },
];

export function PriorityMark({ priority }) {
  const n = { High: 3, Medium: 2, Low: 1 }[priority] || 0;
  return (
    <span className={`pmark pmark-${n}`} aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

// A list of task rows. Status, priority and planned date can be changed
// in place; clicking anywhere else opens the task.
export default function TaskList({
  tasks, businesses, showBiz = true, onOpen, onQuickUpdate,
  selected, onToggleSelect, selecting = false, updatingIds, empty = 'Nothing here.',
}) {
  if (!tasks.length) return <p className="list-empty">{empty}</p>;
  return (
    <div className={`tasklist ${selecting ? 'is-selecting' : ''}`} role="list">
      {tasks.map(t => (
        <TaskRow
          key={t.id}
          task={t}
          business={businesses[t.bizId]}
          showBiz={showBiz}
          onOpen={onOpen}
          onQuickUpdate={onQuickUpdate}
          isSelected={selected?.has(t.id) || false}
          onToggleSelect={onToggleSelect}
          selecting={selecting}
          updating={updatingIds?.has(t.id) || false}
        />
      ))}
    </div>
  );
}

const TaskRow = memo(function TaskRow({
  task, business, showBiz, onOpen, onQuickUpdate, isSelected, onToggleSelect, selecting, updating,
}) {
  const overdue = isOverdue(task);
  const done = task.status === 'Done';
  const t = today();
  const deadlinePast = !done && task.deadline && task.deadline < t;
  const plannedPast = !done && task.plannedDate && task.plannedDate < t;

  const meta = [];
  if (showBiz && business) meta.push(<span key="b" className="meta-biz"><BizMark color={business.color} size={7} />{business.name}</span>);
  if (task.responsible) meta.push(<span key="r"><bdi>{task.responsible}</bdi></span>);
  if (task.system) meta.push(<span key="s"><bdi>{task.system}</bdi></span>);
  if (task.deadline) meta.push(
    <span key="d" className={deadlinePast ? 'is-late' : ''}>due {shortDate(task.deadline)}</span>
  );
  if (task.status === 'Blocked' && task.blockingIssue) meta.push(
    <span key="x" className="meta-blocking" title={task.blockingIssue}><bdi>{task.blockingIssue}</bdi></span>
  );

  const click = () => (selecting && onToggleSelect ? onToggleSelect(task.id) : onOpen(task));

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`row ${isSelected ? 'is-selected' : ''} ${done ? 'is-done' : ''} ${updating ? 'is-updating' : ''}`}
      onClick={click}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) click(); }}
    >
      {onToggleSelect && (
        <label className="row-select" onClick={e => e.stopPropagation()} title="Select">
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)} />
        </label>
      )}

      <Picker
        className="row-status"
        value={task.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onQuickUpdate(task, { status })}
        title={`${task.status} — change status`}
      >
        <StatusMark status={task.status} />
      </Picker>

      <div className="row-main">
        <div className="row-title" dir="auto">{task.taskName || 'Untitled'}</div>
        {meta.length > 0 && <div className="row-meta">{meta}</div>}
      </div>

      <Picker
        className={`row-priority ${task.priority ? '' : 'is-empty'}`}
        value={task.priority || ''}
        options={PRIORITY_OPTIONS}
        onChange={(priority) => onQuickUpdate(task, { priority })}
        title={task.priority ? `${task.priority} priority` : 'Set priority'}
        align="right"
      >
        <PriorityMark priority={task.priority} />
      </Picker>

      <DateButton
        className={`row-date ${task.plannedDate ? '' : 'is-empty'} ${plannedPast || (overdue && !task.plannedDate) ? 'is-late' : ''} ${task.plannedDate === t ? 'is-today' : ''}`}
        value={task.plannedDate}
        onChange={(plannedDate) => onQuickUpdate(task, { plannedDate })}
        title="Planned date"
      >
        {task.plannedDate ? dayLabel(task.plannedDate) : 'Plan'}
      </DateButton>
    </div>
  );
});
