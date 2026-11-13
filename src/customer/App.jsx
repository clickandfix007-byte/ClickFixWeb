import React, { useMemo, useState } from 'react';
import { useStore, actions, STATUS, CUSTOMER_ID } from '../shared/store.js';
import { niceDate, isoLocal } from '../shared/utils.js';
import logo from '../shared/logo.png';

const money = n => '₹' + Number(n).toLocaleString('en-IN');
const STAGES = [STATUS.CONFIRMED, STATUS.ASSIGNED, STATUS.ON_WAY, STATUS.PROGRESS, STATUS.DONE];
const STAGE_NOTES = ['We received your request','Your professional is matched','Technician is heading to you','Work has started','Job completed successfully'];
const navItems = [{id:'home',label:'Home',icon:'⌂'},{id:'bookings',label:'Bookings',icon:'▣'},{id:'track',label:'Track',icon:'⌖'},{id:'payments',label:'Payments',icon:'₹'},{id:'profile',label:'Profile',icon:'○'}];

function App(){
  const [tab,setTab] = useState('home');
  const [selected,setSelected] = useState(null);
  const [category,setCategory] = useState('All');
  const [search,setSearch] = useState('');
  const allBookings = useStore(st=>st.bookings);
  const services = useStore(st=>st.services.filter(x=>x.active));
  const coupons = useStore(st=>st.coupons);
  const paymentHistory = useStore(st=>st.payments.filter(p=>p.customerId===CUSTOMER_ID));
  const bookings = useMemo(()=>allBookings.filter(b=>b.customerId===CUSTOMER_ID),[allBookings]);
  const [activeId,setActiveId] = useState(null);
  const activeBooking = bookings.find(b=>b.id===activeId) || bookings[0] || null;
  const setActiveBooking = b => setActiveId(b ? b.id : null);
  const [toast,setToast] = useState('');
  const [form,setForm] = useState({date:isoLocal(),time:'10:00 AM',address:'',notes:'',payment:'UPI',coupon:''});
  const [profile,setProfile] = useState({name:'Alex Johnson',phone:'+91 98765 43210',email:'alex@example.com',address:'Koramangala, Bengaluru'});

  const categories = ['All','Repair','Cleaning','Home services','Vehicle care','Convenience','Plans'];
  const visibleServices = useMemo(()=>services.filter(s=>(category==='All'||s.category===category) && (s.name+' '+s.desc).toLowerCase().includes(search.toLowerCase())),[services,category,search]);
  const coupon = coupons.find(c=>c.active && c.code===form.coupon.trim().toUpperCase()) || null;
  const discount = selected && coupon ? Math.round(selected.price*coupon.percent/100) : 0;
  const notify = msg => { setToast(msg); window.clearTimeout(window.__cfToast); window.__cfToast=window.setTimeout(()=>setToast(''),2600); };
  const startBooking = service => { setSelected(service); setTab('book'); };
  const submitBooking = e => {
    e.preventDefault();
    if(!selected) return;
    if(!form.address.trim()){notify('Please enter your service address.');return;}
    const booking=actions.createBooking({serviceId:selected.id,service:selected.name,icon:selected.icon,date:form.date,time:form.time,address:form.address.trim(),notes:form.notes.trim(),payment:form.payment,amount:selected.price-discount,coupon:coupon?coupon.code:null,customerId:CUSTOMER_ID,customerName:profile.name,customerPhone:profile.phone});
    setActiveBooking(booking); setSelected(null); setTab('bookings');
    notify('Your service request has been placed!');
  };
  const updateBookingStatus = status => {
    if(!activeBooking) return;
    actions.setStatus(activeBooking.id,status);
    notify('Booking status updated.');
  };

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setTab('home')} aria-label="Click and Fix home"><img className="brand-logo" src={logo} alt="Click & Fix"/><small className="brand-sub">DOORSTEP SERVICES</small></button>
      <div className="top-actions"><span className="location-pill">📍 Bengaluru</span><button className="icon-btn" onClick={()=>notify('You’re all caught up!')} aria-label="Notifications">♧<i/></button><div className="avatar">AJ</div></div>
    </header>

    <main>
      {tab==='home' && <section className="page">
        <div className="welcome-row"><div><p className="eyebrow">WELCOME TO CLICK & FIX</p><h1>Hi, {profile.name.split(' ')[0]} 👋</h1><p className="muted">What can we help you fix today?</p></div><div className="welcome-art">🛠️</div></div>
        <div className="hero"><div className="hero-copy"><span className="hero-tag">ONE APP. EVERYDAY HELP.</span><h2>Expert help, <em>right at your doorstep.</em></h2><p>Book, track and manage trusted local services in a few taps.</p><button className="primary-btn" onClick={()=>document.getElementById('service-list')?.scrollIntoView({behavior:'smooth'})}>Explore services <b>→</b></button></div><div className="hero-visual"><div className="hero-circle">🔧</div><span className="spark s1">✦</span><span className="spark s2">✦</span><span className="hero-chip">✓ Verified professionals</span></div></div>
        <div className="section-head"><div><p className="eyebrow">MADE EASY FOR YOU</p><h2>Our services</h2></div><button className="text-btn" onClick={()=>{setCategory('All');document.getElementById('service-list')?.scrollIntoView({behavior:'smooth'});}}>View all →</button></div>
        <div className="category-row">{categories.map(c=><button key={c} className={'category-chip '+(category===c?'active':'')} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div id="service-list" className="service-grid">{visibleServices.map(s=><button className="service-card" key={s.id} onClick={()=>startBooking(s)}><span className="service-icon">{s.icon}</span><strong>{s.name}</strong><small>{s.desc}</small><span className="service-bottom"><b>From {money(s.price)}</b><i>→</i></span></button>)}</div>
        <div className="promo-strip"><span>🌿</span><div><b>Repair • Reuse • Go Green</b><small>Give your technology a longer life.</small></div><span className="promo-arrow">→</span></div>
        <div className="section-head"><div><p className="eyebrow">YOUR SERVICE AT A GLANCE</p><h2>Recent booking</h2></div><button className="text-btn" onClick={()=>setTab('bookings')}>See all →</button></div>
        {bookings[0] ? <BookingMini booking={bookings[0]} onClick={()=>{setActiveBooking(bookings[0]);setTab('track')}}/> : <div className="empty-state">No bookings yet. Choose a service to get started.</div>}
      </section>}

      {tab==='book' && <section className="page narrow">
        <button className="back-link" onClick={()=>{setSelected(null);setTab('home')}}>← Back to services</button>
        <p className="eyebrow">BOOK A SERVICE</p><h1>{selected?selected.name:'Choose a service'}</h1>
        {selected ? <><div className="selected-service"><span>{selected.icon}</span><div><b>{selected.name}</b><small>{selected.desc}</small></div><strong>From {money(selected.price)}</strong></div>
        <form className="form-card" onSubmit={submitBooking}>
          <h3>Schedule your service</h3>
          <label>Preferred date<input type="date" min={isoLocal()} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required/></label>
          <label>Preferred time<select value={form.time} onChange={e=>setForm({...form,time:e.target.value})}><option>09:00 AM</option><option>10:00 AM</option><option>11:00 AM</option><option>12:00 PM</option><option>02:00 PM</option><option>03:00 PM</option><option>04:00 PM</option><option>06:00 PM</option></select></label>
          <label>Service address<textarea placeholder="House / flat, street, area, Bengaluru" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} required rows="3"/></label>
          <label>Additional instructions <span className="optional">(optional)</span><textarea placeholder="Tell us a little more about the work..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows="2"/></label>
          <label>Coupon code <span className="optional">(optional)</span><input placeholder="e.g. WELCOME10" value={form.coupon} onChange={e=>setForm({...form,coupon:e.target.value})}/></label>{form.coupon.trim()&&<small className="fine-print">{coupon?`✓ ${coupon.code} applied — ${coupon.percent}% off`:'This coupon is not valid.'}</small>}
          <div className="payment-choice"><b>Payment method</b><div className="choice-row">{['UPI','Card','Cash'].map(p=><button key={p} type="button" className={form.payment===p?'choice active':'choice'} onClick={()=>setForm({...form,payment:p})}>{p==='UPI'?'📲':p==='Card'?'💳':'💵'} {p}</button>)}</div></div>
          <div className="price-row"><span>{discount?`Estimated price (−${money(discount)})`:'Estimated starting price'}</span><b>{money(selected.price-discount)}</b></div><small className="fine-print">Final quote may vary after technician inspection. No payment is collected in this demo.</small>
          <button className="primary-btn full" type="submit">Confirm booking <span>→</span></button>
        </form></> : <div className="service-grid">{services.map(s=><button className="service-card" key={s.id} onClick={()=>setSelected(s)}><span className="service-icon">{s.icon}</span><strong>{s.name}</strong><small>{s.desc}</small><span className="service-bottom"><b>From {money(s.price)}</b><i>→</i></span></button>)}</div>}
      </section>}

      {tab==='bookings' && <section className="page"><p className="eyebrow">YOUR ACTIVITY</p><h1>My bookings</h1><p className="muted">All your service requests in one place.</p><div className="booking-list">{bookings.map(b=><BookingMini key={b.id} booking={b} onClick={()=>{setActiveBooking(b);setTab('track')}}/>)}</div>{!bookings.length&&<div className="empty-state">Your bookings will appear here.</div>}</section>}

      {tab==='track' && <section className="page narrow"><p className="eyebrow">LIVE SERVICE UPDATES</p><h1>Track your service</h1><p className="muted">Follow your booking from confirmation to completion.</p>{activeBooking?<div className="tracking-card"><div className="track-head"><div><small>BOOKING ID</small><h3>#{activeBooking.id}</h3></div><span className="status-pill">{activeBooking.status}</span></div><div className="track-service"><span>{activeBooking.icon}</span><div><b>{activeBooking.service}</b><small>{niceDate(activeBooking.date)} • {activeBooking.time}</small></div></div>{activeBooking.status===STATUS.CANCELLED ? <div className="empty-state">This booking was cancelled.</div> : <div className="timeline">{STAGES.map((step,i)=>{const current=STAGES.indexOf(activeBooking.status);return <div className={'timeline-step '+(i<=Math.max(0,current)?'done':'')} key={step}><span>{i<=Math.max(0,current)?'✓':i+1}</span><div><b>{step}</b><small>{STAGE_NOTES[i]}</small></div></div>})}</div>}<div className="address-box"><small>SERVICE ADDRESS</small><b>📍 {activeBooking.address}</b></div><div className="tech-box"><div className="tech-avatar">👨🏻‍🔧</div><div><b>{activeBooking.technician}</b><small>Click & Fix service professional</small></div>{activeBooking.phone&&activeBooking.phone!=='—'?<a className="call-btn" href={'tel:'+activeBooking.phone.replace(/[^\d+]/g,'')} aria-label="Call technician">☎</a>:<span className="call-btn" style={{opacity:.4}}>☎</span>}</div>
          {[STATUS.CONFIRMED,STATUS.ASSIGNED].includes(activeBooking.status)&&<button className="choice" style={{width:'100%',marginTop:12,color:'#c0392b'}} onClick={()=>{actions.cancel(activeBooking.id);notify('Booking cancelled.')}}>Cancel booking</button>}<div className="demo-controls"><small>DEMO: Update tracking status (normally done by the technician app)</small><div className="choice-row">{[STATUS.ASSIGNED,STATUS.ON_WAY,STATUS.PROGRESS,STATUS.DONE].map(s=><button key={s} className="choice" onClick={()=>updateBookingStatus(s)}>{s}</button>)}</div></div></div>:<div className="empty-state">Select a booking to see its tracking details.</div>}</section>}

      {tab==='payments' && <section className="page"><p className="eyebrow">PAYMENT CENTRE</p><h1>Payments</h1><p className="muted">Review your transactions and payment methods.</p><div className="wallet-card"><small>TOTAL PAID</small><h2>{money(paymentHistory.reduce((a,p)=>a+p.amount,0))}</h2><span>🔒 Secure payment experience</span></div><div className="section-head"><h2>Payment history</h2></div><div className="payment-list">{paymentHistory.map(p=><div className="payment-item" key={p.id}><span className="payment-icon">₹</span><div><b>{p.title}</b><small>{p.id} • {p.date}</small></div><div className="payment-amount"><b>{money(p.amount)}</b><small className="paid">{p.status}</small></div></div>)}</div><div className="info-note">ℹ️ Payments are in demo mode. Connect a payment gateway to accept real UPI, card or wallet payments.</div></section>}

      {tab==='profile' && <section className="page narrow"><p className="eyebrow">ACCOUNT & PREFERENCES</p><h1>My profile</h1><div className="profile-card"><div className="profile-avatar">AJ</div><h2>{profile.name}</h2><p>{profile.phone}</p><span className="verified">✓ Customer account</span></div><form className="form-card" onSubmit={e=>{e.preventDefault();notify('Profile saved successfully.')}}><h3>Personal information</h3><label>Full name<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Phone number<input value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label><label>Email address<input type="email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></label><label>Saved address<textarea rows="3" value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label><button className="primary-btn full">Save changes</button></form><div className="settings-list"><button onClick={()=>notify('Help centre coming soon.')}>💬 Help & support <span>→</span></button><button onClick={()=>notify('Terms and privacy information will appear here.')}>🔐 Privacy & terms <span>→</span></button><button onClick={()=>notify('You are safely signed in.')}>↪ Sign out <span>→</span></button></div></section>}
    </main>

    <nav className="bottom-nav">{navItems.map(n=><button key={n.id} className={tab===n.id||((tab==='book')&&n.id==='home')?'active':''} onClick={()=>{setTab(n.id);if(n.id!=='book')setSelected(null)}}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>
    {toast&&<div className="toast">✓ {toast}</div>}
  </div>
}

function BookingMini({booking,onClick}){return <button className="booking-mini" onClick={onClick}><span className="booking-icon">{booking.icon}</span><span className="booking-info"><b>{booking.service}</b><small>#{booking.id} • {niceDate(booking.date)}, {booking.time}</small><small>📍 {booking.address}</small></span><span className="booking-right"><i>{booking.status}</i><b>→</b></span></button>}
export default App;
