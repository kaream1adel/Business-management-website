import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck } from './Icons.jsx';

// A small menu anchored to its trigger. Positioned with `fixed` so it is
// never clipped by scrolling containers; flips above when there's no room.
export function Popover({ anchor, onClose, children, align = 'left', className = '' }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = a.bottom + 4;
    if (top + m.height > vh - 8 && a.top - m.height - 4 > 8) top = a.top - m.height - 4;
    let left = align === 'right' ? a.right - m.width : a.left;
    left = Math.max(8, Math.min(left, vw - m.width - 8));
    setStyle({ top, left });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onScroll = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} className={`popover ${className}`} style={style} role="menu" onClick={e => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}

// Button that opens a list of options. options: [{ value, label, icon? }]
export function Picker({ value, options, onChange, children, className = '', title, align, disabled }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        title={title}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        {children}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} align={align}>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className={`menu-item ${o.value === value ? 'on' : ''}`}
              onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}
            >
              {o.icon && <span className="menu-icon">{o.icon}</span>}
              <span className="menu-label">{o.label}</span>
              {o.value === value && <IconCheck size={14} className="menu-check" />}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}

// Opens the browser's native date picker from any trigger.
export function DateButton({ value, onChange, className = '', children, title }) {
  const input = useRef(null);
  const open = (e) => {
    e.stopPropagation();
    const el = input.current;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  return (
    <span className="date-btn-wrap" onClick={e => e.stopPropagation()}>
      <button type="button" className={className} onClick={open} title={title}>{children}</button>
      <input
        ref={input}
        type="date"
        className="date-shadow"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </span>
  );
}
