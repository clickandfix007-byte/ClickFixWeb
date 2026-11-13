import React, { useMemo, useState } from 'react';
import { useStore, actions, STATUS, NO_TECH } from '../shared/store.js';
import { money, niceDate, addDays, isoLocal, initials, downloadCsv, longDate } from '../shared/utils.js';
import { LineChart, Donut, Bars } from './charts.jsx';

const PILL = { [STATUS.CONFIRMED]: 'blue', [STATUS.ASSIGNED]: 'amber', [STATUS.ON_WAY]: 'sky', [STATUS.PROGRESS]: 'sky', [STATUS.DONE]: 'green', [STATUS.CANCELLED]: 'red' };
export const Pill = ({ status, text }) => <span className={'pill ' + (PILL[status] || 'blue')}>{text || status}</span>;
const Card = ({ title, action, children, className = '' }) => <section className={'card ' + className}>
  {(title || action) && <div className="card-head"><h3>{title}</h3>{action}</div>}{children}</section>;
const Empty = ({ children }) => <div className="empty">{children}</div>;
const Page = ({ title, sub, children, right }) => <div className="page">
  <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{right}</div>{children}</div>;
const Kpi = ({ color, icon, label, value, note }) => <div className={'kpi ' + color}><span className="kpi-ic">{icon}</span>
  <div><small>{label}</small><b>{value}</b><em>{note}</em></div></div>;
const delta = (cur, prev) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));
const arrow = d => (d >= 0 ? '↑ ' : '↓ ') + Math.abs(d) + '%';
const day = iso => (iso || '').slice(0, 10);

/* ---------- shared: technician assignment cell ---------- */
function AssignCell({ b, technicians }) {
  if (b.status === STATUS.CANCELLED || b.status === STATUS.DONE) return <span>{b.techId ? b.technician : '—'}</span>;
  if (b.techId) return <div className="stack"><b>{b.technician}</b>
    <small className={b.techResponse === 'pending' ? 'warn' : ''}>{b.techResponse === 'pending' ? 'Awaiting acceptance' : b.status}</small>
    {b.status === STATUS.ASSIGNED && <button className="link" onClick={() => actions.unassign(b.id)}>Unassign</button>}</div>;
  const opts = technicians.filter(t => t.active)
    .sort((a, c) => Number(c.skills.includes(b.serviceId)) - Number(a.skills.includes(b.serviceId)) || Number(c.online) - Number(a.online));
  return <select className="sel" value="" onChange={e => e.target.value && actions.assign(b.id, e.target.value)} aria-label={'Assign technician for ' + b.id}>
    <option value="">Assign technician…</option>
    {opts.map(t => <option key={t.id} value={t.id}>{t.name} {t.online ? '● online' : '○ offline'}{t.skills.includes(b.serviceId) ? ' ✓ skill' : ''}{(b.rejectedBy || []).includes(t.id) ? ' (declined)' : ''}</option>)}
  </select>;
}

