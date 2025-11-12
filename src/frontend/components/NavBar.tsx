import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getToken, clearToken } from '../auth';
import { api } from '../api';

export default function NavBar() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchEmail = async () => {
      const token = getToken();
      if (!token) { setEmail(null); return; }
      try {
        const me = await api<{ id: number; email: string }>("/auth/me");
        if (me?.data?.email) setEmail(me.data.email);
        else setEmail(null);
      } catch {
        setEmail(null);
      }
    };
    const onChange = () => { fetchEmail(); };
    fetchEmail();
    window.addEventListener('auth-changed', onChange);
    return () => window.removeEventListener('auth-changed', onChange);
  }, []);

  const onLogout = () => {
    clearToken();
    setOpen(false);
    navigate('/login');
  };

  return (
    <div className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-logo" />
          <div>AI Travel Planner</div>
        </div>
        <nav className="nav" style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {!email && (
              <>
                <NavLink to="/register" className={({ isActive }) => isActive ? 'active' : ''}>注册</NavLink>
                <NavLink to="/login" className={({ isActive }) => isActive ? 'active' : ''}>登录</NavLink>
              </>
            )}
            <NavLink to="/plan/new" className={({ isActive }) => isActive ? 'active' : ''}>新建行程</NavLink>
<NavLink to="/plans" className={({ isActive }) => isActive ? 'active' : ''}>行程与费用管理</NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>设置</NavLink>
          </div>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            {email && (
              <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen(v => !v)}>
                {email}
                {open && (
                  <div style={{ position: 'absolute', right: 0, top: '120%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, minWidth: 120, zIndex: 10 }}>
                    <div style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={onLogout}>退出登录</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}