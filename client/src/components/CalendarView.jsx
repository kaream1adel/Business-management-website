import { useMemo, useState } from 'react';
import { Picker, DateButton } from './Picker.jsx';
import { STATUS_OPTIONS, PriorityMark } from './TaskList.jsx';
import { StatusMark, BizMark, IconPlus, IconUp, IconDown } from './Icons.jsx';
import { today, localDateStr, isOverdue, shortDate, PRIORITY_RANK } from '../utils.js';
import './Calendar.css';

const parse = (s) => new Date(s + 'T00:00:00');
const shift = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return localDateStr(d); };
// Weeks start on Saturday
const weekOf = (s) => shift(s, -((parse(s).getDay() + 1) % 7));
const dayOf = (t) => t.plannedDate || t.deadline || '';

const order = (a, b) =>
  (a.status === 'Done') - (b.status === 'Done') ||
  PRIORITY_RANK[a.priority || ''] - PRIORITY_RANK[b.priority || ''] ||
  (a.taskName || '').localeCompare(b.taskName || '');

// A week, Saturday to Friday. A task sits on its planned date (or its
// deadline when it has no plan). Drag a card to another day to re-plan it.
export default function CalendarView({ tasks, businesses, showBiz, onOpen, onQuickUpdate, onNewTask, embedded = false }) {
  const t = today();
  const [start, setStart] = useState(() => weekOf(t));
  const [tray, setTray] = useState(null); // 'late' | 'nodate' | null
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shift(start, i)), [start]);
  const end = days[6];

  const byDay = useMemo(() => {
    const map = Object.fromEntries(days.map(d => [d, []]));
    tasks.forEach(x => { const d = dayOf(x); if (map[d]) map[d].push(x); });
    Object.values(map).forEach(list => list.sort(order));
    return map;
  }, [tasks, days]);

  // Late tasks dated before this week, and open tasks with no date at all
  const late = useMemo(() => tasks.filter(x => isOverdue(x) && dayOf(x) < start).sort((a, b) => dayOf(a).localeCompare(dayOf(b))), [tasks, start]);
  const nodate = useMemo(() => tasks.filter(x => x.status !== 'Done' && !dayOf(x)).sort(order), [tasks]);

  const weekTotal = days.reduce((n, d) => n + byDay[d].filter(x => x.status !== 'Done').length, 0);
  const isThisWeek = t >= start && t <= end;

  const find = (id) => tasks.find(x => x.id === id);
  const moveTo = (id, day) => {
    const task = find(id);
    if (task && task.plannedDate !== day) onQuickUpdate(task, { plannedDate: day });
  };

  const dragProps = (task) => ({
    draggable: task.status !== 'Done',
    onDragStart: (e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; setDragId(task.id); },
    onDragEnd: () => { setDragId(null); setOverDay(null); },
  });

  const range = parse(start).getMonth() === parse(end).getMonth()
    ? `${parse(start).getDate()}–${parse(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `${shortDate(start)} – ${parse(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const cardProps = { businesses, showBiz, onOpen, onQuickUpdate, dragProps, dragId };

  return (
    <div className={embedded ? 'tab-body cal' : 'page page-wide cal'}>
      <header className={embedded ? 'tab-head cal-head' : 'page-head cal-head'}>
        <div>
          {!embedded && <h1 className="page-title">Calendar</h1>}
          <p className="cal-range">{range} <span className="muted">· {weekTotal} open</span></p>
        </div>
        <div className="cal-nav">
          <button className="btn btn-sm" onClick={() => setStart(shift(start, -7))} aria-label="Previous week">‹</button>
          <button className={`btn btn-sm ${isThisWeek ? 'btn-ink' : ''}`} onClick={() => setStart(weekOf(t))}>This week</button>
          <button className="btn btn-sm" onClick={() => setStart(shift(start, 7))} aria-label="Next week">›</button>
          <DateButton className="btn btn-sm btn-quiet" value={start} onChange={(d) => d && setStart(weekOf(d))} title="Jump to a date">
            Go to date
          </DateButton>
        </div>
      </header>

      {(late.length > 0 || nodate.length > 0) && (
        <div className="cal-trays">
          {late.length > 0 && (
            <button className={`cal-tray-btn is-late ${tray === 'late' ? 'on' : ''}`} onClick={() => setTray(tray === 'late' ? null : 'late')}>
              {late.length} overdue from earlier {tray === 'late' ? <IconUp size={12} /> : <IconDown size={12} />}
            </button>
          )}
          {nodate.length > 0 && (
            <button className={`cal-tray-btn ${tray === 'nodate' ? 'on' : ''}`} onClick={() => setTray(tray === 'nodate' ? null : 'nodate')}>
              {nodate.length} with no date {tray === 'nodate' ? <IconUp size={12} /> : <IconDown size={12} />}
            </button>
          )}
          {tray && <span className="cal-tray-hint">Drag a card onto a day to plan it.</span>}
        </div>
      )}
      {tray && (
        <div className="cal-tray">
          {(tray === 'late' ? late : nodate).map(x => <Card key={x.id} task={x} {...cardProps} showDate={tray === 'late'} />)}
        </div>
      )}

      <div className="cal-week">
        {days.map(d => {
          const list = byDay[d];
          const past = d < t;
          const date = parse(d);
          return (
            <section
              key={d}
              className={`cal-day ${d === t ? 'is-today' : ''} ${past ? 'is-past' : ''} ${overDay === d ? 'is-over' : ''}`}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverDay(d); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverDay(o => o === d ? null : o); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOverDay(null); setDragId(null); if (id) moveTo(id, d); }}
            >
              <header className="cal-day-head">
                <span className="cal-dow">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="cal-date num">{date.getDate()}</span>
                {list.length > 0 && <span className="cal-count num">{list.filter(x => x.status !== 'Done').length || ''}</span>}
                <button className="cal-add" onClick={() => onNewTask(d)} title={`New task on ${shortDate(d)}`}><IconPlus size={13} /></button>
              </header>
              <div className="cal-cards">
                {list.map(x => <Card key={x.id} task={x} {...cardProps} />)}
                {list.length === 0 && <p className="cal-empty">—</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Card({ task, businesses, showBiz, onOpen, onQuickUpdate, dragProps, dragId, showDate }) {
  const biz = businesses[task.bizId];
  const done = task.status === 'Done';
  const deadlineOnly = !task.plannedDate && task.deadline;
  const late = isOverdue(task);
  return (
    <div
      className={`cal-card ${done ? 'is-done' : ''} ${dragId === task.id ? 'is-dragging' : ''} ${late ? 'is-late' : ''}`}
      style={{ '--biz': biz?.color }}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(task); }}
      {...dragProps(task)}
    >
      <div className="cal-card-top">
        <Picker className="cal-status" value={task.status} options={STATUS_OPTIONS}
          onChange={(status) => onQuickUpdate(task, { status })} title={`${task.status} — change status`}>
          <StatusMark status={task.status} size={13} />
        </Picker>
        <span className="cal-title" dir="auto">{task.taskName || 'Untitled'}</span>
      </div>
      <div className="cal-meta">
        {showBiz && biz && <span className="cal-biz"><BizMark color={biz.color} size={6} /><bdi>{biz.name}</bdi></span>}
        {task.responsible && <span><bdi>{task.responsible}</bdi></span>}
        {deadlineOnly && <span className="cal-due">deadline</span>}
        {showDate && <span className="is-late">{shortDate(task.plannedDate || task.deadline)}</span>}
        {task.priority === 'High' && <PriorityMark priority="High" />}
        <DateButton className="cal-move" value={task.plannedDate} onChange={(plannedDate) => onQuickUpdate(task, { plannedDate })} title="Change planned date">
          Move
        </DateButton>
      </div>
    </div>
  );
}