/* ================= Dashboard ================= */
export function Dashboard({ go }) {
  const { bookings, payments, technicians, services } = useStore();
  const today = isoLocal(), d30 = addDays(today, -30), d60 = addDays(today, -60);
  const inRange = (iso, from, to) => iso >= from && iso <= to;
  const created = b => day(b.createdAt);

  const cur = bookings.filter(b => inRange(created(b), d30, today)).length;
  const prev = bookings.filter(b => inRange(created(b), d60, addDays(d30, -1))).length;
  const doneCur = bookings.filter(b => b.status === STATUS.DONE && inRange(day(b.completedAt), d30, today)).length;
  const donePrev = bookings.filter(b => b.status === STATUS.DONE && inRange(day(b.completedAt), d60, addDays(d30, -1))).length;
  const revCur = payments.filter(p => inRange(p.dateISO, d30, today)).reduce((a, p) => a + p.amount, 0);
  const revPrev = payments.filter(p => inRange(p.dateISO, d60, addDays(d30, -1))).reduce((a, p) => a + p.amount, 0);
  const pending = bookings.filter(b => b.status === STATUS.CONFIRMED || b.status === STATUS.ASSIGNED);
  const unassigned = bookings.filter(b => b.status === STATUS.CONFIRMED);

  const months = useMemo(() => {
    const out = []; const base = new Date(); base.setDate(1);
    for (let i = 5; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: d.toLocaleDateString('en-US', { month: 'short' }) }); }
    return out;
  }, []);
  const trend = months.map(m => bookings.filter(b => day(b.createdAt).startsWith(m.key)).length);

  const byService = {}; bookings.forEach(b => { byService[b.service] = (byService[b.service] || 0) + 1; });
  const sorted = Object.entries(byService).sort((a, b) => b[1] - a[1]);
  const palette = ['#1d6ae5', '#17a864', '#ff9417', '#7c4dde', '#c9d4e3'];
  const parts = [...sorted.slice(0, 4).map(([label, value], i) => ({ label, value, color: palette[i] })),
    ...(sorted.length > 4 ? [{ label: 'Others', value: sorted.slice(4).reduce((a, [, v]) => a + v, 0), color: palette[4] }] : [])];

  const recent = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const top = technicians.map(t => ({ ...t, jobs: bookings.filter(b => b.techId === t.id && b.status === STATUS.DONE).length }))
    .sort((a, b) => b.jobs - a.jobs).slice(0, 4);

  return <Page title="Dashboard" sub="Complete business control at a glance.">
    <div className="kpis">
      <Kpi color="blue" icon="📅" label="Total Bookings" value={bookings.length.toLocaleString('en-IN')} note={arrow(delta(cur, prev)) + ' vs prev 30 days'} />
      <Kpi color="green" icon="✔" label="Completed Jobs" value={bookings.filter(b => b.status === STATUS.DONE).length.toLocaleString('en-IN')} note={arrow(delta(doneCur, donePrev)) + ' vs prev 30 days'} />
      <Kpi color="purple" icon="₹" label="Revenue" value={money(payments.reduce((a, p) => a + p.amount, 0))} note={arrow(delta(revCur, revPrev)) + ' vs prev 30 days'} />
      <Kpi color="orange" icon="⏳" label="Pending Jobs" value={pending.length} note={unassigned.length + ' need a technician'} />
    </div>

    <div className="grid-2">
      <Card title="Bookings Trend"><LineChart labels={months.map(m => m.label)} values={trend} /></Card>
      <Card title="Services"><Donut parts={parts} /></Card>
    </div>

    {unassigned.length > 0 && <Card title={`Awaiting assignment (${unassigned.length})`} action={<button className="link" onClick={() => go('bookings')}>Open bookings →</button>}>
      <div className="tbl-wrap"><table className="tbl"><tbody>{unassigned.slice(0, 5).map(b => <tr key={b.id}>
        <td><b>#{b.id}</b></td><td>{b.icon} {b.service}</td><td>{niceDate(b.date)}, {b.time}</td><td>{b.address}</td>
        <td style={{ minWidth: 200 }}><AssignCell b={b} technicians={technicians} /></td></tr>)}</tbody></table></div></Card>}

    <div className="grid-2 wide-left">
      <Card title="Recent Bookings" action={<button className="link" onClick={() => go('bookings')}>View All →</button>}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Service</th><th>Area</th><th>When</th><th>Status</th></tr></thead>
          <tbody>{recent.map(b => <tr key={b.id}><td><b>#{b.id}</b></td><td>{b.service}</td><td>{b.address.split(',')[0]}</td><td>{niceDate(b.date)}</td><td><Pill status={b.status} /></td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Top Technicians" action={<button className="link" onClick={() => go('technicians')}>View All →</button>}>
        {top.map(t => <div className="person" key={t.id}><div className="ava">{initials(t.name)}</div>
          <div><b>{t.name}</b><small>{t.jobs} Jobs</small></div><span className="star">★ {t.rating}</span></div>)}
      </Card>
    </div>
  </Page>;
}

/* ================= Bookings ================= */
export function Bookings() {
  const { bookings, technicians } = useStore();
  const [status, setStatus] = useState('All'); const [q, setQ] = useState(''); const [limit, setLimit] = useState(15);
  const list = useMemo(() => bookings.filter(b => (status === 'All' || b.status === status) &&
    (b.id + b.customerName + b.service + b.address).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [bookings, status, q]);
  return <Page title="Bookings" sub="Assign technicians and follow every job." right={
    <button className="btn" onClick={() => downloadCsv('bookings.csv', [['ID', 'Customer', 'Service', 'Date', 'Time', 'Address', 'Technician', 'Status', 'Amount'],
      ...list.map(b => [b.id, b.customerName, b.service, b.date, b.time, b.address, b.techId ? b.technician : '', b.status, b.amount])])}>⬇ Export CSV</button>}>
    <Card>
      <div className="filters"><input className="inp" placeholder="Search ID, customer, service, area…" value={q} onChange={e => { setQ(e.target.value); setLimit(15); }} />
        <select className="sel" value={status} onChange={e => { setStatus(e.target.value); setLimit(15); }}><option>All</option>{Object.values(STATUS).map(s => <option key={s}>{s}</option>)}</select>
        <span className="muted">{list.length} bookings</span></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>When</th><th>Address</th><th>Technician</th><th>Status</th><th>Amount</th><th /></tr></thead>
        <tbody>{list.slice(0, limit).map(b => <tr key={b.id}>
          <td><b>#{b.id}</b></td><td>{b.customerName}<small className="sub">{b.customerPhone}</small></td><td>{b.icon} {b.service}</td>
          <td>{niceDate(b.date)}<small className="sub">{b.time}</small></td><td className="addr">{b.address}</td>
          <td style={{ minWidth: 190 }}><AssignCell b={b} technicians={technicians} /></td><td><Pill status={b.status} /></td><td><b>{money(b.amount)}</b></td>
          <td>{(b.status === STATUS.CONFIRMED || b.status === STATUS.ASSIGNED) && <button className="link danger" onClick={() => window.confirm('Cancel booking #' + b.id + '?') && actions.cancel(b.id)}>Cancel</button>}</td></tr>)}</tbody></table></div>
      {!list.length && <Empty>No bookings match.</Empty>}
      {list.length > limit && <button className="btn ghost center" onClick={() => setLimit(limit + 20)}>Show more</button>}
    </Card>
  </Page>;
}

/* ================= Customers ================= */
export function Customers() {
  const { customers, bookings } = useStore(); const [q, setQ] = useState('');
  const rows = customers.map(c => { const mine = bookings.filter(b => b.customerId === c.id);
    return { ...c, count: mine.length, spent: mine.filter(b => b.status === STATUS.DONE).reduce((a, b) => a + b.amount, 0), last: mine.map(b => b.date).sort().pop() }; })
    .filter(c => (c.name + c.phone + c.email).toLowerCase().includes(q.toLowerCase()));
  return <Page title="Customers" sub="Everyone who has booked with Click & Fix.">
    <Card><div className="filters"><input className="inp" placeholder="Search name, phone, email…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Address</th><th>Bookings</th><th>Spent</th><th>Last booking</th></tr></thead>
        <tbody>{rows.map(c => <tr key={c.id}><td><div className="person"><div className="ava">{initials(c.name)}</div><b>{c.name}</b></div></td><td>{c.phone}</td><td>{c.email}</td><td>{c.address}</td>
          <td>{c.count}</td><td><b>{money(c.spent)}</b></td><td>{c.last ? niceDate(c.last) : '—'}</td></tr>)}</tbody></table></div>
      {!rows.length && <Empty>No customers found.</Empty>}</Card>
  </Page>;
}

/* ================= Technicians ================= */
export function Technicians() {
  const { technicians, bookings, services } = useStore();
  const empty = { name: '', phone: '', area: '', skills: [] };
  const [f, setF] = useState(empty); const [err, setErr] = useState('');
  const add = e => { e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) { setErr('Name and phone are required.'); return; }
    actions.addTechnician({ ...f, name: f.name.trim(), phone: f.phone.trim(), area: f.area.trim() || 'Bengaluru' }); setF(empty); setErr(''); };
  const toggle = id => setF(p => ({ ...p, skills: p.skills.includes(id) ? p.skills.filter(s => s !== id) : [...p.skills, id] }));
  return <Page title="Technicians" sub="Your field team and their availability.">
    <Card><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Technician</th><th>Phone</th><th>Area</th><th>Skills</th><th>Rating</th><th>Done</th><th>Active jobs</th><th>Availability</th><th>Account</th></tr></thead>
      <tbody>{technicians.map(t => { const done = bookings.filter(b => b.techId === t.id && b.status === STATUS.DONE).length;
        const act = bookings.filter(b => b.techId === t.id && [STATUS.ASSIGNED, STATUS.ON_WAY, STATUS.PROGRESS].includes(b.status)).length;
        return <tr key={t.id} className={t.active ? '' : 'dim'}><td><div className="person"><div className="ava">{initials(t.name)}</div><b>{t.name}</b></div></td><td>{t.phone}</td><td>{t.area}</td>
          <td className="skills">{t.skills.map(s => services.find(x => x.id === s)?.icon).join(' ') || '—'}</td><td>★ {t.rating}</td><td>{done}</td><td>{act}</td>
          <td><span className={'pill ' + (t.online ? 'green' : 'grey')}>{t.online ? 'Online' : 'Offline'}</span></td>
          <td><button className={'link ' + (t.active ? 'danger' : '')} onClick={() => actions.updateTechnician(t.id, { active: !t.active, online: t.active ? false : t.online })}>{t.active ? 'Suspend' : 'Reactivate'}</button></td></tr>; })}</tbody></table></div></Card>
    <Card title="Add technician"><form className="form-grid" onSubmit={add}>
      <label>Full name<input className="inp" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label>Phone<input className="inp" value={f.phone} placeholder="+91 …" onChange={e => setF({ ...f, phone: e.target.value })} /></label>
      <label>Area<input className="inp" value={f.area} placeholder="e.g. Whitefield" onChange={e => setF({ ...f, area: e.target.value })} /></label>
      <div className="full"><small className="lbl">SKILLS</small><div className="chips">{services.map(s => <button type="button" key={s.id} className={'chip ' + (f.skills.includes(s.id) ? 'on' : '')} onClick={() => toggle(s.id)}>{s.icon} {s.name}</button>)}</div></div>
      <div className="full row-end">{err && <span className="err">{err}</span>}<button className="btn primary" type="submit">Add technician</button></div></form></Card>
  </Page>;
}

/* ================= Service categories ================= */
export function Services() {
  const { services, bookings } = useStore();
  const [f, setF] = useState({ name: '', category: 'Repair', price: '', icon: '🛠️' });
  const cats = [...new Set(services.map(s => s.category))];
  const add = e => { e.preventDefault(); if (!f.name.trim() || !Number(f.price)) return;
    actions.addService({ name: f.name.trim(), category: f.category.trim() || 'Other', price: Number(f.price), icon: f.icon || '🛠️', desc: 'New service' }); setF({ ...f, name: '', price: '' }); };
  return <Page title="Service Categories" sub="Prices and availability update instantly in the customer app.">
    <Card><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Service</th><th>Category</th><th>Starting price (₹)</th><th>ETA</th><th>Bookings</th><th>Visible to customers</th></tr></thead>
      <tbody>{services.map(s => <tr key={s.id} className={s.active ? '' : 'dim'}><td><b>{s.icon} {s.name}</b><small className="sub">{s.desc}</small></td><td>{s.category}</td>
        <td><input className="inp small" type="number" min="0" defaultValue={s.price} key={s.id + s.price} onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== s.price) actions.updateService(s.id, { price: v }); }} /></td>
        <td>{s.eta}</td><td>{bookings.filter(b => b.serviceId === s.id).length}</td>
        <td><button className={'switch ' + (s.active ? 'on' : '')} aria-label={'Toggle ' + s.name} onClick={() => actions.updateService(s.id, { active: !s.active })} /></td></tr>)}</tbody></table></div></Card>
    <Card title="Add a service"><form className="form-grid" onSubmit={add}>
      <label>Name<input className="inp" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label>Category<input className="inp" list="cats" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /><datalist id="cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
      <label>Starting price (₹)<input className="inp" type="number" min="1" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></label>
      <label>Icon (emoji)<input className="inp" value={f.icon} maxLength="4" onChange={e => setF({ ...f, icon: e.target.value })} /></label>
      <div className="full row-end"><button className="btn primary" type="submit">Add service</button></div></form></Card>
  </Page>;
}

