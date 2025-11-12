import React from 'react';

type PieDatum = {
  label: string;
  value: number;
  color: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z'
  ].join(' ');
}

export default function PieChart({ data, size = 220, thickness = 40 }: { data: PieDatum[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter - thickness;

  let currentAngle = 0;
  const segments = total > 0
    ? data.map((d) => {
        const angle = (d.value / total) * 360;
        const seg = {
          path: arcPath(cx, cy, rOuter, rInner, currentAngle, currentAngle + angle),
          color: d.color,
          label: d.label,
          value: d.value,
          pct: total > 0 ? (d.value / total) : 0
        };
        currentAngle += angle;
        return seg;
      })
    : [];

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="费用饼图">
        {/* 背景圆（无数据时显示灰圈）*/}
        {segments.length === 0 && (
          <circle cx={cx} cy={cy} r={rOuter} fill="var(--surface)" />
        )}
        {/* 饼图分段 */}
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} />
        ))}
        {/* 中心空洞，形成甜甜圈样式 */}
        <circle cx={cx} cy={cy} r={rInner} fill="var(--bg)" />
        {/* 中心总额文字 */}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontWeight: 600, fill: '#fff' }}>
          {total > 0 ? `¥${total.toFixed(0)}` : '暂无'}
        </text>
      </svg>

      {/* 图例 */}
      <div style={{ display: 'grid', gap: 6 }}>
        {data.map((d, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
            <span style={{ minWidth: 72, fontSize: 13 }}>{d.label}</span>
            <span style={{ color: 'var(--fg)', fontWeight: 500, fontSize: 13 }}>¥{d.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}