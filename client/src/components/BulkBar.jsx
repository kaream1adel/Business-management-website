import { Picker, DateButton } from './Picker.jsx';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from './TaskList.jsx';
import { BizMark, IconX, IconTrash } from './Icons.jsx';

// Shown while tasks are selected: change them all at once.
export default function BulkBar({ count, bizList, onApply, onDelete, onClear, busy }) {
  const bizOptions = bizList.map(b => ({ value: b.id, label: b.name, icon: <BizMark color={b.color} /> }));
  return (
    <div className="bulkbar" role="toolbar" aria-label="Change selected tasks">
      <span className="bulk-count"><span className="num">{count}</span> selected</span>
      <span className="bulk-sep" />
      <Picker className="bulk-btn" options={STATUS_OPTIONS} value={null} onChange={status => onApply({ status })} disabled={busy}>Status</Picker>
      <Picker className="bulk-btn" options={PRIORITY_OPTIONS} value={null} onChange={priority => onApply({ priority })} disabled={busy}>Priority</Picker>
      <DateButton className="bulk-btn" value="" onChange={plannedDate => onApply({ plannedDate })}>Plan date</DateButton>
      {bizOptions.length > 1 && (
        <Picker className="bulk-btn" options={bizOptions} value={null} onChange={bizId => onApply({ bizId })} disabled={busy}>Move to</Picker>
      )}
      <button className="bulk-btn is-danger" onClick={onDelete} disabled={busy}><IconTrash size={14} /> Delete</button>
      <span className="bulk-sep" />
      <button className="bulk-btn" onClick={onClear} aria-label="Clear selection" title="Clear selection (Esc)"><IconX size={14} /></button>
    </div>
  );
}
