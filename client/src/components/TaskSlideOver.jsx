import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { isOverdue, ConflictError, STATUSES, PRIORITIES, shortDate } from '../utils.js';
import { StatusMark, BizMark, IconX, IconPlus, IconExternal, IconTrash } from './Icons.jsx';
import './TaskSlideOver.css';

const FIELDS = ['bizId', 'taskName', 'status', 'priority', 'responsible', 'system',
  'plannedDate', 'deadline', 'notes', 'blockingIssue'];

const COLUMN_LABELS = {
  biz_id: 'Business', task_name: 'Name', status: 'Status', priority: 'Priority',
  responsible: 'Responsible', system: 'System', planned_date: 'Planned', deadline: 'Deadline',
  notes: 'Notes', blocking_issue: 'Blocking issue', extra: 'Other fields',
};

const norm = (v) => (v ?? '').toString().trim();

const toForm = (t) => ({
  ...Object.fromEntries(FIELDS.map(k => [k, t?.[k] ?? ''])),
  extra: Object.entries(t?.extra || {}).map(([k, v]) => ({ k, v: String(v) })),
});

// Extra fields as a clean object (blank rows dropped), or null when empty
function extraObj(pairs) {
  const out = {};
  for (const { k, v } of pairs) if (norm(k) && norm(v)) out[norm(k)] = norm(v);
  return Object.keys(out).length ? out : null;
}

// Only the fields the user changed compared with the copy the form was loaded from
function diff(form, origin) {
  const out = {};
  for (const k of FIELDS) if (norm(form[k]) !== norm(origin[k])) out[k] = form[k];
  const a = extraObj(form.extra), b = extraObj(origin.extra);
  if (JSON.stringify(a) !== JSON.stringify(b)) out.extra = a;
  return out;
}

