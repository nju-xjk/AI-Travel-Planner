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
    <div className="container" style={{ maxWidth: 1180 }}>
      <Card title="通用设置">
        <div className="grid two">
          <Input label="百炼大模型 ApiKey" placeholder="用于调用百炼大模型的 API Key" value={settings.BAILIAN_API_KEY || ''} onChange={e => onChange('BAILIAN_API_KEY', e.target.value)} />
          <Input label="百度地图 浏览器AK" placeholder="用于浏览器侧加载百度地图脚本" value={settings.BAIDU_BROWSER_AK || ''} onChange={e => onChange('BAIDU_BROWSER_AK', e.target.value)} />
          <Input label="讯飞语音识别 ApiKey" placeholder="用于科大讯飞语音识别服务" value={settings.XF_API_KEY || ''} onChange={e => onChange('XF_API_KEY', e.target.value)} />
          <Input label="讯飞语音识别 Secret" placeholder="用于科大讯飞语音识别（Secret）" value={settings.XF_API_SECRET || ''} onChange={e => onChange('XF_API_SECRET', e.target.value)} />
          <Input label="讯飞 应用ID" placeholder="用于科大讯飞应用ID" value={settings.XF_APP_ID || ''} onChange={e => onChange('XF_APP_ID', e.target.value)} />
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Button variant="primary" onClick={onSave}>保存</Button>
        {msg && <span className="note">{msg}</span>}
      </div>
    </div>
  );
}