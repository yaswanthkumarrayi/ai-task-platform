import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Trash2, RefreshCw,
  Loader2, AlertCircle, Cpu, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';

/* ─── Styles ─────────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #f5f6fa;
    --bg-2:        #ffffff;
    --bg-3:        #f9fafb;
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
  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100%; -webkit-font-smoothing: antialiased; }

  /* ── Navbar ── */
  .nav {
    position: sticky; top: 0; z-index: 100;
    height: var(--nav-h);
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 12px;
  }
  .nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; flex: 1; }
  .nav-logo {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--accent);
    display: grid; place-items: center; flex-shrink: 0;
  }
  .nav-title { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
  .nav-right { display: flex; align-items: center; gap: 8px; }
  .nav-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
  .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--accent-light); border: 1px solid #bfdbfe;
    display: grid; place-items: center;
    font-size: 12px; font-weight: 600; color: var(--accent); flex-shrink: 0;
  }
  .user-name { font-size: 13px; font-weight: 500; color: var(--text-2); display: none; }
  @media(min-width:640px){ .user-name { display: block; } }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font); font-size: 13px; font-weight: 500;
    border: 1px solid transparent; border-radius: var(--radius);
    cursor: pointer; padding: 7px 14px;
    transition: all var(--transition); white-space: nowrap; text-decoration: none; line-height: 1;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-icon { padding: 7px; }
  .btn-sm { padding: 5px 11px; font-size: 12px; }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover:not(:disabled) { background: #1d4ed8; border-color: #1d4ed8; }
  .btn-ghost { background: transparent; color: var(--text-2); border-color: var(--border); }
  .btn-ghost:hover { background: var(--surface-2); color: var(--text); border-color: var(--border-2); }
  .btn-success { background: var(--success-bg); color: var(--success); border-color: var(--success-bd); }
  .btn-success:hover:not(:disabled) { background: #dcfce7; }
  .btn-danger { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-bd); }
  .btn-danger:hover { background: #fee2e2; }

  /* ── Layout ── */
  .page { max-width: 860px; margin: 0 auto; padding: 24px 16px 80px; }
  @media(min-width:640px){ .page { padding: 32px 24px 80px; } }
  @media(min-width:1024px){ .page { padding: 40px 32px 80px; } }

  /* ── Back link ── */
  .back-link {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 500; color: var(--text-2);
    text-decoration: none; margin-bottom: 20px;
    transition: color var(--transition);
  }
  .back-link:hover { color: var(--text); }

  /* ── Detail header ── */
  .detail-header {
    display: flex; flex-direction: column; gap: 14px;
    margin-bottom: 20px;
    animation: fadeUp 0.3s ease;
  }
  @media(min-width:640px){ .detail-header { flex-direction: row; align-items: flex-start; justify-content: space-between; } }
  .detail-title { font-size: 20px; font-weight: 700; letter-spacing: -0.4px; margin-bottom: 8px; color: var(--text); }
  @media(min-width:640px){ .detail-title { font-size: 24px; } }
  .detail-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .detail-actions { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }

  /* ── Status badge ── */
  .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; white-space: nowrap; border: 1px solid; }
  .badge-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .badge-pending { background: var(--warn-bg);    color: var(--warn);    border-color: var(--warn-bd); }
  .badge-pending .badge-dot { background: var(--warn); }
  .badge-running { background: var(--running-bg); color: var(--running); border-color: var(--running-bd); }
  .badge-running .badge-dot { background: var(--running); animation: pulse 1.5s ease infinite; }
  .badge-success { background: var(--success-bg); color: var(--success); border-color: var(--success-bd); }
  .badge-success .badge-dot { background: var(--success); }
  .badge-failed  { background: var(--danger-bg);  color: var(--danger);  border-color: var(--danger-bd); }
  .badge-failed .badge-dot  { background: var(--danger); }

  /* ── Info grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px; margin-bottom: 16px;
  }
  @media(min-width:640px){ .info-grid { grid-template-columns: repeat(4, 1fr); } }
  .info-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 14px 16px;
    animation: fadeUp 0.3s ease both;
  }
  .info-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .info-val { font-size: 13px; font-weight: 500; color: var(--text); }
  .info-val-accent { font-size: 20px; font-weight: 700; color: var(--accent); letter-spacing: -0.5px; }

  /* ── Cards ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 18px; margin-bottom: 10px;
    animation: fadeUp 0.35s ease both;
  }
  .card-label {
    font-size: 11px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
  }
  .card-success { border-color: var(--success-bd); }
  .card-label-success { color: var(--success); }

  /* ── Code block ── */
  .code-block {
    background: var(--bg-3); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 12px 14px;
    font-family: var(--mono); font-size: 12.5px; color: var(--text-2);
    white-space: pre-wrap; word-break: break-word; line-height: 1.65;
    max-height: 260px; overflow-y: auto;
  }

  /* ── Error banner ── */
  .error-banner {
    background: var(--danger-bg); border: 1px solid var(--danger-bd);
    border-radius: var(--radius-lg); padding: 14px 16px;
    display: flex; gap: 10px; align-items: flex-start;
    margin-bottom: 10px; animation: fadeUp 0.3s ease;
  }
  .error-title { font-weight: 600; color: var(--danger); font-size: 13px; margin-bottom: 3px; }
  .error-msg { font-size: 13px; color: var(--text-2); }

  /* ── Log viewer ── */
  .logs-wrap { display: flex; flex-direction: column; gap: 2px; }
  .log-row {
    display: flex; align-items: baseline; gap: 10px;
    font-family: var(--mono); font-size: 12px;
    padding: 5px 8px; border-radius: 6px;
    transition: background var(--transition);
  }
  .log-row:hover { background: var(--bg-3); }
  .log-time { color: var(--text-3); flex-shrink: 0; width: 78px; }
  .log-lvl {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    padding: 1px 6px; border-radius: 3px; flex-shrink: 0; letter-spacing: 0.3px;
    border: 1px solid;
  }
  .log-lvl-info  { background: var(--accent-light); color: var(--accent); border-color: #bfdbfe; }
  .log-lvl-warn  { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-bd); }
  .log-lvl-error { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-bd); }
  .log-msg { color: var(--text-2); }
  .log-empty { color: var(--text-3); font-size: 13px; padding: 6px 0; }

  /* ── Tags ── */
  .op-tag {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    background: var(--bg-3); color: var(--text-2);
    border: 1px solid var(--border);
    padding: 2px 8px; border-radius: 4px;
  }
  .id-tag { font-size: 11px; color: var(--text-3); font-family: var(--mono); }

  /* ── Loading ── */
  .full-screen { display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: var(--bg); }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin 0.75s linear infinite; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 99px; }

  /* ── Animations ── */
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
  @keyframes fadeUp  { from{ opacity:0; transform:translateY(8px) } to{ opacity:1; transform:none } }
