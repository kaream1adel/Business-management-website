import { IconToday, IconHome, IconList, IconSettings, IconPlus, IconRefresh, IconBriefcase, BizMark } from './Icons.jsx';
import './Sidebar.css';

function SyncLine({ syncing, syncError, lastSync, onSync }) {
  const time = lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <button className={`sync ${syncError ? 'is-error' : ''} ${syncing ? 'is-syncing' : ''}`} onClick={onSync} disabled={syncing}
      title="Refresh now. The app also refreshes every 30 seconds.">
      <IconRefresh size={13} />
      {syncError ? 'Offline, retrying' : time ? `Synced ${time}` : 'Syncing'}
    </button>
  );
}

const PAGE_NAMES = { calendar: 'Calendar', all: 'All tasks', settings: 'Settings' };

// Desktop: left column. Phone: a top bar and a bottom tab bar.
export default function Sidebar({ view, setView, bizId, onOpenBiz, lastBizId, bizList, counts, onNewTask, sync }) {
  const onBiz = (id) => view === 'biz' && bizId === id;
  const homeBadge = counts.overdue + counts.today;

  return (
    <>
      <aside className="side">
        <div className="side-brand">BizDash</div>

        <button className="btn side-new" onClick={() => onNewTask()}>
          <IconPlus size={14} /> New task <span className="kbd">N</span>
        </button>

        <nav className="side-nav" aria-label="Main">
          <button className={`side-item ${view === 'home' ? 'on' : ''}`} onClick={() => setView('home')}
            aria-current={view === 'home' ? 'page' : undefined}>
            <IconHome />
            <span className="side-label">Home</span>
            {homeBadge > 0 && <span className={`side-count num ${counts.overdue ? 'is-late' : ''}`}>{homeBadge}</span>}
          </button>
          <button className={`side-item ${view === 'calendar' ? 'on' : ''}`} onClick={() => setView('calendar')}
            aria-current={view === 'calendar' ? 'page' : undefined}>
            <IconToday />
            <span className="side-label">Calendar</span>
          </button>
        </nav>

        <div className="side-head">
          <span>Businesses</span>
          <button className="side-edit" onClick={() => setView('settings')}>Edit</button>
        </div>
        <nav className="side-nav" aria-label="Businesses">
          {bizList.map(b => (
            <button key={b.id} className={`side-item ${onBiz(b.id) ? 'on' : ''}`} onClick={() => onOpenBiz(b.id)} title={b.name}
              aria-current={onBiz(b.id) ? 'page' : undefined}>
              <span className="side-mark"><BizMark color={b.color} /></span>
              <span className="side-label" dir="auto">{b.name}</span>
              {counts.lateByBiz[b.id] > 0 && <span className="side-late num" title={`${counts.lateByBiz[b.id]} overdue`}>{counts.lateByBiz[b.id]}</span>}
              {counts.byBiz[b.id] > 0 && <span className="side-count num">{counts.byBiz[b.id]}</span>}
            </button>
          ))}
        </nav>

        <nav className="side-nav side-gap" aria-label="Everything">
          <button className={`side-item ${view === 'all' ? 'on' : ''}`} onClick={() => setView('all')}
            aria-current={view === 'all' ? 'page' : undefined}>
            <IconList />
            <span className="side-label">All tasks</span>
            {counts.all > 0 && <span className="side-count num">{counts.all}</span>}
          </button>
        </nav>

        <div className="side-foot">
          <button className={`side-item ${view === 'settings' ? 'on' : ''}`} onClick={() => setView('settings')}>
            <IconSettings /><span className="side-label">Settings</span>
          </button>
          <SyncLine {...sync} />
        </div>
      </aside>

      {/* Phone */}
      <header className="topbar">
        <select
          className="topbar-biz"
          value={view === 'biz' ? bizId : view === 'home' ? 'home' : view}
          onChange={e => e.target.value === 'home' ? setView('home') : onOpenBiz(e.target.value)}
          aria-label="Go to"
        >
          <option value="home">Home</option>
          {bizList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          {PAGE_NAMES[view] && <option value={view} hidden>{PAGE_NAMES[view]}</option>}
        </select>
        <SyncLine {...sync} />
        <button className="btn btn-ink btn-sm" onClick={() => onNewTask()}><IconPlus size={14} /> New</button>
      </header>
      <nav className="tabbar" aria-label="Main">
        <button className={view === 'home' ? 'on' : ''} onClick={() => setView('home')}>
          <span className="tab-icon">
            <IconHome size={18} />
            {homeBadge > 0 && <span className={`tab-badge num ${counts.overdue ? 'is-late' : ''}`}>{homeBadge}</span>}
          </span>
          Home
        </button>
        <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
          <span className="tab-icon"><IconToday size={18} /></span>
          Calendar
        </button>
        <button className={view === 'biz' ? 'on' : ''} onClick={() => lastBizId && onOpenBiz(lastBizId)} disabled={!lastBizId}>
          <span className="tab-icon"><IconBriefcase size={18} /></span>
          Business
        </button>
        <button className={view === 'all' ? 'on' : ''} onClick={() => setView('all')}>
          <span className="tab-icon"><IconList size={18} /></span>
          All
        </button>
        <button className={view === 'settings' ? 'on' : ''} onClick={() => setView('settings')}>
          <span className="tab-icon"><IconSettings size={18} /></span>
          Settings
        </button>
      </nav>
    </>
  );
}
