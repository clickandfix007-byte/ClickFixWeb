export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');

export const isoLocal = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};

/** "2026-11-09" -> Today / Tomorrow / Yesterday / "Tue, 10 Nov" */
export const niceDate = iso => {
  if (!iso) return '';
  const today = isoLocal();
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** "2026-11-09" -> "Nov 09, 2026" */
export const longDate = iso =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

export const initials = name =>
  (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

export const mapsUrl = address =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address || '');

export const telUrl = phone => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');

/** "10:00 AM" -> minutes since midnight (for sorting) */
export const timeValue = t => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

export const downloadCsv = (filename, rows) => {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
