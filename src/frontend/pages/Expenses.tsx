import React from 'react';
import Card from '../components/Card';

export default function Expenses() {
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <Card title="费用管理（占位）" footer={<span className="note">后续串接 /expenses 与统计视图。</span>}>
        <div className="stack">
          <div className="note">在此处将展示出行期间的支出列表与总览。</div>
          <div className="note">支持分类筛选与导出（计划在 WP5 完成）。</div>
        </div>
      </Card>
    </div>
  );
}