/* ================= Inventory ================= */
export function Inventory() {
  const { inventory } = useStore();
  const [f, setF] = useState({ name: '', sku: '', qty: '', min: '5', cost: '' });
  const low = inventory.filter(i => i.qty <= i.min);
  const value = inventory.reduce((a, i) => a + i.qty * i.cost, 0);
  const add = e => { e.preventDefault(); if (!f.name.trim()) return;
    actions.addItem({ name: f.name.trim(), sku: f.sku.trim() || '—', qty: Number(f.qty) || 0, min: Number(f.min) || 0, cost: Number(f.cost) || 0 }); setF({ name: '', sku: '', qty: '', min: '5', cost: '' }); };
  return <Page title="Inventory" sub="Spare parts and consumables used on jobs.">
    <div className="kpis three">
      <Kpi color="blue" icon="📦" label="Items" value={inventory.length} note="tracked parts" />
      <Kpi color={low.length ? 'orange' : 'green'} icon="⚠" label="Low stock" value={low.length} note={low.length ? low.map(i => i.sku).join(', ') : 'all good'} />
      <Kpi color="purple" icon="₹" label="Stock value" value={money(value)} note="at cost" />
    </div>
    <Card><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Item</th><th>SKU</th><th>In stock</th><th>Reorder at</th><th>Cost</th><th>Value</th><th>Status</th><th /></tr></thead>
      <tbody>{inventory.map(i => <tr key={i.id}><td><b>{i.name}</b></td><td>{i.sku}</td>
        <td><div className="qty"><button onClick={() => actions.adjustStock(i.id, -1)} aria-label="Decrease">−</button><b>{i.qty}</b><button onClick={() => actions.adjustStock(i.id, 1)} aria-label="Increase">+</button></div></td>
        <td>{i.min}</td><td>{money(i.cost)}</td><td>{money(i.qty * i.cost)}</td>
        <td><span className={'pill ' + (i.qty <= i.min ? 'amber' : 'green')}>{i.qty === 0 ? 'Out of stock' : i.qty <= i.min ? 'Low stock' : 'In stock'}</span></td>
        <td><button className="link danger" onClick={() => window.confirm('Remove ' + i.name + '?') && actions.removeItem(i.id)}>Remove</button></td></tr>)}</tbody></table></div></Card>
    <Card title="Add inventory item"><form className="form-grid" onSubmit={add}>
      <label>Item name<input className="inp" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label>SKU<input className="inp" value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></label>
      <label>Quantity<input className="inp" type="number" min="0" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} /></label>
      <label>Reorder at<input className="inp" type="number" min="0" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} /></label>
      <label>Unit cost (₹)<input className="inp" type="number" min="0" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></label>
      <div className="full row-end"><button className="btn primary" type="submit">Add item</button></div></form></Card>
  </Page>;
}

