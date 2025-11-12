import express from 'express';
import type { DB } from '../data/db';
import { AuthService } from '../services/authService';
import { createAuthGuard } from './middlewares/authGuard';
import { UserDAO } from '../data/dao/userDao';

export interface CreateAuthRouterOptions {
  jwtSecret: string;
}

export function createAuthRouter(db: DB, options: CreateAuthRouterOptions): express.Router {
  const router = express.Router();
  const auth = new AuthService(db, { jwtSecret: options.jwtSecret });
  const guard = createAuthGuard(options.jwtSecret);
  const users = new UserDAO(db);

  router.post('/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'email and password are required' });
    }
    try {
      const normEmail = String(email).trim().toLowerCase();
      const user = await auth.register(normEmail, password);
      return res.status(201).json({ data: user });
    } catch (err: any) {
      if (err && err.message === 'EMAIL_EXISTS') {
        return res.status(400).json({ code: 'EMAIL_EXISTS', message: 'email already registered' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'email and password are required' });
    }
    try {
      const normEmail = String(email).trim().toLowerCase();
      const { token } = await auth.login(normEmail, password);
      return res.status(200).json({ data: { token } });
    } catch (err: any) {
      if (err && err.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'invalid email or password' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  // Stateless logout: client should discard token. Kept for API symmetry.
  router.post('/logout', async (_req, res) => {
    return res.status(204).send();
  });

  // Get my profile
  router.get('/me', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const u = users.findById(user.id);
    if (!u) return res.status(404).json({ code: 'NOT_FOUND', message: 'user not found' });
    const data = {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      preferencesText: u.preferences_text ?? ''
    };
    return res.status(200).json({ data });
  });

  // Update my email and/or password
  router.put('/me', guard, async (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const { email, password } = req.body || {};
    const u = users.findById(user.id);
    if (!u) return res.status(404).json({ code: 'NOT_FOUND', message: 'user not found' });
    // Update email when provided
    if (typeof email === 'string' && email.trim()) {
      const norm = String(email).trim().toLowerCase();
      const exists = users.findByEmail(norm);
      if (exists && exists.id !== u.id) {
        return res.status(400).json({ code: 'EMAIL_EXISTS', message: 'email already registered' });
      }
      users.updateEmail(u.id, norm);
    }
    // Update password when provided
    if (typeof password === 'string' && password) {
      try {
        const bcrypt = require('bcryptjs');
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        users.updatePasswordHash(u.id, hash);
      } catch (_err) {
        return res.status(500).json({ code: 'SERVER_ERROR', message: 'failed to update password' });
      }
    }
    const updated = users.findById(user.id);
    if (!updated) return res.status(500).json({ code: 'SERVER_ERROR', message: 'failed to update profile' });
    return res.status(200).json({ data: { id: updated.id, email: updated.email } });
  });

  // Read my preferences
  router.get('/me/preferences', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const u = users.findById(user.id);
    if (!u) return res.status(404).json({ code: 'NOT_FOUND', message: 'user not found' });
    return res.status(200).json({ data: { preferencesText: u.preferences_text ?? '' } });
  });

  // Update my preferences
  router.put('/me/preferences', guard, (req, res) => {
    const user = (req as any).user as { id: number } | undefined;
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing user' });
    const { preferencesText } = req.body || {};
    if (typeof preferencesText !== 'string') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'preferencesText must be a string' });
    }
    users.updatePreferencesText(user.id, preferencesText);
    return res.status(200).json({ data: { preferencesText } });
  });

  return router;
}