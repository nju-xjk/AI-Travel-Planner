import React, { useEffect, useState } from 'react';
import { api } from '../api';

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
    <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
      <h2>设置</h2>
      <label>
        LLM Provider
        <input value={settings.llmProvider || ''} onChange={e => onChange('llmProvider', e.target.value)} />
      </label>
      <label>
        llmEnabled
        <input type="checkbox" checked={!!settings.llmEnabled} onChange={e => onChange('llmEnabled', e.target.checked)} />
      </label>
      <label>
        BUDGET_PERDAY_TRANSPORT
        <input type="number" value={settings.BUDGET_PERDAY_TRANSPORT ?? ''} onChange={e => onChange('BUDGET_PERDAY_TRANSPORT', Number(e.target.value))} />
      </label>
      <label>
        BUDGET_PERDAY_FOOD
        <input type="number" value={settings.BUDGET_PERDAY_FOOD ?? ''} onChange={e => onChange('BUDGET_PERDAY_FOOD', Number(e.target.value))} />
      </label>
      <label>
        BUDGET_PERDAY_ENTERTAINMENT
        <input type="number" value={settings.BUDGET_PERDAY_ENTERTAINMENT ?? ''} onChange={e => onChange('BUDGET_PERDAY_ENTERTAINMENT', Number(e.target.value))} />
      </label>
      <label>
        BUDGET_PERDAY_ACCOMMODATION
        <input type="number" value={settings.BUDGET_PERDAY_ACCOMMODATION ?? ''} onChange={e => onChange('BUDGET_PERDAY_ACCOMMODATION', Number(e.target.value))} />
      </label>
      <button onClick={onSave}>保存</button>
      {msg && <div>{msg}</div>}
    </div>
  );
}