/* ================= Payments ================= */
export function Payments() {
  const { payments } = useStore();
  const total = payments.reduce((a, p) => a + p.amount, 0);
  const by = m => payments.filter(p => p.method === m).reduce((a, p) => a + p.amount, 0);
  return <Page title="Payments" sub="Every completed job creates a payment record." right={
    <button className="btn" onClick={() => downloadCsv('payments.csv', [['Payment ID', 'Booking', 'Service', 'Date', 'Method', 'Status', 'Amount'],
      ...payments.map(p => [p.id, p.bookingId, p.title, p.dateISO, p.method, p.status, p.amount])])}>⬇ Export CSV</button>}>
    <div className="kpis three"><Kpi color="purple" icon="₹" label="Total collected" value={money(total)} note={payments.length + ' payments'} />
      <Kpi color="blue" icon="📲" label="UPI + Card" value={money(by('UPI') + by('Card'))} note="digital" /><Kpi color="orange" icon="💵" label="Cash" value={money(by('Cash'))} note="collected by technicians" /></div>
    <Card title="Latest payments"><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Payment</th><th>Booking</th><th>Service</th><th>Date</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
      <tbody>{payments.slice(0, 25).map(p => <tr key={p.id}><td><b>{p.id}</b></td><td>#{p.bookingId}</td><td>{p.title}</td><td>{longDate(p.dateISO)}</td><td>{p.method}</td>
        <td><span className="pill green">{p.status}</span></td><td><b>{money(p.amount)}</b></td></tr>)}</tbody></table></div>
      {!payments.length && <Empty>No payments yet.</Empty>}</Card>
    <p className="note">ℹ️ Demo data. Connect a payment gateway (e.g. Razorpay) and verify payments on your server before treating them as real.</p>
  </Page>;
}