export default function TaskSlideOver({
  mode, task, liveTask, businesses, bizList, suggestions, authFetch,
  onCreate, onUpdate, onDelete, onToast, onClose,
}) {
  const isNew = mode === 'create';
  // origin = the copy the form was loaded from; version = what we tell the server we're editing
  const [origin, setOrigin]   = useState(() => toForm(task));
  const [base, setBase]       = useState(task);
  const [version, setVersion] = useState(task.version);
  const [form, setForm]       = useState(() => toForm(task));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [conflict, setConflict] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState(null);
  const nameRef = useRef(null);

  const changes = useMemo(() => diff(form, origin), [form, origin]);
  const dirty = Object.keys(changes).length > 0;

  const remoteDeleted = !isNew && liveTask === null;
  const remoteChanged = !isNew && liveTask && liveTask.version !== version;

  const loadLatest = useCallback((latest) => {
    setOrigin(toForm(latest));
    setBase(latest);
    setVersion(latest.version);
    setForm(toForm(latest));
    setConflict(null);
    setError('');
  }, []);

  // Another device changed this task while it's open: take it silently if
  // nothing has been typed yet; otherwise show a notice.
  useEffect(() => {
    if (remoteChanged && !dirty && !saving) loadLatest(liveTask);
  }, [remoteChanged, dirty, saving, liveTask, loadLatest]);

  useEffect(() => { if (isNew) nameRef.current?.focus(); }, [isNew]);

  // Grow the title box to fit long names
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [form.taskName]);

  const set = (k) => (e) => { const v = e.target.value; setForm(f => ({ ...f, [k]: v })); setError(''); };

  // "ahmed" -> "Ahmed" if that spelling already exists, so names stay consistent
  const snap = (k, list) => () => {
    const v = norm(form[k]);
    const hit = list.find(s => s.toLowerCase() === v.toLowerCase());
    if (hit && hit !== form[k]) setForm(f => ({ ...f, [k]: hit }));
  };

  const setExtra = (i, key) => (e) => {
    const v = e.target.value;
    setForm(f => ({ ...f, extra: f.extra.map((p, j) => j === i ? { ...p, [key]: v } : p) }));
  };
  const addExtra = () => setForm(f => ({ ...f, extra: [...f.extra, { k: '', v: '' }] }));
  const removeExtra = (i) => setForm(f => ({ ...f, extra: f.extra.filter((_, j) => j !== i) }));

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  }, [dirty, onClose]);

  const save = useCallback(async (overrideVersion) => {
    if (!norm(form.taskName)) { setError('Give the task a name.'); nameRef.current?.focus(); return; }
    const labels = form.extra.filter(p => norm(p.k) && norm(p.v)).map(p => norm(p.k).toLowerCase());
    if (new Set(labels).size !== labels.length) { setError('Two of the other fields have the same label.'); return; }
    if (!isNew && !dirty) { onClose(); return; }
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await onCreate({ ...Object.fromEntries(FIELDS.map(k => [k, form[k]])), extra: extraObj(form.extra) });
        onToast('Task added', 'success', 2000);
      } else {
        // Send only what was touched, so edits to other fields made on
        // another device are kept.
        await onUpdate({ ...base, version: overrideVersion ?? version }, changes);
        onToast('Saved', 'success', 1600);
      }
      onClose();
    } catch (err) {
      if (err instanceof ConflictError) setConflict(err.current);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, isNew, dirty, base, version, changes, onCreate, onUpdate, onToast, onClose]);

  const doDelete = async () => {
    setSaving(true);
    try {
      await onDelete({ ...base, version });
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      if (err instanceof ConflictError) setConflict(err.current);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    setHistory('loading');
    try {
      const res = await authFetch(`/api/tasks/${task.id}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistory(data.history);
    } catch (err) {
      setHistory(null);
      setError(`Couldn't load the history: ${err.message}`);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); requestClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [requestClose, save]);

  const business = businesses[form.bizId];
  const overdue = !isNew && isOverdue(form);
  // Archived businesses only appear in the list if this task already belongs to one
  const bizChoices = bizList.filter(b => !b.archivedAt || b.id === form.bizId);

  return (
    <>
      <div className="panel-backdrop" onClick={requestClose} />
      <div className="panel" role="dialog" aria-modal="true" aria-label={isNew ? 'New task' : 'Edit task'}>
        <div className="panel-top">
          <span className="panel-crumb">
            {business && <BizMark color={business.color} />}
            {business?.name || 'No business'}
            {isNew && <span className="muted"> · new task</span>}
            {dirty && !isNew && <span className="muted"> · unsaved</span>}
          </span>
          <button className="btn btn-quiet btn-sm btn-icon" onClick={requestClose} aria-label="Close"><IconX /></button>
        </div>

        {remoteDeleted && (
          <div className="notice">This task was deleted on another device. Saving won't work.</div>
        )}
        {conflict && (
          <div className="notice">
            <strong>Someone changed this task on another device</strong>, so your edits weren't saved yet.
            <div className="notice-actions">
              <button className="btn btn-sm" onClick={() => loadLatest(conflict)}>Load theirs, drop mine</button>
              <button className="btn btn-sm btn-ink" onClick={() => { setVersion(conflict.version); setBase(conflict); setConflict(null); save(conflict.version); }}>
                Save mine on top
              </button>
            </div>
          </div>
        )}
        {!conflict && remoteChanged && dirty && (
          <div className="notice is-info">
            This task was updated on another device while you were editing.
            <div className="notice-actions">
              <button className="btn btn-sm" onClick={() => loadLatest(liveTask)}>Load theirs, drop mine</button>
            </div>
          </div>
        )}

        <div className="panel-body">
          <textarea
            ref={nameRef}
            className="panel-title"
            dir="auto"
            value={form.taskName}
            onChange={set('taskName')}
            placeholder="What needs doing?"
            maxLength={300}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
          />

          <dl className="props">
            <Prop label="Status">
              <span className="prop-with-mark">
                <StatusMark status={form.status} />
                <select value={form.status} onChange={set('status')}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </span>
            </Prop>
            <Prop label="Priority">
              <select value={form.priority} onChange={set('priority')}>
                <option value="">None</option>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Prop>
            <Prop label="Business">
              <select value={form.bizId} onChange={set('bizId')}>
                {bizChoices.map(b => <option key={b.id} value={b.id}>{b.name}{b.archivedAt ? ' (archived)' : ''}</option>)}
              </select>
            </Prop>
            <Prop label="Responsible">
              <input value={form.responsible} onChange={set('responsible')} onBlur={snap('responsible', suggestions.responsible)}
                list="dl-responsible" maxLength={200} placeholder="Nobody yet" />
            </Prop>
            <Prop label="System">
              <input value={form.system} onChange={set('system')} list="dl-system" maxLength={200} placeholder="e.g. Mixer, Chilling" />
            </Prop>
            <Prop label="Planned">
              <input type="date" value={form.plannedDate} onChange={set('plannedDate')} className={!form.plannedDate ? 'is-empty' : ''} />
            </Prop>
            <Prop label="Deadline">
              <input type="date" value={form.deadline} onChange={set('deadline')}
                className={`${!form.deadline ? 'is-empty' : ''} ${overdue && form.deadline ? 'is-late' : ''}`} />
            </Prop>
          </dl>

          <datalist id="dl-responsible">{suggestions.responsible.map(s => <option key={s} value={s} />)}</datalist>
          <datalist id="dl-system">{suggestions.system.map(s => <option key={s} value={s} />)}</datalist>

          <label className="block">
            <span className="block-label">Notes</span>
            <textarea dir="auto" rows={5} value={form.notes} onChange={set('notes')} maxLength={10000} placeholder="Details, measurements, who to call…" />
          </label>

          {(form.status === 'Blocked' || form.blockingIssue) && (
            <label className="block">
              <span className="block-label">What's blocking it</span>
              <textarea dir="auto" rows={2} value={form.blockingIssue} onChange={set('blockingIssue')} maxLength={10000}
                placeholder="Waiting for parts, approval…" />
            </label>
          )}

          <div className="block">
            <span className="block-label">Other fields</span>
            {form.extra.length > 0 && (
              <div className="extra">
                {form.extra.map((p, i) => (
                  <div key={i} className="extra-row">
                    <input className="extra-k" value={p.k} onChange={setExtra(i, 'k')} placeholder="Label" maxLength={60} aria-label="Field label" />
                    <input className="extra-v" value={p.v} onChange={setExtra(i, 'v')} placeholder="Value" maxLength={2000} aria-label={`${p.k || 'Field'} value`} />
                    {/^https?:\/\//.test(p.v) && (
                      <a className="btn btn-quiet btn-sm btn-icon" href={p.v} target="_blank" rel="noreferrer" title="Open link"><IconExternal /></a>
                    )}
                    <button type="button" className="btn btn-quiet btn-sm btn-icon" onClick={() => removeExtra(i)} title="Remove field" aria-label="Remove field">
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-quiet btn-sm add-field" onClick={addExtra}><IconPlus size={13} /> Add a field</button>
          </div>

          {!isNew && (
            <div className="block history">
              {history === null && <button className="link" onClick={loadHistory}>Show change history</button>}
              {history === 'loading' && <span className="muted">Loading…</span>}
              {Array.isArray(history) && (
                <>
                  <span className="block-label">History</span>
                  <ul className="history-list">
                    {history.map((h, i) => <HistoryItem key={i} entry={h} businesses={businesses} />)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="panel-foot">
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="panel-foot-row">
            {!isNew && (confirmDelete ? (
              <span className="confirm">
                Delete this task?
                <button className="btn btn-sm btn-accent" onClick={doDelete} disabled={saving}>Delete</button>
                <button className="btn btn-sm btn-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            ) : (
              <button className="btn btn-danger-text btn-sm" onClick={() => setConfirmDelete(true)} disabled={saving}><IconTrash size={14} /> Delete</button>
            ))}
            <span className="spacer" />
            <span className="save-hint muted">Ctrl+Enter</span>
            <button className="btn btn-quiet" onClick={requestClose} disabled={saving}>Cancel</button>
            <button className="btn btn-ink" onClick={() => save()} disabled={saving || (!isNew && !dirty)}>
              {saving ? 'Saving…' : isNew ? 'Add task' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Prop({ label, children }) {
  return (
    <div className="prop">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function HistoryItem({ entry, businesses }) {
  const when = new Date(entry.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const label = { import: 'Imported from Notion', create: 'Created', update: 'Changed', delete: 'Deleted', restore: 'Restored' }[entry.action];
  const show = (col, v) => {
    if (v === null || v === '') return '—';
    if (col === 'biz_id') return businesses[v]?.name || v;
    if (col === 'planned_date' || col === 'deadline') return shortDate(v);
    if (col === 'extra') return 'edited';
    const s = String(v);
    return s.length > 40 ? s.slice(0, 40) + '…' : s;
  };
  const changes = entry.action === 'update' && entry.changes ? Object.entries(entry.changes) : [];
  return (
    <li>
      <div className="history-head"><span>{label}</span><span className="muted num">{when}</span></div>
      {changes.map(([col, [from, to]]) => (
        <div key={col} className="history-change">
          {COLUMN_LABELS[col] || col}{col === 'extra' ? ' edited' : <>: <s>{show(col, from)}</s> → {show(col, to)}</>}
        </div>
      ))}
    </li>
  );
}
