import { useSyncExternalStore } from 'react';
import { buildSeed, STATUS, NO_TECH } from './seed.js';
import { isoLocal, longDate } from './utils.js';

export { STATUS, NO_TECH, CUSTOMER_ID } from './seed.js';

/**
 * Tiny shared data store.
 *
 * Data lives in localStorage, so the customer, technician and admin apps (same origin, different
 * pages/tabs) see each other's changes live through the `storage` event. This is demo plumbing:
 * replace the body of each action with an API call when you have a backend.
 */
const KEY = 'clickfix.web.v1';
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) return s; }
  } catch { /* ignore */ }
  const s = buildSeed();
  persist(s);
  return s;
}
function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full / blocked */ } }
function emit() { listeners.forEach(l => l()); }
function update(fn) { state = fn(state); persist(state); emit(); }

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) { try { state = JSON.parse(e.newValue); emit(); } catch { /* ignore */ } }
  });
}

const subscribe = cb => { listeners.add(cb); return () => listeners.delete(cb); };
const getState = () => state;

/** Re-renders on any change. `selector` just picks/derives data (it may return new arrays). */
export function useStore(selector) {
  const s = useSyncExternalStore(subscribe, getState);
  return selector ? selector(s) : s;
}

const patchBooking = (id, fn) => update(s => ({ ...s, bookings: s.bookings.map(b => (b.id === id ? fn(b) : b)) }));
const uid = p => p + Math.floor(10000 + Math.random() * 89999);

export const actions = {
  /* ---------- customer ---------- */
  createBooking(input) {
    const booking = {
      id: uid('CAF'), serviceId: input.serviceId, service: input.service, icon: input.icon,
      date: input.date, time: input.time, address: input.address, notes: input.notes || '', payment: input.payment || 'UPI',
      status: STATUS.CONFIRMED, amount: input.amount, techId: null, technician: NO_TECH, phone: '—', techResponse: null, rejectedBy: [],
      customerId: input.customerId, customerName: input.customerName, customerPhone: input.customerPhone,
      coupon: input.coupon || null, createdAt: new Date().toISOString(),
    };
    update(s => ({ ...s, bookings: [booking, ...s.bookings] }));
    return booking;
  },
  cancel(id) { patchBooking(id, b => ({ ...b, status: STATUS.CANCELLED, techResponse: null })); },

  /* ---------- admin dispatch ---------- */
  assign(id, techId) {
    update(s => {
      const t = s.technicians.find(x => x.id === techId);
      if (!t) return s;
      return { ...s, bookings: s.bookings.map(b => (b.id === id
        ? { ...b, status: STATUS.ASSIGNED, techId: t.id, technician: t.name, phone: t.phone, techResponse: 'pending' } : b)) };
    });
  },
  unassign(id) {
    patchBooking(id, b => ({ ...b, status: STATUS.CONFIRMED, techId: null, technician: NO_TECH, phone: '—', techResponse: null }));
  },

  /* ---------- technician ---------- */
  accept(id) { patchBooking(id, b => ({ ...b, techResponse: 'accepted' })); },
  reject(id) {
    patchBooking(id, b => ({
      ...b, status: STATUS.CONFIRMED, techId: null, technician: NO_TECH, phone: '—', techResponse: null,
      rejectedBy: [...(b.rejectedBy || []), b.techId],
    }));
  },
  setStatus(id, status) {
    update(s => {
      const fallback = s.technicians.find(t => t.active) || s.technicians[0];
      return {
        ...s,
        bookings: s.bookings.map(b => {
          if (b.id !== id) return b;
          const next = { ...b, status };
          // demo helper: a customer-side "Technician assigned" with nobody assigned picks a technician
          if (status === STATUS.ASSIGNED && !b.techId && fallback) {
            Object.assign(next, { techId: fallback.id, technician: fallback.name, phone: fallback.phone, techResponse: 'accepted' });
          }
          return next;
        }),
      };
    });
  },
  complete(id, amount) {
    update(s => {
      const b = s.bookings.find(x => x.id === id);
      if (!b || b.status === STATUS.DONE) return s;
      const final = Number(amount) > 0 ? Number(amount) : b.amount;
      const today = isoLocal();
      const payment = {
        id: uid('PAY'), bookingId: id, title: b.service, date: longDate(today), dateISO: today, amount: final, method: b.payment,
        status: b.payment === 'Cash' ? 'Cash collected' : 'Paid', customerId: b.customerId,
      };
      return {
        ...s,
        bookings: s.bookings.map(x => (x.id === id ? { ...x, status: STATUS.DONE, amount: final, completedAt: new Date().toISOString() } : x)),
        payments: [payment, ...s.payments],
      };
    });
  },
  setOnline(techId, online) {
    update(s => ({ ...s, technicians: s.technicians.map(t => (t.id === techId ? { ...t, online } : t)) }));
  },

  /* ---------- admin: technicians ---------- */
  addTechnician(t) {
    update(s => ({ ...s, technicians: [...s.technicians, { id: uid('t'), rating: 4.5, online: false, active: true, skills: [], ...t }] }));
  },
  updateTechnician(id, patch) {
    update(s => ({ ...s, technicians: s.technicians.map(t => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  /* ---------- admin: services ---------- */
  updateService(id, patch) {
    update(s => ({ ...s, services: s.services.map(x => (x.id === id ? { ...x, ...patch } : x)) }));
  },
  addService(svc) {
    update(s => ({ ...s, services: [...s.services, { id: 'svc' + Date.now(), active: true, icon: '🛠️', eta: 'Scheduled', ...svc }] }));
  },

  /* ---------- admin: inventory ---------- */
  adjustStock(id, delta) {
    update(s => ({ ...s, inventory: s.inventory.map(i => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)) }));
  },
  addItem(item) { update(s => ({ ...s, inventory: [...s.inventory, { id: uid('i'), qty: 0, min: 5, cost: 0, ...item }] })); },
  removeItem(id) { update(s => ({ ...s, inventory: s.inventory.filter(i => i.id !== id) })); },

  /* ---------- admin: coupons ---------- */
  addCoupon(c) {
    update(s => ({ ...s, coupons: [{ active: true, ...c, code: c.code.trim().toUpperCase() }, ...s.coupons.filter(x => x.code !== c.code.trim().toUpperCase())] }));
  },
  toggleCoupon(code) { update(s => ({ ...s, coupons: s.coupons.map(c => (c.code === code ? { ...c, active: !c.active } : c)) })); },
  removeCoupon(code) { update(s => ({ ...s, coupons: s.coupons.filter(c => c.code !== code) })); },

  /* ---------- admin: settings ---------- */
  updateSettings(patch) { update(s => ({ ...s, settings: { ...s.settings, ...patch } })); },
  resetDemo() { state = buildSeed(); persist(state); emit(); },
};