/* ================= Reports ================= */
export function Reports() {
  const { bookings, payments, settings } = useStore();
  const revenue = {}; bookings.filter(b => b.status === STATUS.DONE).forEach(b => { revenue[b.service] = (revenue[b.service] || 0) + b.amount; });
  const revItems = Object.entries(revenue).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  const statusParts = Object.values(STATUS).map((s, i) => ({ label: s, value: bookings.filter(b => b.status === s).length, color: ['#1d6ae5', '#ff9417', '#0aa5e0', '#7c4dde', '#17a864', '#d93b3b'][i] })).filter(p => p.value);
  const months = []; const base = new Date(); base.setDate(1);
  for (let i = 5; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value: payments.filter(p => p.dateISO.startsWith(key)).reduce((a, p) => a + p.amount, 0) }); }
  const gross = payments.reduce((a, p) => a + p.amount, 0);
  const payout = Math.round(gross * settings.payoutPercent / 100);
  return <Page title="Reports" sub="Revenue, workload and payouts.">
    <div className="kpis three"><Kpi color="purple" icon="₹" label="Gross revenue" value={money(gross)} note="all time" />
      <Kpi color="green" icon="🧰" label={`Technician payouts (${settings.payoutPercent}%)`} value={money(payout)} note="owed to the field team" />
      <Kpi color="blue" icon="📈" label="Company share" value={money(gross - payout)} note={(100 - settings.payoutPercent) + '% margin before costs'} /></div>
    <div className="grid-2">
      <Card title="Revenue by month"><LineChart labels={months.map(m => m.label)} values={months.map(m => Math.round(m.value / 100) / 10)} color="#17a864" /><p className="note">Values in ₹ thousands.</p></Card>
      <Card title="Bookings by status"><Donut parts={statusParts} /></Card>
    </div>
    <Card title="Revenue by service (completed jobs)"><Bars items={revItems} format={money} color="#7c4dde" />{!revItems.length && <Empty>No completed jobs yet.</Empty>}</Card>
  </Page>;
}

