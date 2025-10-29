import express from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedUser {
  id: number;
  email: string;
}

export interface AuthedRequest extends express.Request {
  user?: AuthedUser;
}

export function createAuthGuard(jwtSecret: string): express.RequestHandler {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'missing bearer token' });
    }
    const token = auth.slice('Bearer '.length);
    try {
      const payload = jwt.verify(token, jwtSecret) as { sub: number; email: string };
      req.user = { id: payload.sub, email: payload.email };
      return next();
    } catch (_err) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'invalid token' });
    }
  };
}