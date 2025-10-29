import express from 'express';
import { randomUUID } from 'crypto';

export function correlationId(): express.RequestHandler {
  return (req, _res, next) => {
    const headerId = req.headers['x-request-id'];
    const id = typeof headerId === 'string' && headerId ? headerId : randomUUID();
    (req as any).id = id;
    next();
  };
}