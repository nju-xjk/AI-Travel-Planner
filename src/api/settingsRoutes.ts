import express from 'express';
import { SettingsService } from '../services/settingsService';

export function createSettingsRouter(): express.Router {
  const router = express.Router();
  const svc = new SettingsService();

  router.get('/', (_req, res) => {
    const data = svc.getSettings();
    res.status(200).json({ data });
  });

  router.post('/', (req, res) => {
    const payload = req.body || {};
    try {
      const saved = svc.updateSettings(payload);
      res.status(200).json({ data: saved });
    } catch (err: any) {
      if (err?.code === 'BAD_REQUEST') {
        return res.status(400).json({ code: 'BAD_REQUEST', message: err.message || 'invalid settings' });
      }
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'unexpected error' });
    }
  });

  return router;
}