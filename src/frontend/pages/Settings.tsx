import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { clearToken } from '../auth';
import { useNavigate } from 'react-router-dom';

type Settings = Record<string, any>;

export default function Settings() {
  const navigate = useNavigate();
  // 系统设置（API Key 等）
  const [settings, setSettings] = useState<Settings>({});
  const [sysMsg, setSysMsg] = useState('');

  // 个人设置（邮箱、密码、偏好）
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferencesText, setPreferencesText] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    (async () => {
      // 加载系统设置
      const res = await api<Settings>('/settings');
      if (res.data) setSettings(res.data);
      // 加载个人资料
      const me = await api<{ id: number; email: string; created_at: string; preferencesText: string }>('/auth/me');
      if (me.data) {
        setEmail(me.data.email || '');
        setPreferencesText(me.data.preferencesText || '');
      }
    })();
  }, []);

  const onChangeSys = (k: string, v: any) => {
    setSettings(s => ({ ...s, [k]: v }));
  };

  const onSaveSystem = async () => {
    setSysMsg('');
    const res = await api<Settings>('/settings', { method: 'POST', body: JSON.stringify(settings) });
    if (res.data) setSysMsg('保存成功');
    else setSysMsg(res.message || '保存失败');
  };

  const onSaveProfile = async () => {
    setProfileMsg('');
    // 更新邮箱与密码（密码可选，留空不修改）
    const payload: any = { email };
    if (password && password.trim()) payload.password = password;
    const res1 = await api<{ id: number; email: string }>('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
    if (res1.code === 'EMAIL_EXISTS') {
      setProfileMsg('该邮箱已被占用');
      return;
    }
    // 更新偏好文本
    const res2 = await api<{ preferencesText: string }>('/auth/me/preferences', { method: 'PUT', body: JSON.stringify({ preferencesText }) });
    if (res1.data || res2.data) {
      // 如果修改了密码，则强制退出登录并跳转到登录页
      if (payload.password && String(payload.password).trim()) {
        try { clearToken(); } catch {}
        setProfileMsg('密码已更新，请重新登录');
        navigate('/login');
        return;
      }
      setProfileMsg('保存成功');
      // 清空输入的密码框以避免误存
      setPassword('');
      // 触发全局登录信息更新（导航栏邮箱展示）
      window.dispatchEvent(new Event('auth-changed'));
    } else {
      setProfileMsg(res1.message || res2.message || '保存失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <Card title="系统设置">
        <div className="grid two">
          <Input label="百炼大模型 ApiKey" placeholder="用于调用百炼大模型的 API Key" value={settings.BAILIAN_API_KEY || ''} onChange={e => onChangeSys('BAILIAN_API_KEY', e.target.value)} />
          <Input label="百度地图 浏览器AK" placeholder="用于浏览器侧加载百度地图脚本" value={settings.BAIDU_BROWSER_AK || ''} onChange={e => onChangeSys('BAIDU_BROWSER_AK', e.target.value)} />
          <Input label="讯飞语音识别 ApiKey" placeholder="用于科大讯飞语音识别服务" value={settings.XF_API_KEY || ''} onChange={e => onChangeSys('XF_API_KEY', e.target.value)} />
          <Input label="讯飞语音识别 Secret" placeholder="用于科大讯飞语音识别（Secret）" value={settings.XF_API_SECRET || ''} onChange={e => onChangeSys('XF_API_SECRET', e.target.value)} />
          <Input label="讯飞 应用ID" placeholder="用于科大讯飞应用ID" value={settings.XF_APP_ID || ''} onChange={e => onChangeSys('XF_APP_ID', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button variant="primary" onClick={onSaveSystem}>保存系统设置</Button>
          {sysMsg && <span className="note">{sysMsg}</span>}
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
      <Card title="个人设置">
        <div className="stack" style={{ gap: 12 }}>
          <Input label="邮箱" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="新密码（留空不修改）" type="password" placeholder="新密码" value={password} onChange={e => setPassword(e.target.value)} />
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>偏好设置</label>
            <textarea
              value={preferencesText}
              onChange={e => setPreferencesText(e.target.value)}
              placeholder="例如：喜欢自然风光、清淡饮食、偏好公共交通等"
              style={{ width: '100%', minHeight: 120, borderRadius: 8, border: '1px solid var(--border)', padding: 8, background: 'var(--bg)', color: 'var(--fg)' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button variant="primary" onClick={onSaveProfile}>保存个人设置</Button>
          {profileMsg && <span className="note">{profileMsg}</span>}
        </div>
      </Card>
      </div>
    </div>
  );
}