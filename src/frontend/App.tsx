import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PlanNew from './pages/PlanNew';
import PlanShow from './pages/PlanShow';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';
import NavBar from './components/NavBar';

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/plan/new" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/plan/new" element={<PlanNew />} />
          <Route path="/plan/:id" element={<PlanShow />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <div className="footer">AI Travel Planner · Better trips with smarter planning ✈️</div>
      </main>
    </div>
  );
}