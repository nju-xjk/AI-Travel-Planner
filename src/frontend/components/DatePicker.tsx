import React from 'react';

type DatePickerProps = {
  label?: string;
  value?: string; // yyyy-mm-dd
  onChange?: (v: string) => void;
  name?: string;
  min?: string;
  max?: string;
  error?: boolean;
};

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parse(value?: string): Date | null {
  if (!value) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  if (!m) return null;
  const t = Date.parse(value + 'T00:00:00');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function DatePicker({ label, value, onChange, name, min, max, error }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parse(value) || new Date();
  const [viewYear, setViewYear] = React.useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selected.getMonth()); // 0-11
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const daysGrid = React.useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startIdx = first.getDay(); // 0-6 (Sun=0)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    // Leading from previous month
    for (let i = 0; i < startIdx; i++) {
      const d = new Date(viewYear, viewMonth - 1, prevDays - startIdx + 1 + i);
      cells.push({ date: d, inMonth: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      cells.push({ date: d, inMonth: true });
    }
    // Trailing to fill 6 rows
    const trailing = 42 - cells.length;
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const isDisabled = (d: Date) => {
    const val = fmt(d);
    if (min && val < min) return true;
    if (max && val > max) return true;
    return false;
  };

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="stack" ref={containerRef} style={{ position: 'relative' }}>
      {label && <div className="label" style={error ? { color: '#e11d48' } : undefined}>{label}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="input"
          type="text"
          readOnly
          value={value || ''}
          placeholder="点击选择日期"
          name={name}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          style={error ? { border: '1px solid #e11d48', boxShadow: '0 0 0 2px rgba(225,29,72,0.15)' } : undefined}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 100,
            width: 280,
            borderRadius: 12,
            border: '1px solid #ddd',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', padding: 8, borderBottom: '1px solid #eee', color: '#222' }}>
            <button type="button" onClick={() => { const m = viewMonth - 1; setViewMonth(((m % 12) + 12) % 12); setViewYear(viewYear + (m < 0 ? -1 : 0)); }} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#333', cursor: 'pointer' }}>←</button>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>{viewYear}年 {viewMonth + 1}月</div>
            <button type="button" onClick={() => { const m = viewMonth + 1; setViewMonth(m % 12); setViewYear(viewYear + (m > 11 ? 1 : 0)); }} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#333', cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: 8 }}>
            {weekdays.map(w => (
              <div key={w} style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>{w}</div>
            ))}
            {daysGrid.map(({ date, inMonth }, i) => {
              const val = fmt(date);
              const isSel = value === val;
              const disabled = isDisabled(date);
              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => { if (!disabled) { onChange && onChange(val); setOpen(false); } }}
                  style={{
                    padding: '8px 0',
                    borderRadius: 8,
                    border: '1px solid #eee',
                    background: isSel ? 'var(--primary)' : (inMonth ? '#fff' : '#f7f7f7'),
                    color: isSel ? '#fff' : (disabled ? '#bbb' : (inMonth ? '#222' : '#999')),
                    cursor: disabled ? 'not-allowed' : 'pointer'
                  }}
                >{date.getDate()}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderTop: '1px solid #eee', color: '#222' }}>
            <button type="button" onClick={() => { const d = new Date(); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#333', cursor: 'pointer' }}>回到本月</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setOpen(false)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#333', cursor: 'pointer' }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}