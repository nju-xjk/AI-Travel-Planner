import React from 'react';
import { NavLink } from 'react-router-dom';

export default function NavBar() {
  return (
    <div className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-logo" />
          <div>AI Travel Planner</div>
        </div>
        <nav className="nav">
          <NavLink to="/register" className={({ isActive }) => isActive ? 'active' : ''}>注册</NavLink>
          <NavLink to="/login" className={({ isActive }) => isActive ? 'active' : ''}>登录</NavLink>
          <NavLink to="/plan/new" className={({ isActive }) => isActive ? 'active' : ''}>新建行程</NavLink>
          <NavLink to="/expenses" className={({ isActive }) => isActive ? 'active' : ''}>费用</NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>设置</NavLink>
        </nav>
      </div>
    </div>
  );
}