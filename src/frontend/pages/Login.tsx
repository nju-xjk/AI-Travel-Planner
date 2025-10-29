import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const emailNorm = email.trim().toLowerCase();
    const res = await api<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailNorm, password })
    });
    setLoading(false);
    if (res?.data?.token) {
      localStorage.setItem('token', res.data.token);
      setMsg('登录成功，即将跳转...');
      setTimeout(() => navigate('/plan/new'), 600);
    } else {
      setMsg(res?.message || '登录失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <Card title="登录">
        <form onSubmit={onLogin} className="stack">
          <Input label="邮箱" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="密码" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? '登录中...' : '登录'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setEmail('test@example.com'); setPassword('password'); }}>填充示例</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/register')}>去注册</Button>
          </div>
          {msg && <div className="note">{msg}</div>}
        </form>
      </Card>
    </div>
  );
}