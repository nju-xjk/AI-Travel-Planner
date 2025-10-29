import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';

type Settings = Record<string, any>;

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api<Settings>('/settings');
      if (res.data) setSettings(res.data);
    })();
  }, []);

  const onChange = (k: string, v: any) => {
    setSettings(s => ({ ...s, [k]: v }));
  };

  const onSave = async () => {
    setMsg('');
    const res = await api<Settings>('/settings', { method: 'POST', body: JSON.stringify(settings) });
    if (res.data) setMsg('保存成功');
    else setMsg(res.message || '保存失败');
  };

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="grid two">
        <Card title="通用设置">
          <div className="stack">
            <Input label="LLM Provider" value={settings.llmProvider || ''} onChange={e => onChange('llmProvider', e.target.value)} />
            <div className="row">
              <div className="label">llmEnabled</div>
              <input type="checkbox" checked={!!settings.llmEnabled} onChange={e => onChange('llmEnabled', e.target.checked)} />
            </div>
          </div>
        </Card>

        <Card title="预算日均系数">
          <div className="grid two">
            <Input label="交通（BUDGET_PERDAY_TRANSPORT）" type="number" value={settings.BUDGET_PERDAY_TRANSPORT ?? ''} onChange={e => onChange('BUDGET_PERDAY_TRANSPORT', Number(e.target.value))} />
            <Input label="餐饮（BUDGET_PERDAY_FOOD）" type="number" value={settings.BUDGET_PERDAY_FOOD ?? ''} onChange={e => onChange('BUDGET_PERDAY_FOOD', Number(e.target.value))} />
            <Input label="娱乐（BUDGET_PERDAY_ENTERTAINMENT）" type="number" value={settings.BUDGET_PERDAY_ENTERTAINMENT ?? ''} onChange={e => onChange('BUDGET_PERDAY_ENTERTAINMENT', Number(e.target.value))} />
            <Input label="住宿（BUDGET_PERDAY_ACCOMMODATION）" type="number" value={settings.BUDGET_PERDAY_ACCOMMODATION ?? ''} onChange={e => onChange('BUDGET_PERDAY_ACCOMMODATION', Number(e.target.value))} />
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Button variant="primary" onClick={onSave}>保存</Button>
        {msg && <span className="note">{msg}</span>}
      </div>
    </div>
  );
}