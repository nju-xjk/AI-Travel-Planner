import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const emailNorm = email.trim().toLowerCase();
    const res = await api<{ id: number; email: string; created_at: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: emailNorm, password })
    });
    setLoading(false);
    if (res?.data?.id) {
      setMsg('注册成功，请使用该账号登录');
      setTimeout(() => navigate('/login'), 800);
    } else {
      setMsg(res?.message || '注册失败');
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <Card title="注册">
        <form onSubmit={onRegister} className="stack">
          <Input label="邮箱" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="密码" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="submit" variant="primary" disabled={loading}>{loading ? '注册中...' : '注册'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/login')}>已有账号？去登录</Button>
          </div>
          {msg && <div className="note">{msg}</div>}
        </form>
      </Card>
    </div>
  );
}