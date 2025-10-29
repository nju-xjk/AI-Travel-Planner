import express from 'express';
import type { DB } from '../data/db';
import { AuthService } from '../services/authService';

export interface CreateAuthRouterOptions {
  jwtSecret: string;
}

export function createAuthRouter(db: DB, options: CreateAuthRouterOptions): express.Router {
  const router = express.Router();
  const auth = new AuthService(db, { jwtSecret: options.jwtSecret });

  router.post('/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'email and password are required' });
    }
    try {
      const user = await auth.register(email, password);
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
      const { token } = await auth.login(email, password);
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

  return router;
}