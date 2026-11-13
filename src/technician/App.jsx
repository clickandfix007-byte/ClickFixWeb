import React, { useState } from 'react';
import { useStore, actions, STATUS } from '../shared/store.js';
import { money, niceDate, initials, mapsUrl, telUrl, timeValue, isoLocal } from '../shared/utils.js';
import logo from '../shared/logo.png';

const TABS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'jobs', label: 'Jobs', icon: '▣' },
  { id: 'earnings', label: 'Earnings', icon: '₹' },
  { id: 'profile', label: 'Profile', icon: '○' },
];

const isNew = b => b.status === STATUS.ASSIGNED && b.techResponse === 'pending';
const isActive = b => [STATUS.ASSIGNED, STATUS.ON_WAY, STATUS.PROGRESS].includes(b.status);
const byTime = (a, b) => a.date.localeCompare(b.date) || timeValue(a.time) - timeValue(b.time);

function label(b) {
  if (isNew(b)) return ['New', 'new'];
  if (b.status === STATUS.ASSIGNED) return ['Accepted', ''];
  if (b.status === STATUS.ON_WAY) return ['On the way', 'go'];
  if (b.status === STATUS.PROGRESS) return ['In progress', 'go'];
  if (b.status === STATUS.DONE) return ['Completed', 'done'];
  return [b.status, 'cancel'];
}

export default function App() {
  const [techId, setTechId] = useState(() => localStorage.getItem('clickfix.techId') || 't1');
  const [tab, setTab] = useState('home');
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState('');

  const technicians = useStore(s => s.technicians);
  const settings = useStore(s => s.settings);
  const allBookings = useStore(s => s.bookings);
  const me = technicians.find(t => t.id === techId) || technicians[0];
  const jobs = allBookings.filter(b => b.techId === me.id);
  const payout = amt => Math.round(amt * settings.payoutPercent / 100);

  const notify = msg => { setToast(msg); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(''), 2400); };
  const chooseTech = id => { localStorage.setItem('clickfix.techId', id); setTechId(id); setOpenId(null); };
  const go = id => { setTab(id); setOpenId(null); };
  const open = jobs.find(b => b.id === openId);

  const accept = id => { actions.accept(id); notify('Job accepted.'); };
  const reject = id => { actions.reject(id); setOpenId(null); notify('Job rejected — returned to dispatch.'); };

  const card = b => <JobCard key={b.id} job={b} onOpen={() => setOpenId(b.id)} onAccept={() => accept(b.id)} onReject={() => reject(b.id)} />;

  return <div className="app-shell tech">
    <header className="topbar">
      <button className="brand" onClick={() => go('home')} aria-label="Home"><img className="brand-logo" src={logo} alt="Click & Fix" /><small className="brand-sub">TECHNICIAN APP</small></button>
      <div className="top-actions"><span className="location-pill">{me.online ? '● Online' : '● Offline'}</span><div className="avatar">{initials(me.name)}</div></div>
    </header>

    <main>
      {open ? <JobDetail job={open} payout={payout} onBack={() => setOpenId(null)} notify={notify} onReject={() => reject(open.id)} /> : <>
        {tab === 'home' && <Home me={me} jobs={jobs} card={card} setTab={go} />}
        {tab === 'jobs' && <Jobs jobs={jobs} card={card} />}
        {tab === 'earnings' && <Earnings jobs={jobs} payout={payout} percent={settings.payoutPercent} />}
        {tab === 'profile' && <Profile me={me} jobs={jobs} technicians={technicians} chooseTech={chooseTech} />}
      </>}
    </main>

    <nav className="bottom-nav">{TABS.map(t => <button key={t.id} className={tab === t.id && !open ? 'active' : ''} onClick={() => go(t.id)}><span>{t.icon}</span><small>{t.label}</small></button>)}</nav>
    {toast && <div className="toast">✓ {toast}</div>}
  </div>;
}

function JobCard({ job, onOpen, onAccept, onReject }) {
  const [text, kind] = label(job);
  return <div className="job-card" onClick={onOpen} role="button" tabIndex={0}>
    <div className="job-top"><span className="booking-icon">{job.icon}</span><div><b>#{job.id}</b><small>{job.service}</small></div><span className={'pill ' + kind}>{text}</span></div>
    <div className="job-line">📍 {job.address}</div>
    <div className="job-line">🕙 {niceDate(job.date)}, {job.time} • {job.customerName}</div>
    <div className="job-amount">{money(job.amount)}</div>
    {isActive(job) && <div className="job-actions" onClick={e => e.stopPropagation()}>
      <a className="btn blue full" href={mapsUrl(job.address)} target="_blank" rel="noreferrer">➤ Navigate</a>
      {isNew(job) && <><button className="btn green" onClick={onAccept}>✓ Accept</button><button className="btn red" onClick={onReject}>✕ Reject</button></>}
    </div>}
  </div>;
}

