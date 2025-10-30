import React from 'react';
import Card from './Card';

type BudgetEstimate = {
  destination: string;
  start_date: string;
  end_date: string;
  party_size: number;
  currency: 'CNY';
  total: number;
  breakdown: Record<string, number>;
  warnings: string[];
};

function formatCNY(n: number): string {
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `¥${Math.round(n)}`;
  }
}

export default function BudgetView({ estimate }: { estimate: BudgetEstimate }) {
  const items = Object.entries(estimate.breakdown)
    .filter(([_, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = items.length ? Math.max(...items.map(([_, v]) => v)) : 0;

  return (
    <Card title="预算估算">
      <div className="budget-header">
        <div className="budget-total">总计：{formatCNY(estimate.total)}</div>
        <div className="budget-meta">👥 {estimate.party_size} 人 · 📍 {estimate.destination} · 🗓️ {estimate.start_date} → {estimate.end_date}</div>
      </div>
      <div className="breakdown-list">
        {items.map(([key, val]) => {
          const pct = max > 0 ? Math.round((val / max) * 100) : 0;
          const label = ({
            transport: '交通',
            accommodation: '住宿',
            food: '餐饮',
            entertainment: '景点/娱乐',
            shopping: '购物',
            other: '其他'
          } as Record<string, string>)[key] || key;
          return (
            <div key={key} className="breakdown-item">
              <div className="breakdown-row">
                <div className="breakdown-label">{label}</div>
                <div className="breakdown-value">{formatCNY(val)}</div>
              </div>
              <div className="breakdown-bar">
                <div className="breakdown-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="note">暂无分项预算数据</div>
        )}
      </div>
      {estimate.warnings?.length ? (
        <div className="warnings">
          {estimate.warnings.map((w, i) => (
            <span key={i} className="warning-chip">⚠️ {w}</span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}