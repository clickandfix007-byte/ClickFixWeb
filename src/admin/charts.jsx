import React from 'react';

/** Responsive SVG line chart. */
export function LineChart({ labels, values, color = '#1d6ae5', height = 210 }) {
  const W = 520, H = height, L = 38, R = 14, T = 14, B = 28;
  const max = Math.max(5, ...values);
  const top = Math.ceil(max / 4 / 5) * 5 * 4 || 20;
  const x = i => L + (values.length === 1 ? 0 : (i * (W - L - R)) / (values.length - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${L},${H - B} ${line} ${x(values.length - 1)},${H - B}`;
  return <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Line chart">
    {[0, 1, 2, 3, 4].map(k => { const v = (top / 4) * k; return <g key={k}>
      <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e8eef6" /><text x={L - 7} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#7d8da1">{Math.round(v)}</text></g>; })}
    <polygon points={area} fill={color} opacity=".08" />
    <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    {pts.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={color} strokeWidth="2" /><title>{labels[i]}: {values[i]}</title>
      <text x={p[0]} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#7d8da1">{labels[i]}</text></g>)}
  </svg>;
}

/** Donut chart with legend. parts = [{label, value, color}] */
export function Donut({ parts, size = 150 }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return <div className="donut-wrap">
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="Donut chart">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#eef3f9" strokeWidth="22" />
      {parts.map(p => { const len = (p.value / total) * c; const el =
        <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="22"
          strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)"><title>{p.label}: {p.value}</title></circle>;
        acc += len; return el; })}
      <text x="70" y="68" textAnchor="middle" fontSize="20" fontWeight="800" fill="#102746">{total}</text>
      <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#7d8da1">TOTAL</text>
    </svg>
    <ul className="legend">{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{p.label}<b>{Math.round((p.value / total) * 100)}%</b></li>)}</ul>
  </div>;
}

/** Horizontal bars. items = [{label, value}] */
export function Bars({ items, format = v => v, color = '#1d6ae5' }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return <div className="bars">{items.map(i => <div className="bar-row" key={i.label}>
    <span className="bar-label">{i.label}</span>
    <div className="bar-track"><div className="bar-fill" style={{ width: (i.value / max) * 100 + '%', background: i.color || color }} /></div>
    <b className="bar-val">{format(i.value)}</b></div>)}</div>;
}
