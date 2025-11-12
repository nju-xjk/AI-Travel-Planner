import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    // 已登录时自动跳转到新建行程
    if (isAuthenticated()) {
      navigate('/plan/new', { replace: true });
    }
  }, [navigate]);

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
      window.dispatchEvent(new Event('auth-changed'));
      setMsg('登录成功，即将跳转...');
      setTimeout(() => navigate('/plan/new'), 600);
    } else {
      setMsg(res?.message || '登录失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Card title="登录">
        <div className="auth-form" style={{ width: 'min(600px, 100%)', margin: '0 auto', padding: '0 12px' }}>
        <form onSubmit={onLogin} className="stack">
          <Input label="邮箱" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="密码" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', width: '100%' }}>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? '登录中...' : '登录'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/register')}>没有账号？去注册</Button>
          </div>
          {msg && <div className="note">{msg}</div>}
        </form>
        </div>
      </Card>
    </div>
  );
}