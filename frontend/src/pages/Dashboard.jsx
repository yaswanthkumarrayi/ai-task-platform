import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Plus, LogOut, RefreshCw, Play, Trash2,
  ChevronRight, Clock, BarChart3, Loader2, X, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #f5f6fa;
    --bg-2:        #ffffff;
    --surface:     #ffffff;
    --surface-2:   #f9fafb;
    --border:      #e5e7eb;
    --border-2:    #d1d5db;
    --accent:      #2563eb;
    --accent-light:#eff6ff;
    --success:     #16a34a;
    --success-bg:  #f0fdf4;
    --success-bd:  #bbf7d0;
    --warn:        #d97706;
    --warn-bg:     #fffbeb;
    --warn-bd:     #fde68a;
    --danger:      #dc2626;
    --danger-bg:   #fef2f2;
    --danger-bd:   #fecaca;
    --running:     #0369a1;
    --running-bg:  #f0f9ff;
    --running-bd:  #bae6fd;
    --text:        #111827;
    --text-2:      #6b7280;
    --text-3:      #9ca3af;
    --radius:      8px;
    --radius-lg:   12px;
    --font:        'Inter', sans-serif;
    --mono:        'JetBrains Mono', monospace;
    --nav-h:       60px;
    --transition:  0.15s ease;
  }

  html { height: 100%; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    min-height: 100%;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Navbar ── */
  .nav {
    position: sticky; top: 0; z-index: 100;
    height: var(--nav-h);
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
    padding: 0 24px;
    gap: 12px;
  }
  .nav-brand {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex: 1;
  }
  .nav-logo {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--accent);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .nav-title {
    font-size: 15px; font-weight: 600; color: var(--text);
    letter-spacing: -0.2px;
  }
  .nav-right { display: flex; align-items: center; gap: 8px; }
  .nav-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
  .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--accent-light);
    border: 1px solid #bfdbfe;
    display: grid; place-items: center;
    font-size: 12px; font-weight: 600; color: var(--accent);
    flex-shrink: 0;
  }
  .user-name { font-size: 13px; font-weight: 500; color: var(--text-2); display: none; }
  @media(min-width:640px){ .user-name { display: block; } }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font); font-size: 13px; font-weight: 500;
    border: 1px solid transparent; border-radius: var(--radius);
    cursor: pointer; padding: 7px 14px;
    transition: all var(--transition); white-space: nowrap;
    text-decoration: none; line-height: 1;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-icon { padding: 7px; }
  .btn-sm { padding: 5px 11px; font-size: 12px; }
  .btn-primary {
    background: var(--accent); color: #fff;
    border-color: var(--accent);
  }
  .btn-primary:hover:not(:disabled) { background: #1d4ed8; border-color: #1d4ed8; }
  .btn-ghost {
    background: transparent; color: var(--text-2);
    border-color: var(--border);
  }
  .btn-ghost:hover { background: var(--surface-2); color: var(--text); border-color: var(--border-2); }
  .btn-success {
    background: var(--success-bg); color: var(--success);
    border-color: var(--success-bd);
  }
  .btn-success:hover:not(:disabled) { background: #dcfce7; }
  .btn-danger {
    background: var(--danger-bg); color: var(--danger);
    border-color: var(--danger-bd);
  }
  .btn-danger:hover { background: #fee2e2; }

  /* ── Layout ── */
  .page { max-width: 1080px; margin: 0 auto; padding: 28px 16px 80px; }
  @media(min-width:640px){ .page { padding: 32px 24px 80px; } }
  @media(min-width:1024px){ .page { padding: 40px 32px 80px; } }

  /* ── Page header ── */
  .page-header { margin-bottom: 28px; }
  .page-header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; color: var(--text); }
  @media(min-width:640px){ .page-header h1 { font-size: 26px; } }
  .page-header p { color: var(--text-2); font-size: 14px; margin-top: 3px; }

  /* ── Stats ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px; margin-bottom: 28px;
  }
  @media(min-width:480px){ .stats-grid { grid-template-columns: repeat(3, 1fr); } }
  @media(min-width:900px){ .stats-grid { grid-template-columns: repeat(5, 1fr); } }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 18px 16px; cursor: pointer;
    transition: all var(--transition);
    animation: fadeUp 0.3s ease both;
  }
  .stat-card:hover { border-color: var(--border-2); background: var(--surface-2); }
  .stat-card.active { border-color: var(--accent); background: var(--accent-light); }
  .stat-indicator {
    width: 8px; height: 8px; border-radius: 2px;
    margin-bottom: 12px;
  }
  .stat-val { font-size: 26px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: var(--text); }
  .stat-label { font-size: 12px; font-weight: 500; color: var(--text-2); margin-top: 4px; }

  /* ── Section header ── */
  .section-hd {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px; gap: 12px;
  }
  .section-hd h2 {
    font-size: 15px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 7px;
  }

  /* ── Filters ── */
  .filters {
    display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px;
  }
  .filter-btn {
    font-family: var(--font); font-size: 12px; font-weight: 500;
    padding: 5px 12px; border-radius: 6px; cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface); color: var(--text-2);
    transition: all var(--transition);
  }
  .filter-btn:hover { background: var(--surface-2); color: var(--text); border-color: var(--border-2); }
  .filter-btn.active {
    background: var(--accent); color: #fff;
    border-color: var(--accent);
  }

  /* ── Status badge ── */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500; padding: 2px 8px;
    border-radius: 4px; white-space: nowrap; border: 1px solid;
  }
  .badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .badge-pending  { background: var(--warn-bg);    color: var(--warn);    border-color: var(--warn-bd); }
  .badge-pending .badge-dot  { background: var(--warn); }
  .badge-running  { background: var(--running-bg); color: var(--running); border-color: var(--running-bd); }
  .badge-running .badge-dot  { background: var(--running); animation: pulse 1.5s ease infinite; }
  .badge-success  { background: var(--success-bg); color: var(--success); border-color: var(--success-bd); }
  .badge-success .badge-dot  { background: var(--success); }
  .badge-failed   { background: var(--danger-bg);  color: var(--danger);  border-color: var(--danger-bd); }
  .badge-failed .badge-dot   { background: var(--danger); }

  /* ── Task cards ── */
  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-card {
    display: flex; align-items: center; gap: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    text-decoration: none; color: inherit;
    transition: all var(--transition);
    animation: fadeUp 0.3s ease both;
  }
  .task-card:hover { border-color: var(--border-2); background: var(--surface-2); }
  .task-type-icon {
    width: 36px; height: 36px; border-radius: 8px;
    background: var(--bg); border: 1px solid var(--border);
    display: grid; place-items: center; flex-shrink: 0;
    color: var(--text-3);
  }
  .task-body { flex: 1; min-width: 0; }
  .task-title {
    font-size: 14px; font-weight: 500; margin-bottom: 5px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    color: var(--text);
  }
  .task-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .task-op {
    font-family: var(--mono); font-size: 10px; font-weight: 500;
    color: var(--text-2); background: var(--bg);
    border: 1px solid var(--border);
    padding: 2px 6px; border-radius: 4px;
  }
  .task-time { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-3); }
  .task-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  /* ── Empty state ── */
  .empty {
    text-align: center; padding: 56px 24px;
    background: var(--surface); border: 1px dashed var(--border-2);
    border-radius: var(--radius-lg);
  }
  .empty-icon {
    width: 44px; height: 44px; border-radius: 10px;
    background: var(--surface-2); border: 1px solid var(--border);
    display: grid; place-items: center; margin: 0 auto 16px;
    color: var(--text-3);
  }
  .empty h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
  .empty p { color: var(--text-2); font-size: 13px; }

  /* ── Modal ── */
  .overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.35);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  @media(min-width:640px){ .overlay { align-items: center; } }
  .modal {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    width: 100%; max-width: 480px;
    padding: 24px 24px 28px;
    max-height: 92dvh; overflow-y: auto;
    animation: slideUp 0.25s ease;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
  }
  @media(min-width:640px){
    .modal { border-radius: var(--radius-lg); animation: scaleIn 0.2s ease; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
  }
  .modal-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .modal-hd h2 { font-size: 16px; font-weight: 600; color: var(--text); }
  .modal-close {
    width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
    cursor: pointer; background: var(--surface-2); color: var(--text-2);
    display: grid; place-items: center; transition: all var(--transition);
  }
  .modal-close:hover { background: var(--border); color: var(--text); }

  /* ── Form ── */
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block; font-size: 12px; font-weight: 600; color: var(--text);
    margin-bottom: 6px; letter-spacing: 0.1px;
  }
  .form-input, .form-select, .form-textarea {
    width: 100%; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text); font-family: var(--font);
    font-size: 13px; padding: 9px 12px;
    transition: border-color var(--transition), box-shadow var(--transition);
    outline: none; resize: none;
  }
  .form-input::placeholder, .form-textarea::placeholder { color: var(--text-3); }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }
  .form-select option { background: var(--surface); }
  .char-count { font-size: 11px; color: var(--text-3); text-align: right; margin-top: 4px; }
  .modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  /* ── Loading ── */
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.75s linear infinite;
  }
  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--text-2); font-size: 13px; }

  /* ── Animations ── */
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes pulse    { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
  @keyframes fadeIn   { from{ opacity:0 } to{ opacity:1 } }
  @keyframes fadeUp   { from{ opacity:0; transform:translateY(8px) } to{ opacity:1; transform:none } }
  @keyframes slideUp  { from{ transform:translateY(40px); opacity:0 } to{ transform:none; opacity:1 } }
  @keyframes scaleIn  { from{ transform:scale(0.96); opacity:0 } to{ transform:none; opacity:1 } }
`;

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const OPERATIONS = [
  { value: 'uppercase',  label: 'Uppercase',      desc: 'Convert text to UPPERCASE' },
  { value: 'lowercase',  label: 'Lowercase',      desc: 'Convert text to lowercase' },
  { value: 'reverse',    label: 'Reverse String', desc: 'Reverse the input text' },
  { value: 'word_count', label: 'Word Count',     desc: 'Count words, characters & sentences' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', cls: 'badge-pending' },
  running: { label: 'Running', cls: 'badge-running' },
  success: { label: 'Success', cls: 'badge-success' },
  failed:  { label: 'Failed',  cls: 'badge-failed'  },
};

const formatTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ─── Components ─────────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className="badge-dot" /> {cfg.label}
    </span>
  );
};

/* ─── Create Modal ───────────────────────────────────────────────────────────── */
const CreateModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState({ title: '', inputText: '', operation: 'uppercase' });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.inputText.trim()) return toast.error('Input text is required');
    setLoading(true);
    try {
      const { data } = await tasksAPI.create(form);
      onCreate(data.task);
      toast.success('Task created and queued');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h2>New Task</h2>
          <button className="modal-close" onClick={onClose} id="create-modal-close" aria-label="Close">
            <X size={13} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">Task Title</label>
            <input
              id="task-title" type="text" className="form-input"
              placeholder="e.g. Process customer feedback"
              value={form.title} onChange={(e) => set('title', e.target.value)}
              maxLength={100} autoFocus
            />
            <p className="char-count">{form.title.length} / 100</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-operation">Operation</label>
            <select id="task-operation" className="form-select"
              value={form.operation} onChange={(e) => set('operation', e.target.value)}>
              {OPERATIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label} — {op.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-input">Input Text</label>
            <textarea
              id="task-input" className="form-textarea"
              placeholder="Paste or type the text to process..."
              value={form.inputText} onChange={(e) => set('inputText', e.target.value)}
              rows={5} maxLength={10000}
            />
            <p className="char-count">{form.inputText.length.toLocaleString()} / 10,000</p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" id="create-task-submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? <><Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite' }} /> Creating…</>
                : <><Plus size={13} /> Create Task</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Dashboard ──────────────────────────────────────────────────────────────── */
const STAT_CARDS = [
  { key: 'total',   label: 'Total',      color: '#2563eb' },
  { key: 'pending', label: 'Pending',    color: '#d97706' },
  { key: 'running', label: 'Running',    color: '#0369a1' },
  { key: 'success', label: 'Successful', color: '#16a34a' },
  { key: 'failed',  label: 'Failed',     color: '#dc2626' },
];

const FILTERS = ['all', 'pending', 'running', 'success', 'failed'];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [tasks, setTasks]         = useState([]);
  const [stats, setStats]         = useState({ total: 0, pending: 0, running: 0, success: 0, failed: 0 });
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [runningIds, setRunningIds] = useState(new Set());

  const fetchData = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const [tasksRes, statsRes] = await Promise.all([
        tasksAPI.list(params),
        tasksAPI.stats(),
      ]);
      setTasks(tasksRes.data.tasks);
      setStats(statsRes.data.stats);
    } catch {
      // silent on background poll
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  useEffect(() => {
    const hasActive = tasks.some((t) => ['pending', 'running'].includes(t.status));
    if (!hasActive) return;
    const id = setInterval(fetchData, 4000);
    return () => clearInterval(id);
  }, [tasks, fetchData]);

  const handleRun = async (e, taskId) => {
    e.preventDefault(); e.stopPropagation();
    setRunningIds((s) => new Set([...s, taskId]));
    try {
      await tasksAPI.run(taskId);
      toast.success('Task queued');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to run task');
    } finally {
      setRunningIds((s) => { const n = new Set(s); n.delete(taskId); return n; });
    }
  };

  const handleDelete = async (e, taskId) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(taskId);
      setTasks((p) => p.filter((t) => t._id !== taskId));
      toast.success('Task deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleCreate = (newTask) => {
    setTasks((p) => [newTask, ...p]);
    setStats((s) => ({ ...s, total: s.total + 1, pending: s.pending + 1 }));
  };

  return (
    <>
      <style>{STYLES}</style>

      {/* Navbar */}
      <nav className="nav">
        <Link to="/dashboard" className="nav-brand">
          <div className="nav-logo"><Cpu size={16} color="#fff" /></div>
          <span className="nav-title">AI Task Platform</span>
        </Link>
        <div className="nav-right">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={fetchData} id="refresh-btn" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <div className="nav-divider" />
          <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <span className="user-name">{user?.username}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout} id="logout-btn">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </nav>

      {/* Page */}
      <div className="page">
        <div className="page-header">
          <h1>Task Dashboard</h1>
          <p>Create and monitor your text processing tasks</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {STAT_CARDS.map(({ key, label, color }, i) => (
            <div
              key={key} className={`stat-card${filter === (key === 'total' ? 'all' : key) ? ' active' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => setFilter(key === 'total' ? 'all' : key)}
              role="button" tabIndex={0}
            >
              <div className="stat-indicator" style={{ background: color }} />
              <div className="stat-val">{stats[key] ?? 0}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Section header */}
        <div className="section-hd">
          <h2><BarChart3 size={15} color="var(--text-3)" /> My Tasks</h2>
          <button id="new-task-btn" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={13} /> New Task
          </button>
        </div>

        {/* Filters */}
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)} id={`filter-${f}`}>
              {f === 'all' ? `All (${stats.total})` : `${STATUS_CONFIG[f]?.label} (${stats[f] ?? 0})`}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="center"><div className="spinner" /><span>Loading tasks…</span></div>
        ) : tasks.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Layers size={20} /></div>
            <h3>No tasks found</h3>
            <p>{filter === 'all' ? 'Create your first task to get started.' : `No ${filter} tasks found.`}</p>
            {filter === 'all' && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={() => setShowModal(true)}>
                <Plus size={13} /> Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task, i) => (
              <Link
                key={task._id} to={`/tasks/${task._id}`}
                className="task-card" id={`task-${task._id}`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="task-type-icon">
                  <Layers size={15} />
                </div>
                <div className="task-body">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span className="task-op">{task.operation}</span>
                    <StatusBadge status={task.status} />
                    <span className="task-time"><Clock size={10} />{formatTime(task.createdAt)}</span>
                  </div>
                </div>
                <div className="task-actions">
                  {['pending', 'failed'].includes(task.status) && (
                    <button
                      className="btn btn-success btn-sm" id={`run-task-${task._id}`}
                      onClick={(e) => handleRun(e, task._id)}
                      disabled={runningIds.has(task._id)} title="Run task"
                    >
                      {runningIds.has(task._id)
                        ? <Loader2 size={12} style={{ animation: 'spin 0.75s linear infinite' }} />
                        : <Play size={12} />}
                      Run
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm btn-icon" id={`delete-task-${task._id}`}
                    onClick={(e) => handleDelete(e, task._id)} title="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </>
  );
};

export default Dashboard;