`;

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending: { label: 'Pending', cls: 'badge-pending' },
  running: { label: 'Running', cls: 'badge-running' },
  success: { label: 'Success', cls: 'badge-success' },
  failed:  { label: 'Failed',  cls: 'badge-failed'  },
};

const OPERATIONS = {
  uppercase:  { label: 'Uppercase' },
  lowercase:  { label: 'Lowercase' },
  reverse:    { label: 'Reverse String' },
  word_count: { label: 'Word Count' },
};

const formatTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

/* ─── Sub-components ─────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <span className={`badge ${cfg.cls}`}><span className="badge-dot" />{cfg.label}</span>;
};

const LogViewer = ({ logs }) => {
  if (!logs?.length) return <p className="log-empty">No log entries yet.</p>;
  return (
    <div className="logs-wrap">
      {logs.map((log, i) => (
        <div key={i} className="log-row">
          <span className="log-time">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>
          <span className={`log-lvl log-lvl-${log.level}`}>{log.level}</span>
          <span className="log-msg">{log.message}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── TaskDetail ─────────────────────────────────────────────────────────────── */
const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      const { data } = await tasksAPI.get(id);
      setTask(data.task);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Task not found');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  useEffect(() => {
    if (!task || !['pending', 'running'].includes(task.status)) return;
    const interval = setInterval(fetchTask, 3000);
    return () => clearInterval(interval);
  }, [task, fetchTask]);

  const handleRun = async () => {
    setRunning(true);
    try {
      await tasksAPI.run(id);
      toast.success('Task queued');
      fetchTask();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to run task');
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="full-screen"><div className="spinner" /></div>
      </>
    );
  }

  if (!task) return null;

  const op = OPERATIONS[task.operation] || { label: task.operation };
  const duration = task.startedAt && task.completedAt
    ? `${((new Date(task.completedAt) - new Date(task.startedAt)) / 1000).toFixed(2)}s`
    : null;

  let resultDisplay = task.result;
  if (task.operation === 'word_count' && task.result) {
    try { resultDisplay = JSON.stringify(JSON.parse(task.result), null, 2); } catch { /* noop */ }
  }

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
          <div className="nav-divider" />
          <div className="avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <span className="user-name">{user?.username}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout} id="logout-btn">
            Logout
          </button>
        </div>
      </nav>

      {/* Page */}
      <div className="page">
        <Link to="/dashboard" className="back-link" id="back-to-dashboard">
          <ArrowLeft size={13} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="detail-header">
          <div>
            <h1 className="detail-title">{task.title}</h1>
            <div className="detail-meta">
              <StatusBadge status={task.status} />
              <span className="op-tag">{op.label}</span>
              <span className="id-tag">{task._id}</span>
            </div>
          </div>
          <div className="detail-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={fetchTask} id="refresh-task-btn" title="Refresh">
              <RefreshCw size={13} />
            </button>
            {['pending', 'failed'].includes(task.status) && (
              <button className="btn btn-success btn-sm" id="run-task-btn" onClick={handleRun} disabled={running}>
                {running
                  ? <><Loader2 size={13} style={{ animation: 'spin 0.75s linear infinite' }} /> Running…</>
                  : <><Play size={13} /> Run Task</>}
              </button>
            )}
            <button className="btn btn-danger btn-sm" id="delete-task-btn" onClick={handleDelete}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="info-grid">
          {[
            { label: 'Created At',      val: formatTime(task.createdAt),   delay: 0 },
            { label: 'Started At',      val: formatTime(task.startedAt),   delay: 50 },
            { label: 'Completed At',    val: formatTime(task.completedAt), delay: 100 },
            { label: 'Processing Time', val: duration || '—',              delay: 150, accent: !!duration },
          ].map(({ label, val, delay, accent }) => (
            <div key={label} className="info-card" style={{ animationDelay: `${delay}ms` }}>
              <div className="info-label">{label}</div>
              <div className={accent ? 'info-val-accent' : 'info-val'}>{val}</div>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {task.status === 'failed' && task.errorMessage && (
          <div className="error-banner">
            <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div className="error-title">Error</div>
              <div className="error-msg">{task.errorMessage}</div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="card" style={{ animationDelay: '80ms' }}>
          <div className="card-label">
            <FileText size={11} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
            Input Text ({task.inputText?.length?.toLocaleString() || 0} chars)
          </div>
          <pre className="code-block">{task.inputText}</pre>
        </div>

        {/* Result */}
        {task.result && (
          <div className="card card-success" style={{ animationDelay: '110ms' }}>
            <div className="card-label card-label-success">Result</div>
            <pre className="code-block">{resultDisplay}</pre>
          </div>
        )}

        {/* Logs */}
        <div className="card" style={{ animationDelay: '140ms' }}>
          <div className="card-label">Processing Logs ({task.logs?.length || 0} entries)</div>
          <LogViewer logs={task.logs} />
        </div>
      </div>
    </>
  );
};

export default TaskDetail;