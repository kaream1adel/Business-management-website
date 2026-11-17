import { useState } from 'react';
import './LoginPage.css';

const TABS = [['signin', 'Sign in'], ['signup', 'Create account'], ['demo', 'See demo']];

// Sign in to your account, create one, or open the demo (sample data, no account).
export default function LoginPage({ onLogin, onSignup, onClearError, error, loading }) {
  const [tab, setTab] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState('');

  const pick = (t) => { setTab(t); setLocalError(''); onClearError(); };

  const submit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (!username || !password) return;
    if (tab === 'signin') return onLogin(username.trim(), password);
    if (password.length < 8) return setLocalError('Password: at least 8 characters.');
    if (password !== confirm) return setLocalError('The two passwords are different.');
    onSignup(username.trim(), password);
  };

  const shownError = localError || error;
  const signingUp = tab === 'signup';

  return (
    <main className="login">
      <div className="login-form">
        <h1 className="login-title">BizDash</h1>
        <p className="login-sub">A task dashboard for running several businesses.</p>

        <div className="login-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => pick(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab !== 'demo' ? (
          <form className="login-panel" onSubmit={submit}>
            {signingUp && <p className="login-demo-text">Your own private space for your businesses and tasks. Only you can see it.</p>}
            <label className="login-field">
              <span>Username</span>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)}
                autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} />
              {signingUp && <small className="login-hint">3–32 letters or numbers; dots, dashes and underscores are fine.</small>}
            </label>

            <label className="login-field">
              <span>Password</span>
              <span className="login-pass">
                <input className="input" type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete={signingUp ? 'new-password' : 'current-password'} />
                <button type="button" className="login-show" onClick={() => setShowPass(v => !v)}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </span>
              {signingUp && <small className="login-hint">At least 8 characters.</small>}
            </label>

            {signingUp && (
              <label className="login-field">
                <span>Password again</span>
                <input className="input" type={showPass ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              </label>
            )}

            {shownError && <p className="login-error" role="alert">{shownError}</p>}

            <button type="submit" className="btn btn-ink login-btn"
              disabled={loading || !username || !password || (signingUp && !confirm)}>
              {loading ? (signingUp ? 'Creating…' : 'Signing in…') : (signingUp ? 'Create account' : 'Sign in')}
            </button>
          </form>
        ) : (
          <div className="login-panel">
            <p className="login-demo-text">
              Try the full app with three made-up businesses and their tasks. No account needed.
              Change anything you like; the sample data resets every night.
            </p>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="button" className="btn btn-ink login-btn" disabled={loading} onClick={() => onLogin()}>
              {loading ? 'Opening…' : 'Open the demo'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
