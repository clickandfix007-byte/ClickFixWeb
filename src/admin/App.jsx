import React, { useEffect, useState } from 'react';
import { useStore, STATUS } from '../shared/store.js';
import { initials } from '../shared/utils.js';
import logo from '../shared/logo.png';
import { Dashboard, Bookings, Customers, Technicians, Services, Inventory, Payments, Reports, Offers, Settings } from './pages.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'customers', label: 'Customers', icon: '☺' },
  { id: 'technicians', label: 'Technicians', icon: '🔧' },
  { id: 'bookings', label: 'Bookings', icon: '📅' },
  { id: 'services', label: 'Service Categories', icon: '▤' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'payments', label: 'Payments', icon: '₹' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'offers', label: 'Offers & Coupons', icon: '🏷' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];
const SESSION = 'clickfix.admin.session';

/* Demo-only gate. A password check in browser code is NOT security — replace with real server auth. */
function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(false);
  const submit = e => { e.preventDefault();
    if (email.trim().toLowerCase() === 'admin@clickfix.in' && pw === 'admin123') onLogin(); else setErr(true); };
  return <div className="login-bg"><form className="login" onSubmit={submit}>
    <img src={logo} alt="Click & Fix" className="login-logo" />
    <h1>Admin sign in</h1><p>Complete business control</p>
    <label>Email<input className="inp" type="email" autoFocus value={email} onChange={e => { setEmail(e.target.value); setErr(false); }} /></label>
    <label>Password<input className="inp" type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} /></label>
    {err && <div className="err">Incorrect email or password.</div>}
    <button className="btn primary" type="submit">Sign in</button>
    <small className="hint">Demo login: <b>admin@clickfix.in</b> / <b>admin123</b><br />Client-side only — add real authentication before going live.</small>
  </form></div>;
}

const readHash = () => { const h = window.location.hash.replace('#', ''); return NAV.some(n => n.id === h) ? h : 'dashboard'; };

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION) === '1');
  const [page, setPage] = useState(readHash);
  const [open, setOpen] = useState(false);
  const bookings = useStore(s => s.bookings);
  const waiting = bookings.filter(b => b.status === STATUS.CONFIRMED).length;

  useEffect(() => { const on = () => setPage(readHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const go = id => { window.location.hash = id; setPage(id); setOpen(false); window.scrollTo(0, 0); };
  const login = () => { sessionStorage.setItem(SESSION, '1'); setAuthed(true); };
  const logout = () => { sessionStorage.removeItem(SESSION); setAuthed(false); };

  if (!authed) return <Login onLogin={login} />;

  const View = { dashboard: Dashboard, customers: Customers, technicians: Technicians, bookings: Bookings, services: Services,
    inventory: Inventory, payments: Payments, reports: Reports, offers: Offers, settings: Settings }[page];

  return <div className="shell">
    <aside className={'side ' + (open ? 'open' : '')}>
      <div className="logo-box"><img src={logo} alt="Click & Fix" /></div>
      <nav>{NAV.map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
        <span>{n.icon}</span>{n.label}{n.id === 'bookings' && waiting > 0 && <i className="badge">{waiting}</i>}</button>)}
        <button className="logout" onClick={logout}><span>⎋</span>Logout</button></nav>
    </aside>
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <div className="main">
      <header className="top"><button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button><span className="grow" />
        <span className="welcome">Welcome, Admin</span><div className="ava">{initials('Admin User')}</div></header>
      <View go={go} />
    </div>
  </div>;
}