function Home({ me, jobs, card, setTab }) {
  const today = isoLocal();
  const todayJobs = jobs.filter(b => b.date === today && b.status !== STATUS.CANCELLED).length;
  const doneToday = jobs.filter(b => b.status === STATUS.DONE && (b.completedAt || '').startsWith(today)).length;
  const active = jobs.filter(isActive).sort(byTime);
  return <section className="page">
    <div className="t-head">
      <div className="profile-avatar">{initials(me.name)}</div>
      <div><h1>{me.name}</h1><p className={me.online ? 'on' : 'off'}>● {me.online ? 'Online — receiving jobs' : 'Offline'}</p></div>
      <button className={'switch ' + (me.online ? 'on' : '')} aria-label="Toggle online" onClick={() => actions.setOnline(me.id, !me.online)} />
    </div>
    {!me.online && <div className="offline-note">You're offline. Go online to receive new job requests.</div>}
    <div className="stat-row">
      <div className="stat blue"><div><small>Today Jobs</small><b>{todayJobs}</b></div><i>📅</i></div>
      <div className="stat green"><div><small>Completed</small><b>{doneToday}</b></div><i>✔</i></div>
    </div>
    <div className="section-head"><div><h2>Assigned Jobs</h2></div><button className="text-btn" onClick={() => setTab('jobs')}>View All →</button></div>
    <div className="job-list">{active.slice(0, 3).map(card)}{!active.length && <div className="empty-state">No active jobs right now. New requests will show up here.</div>}</div>
  </section>;
}

function Jobs({ jobs, card }) {
  const [tab, setTab] = useState('new');
  const groups = {
    new: jobs.filter(isNew),
    active: jobs.filter(b => isActive(b) && !isNew(b)),
    done: jobs.filter(b => b.status === STATUS.DONE),
  };
  const list = [...groups[tab]].sort(tab === 'done' ? (a, b) => b.date.localeCompare(a.date) : byTime).slice(0, 30);
  return <section className="page">
    <p className="eyebrow">YOUR WORK</p><h1>Jobs</h1>
    <div className="tabs">{[['new', 'New'], ['active', 'Active'], ['done', 'Completed']].map(([id, name]) =>
      <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{name} ({groups[id].length})</button>)}</div>
    <div className="job-list">{list.map(card)}{!list.length && <div className="empty-state">Nothing here yet.</div>}</div>
  </section>;
}

function JobDetail({ job, payout, onBack, notify, onReject }) {
  const [amount, setAmount] = useState(String(job.amount));
  const [error, setError] = useState(false);
  const [text, kind] = label(job);
  const finish = () => {
    const n = Number(amount);
    if (!n || n <= 0) { setError(true); return; }
    actions.complete(job.id, n); notify('Job completed. Great work!');
  };
  return <section className="page narrow">
    <button className="back-link" onClick={onBack}>← Back</button>
    <div className="detail-card">
      <div className="row"><span className="booking-icon">{job.icon}</span><div className="grow"><b style={{ fontSize: 16 }}>#{job.id}</b><br /><small>{job.service}</small></div><span className={'pill ' + kind}>{text}</span></div>
      <div className="job-line">🕙 {niceDate(job.date)}, {job.time}</div>
      <div className="job-line">💳 {job.payment}{job.payment === 'Cash' && isActive(job) ? ' — collect cash on completion' : ''}</div>
      <div className="big">{money(job.amount)}</div>
    </div>
    <div className="detail-card"><small className="lbl">CUSTOMER</small>
      <div className="row"><div className="avatar">{initials(job.customerName)}</div><div className="grow"><b>{job.customerName}</b><br /><small>{job.customerPhone}</small></div>
        {isActive(job) && <a className="btn ghost" href={telUrl(job.customerPhone)}>☎ Call</a>}</div>
    </div>
    <div className="detail-card"><small className="lbl">SERVICE ADDRESS</small><b style={{ fontSize: 13 }}>📍 {job.address}</b>
      {job.notes && <><small className="lbl">CUSTOMER NOTES</small><span style={{ fontSize: 12 }}>{job.notes}</span></>}
      {isActive(job) && <a className="btn blue" href={mapsUrl(job.address)} target="_blank" rel="noreferrer">➤ Navigate</a>}
    </div>

    {isNew(job) && <div className="job-actions"><button className="btn green" onClick={() => { actions.accept(job.id); notify('Job accepted.'); }}>✓ Accept job</button><button className="btn red" onClick={onReject}>✕ Reject</button></div>}
    {job.status === STATUS.ASSIGNED && job.techResponse === 'accepted' && <button className="btn blue" style={{ width: '100%' }} onClick={() => { actions.setStatus(job.id, STATUS.ON_WAY); notify("Customer notified: you're on the way."); }}>Start journey</button>}
    {job.status === STATUS.ON_WAY && <button className="btn orange" style={{ width: '100%' }} onClick={() => { actions.setStatus(job.id, STATUS.PROGRESS); notify('Work started.'); }}>I've arrived — start work</button>}
    {job.status === STATUS.PROGRESS && <div className="form-card">
      <label>Final amount (₹)<input inputMode="numeric" value={amount} onChange={e => { setAmount(e.target.value.replace(/\D/g, '')); setError(false); }} /></label>
      <small className="fine-print" style={{ color: error ? '#d93b3b' : undefined }}>{error ? 'Enter a valid amount.' : 'Update if the final quote differs after inspection.'}</small>
      <button className="btn green" style={{ width: '100%', marginTop: 12 }} onClick={finish}>Mark as completed</button>
    </div>}
    {job.status === STATUS.DONE && <b style={{ color: '#0b9b61', fontSize: 13 }}>✓ Completed. Your payout: {money(payout(job.amount))}</b>}
  </section>;
}

function Earnings({ jobs, payout, percent }) {
  const today = isoLocal();
  const done = jobs.filter(b => b.status === STATUS.DONE).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const dayOf = b => (b.completedAt || b.date).slice(0, 10);
  const sum = list => list.reduce((a, b) => a + payout(b.amount), 0);
  const week = new Date(); week.setDate(week.getDate() - 6);
  const weekIso = isoLocal(week);
  return <section className="page">
    <p className="eyebrow">YOUR PAYOUTS</p><h1>Earnings</h1><p className="muted">You earn {percent}% of each completed job.</p>
    <div className="earn-card"><small>TODAY</small><h2>{money(sum(done.filter(b => dayOf(b) === today)))}</h2>
      <span>Last 7 days: {money(sum(done.filter(b => dayOf(b) >= weekIso)))} • All time: {money(sum(done))}</span></div>
    <div className="section-head"><h2>Completed jobs</h2></div>
    {done.slice(0, 20).map(b => <div className="earn-item" key={b.id}><span className="booking-icon">{b.icon}</span>
      <div><b>{b.service}</b><small>#{b.id} • {niceDate(dayOf(b))}</small></div>
      <div className="plus">+ {money(payout(b.amount))}<br /><small style={{ color: '#71839a', fontWeight: 400 }}>of {money(b.amount)}</small></div></div>)}
    {!done.length && <div className="empty-state">Completed jobs will appear here.</div>}
  </section>;
}

function Profile({ me, jobs, technicians, chooseTech }) {
  const done = jobs.filter(b => b.status === STATUS.DONE).length;
  return <section className="page narrow">
    <p className="eyebrow">ACCOUNT</p><h1>My profile</h1>
    <div className="profile-card"><div className="profile-avatar">{initials(me.name)}</div><h2>{me.name}</h2><p>{me.phone}</p><span className="verified">✓ Verified technician</span>
      <p style={{ marginTop: 12, fontWeight: 800 }}>★ {me.rating} &nbsp;•&nbsp; {done} jobs done &nbsp;•&nbsp; {me.area}</p></div>
    <div className="detail-card"><div className="row"><div className="grow"><b>Available for jobs</b><br /><small>{me.online ? "You're online and can receive requests" : "You're offline"}</small></div>
      <button className={'switch ' + (me.online ? 'on' : '')} aria-label="Toggle online" onClick={() => actions.setOnline(me.id, !me.online)} /></div></div>
    <div className="form-card"><label>Demo: sign in as<select value={me.id} onChange={e => chooseTech(e.target.value)}>
      {technicians.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <small className="fine-print">Real sign-in (phone OTP) needs your backend.</small></div>
  </section>;
}
