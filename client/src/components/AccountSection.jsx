import { useState } from 'react';

// Settings → Account: who is signed in, change password, sign out, delete account.
export default function AccountSection({ username, demo, onChangePassword, onDeleteAccount, onLogout }) {
  const [mode, setMode] = useState(null); // 'password' | 'delete' | null
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setMode(null); setCurrent(''); setNext(''); setError(''); };

  const savePassword = async (e) => {
    e.preventDefault();
    if (next.length < 8) return setError('New password: at least 8 characters.');
    setBusy(true); setError('');
    try { await onChangePassword(current, next); close(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const removeAccount = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onDeleteAccount(current); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <section className="section">
      <h2 className="section-title">Account</h2>
      <div className="setting-row">
        <span>
          {demo ? 'You are looking at the demo' : <>Signed in as <b>{username}</b></>}
          <small>{demo ? 'Sample data shared by everyone who opens the demo.' : 'Your businesses and tasks are only visible to you.'}</small>
        </span>
        <button className="btn btn-sm" onClick={onLogout}>{demo ? 'Leave demo' : 'Sign out'}</button>
      </div>

      {!demo && (
        <>
          <div className="setting-row">
            <span>Password</span>
            {mode !== 'password' && <button className="btn btn-sm" onClick={() => { close(); setMode('password'); }}>Change password</button>}
          </div>
          {mode === 'password' && (
            <form className="account-form" onSubmit={savePassword}>
              <input className="input" type="password" placeholder="Current password" value={current}
                onChange={e => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
              <input className="input" type="password" placeholder="New password (8+ characters)" value={next}
                onChange={e => setNext(e.target.value)} autoComplete="new-password" />
              {error && <p className="account-error">{error}</p>}
              <div className="account-actions">
                <button className="btn btn-ink btn-sm" disabled={busy || !current || !next}>Save password</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={close}>Cancel</button>
              </div>
            </form>
          )}

          <div className="setting-row">
            <span>
              Delete account
              <small>Removes your account and all its businesses and tasks for good.</small>
            </span>
            {mode !== 'delete' && <button className="btn btn-sm btn-danger-text" onClick={() => { close(); setMode('delete'); }}>Delete…</button>}
          </div>
          {mode === 'delete' && (
            <form className="account-form" onSubmit={removeAccount}>
              <p className="account-warn">This can't be undone. Download a backup first if you might want your data. Type your password to confirm.</p>
              <input className="input" type="password" placeholder="Password" value={current}
                onChange={e => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
              {error && <p className="account-error">{error}</p>}
              <div className="account-actions">
                <button className="btn btn-sm btn-accent" disabled={busy || !current}>Delete my account</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={close}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