/* ================= Offers & coupons ================= */
export function Offers() {
  const { coupons } = useStore();
  const [f, setF] = useState({ code: '', percent: '10', desc: '' }); const [err, setErr] = useState('');
  const add = e => { e.preventDefault(); const pct = Number(f.percent);
    if (!/^[A-Za-z0-9]{3,16}$/.test(f.code.trim())) { setErr('Code must be 3–16 letters or numbers.'); return; }
    if (!(pct >= 1 && pct <= 90)) { setErr('Discount must be between 1% and 90%.'); return; }
    actions.addCoupon({ code: f.code, percent: pct, desc: f.desc.trim() || pct + '% off' }); setF({ code: '', percent: '10', desc: '' }); setErr(''); };
  return <Page title="Offers & Coupons" sub="Customers enter these codes on the booking form.">
    <Card><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Code</th><th>Discount</th><th>Description</th><th>Active</th><th /></tr></thead>
      <tbody>{coupons.map(c => <tr key={c.code} className={c.active ? '' : 'dim'}><td><b className="code">{c.code}</b></td><td>{c.percent}%</td><td>{c.desc}</td>
        <td><button className={'switch ' + (c.active ? 'on' : '')} aria-label={'Toggle ' + c.code} onClick={() => actions.toggleCoupon(c.code)} /></td>
        <td><button className="link danger" onClick={() => actions.removeCoupon(c.code)}>Delete</button></td></tr>)}</tbody></table></div>
      {!coupons.length && <Empty>No coupons yet.</Empty>}</Card>
    <Card title="Create coupon"><form className="form-grid" onSubmit={add}>
      <label>Code<input className="inp" value={f.code} placeholder="SUMMER20" onChange={e => setF({ ...f, code: e.target.value })} /></label>
      <label>Discount (%)<input className="inp" type="number" min="1" max="90" value={f.percent} onChange={e => setF({ ...f, percent: e.target.value })} /></label>
      <label className="full">Description<input className="inp" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></label>
      <div className="full row-end">{err && <span className="err">{err}</span>}<button className="btn primary" type="submit">Create coupon</button></div></form></Card>
  </Page>;
}

