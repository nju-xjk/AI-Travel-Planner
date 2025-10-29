import express from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

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
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload & { email?: string };
      const subRaw = decoded.sub;
      const subNum = typeof subRaw === 'string' ? Number(subRaw) : subRaw;
      if (!subNum || typeof decoded.email !== 'string') {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: 'invalid token payload' });
      }
      req.user = { id: subNum, email: decoded.email };
      return next();
    } catch (_err) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'invalid token' });
    }
  };
}