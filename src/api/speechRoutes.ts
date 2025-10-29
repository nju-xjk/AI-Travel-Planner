import express from 'express';
import multer from 'multer';
import { SettingsService } from '../services/settingsService';
import { SpeechService } from '../services/speechService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export function createSpeechRouter(): express.Router {
  const router = express.Router();
  const settings = new SettingsService();

  router.post('/recognize', upload.single('audio'), async (req, res) => {
    try {
      const file = req.file;
      const language = (req.body?.language as string) || 'zh-CN';
      if (!file) {
        return res.status(400).json({ code: 'BAD_REQUEST', message: 'audio file is required' });
      }
      const allowed = ['audio/wav', 'audio/webm', 'audio/mpeg', 'audio/mp3'];
      if (file.mimetype && !allowed.includes(file.mimetype)) {
        return res.status(400).json({ code: 'BAD_REQUEST', message: `unsupported audio type: ${file.mimetype}` });
      }
      const cfg = settings.getSettings();
      const svc = new SpeechService({ xfApiKey: cfg.XF_API_KEY, xfAppId: cfg.XF_APP_ID });
      const result = await svc.recognize(file.buffer, language);
      return res.status(200).json({ data: result });
    } catch (err: any) {
      return res.status(500).json({ code: 'SERVER_ERROR', message: 'speech recognition failed' });
    }
  });

  return router;
}