import { addDays, isoLocal, longDate } from './utils.js';

export const STATUS = {
  CONFIRMED: 'Booking confirmed',
  ASSIGNED: 'Technician assigned',
  ON_WAY: 'On the way',
  PROGRESS: 'Service in progress',
  DONE: 'Service completed',
  CANCELLED: 'Cancelled',
};

export const CUSTOMER_ID = 'C1';
export const NO_TECH = 'Finding a nearby technician';

const services = [
  { id: 'mobile', name: 'Mobile Repair', icon: '📱', category: 'Repair', desc: 'Screen, battery, charging and software fixes', price: 499, eta: 'Same day' },
  { id: 'laptop', name: 'Laptop Repair', icon: '💻', category: 'Repair', desc: 'Laptop diagnostics, hardware and software support', price: 699, eta: 'Same day' },
  { id: 'car', name: 'Car Wash', icon: '🚘', category: 'Cleaning', desc: 'Convenient doorstep exterior and interior cleaning', price: 399, eta: '45–60 min' },
  { id: 'bike', name: 'Bike Wash', icon: '🏍️', category: 'Cleaning', desc: 'A careful clean for your two-wheeler', price: 199, eta: '30–45 min' },
  { id: 'painter', name: 'Painter', icon: '🪣', category: 'Home services', desc: 'Freshen up walls, rooms and home surfaces', price: 999, eta: 'Inspection first' },
  { id: 'tyre', name: 'Tyre Puncture', icon: '🛞', category: 'Vehicle care', desc: 'On-site puncture assistance for your vehicle', price: 149, eta: '30–45 min' },
  { id: 'laundry', name: 'Laundry', icon: '🧺', category: 'Cleaning', desc: 'Laundry pickup, wash, fold and doorstep return', price: 99, eta: '24–48 hours' },
  { id: 'pickup', name: 'Pickup & Delivery', icon: '🚚', category: 'Convenience', desc: 'Doorstep collection and return for eligible repairs', price: 99, eta: 'Scheduled' },
  { id: 'amc', name: 'AMC Plans', icon: '🛡️', category: 'Plans', desc: 'Scheduled maintenance and priority support', price: 1499, eta: 'Annual plan' },
].map(s => ({ ...s, active: true }));

const technicians = [
  { id: 't1', name: 'Ramesh Kumar', phone: '+91 98765 11111', area: 'Koramangala', skills: ['mobile', 'laptop', 'pickup'], rating: 4.8, online: true, active: true },
  { id: 't2', name: 'Suresh M', phone: '+91 98765 22222', area: 'Indiranagar', skills: ['laptop', 'mobile'], rating: 4.6, online: true, active: true },
  { id: 't3', name: 'Anita Desai', phone: '+91 98765 33333', area: 'HSR Layout', skills: ['car', 'bike', 'tyre'], rating: 4.9, online: false, active: true },
  { id: 't4', name: 'Imran Sheikh', phone: '+91 98765 44444', area: 'Jayanagar', skills: ['painter', 'amc', 'laundry'], rating: 4.5, online: true, active: true },
];

const customers = [
  { id: 'C1', name: 'Alex Johnson', phone: '+91 98765 43210', email: 'alex@example.com', address: 'Koramangala, Bengaluru' },
  { id: 'C2', name: 'Priya Nair', phone: '+91 98765 43211', email: 'priya@example.com', address: 'Indiranagar, Bengaluru' },
  { id: 'C3', name: 'Rahul Verma', phone: '+91 98765 43212', email: 'rahul@example.com', address: 'HSR Layout, Bengaluru' },
  { id: 'C4', name: 'Meera Rao', phone: '+91 98765 43213', email: 'meera@example.com', address: 'Jayanagar, Bengaluru' },
  { id: 'C5', name: 'Kiran S', phone: '+91 98765 43214', email: 'kiran@example.com', address: 'BTM Layout, Bengaluru' },
];

const inventory = [
  { id: 'i1', name: 'Mobile screen (universal)', sku: 'MOB-SCR', qty: 14, min: 5, cost: 650 },
  { id: 'i2', name: 'Mobile battery', sku: 'MOB-BAT', qty: 22, min: 8, cost: 320 },
  { id: 'i3', name: 'Charging port module', sku: 'MOB-CHG', qty: 4, min: 6, cost: 180 },
  { id: 'i4', name: 'Laptop SSD 512 GB', sku: 'LAP-SSD', qty: 9, min: 3, cost: 2800 },
  { id: 'i5', name: 'Laptop RAM 8 GB', sku: 'LAP-RAM', qty: 11, min: 4, cost: 1500 },
  { id: 'i6', name: 'Thermal paste', sku: 'LAP-THP', qty: 3, min: 5, cost: 90 },
  { id: 'i7', name: 'Puncture repair kit', sku: 'TYR-KIT', qty: 25, min: 10, cost: 60 },
  { id: 'i8', name: 'Car shampoo (5 L)', sku: 'CAR-SHP', qty: 7, min: 3, cost: 450 },
];

const coupons = [
  { code: 'WELCOME10', percent: 10, desc: '10% off your first booking', active: true },
  { code: 'GREEN50', percent: 50, desc: 'Repair • Reuse • Go Green (limited)', active: false },
  { code: 'FIXIT15', percent: 15, desc: '15% off laptop & mobile repairs', active: true },
];

