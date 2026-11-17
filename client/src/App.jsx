import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HomeView from './components/HomeView.jsx';
import BusinessView from './components/BusinessView.jsx';
import AllTasksView from './components/AllTasksView.jsx';
import CalendarView from './components/CalendarView.jsx';
import SettingsView from './components/SettingsView.jsx';
import TaskSlideOver from './components/TaskSlideOver.jsx';
import BulkBar from './components/BulkBar.jsx';
import LoginPage from './components/LoginPage.jsx';
import { ToastContainer } from './components/Toast.jsx';
import { useAuth } from './hooks/useAuth.js';
import { today, isOverdue, ConflictError, applyTheme, plural } from './utils.js';
import './App.css';

const POLL_MS = 30_000;
const THEME_KEY = 'bizdash_theme';

// Links can open a page directly: ?view=calendar, ?view=all, ?biz=<id>&tab=calendar.
// On the public demo, ?demo signs the visitor in.
const params = new URLSearchParams(window.location.search);
const START_VIEW = params.get('biz') ? 'biz' : ['calendar', 'all', 'settings'].includes(params.get('view')) ? params.get('view') : 'home';

const readTheme = () => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } };

export default function App() {
  const { token, isDemo: demo, username, login, signup, logout, clearError, loginError, loginLoading, authFetch } = useAuth();

  const [tasks, setTasks]             = useState([]);
  const [businesses, setBusinesses]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastSync, setLastSync]       = useState(null);
  const [syncError, setSyncError]     = useState(false);
  const [syncing, setSyncing]         = useState(false);
  // view: 'home' | 'calendar' | 'biz' | 'all' | 'settings'
  const [view, setViewRaw]            = useState(START_VIEW);
  const [bizId, setBizId]             = useState(params.get('biz'));
  const [bizTab, setBizTab]           = useState(params.get('tab') || 'today');
  const [quickFilter, setQuickFilter] = useState(null);
  // { mode: 'edit', task } | { mode: 'create', draft } | null
  const [editor, setEditor]           = useState(null);
  const [toasts, setToasts]           = useState([]);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [selected, setSelected]       = useState(new Set());
  const [selectMode, setSelectMode]   = useState(false);
  const [bulkBusy, setBulkBusy]       = useState(false);
  const [theme, setTheme]             = useState(readTheme);
  const searchInputRef                = useRef(null);
  // Bumped on every write, so a refresh that started before the write
  // doesn't overwrite newer local state when it lands.
  const writeSeq                      = useRef(0);
  const tasksRef                      = useRef(tasks);
  tasksRef.current = tasks;

  // ── Toasts ────────────────────────────────────────────────────────────────
  const pushToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-2), { id, message, type, duration, action }]);
  }, []);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  // A link with ?demo (e.g. from a CV) opens the demo straight away
  useEffect(() => {
    if (!token && params.has('demo')) login();
  }, [token, login]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const applyData = useCallback((data) => {
    setTasks(data.tasks || []);
    setBusinesses(data.businesses || {});
  }, []);

  const fetchTasks = useCallback(async ({ manual = false, silent = false } = {}) => {
    if (manual) setSyncing(true);
    else if (!silent) setLoading(true);
    const seq = writeSeq.current;
    try {
      const res = await authFetch('/api/tasks');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (seq !== writeSeq.current) return; // a local write happened meanwhile; the next refresh catches up
      applyData(data);
      setLastSync(new Date());
      setSyncError(false);
      setError(null);
    } catch (err) {
      if (silent) setSyncError(true);
      else if (manual) pushToast(`Couldn't refresh: ${err.message}`, 'error');
      else setError(err.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [authFetch, pushToast, applyData]);

  useEffect(() => {
    if (token) fetchTasks();
    else { setLoading(false); setTasks([]); setBusinesses({}); setEditor(null); setViewRaw('home'); }
  }, [token, fetchTasks]);

  // Stay in step with other devices: poll while visible, refresh on return
  useEffect(() => {
    if (!token) return;
    const refresh = () => { if (document.visibilityState === 'visible') fetchTasks({ silent: true }); };
    const id = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [token, fetchTasks]);

  // ── Local state helpers ───────────────────────────────────────────────────
  const putTask = useCallback((t) => {
    setTasks(prev => prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev]);
  }, []);
  const dropTask = useCallback((id) => setTasks(prev => prev.filter(x => x.id !== id)), []);
  const putBiz = useCallback((b) => setBusinesses(prev => ({ ...prev, [b.id]: b })), []);
  const latest = useCallback((id) => tasksRef.current.find(t => t.id === id), []);
  const markUpdating = useCallback((id, on) => setUpdatingIds(s => {
    const next = new Set(s);
    on ? next.add(id) : next.delete(id);
    return next;
  }), []);

  const api = useCallback(async (url, method, body) => {
    writeSeq.current++;
    const res = await authFetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.current) throw new ConflictError(data.current);
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }, [authFetch]);

  // ── Task writes ───────────────────────────────────────────────────────────
  // base = the task as it was when editing started; its version tells the
  // server which copy this change is based on.
  const updateTask = useCallback(async (base, changes, { optimistic = false } = {}) => {
    markUpdating(base.id, true);
    if (optimistic) putTask({ ...base, ...changes });
    try {
      const { task } = await api(`/api/tasks/${base.id}`, 'PATCH', { version: base.version, ...changes });
      putTask(task);
      return task;
    } catch (err) {
      if (err instanceof ConflictError) putTask(err.current);
      else if (err.status === 404) dropTask(base.id);
      else if (optimistic) putTask(base);
      throw err;
    } finally {
      markUpdating(base.id, false);
    }
  }, [api, putTask, dropTask, markUpdating]);

  const createTask = useCallback(async (fields) => {
    const { task } = await api('/api/tasks', 'POST', fields);
    putTask(task);
    return task;
  }, [api, putTask]);

  const restoreTasks = useCallback(async (ids) => {
    const results = await Promise.allSettled(ids.map(id => api(`/api/tasks/${id}/restore`, 'POST')));
    results.forEach(r => { if (r.status === 'fulfilled') putTask(r.value.task); });
    const failed = results.filter(r => r.status === 'rejected').length;
    pushToast(failed ? `Restored ${ids.length - failed}, ${failed} failed` : ids.length > 1 ? `Restored ${ids.length} tasks` : 'Restored',
      failed ? 'error' : 'success', 2400);
  }, [api, putTask, pushToast]);

  const deleteTask = useCallback(async (base) => {
    await api(`/api/tasks/${base.id}?version=${base.version}`, 'DELETE').catch(err => {
      if (err instanceof ConflictError) putTask(err.current);
      if (err.status === 404) dropTask(base.id);
      throw err;
    });
    dropTask(base.id);
    pushToast(`Deleted “${base.taskName}”`, 'info', 7000, { label: 'Undo', onClick: () => restoreTasks([base.id]) });
  }, [api, putTask, dropTask, pushToast, restoreTasks]);

  const conflictMsg = 'Changed on another device. Showing the latest now, try again.';

  // Status / priority / date changed in place from a list row
  const quickUpdate = useCallback(async (task, changes) => {
    const before = Object.fromEntries(Object.keys(changes).map(k => [k, task[k] ?? '']));
    try {
      await updateTask(task, changes, { optimistic: true });
      if (changes.status === 'Done') {
        pushToast(`Done: ${task.taskName}`, 'success', 8000, {
          label: 'Undo',
          onClick: () => { const t = latest(task.id); if (t) updateTask(t, before, { optimistic: true }).catch(() => {}); },
        });
      }
    } catch (err) {
      pushToast(err instanceof ConflictError ? conflictMsg : `Not saved: ${err.message}`, 'error', 4500);
    }
  }, [updateTask, pushToast, latest]);

  // ── Selection & bulk edits ────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => setSelected(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);
  const clearSelection = useCallback(() => { setSelected(new Set()); setSelectMode(false); }, []);

  const bulkApply = useCallback(async (changes) => {
    const list = [...selected].map(latest).filter(Boolean);
    setBulkBusy(true);
    const results = await Promise.allSettled(list.map(t => updateTask(t, changes, { optimistic: true })));
    setBulkBusy(false);
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) pushToast(`Updated ${list.length - failed} of ${list.length}. ${failed} changed elsewhere or failed, try those again.`, 'error', 6000);
    else pushToast(`Updated ${plural(list.length, 'task')}`, 'success', 2000);
    clearSelection();
  }, [selected, latest, updateTask, pushToast, clearSelection]);

  const bulkDelete = useCallback(async () => {
    const list = [...selected].map(latest).filter(Boolean);
    if (list.length > 5 && !window.confirm(`Delete ${list.length} tasks? You can undo right after.`)) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(list.map(t => api(`/api/tasks/${t.id}?version=${t.version}`, 'DELETE')));
    setBulkBusy(false);
    const gone = list.filter((_, i) => results[i].status === 'fulfilled').map(t => t.id);
    gone.forEach(dropTask);
    const failed = list.length - gone.length;
    pushToast(
      failed ? `Deleted ${gone.length}. ${failed} changed elsewhere, so they were kept.` : `Deleted ${plural(gone.length, 'task')}`,
      failed ? 'error' : 'info', 7000,
      gone.length ? { label: 'Undo', onClick: () => restoreTasks(gone) } : null,
    );
    if (failed) fetchTasks({ silent: true });
    clearSelection();
  }, [selected, latest, api, dropTask, pushToast, restoreTasks, fetchTasks, clearSelection]);

  useEffect(() => {
    document.body.classList.toggle('has-bulkbar', selected.size > 0);
  }, [selected.size]);

  // ── Business writes ───────────────────────────────────────────────────────
  const createBusiness = useCallback(async (fields) => {
    const { business } = await api('/api/businesses', 'POST', fields);
    putBiz(business);
    return business;
  }, [api, putBiz]);

  const updateBusiness = useCallback(async (base, changes) => {
    try {
      const { business } = await api(`/api/businesses/${base.id}`, 'PATCH', { version: base.version, ...changes });
      putBiz(business);
      return business;
    } catch (err) {
      if (err instanceof ConflictError) putBiz(err.current);
      throw err;
    }
  }, [api, putBiz]);

  const reorderBusinesses = useCallback(async (order) => {
    setBusinesses(prev => {
      const next = { ...prev };
      order.forEach((id, i) => { if (next[id]) next[id] = { ...next[id], sortOrder: i + 1 }; });
      return next;
    });
    try {
      applyData(await api('/api/businesses/reorder', 'POST', { order }));
    } catch (err) {
      pushToast(err.message, 'error', 5000);
      fetchTasks({ silent: true });
    }
  }, [api, applyData, pushToast, fetchTasks]);

  const deleteBusiness = useCallback(async (base) => {
    await api(`/api/businesses/${base.id}?version=${base.version}`, 'DELETE');
    setBusinesses(prev => { const next = { ...prev }; delete next[base.id]; return next; });
  }, [api]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const setView = useCallback((v) => {
    setViewRaw(v);
    setQuickFilter(null);
    clearSelection();
    window.scrollTo(0, 0);
  }, [clearSelection]);
  const openBiz = useCallback((id, tab = 'today') => {
    setBizId(id);
    setBizTab(tab);
    setView('biz');
  }, [setView]);
  const changeBizTab = useCallback((tab) => {
    setBizTab(tab);
    setQuickFilter(null);
    clearSelection();
  }, [clearSelection]);
  // Jump to a filtered list: one business's All tab, or All tasks
  const drill = useCallback((filter, inBiz) => {
    if (inBiz) openBiz(inBiz, 'all');
    else setView('all');
    setQuickFilter(filter);
  }, [openBiz, setView]);

  const changeTheme = useCallback((t) => {
    setTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
    applyTheme(t);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const bizList = useMemo(
    () => Object.values(businesses).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [businesses]
  );
  const activeBiz = useMemo(() => bizList.filter(b => !b.archivedAt), [bizList]);

  // A business page for an archived or deleted business goes back home
  useEffect(() => {
    if (view === 'biz' && !loading && !activeBiz.some(b => b.id === bizId)) setViewRaw('home');
  }, [view, bizId, activeBiz, loading]);
  const currentBiz = view === 'biz' ? businesses[bizId] : null;

  // Tasks of archived businesses are hidden everywhere
  const visibleTasks = useMemo(
    () => tasks.filter(t => businesses[t.bizId] && !businesses[t.bizId].archivedAt),
    [tasks, businesses]
  );
  const bizTasks = useMemo(
    () => bizId ? visibleTasks.filter(t => t.bizId === bizId) : [],
    [visibleTasks, bizId]
  );

  const counts = useMemo(() => {
    const t = today();
    const open = visibleTasks.filter(x => x.status !== 'Done');
    const late = open.filter(isOverdue);
    const todayN = open.filter(x => !isOverdue(x) && (x.plannedDate === t || x.deadline === t)).length;
    const byBiz = {}, lateByBiz = {};
    open.forEach(x => { byBiz[x.bizId] = (byBiz[x.bizId] || 0) + 1; });
    late.forEach(x => { lateByBiz[x.bizId] = (lateByBiz[x.bizId] || 0) + 1; });
    return { today: todayN, overdue: late.length, all: open.length, byBiz, lateByBiz };
  }, [visibleTasks]);

  const suggestions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.map(s => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      responsible: uniq(tasks.map(t => t.responsible || '')),
      system: uniq(tasks.flatMap(t => (t.system || '').split(','))),
    };
  }, [tasks]);

  // ── Editor ────────────────────────────────────────────────────────────────
  const openTask = useCallback((task) => setEditor({ mode: 'edit', task }), []);
  // forBiz: a business id; without one, the open business (else the first).
  // onDate: a planned date to start with (from the calendar).
  const openNew = useCallback((forBiz, onDate) => {
    const inBiz = view === 'biz' ? bizId : null;
    setEditor({
      mode: 'create',
      draft: {
        bizId: (typeof forBiz === 'string' && forBiz) || inBiz || activeBiz[0]?.id,
        status: 'Not Started',
        plannedDate: typeof onDate === 'string' ? onDate : view === 'biz' && bizTab === 'today' ? today() : '',
      },
    });
  }, [activeBiz, bizId, bizTab, view]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (view === 'biz') { if (bizTab !== 'all') changeBizTab('all'); }
        else if (view !== 'all') setView('all');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (!typing && !editor && e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openNew();
      } else if (e.key === 'Escape' && !editor && selected.size) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, bizTab, changeBizTab, editor, openNew, selected.size, clearSelection, setView]);

  const handleExport = useCallback(async () => {
    try {
      const res = await authFetch('/api/export');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bizdash-backup-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      pushToast('Backup downloaded', 'success', 2000);
    } catch (err) {
      pushToast(`Export failed: ${err.message}`, 'error');
    }
  }, [authFetch, pushToast]);

  const resetDemo = async () => {
    try {
      applyData(await api('/api/demo/reset', 'POST'));
      setEditor(null);
      clearSelection();
      pushToast('Sample data restored', 'success', 2200);
    } catch (err) {
      pushToast(`Reset failed: ${err.message}`, 'error');
    }
  };

  if (!token) {
    return <LoginPage onLogin={login} onSignup={signup} onClearError={clearError} error={loginError} loading={loginLoading} />;
  }

  const listProps = {
    businesses,
    showBiz: view !== 'biz',
    onOpen: openTask,
    onQuickUpdate: quickUpdate,
    selected,
    onToggleSelect: toggleSelect,
    selecting: selected.size > 0,
    updatingIds,
  };

  const allProps = {
    quickFilter,
    onClearQuick: () => setQuickFilter(null),
    searchRef: searchInputRef,
    selectMode,
    onToggleSelectMode: () => selectMode ? clearSelection() : setSelectMode(true),
    onSelectAll: (ids) => setSelected(new Set(ids)),
  };

  const editingTask = editor?.mode === 'edit' ? editor.task : null;
  const liveTask = editingTask ? (tasks.find(t => t.id === editingTask.id) || null) : null;

  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={setView}
        bizId={bizId}
        lastBizId={bizId && activeBiz.some(b => b.id === bizId) ? bizId : activeBiz[0]?.id}
        onOpenBiz={openBiz}
        bizList={activeBiz}
        counts={counts}
        onNewTask={openNew}
        sync={{ syncing, syncError, lastSync, onSync: () => fetchTasks({ manual: true }) }}
      />

      <main className="main">
        {demo && (
          <div className="demo-strip">
            <span><b>Demo</b> with made-up data. Change anything you like; it resets every night.</span>
            <span className="demo-actions">
              <button className="link" onClick={resetDemo}>Reset now</button>
              <button className="link" onClick={logout}>Leave demo</button>
            </span>
          </div>
        )}
        {loading ? (
          <p className="state">Loading…</p>
        ) : error ? (
          <div className="state">
            <h1 className="page-title">Can't reach the server</h1>
            <p className="muted">{error}</p>
            <button className="btn btn-ink" onClick={() => fetchTasks()}>Try again</button>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <HomeView tasks={visibleTasks} bizList={activeBiz} listProps={listProps}
                onOpenBiz={openBiz} onDrill={drill} onNewTask={openNew} />
            )}
            {view === 'biz' && currentBiz && (
              <BusinessView
                biz={currentBiz}
                tasks={bizTasks}
                tab={bizTab}
                onTab={changeBizTab}
                onHome={() => setView('home')}
                onNewTask={openNew}
                onDrill={(f) => drill(f, currentBiz.id)}
                listProps={listProps}
                allProps={allProps}
              />
            )}
            {view === 'calendar' && (
              <CalendarView tasks={visibleTasks} businesses={businesses} showBiz onOpen={openTask}
                onQuickUpdate={quickUpdate} onNewTask={(d) => openNew(null, d)} />
            )}
            {view === 'all' && <AllTasksView tasks={visibleTasks} listProps={listProps} {...allProps} />}
            {view === 'settings' && (
              <SettingsView
                bizList={bizList}
                tasks={tasks}
                onCreateBiz={createBusiness}
                onUpdateBiz={updateBusiness}
                onReorderBiz={reorderBusinesses}
                onDeleteBiz={deleteBusiness}
                onToast={pushToast}
                theme={theme}
                onTheme={changeTheme}
                onExport={handleExport}
                onLogout={logout}
                account={{
                  username,
                  demo,
                  onChangePassword: async (current, next) => {
                    await api('/api/account/password', 'POST', { current, next });
                    pushToast('Password changed', 'success', 2200);
                  },
                  onDeleteAccount: async (password) => {
                    await api('/api/account', 'DELETE', { password });
                    logout();
                  },
                }}
              />
            )}
          </>
        )}
      </main>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          bizList={activeBiz}
          onApply={bulkApply}
          onDelete={bulkDelete}
          onClear={clearSelection}
          busy={bulkBusy}
        />
      )}

      {editor && (
        <TaskSlideOver
          key={editor.mode === 'edit' ? editor.task.id : 'new'}
          mode={editor.mode}
          task={editor.mode === 'edit' ? editor.task : editor.draft}
          liveTask={liveTask}
          businesses={businesses}
          bizList={bizList}
          suggestions={suggestions}
          authFetch={authFetch}
          onCreate={createTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onToast={pushToast}
          onClose={() => setEditor(null)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
