import React from 'react';
import { isAuthenticated } from '../auth';
import Card from './Card';
import Button from './Button';
import { useNavigate } from 'react-router-dom';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = isAuthenticated();
  const navigate = useNavigate();
  if (!authed) {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <Card title="需要登录">
          <div className="stack">
            <div>该功能需要登录，请先登录后再访问。</div>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <Button type="button" variant="primary" onClick={() => navigate('/login')}>去登录</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}