// small deterministic pseudo-random so the demo charts look the same on every machine
const rng = (() => { let s = 42; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();

function makeHistory() {
  const bookings = []; const payments = [];
  const today = isoLocal();
  const methods = ['UPI', 'Card', 'Cash'];
  const areas = ['Koramangala', 'Indiranagar', 'HSR Layout', 'Jayanagar', 'BTM Layout', 'Whitefield'];
  const weights = ['mobile', 'mobile', 'mobile', 'laptop', 'laptop', 'car', 'bike', 'tyre', 'laundry', 'painter', 'amc', 'pickup'];
  let n = 12000;
  // ~ 150 days of history, busier as it gets closer to today
  for (let day = 150; day >= 3; day--) {
    const count = Math.floor(rng() * (day > 90 ? 1.6 : day > 40 ? 2.4 : 3.3));
    for (let k = 0; k < count; k++) {
      const svcId = weights[Math.floor(rng() * weights.length)];
      const svc = services.find(s => s.id === svcId);
      const cust = customers[Math.floor(rng() * customers.length)];
      const tech = technicians.filter(t => t.skills.includes(svc.id));
      const t = tech[Math.floor(rng() * tech.length)] || technicians[0];
      const date = addDays(today, -day);
      const amount = svc.price + Math.round(rng() * 6) * 100;
      const method = methods[Math.floor(rng() * 3)];
      const id = 'CAF' + (n++);
      bookings.push({
        id, service: svc.name, serviceId: svc.id, icon: svc.icon, date, time: ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'][k % 4],
        address: areas[Math.floor(rng() * areas.length)] + ', Bengaluru', notes: '', payment: method, status: STATUS.DONE, amount,
        techId: t.id, technician: t.name, phone: t.phone, techResponse: 'accepted', rejectedBy: [],
        customerId: cust.id, customerName: cust.name, customerPhone: cust.phone,
        createdAt: date + 'T08:00:00', completedAt: date + 'T17:00:00',
      });
      payments.push({
        id: 'PAY' + (n + 5000), bookingId: id, title: svc.name, date: longDate(date), dateISO: date, amount, method,
        status: method === 'Cash' ? 'Cash collected' : 'Paid', customerId: cust.id,
      });
    }
  }
  return { bookings, payments };
}

export function buildSeed() {
  const today = isoLocal();
  const history = makeHistory();
  const svc = id => services.find(s => s.id === id);
  const mk = (id, serviceId, c, date, time, address, extra) => ({
    id, service: svc(serviceId).name, serviceId, icon: svc(serviceId).icon, date, time, address, notes: '', payment: 'UPI',
    status: STATUS.CONFIRMED, amount: svc(serviceId).price + 300, techId: null, technician: NO_TECH, phone: '—', techResponse: null, rejectedBy: [],
    customerId: c.id, customerName: c.name, customerPhone: c.phone, createdAt: today + 'T07:30:00', ...extra,
  });
  const t1 = technicians[0];
  const live = [
    // offered to Ramesh – he must accept/reject in the technician app
    mk('CAF12345', 'mobile', customers[0], today, '10:00 AM', 'Koramangala, Bengaluru', {
      amount: 799, status: STATUS.ASSIGNED, techId: t1.id, technician: t1.name, phone: t1.phone, techResponse: 'pending', notes: 'Screen cracked after a drop. Phone still works.',
    }),
    // already accepted by Ramesh
    mk('CAF12344', 'laptop', customers[1], today, '01:00 PM', 'Indiranagar, Bengaluru', {
      amount: 999, status: STATUS.ASSIGNED, techId: t1.id, technician: t1.name, phone: t1.phone, techResponse: 'accepted', payment: 'Cash', notes: 'Laptop overheats and shuts down.',
    }),
    // waiting for the admin to assign a technician
    mk('CAF12343', 'painter', customers[2], addDays(today, 1), '11:00 AM', 'HSR Layout, Bengaluru', { amount: 1299, notes: 'Two bedrooms, light colours.' }),
    mk('CAF12342', 'car', customers[3], addDays(today, 1), '09:00 AM', 'Jayanagar, Bengaluru', { amount: 399, payment: 'Cash' }),
  ];
  // completed today by Ramesh, so the technician app shows "Completed 1"
  const done = mk('CAF12330', 'mobile', customers[2], today, '08:30 AM', 'HSR Layout, Bengaluru', {
    amount: 599, status: STATUS.DONE, techId: t1.id, technician: t1.name, phone: t1.phone, techResponse: 'accepted', completedAt: today + 'T09:40:00',
  });
  const donePay = { id: 'PAY8921', bookingId: done.id, title: done.service, date: longDate(today), dateISO: today, amount: 599, method: 'UPI', status: 'Paid', customerId: done.customerId };

  return {
    version: 1,
    services, technicians, customers, inventory, coupons,
    settings: { businessName: 'Click and Fix', city: 'Bengaluru', payoutPercent: 80, supportPhone: '+91 80000 00000' },
    bookings: [...live, done, ...history.bookings.reverse()],
    payments: [donePay, ...history.payments.reverse()],
  };
}
