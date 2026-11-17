// One small line-icon set, drawn on a 16px grid at 1.5 stroke.

const Svg = ({ size = 16, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconToday = (p) => (
  <Svg {...p}><rect x="2.5" y="3" width="11" height="10.5" rx="1.5" /><path d="M2.5 6.5h11M5.5 1.75v2.5M10.5 1.75v2.5" /><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" /></Svg>
);
export const IconUpcoming = (p) => (
  <Svg {...p}><path d="M2.5 4.5h11M2.5 8h7M2.5 11.5h4.5" /><path d="M11 10.5l2 1.5-2 1.5" /></Svg>
);
export const IconList = (p) => (
  <Svg {...p}><path d="M5.5 4h8M5.5 8h8M5.5 12h8" /><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01" strokeWidth="2" /></Svg>
);
export const IconDone = (p) => (
  <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M5.6 8.2l1.7 1.7 3.2-3.4" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" /><circle cx="10" cy="4.5" r="1.5" /><circle cx="6" cy="11.5" r="1.5" /></Svg>
);
export const IconHome = (p) => (
  <Svg {...p}><path d="M2.5 7.2L8 2.75l5.5 4.45" /><path d="M4 6v7.25h8V6" /><path d="M6.75 13.25V9.75h2.5v3.5" /></Svg>
);
export const IconBriefcase = (p) => (
  <Svg {...p}><rect x="2" y="4.75" width="12" height="8.5" rx="1.5" /><path d="M5.75 4.75V3.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v1.25M2 8.5h12" /></Svg>
);
export const IconArrowRight = (p) => <Svg {...p}><path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" /></Svg>;
export const IconPlus =(p) => <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="M10.2 10.2L13.5 13.5" /></Svg>;
export const IconRefresh = (p) => <Svg {...p}><path d="M13 8a5 5 0 1 1-1.5-3.55" /><path d="M13 2.5v3h-3" /></Svg>;
export const IconX = (p) => <Svg {...p}><path d="M4 4l8 8M12 4l-8 8" /></Svg>;
export const IconUp = (p) => <Svg {...p}><path d="M4 10l4-4 4 4" /></Svg>;
export const IconDown = (p) => <Svg {...p}><path d="M4 6l4 4 4-4" /></Svg>;
export const IconArchive = (p) => <Svg {...p}><rect x="2" y="3" width="12" height="3" rx="1" /><path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 8.5h3" /></Svg>;
export const IconTrash = (p) => <Svg {...p}><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.6a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.6" /></Svg>;
export const IconDownload = (p) => <Svg {...p}><path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" /></Svg>;
export const IconExternal = (p) => <Svg {...p}><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" /></Svg>;
export const IconMore = (p) => <Svg {...p}><path d="M3.5 8h.01M8 8h.01M12.5 8h.01" strokeWidth="2.2" /></Svg>;
export const IconCheck = (p) => <Svg {...p}><path d="M3.5 8.5l3 3 6-7" /></Svg>;

// Task status as a shape, not a coloured pill
export function StatusMark({ status, size = 15 }) {
  const c = 7.5, r = 6;
  return (
    <svg className={`smark smark-${(status || 'Not Started').replace(/\s/g, '').toLowerCase()}`}
      width={size} height={size} viewBox="0 0 15 15" aria-hidden="true">
      {status === 'Done' ? (
        <>
          <circle cx={c} cy={c} r={r + 0.75} fill="currentColor" />
          <path d="M4.8 7.7l1.8 1.8 3.6-3.8" fill="none" stroke="var(--paper)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : status === 'In Progress' ? (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d={`M${c} ${c - r + 2.2} A ${r - 2.2} ${r - 2.2} 0 0 1 ${c} ${c + r - 2.2} Z`} fill="currentColor" />
        </>
      ) : status === 'Blocked' ? (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.4 11.6L11.6 3.4" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : (
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 1.9" />
      )}
    </svg>
  );
}

export function BizMark({ color, size = 8 }) {
  return <span className="bizmark" style={{ background: color, width: size, height: size }} aria-hidden="true" />;
}
