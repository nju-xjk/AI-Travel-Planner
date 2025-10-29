import React, { useState } from 'react';
import { api } from '../api';

export default function Login() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password');
  const [msg, setMsg] = useState('');

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await api<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res?.data?.token) {
      localStorage.setItem('token', res.data.token);
      setMsg('登录成功');
    } else {
      setMsg(res?.message || '登录失败');
    }
  };

  return (
    <form onSubmit={onLogin} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
      <h2>登录</h2>
      <input placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">登录</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}