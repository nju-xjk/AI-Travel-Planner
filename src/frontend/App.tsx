import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PlanNew from './pages/PlanNew';
import PlanShow from './pages/PlanShow';
import MyPlans from './pages/MyPlans';
import Settings from './pages/Settings';
import NavBar from './components/NavBar';
import RequireAuth from './components/RequireAuth';

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/plan/new" element={<RequireAuth><PlanNew /></RequireAuth>} />
          <Route path="/plans" element={<RequireAuth><MyPlans /></RequireAuth>} />
          <Route path="/plan/:id" element={<RequireAuth><PlanShow /></RequireAuth>} />
          {/** 费用功能已融入行程详情页，移除独立路由 */}
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        </Routes>
      </main>
      <div className="footer">AI Travel Planner · Better trips with smarter planning ✈️</div>
    </div>
  );
}