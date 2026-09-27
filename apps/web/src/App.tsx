import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  FileText,
  FolderClosed,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Workflow,
  Zap,
} from 'lucide-react';

type Task = {
  id: string;
  title: string;
  status: 'open' | 'done';
  priority: 'low' | 'normal' | 'high';
  due_at: string | null;
};

type AIStatus = {
  provider: 'ollama';
  status: 'ready' | 'unavailable' | 'model_missing' | 'configuration_error' | 'checking';
  model: string | null;
  available_models: string[];
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type View = 'Home' | 'Intelligence' | 'Tasks' | 'Files' | 'Flows' | 'Devices' | 'Security';

const navigation: { name: View; icon: typeof LayoutDashboard }[] = [
  { name: 'Home', icon: LayoutDashboard },
  { name: 'Intelligence', icon: MessageSquareText },
  { name: 'Tasks', icon: Check },
  { name: 'Files', icon: FolderClosed },
  { name: 'Flows', icon: Workflow },
];

const pageCopy: Record<View, { eyebrow: string; title: string; text: string }> = {
  Home: { eyebrow: 'PERSONAL WORKSPACE', title: 'Room to think.', text: 'A clear view of what matters today.' },
  Intelligence: { eyebrow: 'NOVA INTELLIGENCE', title: 'Think it through.', text: 'A private space to work through ideas, one prompt at a time.' },
  Tasks: { eyebrow: 'YOUR MOMENTUM', title: 'Make progress.', text: 'Small steps, kept in view.' },
  Files: { eyebrow: 'YOUR LIBRARY', title: 'Find your flow.', text: 'Your files stay on this device in this preview.' },
  Flows: { eyebrow: 'NOVA FLOW', title: 'Work, in rhythm.', text: 'Draft automations and review them before anything can run.' },
  Devices: { eyebrow: 'DEVICE HUB', title: 'Your connected space.', text: 'Device pairing is not enabled in this local preview.' },
  Security: { eyebrow: 'PRIVACY & SECURITY', title: 'In your hands.', text: 'This preview keeps data in a local SQLite database.' },
};

function App() {
  const [view, setView] = useState<View>('Home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [apiOnline, setApiOnline] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>({ provider: 'ollama', status: 'checking', model: null, available_models: [] });
  const [chatText, setChatText] = useState('');
  const [chatNotice, setChatNotice] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/v1/tasks')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json() as Promise<Task[]>;
      })
      .then((items) => {
        if (active) {
          setTasks(items);
          setApiOnline(true);
        }
      })
      .catch(() => {
        if (active) setApiOnline(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/ai/status')
      .then((response) => {
        if (!response.ok) throw new Error('AI status unavailable');
        return response.json() as Promise<AIStatus>;
      })
      .then((status) => { if (active) setAiStatus(status); })
      .catch(() => {
        if (active) setAiStatus({ provider: 'ollama', status: 'unavailable', model: 'llama3.2:3b', available_models: [] });
      });
    return () => { active = false; };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    if (!apiOnline) {
      showToast('Start the local API to save tasks between sessions.');
      return;
    }
    try {
      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: 'normal' }),
      });
      if (!response.ok) throw new Error('Task could not be saved');
      const created = await response.json() as Task;
      setTasks((current) => [created, ...current]);
      setTaskTitle('');
    } catch {
      setApiOnline(false);
      showToast('Could not reach local storage. Your task was not saved.');
    }
  };

  const toggleTask = async (task: Task) => {
    const status = task.status === 'done' ? 'open' : 'done';
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Task could not be updated');
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    } catch {
      showToast('Could not update task. Check that the local API is running.');
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = chatText.trim();
    if (!content || chatBusy) return;
    setChatBusy(true);
    setChatNotice('');
    try {
      const messages = [...chatMessages, { role: 'user' as const, content }].slice(-20);
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const result = await response.json() as { reply?: string; detail?: { message?: string } | string };
      if (!response.ok) {
        const detail = typeof result.detail === 'string' ? result.detail : result.detail?.message;
        throw new Error(detail || 'The local AI service could not answer.');
      }
      const reply = result.reply;
      if (!reply) throw new Error('The local model returned an empty reply.');
      const updatedMessages: ChatMessage[] = [...chatMessages, { role: 'user', content }, { role: 'assistant', content: reply }];
      setChatMessages(updatedMessages.slice(-20));
      setChatText('');
      setAiStatus((current) => ({ ...current, status: 'ready' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local AI service is unavailable.';
      setChatNotice(`${message} Your prompt was not saved.`);
      fetch('/api/v1/ai/status')
        .then((response) => response.json() as Promise<AIStatus>)
        .then(setAiStatus)
        .catch(() => setAiStatus({ provider: 'ollama', status: 'unavailable', model: 'llama3.2:3b', available_models: [] }));
    } finally {
      setChatBusy(false);
    }
  };

  const openView = (next: View) => setView(next);
  const pendingTasks = tasks.filter((task) => task.status === 'open');
  const doneTasks = tasks.length - pendingTasks.length;
  const { eyebrow, title, text } = pageCopy[view];
  const currentDate = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchingViews = (['Home', 'Intelligence', 'Tasks', 'Files', 'Flows', 'Devices', 'Security'] as View[])
    .filter((name) => name.toLowerCase().includes(normalizedSearch));
  const matchingTasks = tasks.filter((task) => task.title.toLowerCase().includes(normalizedSearch));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => openView('Home')} aria-label="NOVA home">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span className="brand-name">nova<span className="brand-period">.</span></span>
        </button>
        <div className="workspace-switcher">
          <span className="workspace-avatar">M</span>
          <span className="workspace-copy"><strong>My workspace</strong><small>Personal</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Workspace">
          {navigation.map(({ name, icon: Icon }) => (
            <button key={name} className={`nav-item ${view === name ? 'active' : ''}`} onClick={() => openView(name)} aria-label={name} title={name} aria-current={view === name ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.8} /><span>{name}</span>
              {name === 'Tasks' && <span className="nav-count">{pendingTasks.length}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-label secondary-label">YOUR DEVICES</div>
        <button className={`nav-item ${view === 'Devices' ? 'active' : ''}`} onClick={() => openView('Devices')} aria-label="Device hub" title="Device hub" aria-current={view === 'Devices' ? 'page' : undefined}>
          <Activity size={17} strokeWidth={1.8} /><span>Device hub</span><span className="live-dot" />
        </button>
        <button className={`nav-item ${view === 'Security' ? 'active' : ''}`} onClick={() => openView('Security')} aria-label="Security" title="Security" aria-current={view === 'Security' ? 'page' : undefined}>
          <ShieldCheck size={17} strokeWidth={1.8} /><span>Security</span>
        </button>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-icon"><Zap size={15} /></span>
            <div><strong>Local mode</strong><small>Your data stays here</small></div>
            <span className="tiny-status" />
          </div>
          <button className="profile-button" onClick={() => showToast('Profile settings are not connected yet.')}>
            <span className="profile-avatar">N</span>
            <span className="profile-copy"><strong>NOVA workspace</strong><small>Simple mode</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{view}</strong></div>
          <div className="top-actions">
            <span className={`connection-pill ${apiOnline ? 'connected' : ''}`}><span />{apiOnline ? 'Local API connected' : 'Offline preview'}</span>
            <button className="icon-button" aria-label="Search" title="Search" onClick={() => setSearchOpen(true)}><Search size={17} /></button>
            <button className="icon-button notification-button" aria-label="Notifications" title="Notifications" onClick={() => showToast('You are all caught up.')}><Bell size={17} /><i /></button>
            <button className="icon-button help-button" aria-label="Help" title="Help" onClick={() => showToast('NOVA local-first preview')}><CircleHelp size={17} /></button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><Sun size={14} /> {eyebrow}</div>
              <h1>{title}</h1>
              <p className="welcome-subtitle">{text}</p>
            </div>
            <div className="date-label"><span className="date-icon"><span /></span><span><strong>{currentDate}</strong><small>A little space for what matters</small></span></div>
          </section>

          {view === 'Intelligence' ? (
            <section className="chat-workspace">
              <div className="chat-intro">
                <div className="assistant-orbit"><Sparkles size={24} /></div>
                <h2>What’s on your mind?</h2>
                <p>Start with a question, a thought, or something you want to untangle.</p>
                <div className={`ai-status ${aiStatus.status === 'ready' ? 'ai-ready' : ''}`}><LockKeyhole size={13} />{aiStatus.status === 'ready' ? `Local model ready · ${aiStatus.model}` : aiStatus.status === 'model_missing' ? `Install ${aiStatus.model} with ollama pull` : aiStatus.status === 'configuration_error' ? 'Check local Ollama configuration' : aiStatus.status === 'checking' ? 'Checking local Ollama service' : 'Ollama not running · local setup required'}</div>
              </div>
              {chatMessages.length > 0 && <div className="chat-transcript" aria-live="polite">{chatMessages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><span>{message.role === 'assistant' ? 'NOVA' : 'YOU'}</span><p>{message.content}</p></article>)}</div>}
              <form className="chat-composer" onSubmit={(event) => void sendMessage(event)}>
                <textarea value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Ask NOVA anything..." rows={3} disabled={chatBusy} />
                <div className="composer-bottom"><button type="button" className="composer-tool" title="Voice input unavailable in preview" disabled><Mic size={16} /></button><span><LockKeyhole size={12} /> Local only <ChevronDown size={13} /></span><button className="send-button" type="submit" aria-label="Send message" disabled={chatBusy || !chatText.trim()}>{chatBusy ? <span className="send-spinner" /> : <Send size={16} />}</button></div>
              </form>
              {chatNotice && <div className="inline-notice"><LockKeyhole size={16} /><span>{chatNotice}{aiStatus.status === 'unavailable' && <small>Start Ollama, then run <code>ollama pull {aiStatus.model || 'llama3.2:3b'}</code>.</small>}{aiStatus.status === 'model_missing' && <small>Run <code>ollama pull {aiStatus.model}</code>, then retry.</small>}</span><button onClick={() => setChatNotice('')} aria-label="Dismiss">×</button></div>}
              <div className="prompt-grid">
                {['Help me plan my week', 'Summarize a long document', 'Explain a tricky concept'].map((suggestion) => <button key={suggestion} onClick={() => setChatText(suggestion)}><Sparkles size={14} />{suggestion}<ArrowRight size={14} /></button>)}
              </div>
            </section>
          ) : view === 'Home' || view === 'Tasks' ? (
            <>
              <section className="stats-grid" aria-label="Workspace overview">
                <article className="stat-card"><div className="stat-top"><span>OPEN TASKS</span><span className="stat-icon coral"><Check size={16} /></span></div><div className="stat-value">{pendingTasks.length}<span className="stat-denominator"> / {tasks.length}</span></div><div className="stat-foot"><span className="stat-trend">{doneTasks} complete</span><span>on this device</span></div><div className="stat-sparkline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
                <article className="stat-card"><div className="stat-top"><span>LOCAL STORAGE</span><span className="stat-icon mint"><FolderClosed size={16} /></span></div><div className="stat-value stat-word">{apiOnline ? 'Ready' : 'Offline'}</div><div className="stat-foot"><span className="stat-neutral">{apiOnline ? 'SQLite connected' : 'Start the local API'}</span></div><div className="focus-meter"><span className={apiOnline ? 'meter-ready' : ''} /></div></article>
                <article className="stat-card"><div className="stat-top"><span>LOCAL AI</span><span className="stat-icon lilac"><Sparkles size={16} /></span></div><div className="device-line"><span className={`device-pulse ${aiStatus.status === 'ready' ? '' : 'disabled-pulse'}`} /><strong>{aiStatus.status === 'ready' ? 'Model ready' : aiStatus.status === 'checking' ? 'Checking Ollama' : 'Setup needed'}</strong></div><div className="stat-foot"><span className="stat-neutral">{aiStatus.model || 'Local inference only'}</span></div><div className="device-wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></article>
              </section>

              <section className="dashboard-grid">
                <article className="surface-card tasks-card">
                  <div className="card-header"><div><div className="section-kicker">YOUR DAY</div><h2>Today’s focus <span>{pendingTasks.length}</span></h2></div><button className="text-button" onClick={() => openView('Tasks')}>All tasks <ArrowRight size={14} /></button></div>
                  <form className="task-add" onSubmit={(event) => void addTask(event)}><Plus size={16} /><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Add a task to your day..." aria-label="New task" /><button type="submit">Add task</button></form>
                  <div className="task-list">
                    {tasks.slice(0, 4).map((task) => <div key={task.id} className={`task-row ${task.status === 'done' ? 'is-done' : ''}`}><button className="task-check" onClick={() => void toggleTask(task)} aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}>{task.status === 'done' && <Check size={12} />}</button><span className="task-title">{task.title}</span><span className={`priority priority-${task.priority}`}>{task.priority}</span><button className="task-more" aria-label={`More options for ${task.title}`}><MoreHorizontal size={17} /></button></div>)}
                    {tasks.length === 0 && <div className="empty-state">A clean slate. Add a task when you’re ready.</div>}
                  </div>
                  <button className="subtle-link" onClick={() => showToast('Completed tasks are shown here as you finish them.')}>View completed tasks <ArrowRight size={13} /></button>
                </article>

                <article className="surface-card assistant-card">
                  <div className="card-header"><div><div className="section-kicker">A THOUGHT FOR YOU</div><h2>Your day, with intention</h2></div><button className="icon-button small" aria-label="More suggestions" onClick={() => showToast('Suggestions are local and limited in this preview.')}><MoreHorizontal size={17} /></button></div>
                  <div className="suggestion-visual"><div className="suggestion-sun" /><div className="suggestion-path path-one" /><div className="suggestion-path path-two" /><span className="visual-caption">A MOMENT OF CLARITY</span></div>
                  <div className="suggestion-copy"><div className="suggestion-label"><Sparkles size={13} /> GENTLE NUDGE</div><p>{pendingTasks.length ? `You have ${pendingTasks.length} open ${pendingTasks.length === 1 ? 'task' : 'tasks'}. Pick one small thing and give it your attention.` : 'Your list is clear. Take a breath, then decide what matters next.'}</p><button onClick={() => openView('Tasks')}>Take a look <ArrowRight size={14} /></button></div>
                  <div className="assistant-footer"><span><LockKeyhole size={12} /> Based on local task count</span><button onClick={() => showToast('Suggestion dismissed.')}>Dismiss</button></div>
                </article>
              </section>

              <section className="lower-grid">
                <article className="surface-card files-card"><div className="card-header"><div><div className="section-kicker">YOUR LIBRARY</div><h2>Recent files</h2></div><button className="text-button" onClick={() => openView('Files')}>Browse <ArrowRight size={14} /></button></div><div className="empty-files"><span><FileText size={17} /></span><p>No files indexed. File access requires your permission.</p></div></article>
                <article className="surface-card flow-card"><div className="card-header"><div><div className="section-kicker">AUTOMATION</div><h2>Flows</h2></div><button className="icon-button small" aria-label="Open flows" onClick={() => openView('Flows')}><ArrowRight size={16} /></button></div><div className="flow-empty-graphic"><div className="flow-node node-trigger"><Sun size={15} /></div><span /><div className="flow-node node-action"><Zap size={15} /></div><span /><div className="flow-node node-result"><Check size={15} /></div></div><p>No flows are active yet.</p><button className="flow-create" onClick={() => openView('Flows')}><Plus size={14} /> Create a flow</button></article>
              </section>
            </>
          ) : (
            <section className="placeholder-panel"><div className="placeholder-mark"><Sparkles size={22} /></div><h2>{view === 'Flows' ? 'Build with intention.' : view === 'Files' ? 'Your files, your way.' : view === 'Devices' ? 'A connected space.' : 'Privacy comes first.'}</h2><p>{view === 'Flows' ? 'Workflow drafts are stored locally. System actions remain disabled; confirmed runs are recorded as simulations only.' : view === 'Files' ? 'File browsing and indexing need an explicit platform permission adapter. Nothing on your device has been scanned.' : view === 'Devices' ? 'Pairing requires an authenticated pairing service. No devices are connected or discoverable in this preview.' : 'Local AI uses Ollama on this device. Cloud sync is offline; tasks and approved memories stay in SQLite.'}</p>{view === 'Flows' && <button className="primary-button" onClick={() => showToast('Flow builder is the next step in this preview.')}>Draft a flow <ArrowRight size={15} /></button>}{view === 'Security' && <div className="security-list"><span><ShieldCheck size={16} /> Local API <strong>Loopback only</strong></span><span><LockKeyhole size={16} /> AI provider <strong>{aiStatus.status === 'ready' ? 'Local Ollama' : 'Unavailable'}</strong></span><span><Activity size={16} /> Cloud sync <strong>Offline</strong></span></div>}</section>
          )}

          <footer className="page-footer"><span><span className="footer-indicator" />{apiOnline ? 'Local workspace is connected' : 'Offline preview · unsaved changes are not persisted'}</span><span>NOVA <b>·</b> A quieter kind of capable</span></footer>
        </div>
      </main>

      {searchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="search-modal" role="dialog" aria-modal="true" aria-label="Search NOVA" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}><div className="search-input-row"><Search size={18} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search views and tasks..." /><kbd>ESC</kbd><button onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div><div className="search-suggestions"><span>{normalizedSearch ? 'MATCHING VIEWS' : 'QUICK NAVIGATION'}</span>{matchingViews.map((name) => <button key={name} onClick={() => { openView(name); setSearchOpen(false); setSearchQuery(''); }}><span><Search size={14} />{name}</span><ArrowRight size={14} /></button>)}{matchingTasks.map((task) => <button key={task.id} onClick={() => { openView('Tasks'); setSearchOpen(false); setSearchQuery(''); }}><span><Check size={14} />{task.title}</span><ArrowRight size={14} /></button>)}{normalizedSearch && matchingViews.length === 0 && matchingTasks.length === 0 && <p className="search-empty">No local views or tasks match that search.</p>}</div><div className="search-hint"><Command size={13} /> Search stays on this device</div></section></div>}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}

export default App;