/* ================= Settings ================= */
export function Settings() {
  const { settings } = useStore();
  const [f, setF] = useState(settings); const [saved, setSaved] = useState(false);
  const save = e => { e.preventDefault(); const pct = Number(f.payoutPercent);
    actions.updateSettings({ ...f, payoutPercent: pct >= 0 && pct <= 100 ? pct : settings.payoutPercent }); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return <Page title="Settings" sub="Business details and payout rules.">
    <Card title="Business"><form className="form-grid" onSubmit={save}>
      <label>Business name<input className="inp" value={f.businessName} onChange={e => setF({ ...f, businessName: e.target.value })} /></label>
      <label>City<input className="inp" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></label>
      <label>Support phone<input className="inp" value={f.supportPhone} onChange={e => setF({ ...f, supportPhone: e.target.value })} /></label>
      <label>Technician payout (% of job value)<input className="inp" type="number" min="0" max="100" value={f.payoutPercent} onChange={e => setF({ ...f, payoutPercent: e.target.value })} /></label>
      <div className="full row-end">{saved && <span className="ok">✓ Saved</span>}<button className="btn primary" type="submit">Save settings</button></div></form></Card>
    <Card title="Demo data"><p className="note" style={{ marginTop: 0 }}>All data in this demo lives in this browser (localStorage), shared by the customer, technician and admin pages. Resetting restores the sample bookings, technicians and history.</p>
      <button className="btn danger" onClick={() => window.confirm('Reset all demo data?') && actions.resetDemo()}>Reset demo data</button></Card>
  </Page>;
}
