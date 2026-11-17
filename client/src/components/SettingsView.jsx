import { useState, useEffect } from 'react';
import { Popover } from './Picker.jsx';
import { BizMark, IconUp, IconDown, IconArchive, IconTrash, IconDownload, IconPlus } from './Icons.jsx';
import { BIZ_COLORS, ConflictError } from '../utils.js';
import AccountSection from './AccountSection.jsx';
import './SettingsView.css';

export default function SettingsView({
  bizList, tasks, onCreateBiz, onUpdateBiz, onReorderBiz, onDeleteBiz, onToast,
  theme, onTheme, onExport, onLogout, account,
}) {
  const active = bizList.filter(b => !b.archivedAt);
  const archived = bizList.filter(b => b.archivedAt);

  const counts = (id) => {
    const mine = tasks.filter(t => t.bizId === id);
    return { open: mine.filter(t => t.status !== 'Done').length, total: mine.length };
  };

  const move = (i, dir) => {
    const ids = active.map(b => b.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorderBiz([...ids, ...archived.map(b => b.id)]);
  };

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Businesses, appearance and your data</p>
        </div>
      </header>

      <section className="section">
        <h2 className="section-title">Businesses <span className="count">{active.length}</span></h2>
        <div className="biz-list">
          {active.map((b, i) => (
            <BizRow
              key={b.id}
              biz={b}
              counts={counts(b.id)}
              onUpdate={onUpdateBiz}
              onToast={onToast}
              actions={<>
                <button className="btn btn-quiet btn-sm btn-icon" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up"><IconUp /></button>
                <button className="btn btn-quiet btn-sm btn-icon" onClick={() => move(i, 1)} disabled={i === active.length - 1} title="Move down" aria-label="Move down"><IconDown /></button>
                <button
                  className="btn btn-quiet btn-sm"
                  disabled={active.length === 1}
                  title={active.length === 1 ? 'You need at least one active business' : 'Hide this business and its tasks. Nothing is deleted.'}
                  onClick={() => run(() => onUpdateBiz(b, { archived: true }), onToast, `${b.name} archived`)}
                >
                  <IconArchive /> Archive
                </button>
              </>}
            />
          ))}
        </div>
        <AddBusiness onCreate={onCreateBiz} onToast={onToast} taken={bizList.map(b => b.color)} />
      </section>

      {archived.length > 0 && (
        <section className="section">
          <h2 className="section-title">Archived <span className="count">{archived.length}</span></h2>
          <p className="hint">Archived businesses and their tasks are hidden everywhere else. Restore one to bring it all back.</p>
          <div className="biz-list">
            {archived.map(b => {
              const c = counts(b.id);
              return (
                <BizRow
                  key={b.id}
                  biz={b}
                  counts={c}
                  onUpdate={onUpdateBiz}
                  onToast={onToast}
                  actions={<>
                    <button className="btn btn-quiet btn-sm" onClick={() => run(() => onUpdateBiz(b, { archived: false }), onToast, `${b.name} restored`)}>
                      Restore
                    </button>
                    <DeleteBiz biz={b} hasTasks={c.total > 0} onDelete={onDeleteBiz} onToast={onToast} />
                  </>}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Appearance</h2>
        <div className="setting-row">
          <span>Theme</span>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match device']].map(([v, l]) => (
              <button key={v} role="radio" aria-checked={theme === v} className={theme === v ? 'on' : ''} onClick={() => onTheme(v)}>{l}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Data</h2>
        <div className="setting-row">
          <span>
            Download a backup
            <small>Every task, deleted ones too, and the full change history, as a JSON file.</small>
          </span>
          <button className="btn btn-sm" onClick={onExport}><IconDownload /> Export</button>
        </div>
      </section>

      <AccountSection {...account} onLogout={onLogout} />
    </div>
  );
}

async function run(fn, onToast, okMsg) {
  try {
    await fn();
    if (okMsg) onToast(okMsg, 'success', 2200);
    return true;
  } catch (err) {
    onToast(err instanceof ConflictError ? 'Changed on another device. Showing the latest, try again.' : err.message, 'error', 5000);
    return false;
  }
}

function BizRow({ biz, counts, onUpdate, onToast, actions }) {
  const [name, setName] = useState(biz.name);
  useEffect(() => setName(biz.name), [biz.name]);

  const saveName = async () => {
    const v = name.trim();
    if (!v) { setName(biz.name); return; }
    if (v === biz.name) return;
    const ok = await run(() => onUpdate(biz, { name: v }), onToast, 'Renamed');
    if (!ok) setName(biz.name);
  };

  return (
    <div className={`biz-row ${biz.archivedAt ? 'is-archived' : ''}`}>
      <ColorPicker value={biz.color} onChange={(color) => run(() => onUpdate(biz, { color }), onToast)} />
      <input
        className="biz-name"
        value={name}
        maxLength={80}
        onChange={e => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(biz.name); e.currentTarget.blur(); } }}
        aria-label="Business name"
      />
      <span className="biz-counts num">{counts.open} open · {counts.total} total</span>
      <span className="biz-actions">{actions}</span>
    </div>
  );
}

function ColorPicker({ value, onChange, taken = [] }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="swatch-btn"
        onClick={() => setOpen(o => !o)}
        title="Change colour"
        aria-label="Change colour"
      >
        <BizMark color={value} size={14} />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={() => setOpen(false)} className="swatches">
          {BIZ_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`swatch ${c === value ? 'on' : ''} ${taken.includes(c) && c !== value ? 'taken' : ''}`}
              style={{ background: c }}
              onClick={() => { setOpen(false); if (c !== value) onChange(c); }}
              aria-label={c}
              title={taken.includes(c) && c !== value ? 'Already used by another business' : c}
            />
          ))}
        </Popover>
      )}
    </>
  );
}

function AddBusiness({ onCreate, onToast, taken }) {
  const firstFree = BIZ_COLORS.find(c => !taken.includes(c)) || BIZ_COLORS[0];
  const [name, setName] = useState('');
  const [color, setColor] = useState(firstFree);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (taken.includes(color)) setColor(firstFree); }, [taken.join()]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await run(() => onCreate({ name: name.trim(), color }), onToast, `${name.trim()} added`);
    setBusy(false);
    if (ok) setName('');
  };

  return (
    <form className="biz-row biz-add" onSubmit={submit}>
      <ColorPicker value={color} onChange={setColor} taken={taken} />
      <input
        className="biz-name"
        placeholder="New business name"
        value={name}
        maxLength={80}
        onChange={e => setName(e.target.value)}
      />
      <span className="biz-actions">
        <button className="btn btn-sm btn-ink" disabled={busy || !name.trim()}><IconPlus /> Add business</button>
      </span>
    </form>
  );
}

function DeleteBiz({ biz, hasTasks, onDelete, onToast }) {
  const [confirm, setConfirm] = useState(false);
  if (hasTasks) {
    return (
      <button className="btn btn-quiet btn-sm" disabled title="It still has tasks. Keep it archived, or move its tasks to another business first.">
        <IconTrash /> Delete
      </button>
    );
  }
  return confirm ? (
    <span className="confirm">
      Delete for good?
      <button className="btn btn-sm btn-accent" onClick={() => run(() => onDelete(biz), onToast, `${biz.name} deleted`)}>Delete</button>
      <button className="btn btn-sm btn-quiet" onClick={() => setConfirm(false)}>Keep</button>
    </span>
  ) : (
    <button className="btn btn-danger-text btn-sm" onClick={() => setConfirm(true)}><IconTrash /> Delete</button>
  );
}
