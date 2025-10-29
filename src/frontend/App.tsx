import React from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import PlanNew from './pages/PlanNew';
import PlanShow from './pages/PlanShow';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';

function Nav() {
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }}>
      <Link to="/">首页</Link>
      <Link to="/login">登录</Link>
      <Link to="/plan/new">新建行程</Link>
      <Link to="/expenses">费用</Link>
      <Link to="/settings">设置</Link>
    </nav>
  );
}

export default function App() {
  return (
    <div>
      <Nav />
      <div style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/plan/new" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/plan/new" element={<PlanNew />} />
          <Route path="/plan/:id" element={<PlanShow />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}