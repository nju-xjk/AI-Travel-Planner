import fs from 'fs';
import path from 'path';

export interface Settings {
  llmProvider?: string;
  LLM_API_KEY?: string;
  AMAP_API_KEY?: string;
  XF_API_KEY?: string;
  XF_APP_ID?: string;
}

const CONFIG_DIR = path.resolve(process.cwd(), 'config');
const CONFIG_FILE = path.resolve(CONFIG_DIR, 'local.json');

function ensureDirExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class SettingsService {
  getSettings(): Settings {
    try {
      if (!fs.existsSync(CONFIG_FILE)) return {};
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      return obj || {};
    } catch (_err) {
      return {};
    }
  }

  validate(payload: any): { valid: boolean; message?: string } {
    const allowedKeys = ['llmProvider', 'LLM_API_KEY', 'AMAP_API_KEY', 'XF_API_KEY', 'XF_APP_ID'];
    const keys = Object.keys(payload || {});
    for (const k of keys) {
      if (!allowedKeys.includes(k)) {
        return { valid: false, message: `unknown key: ${k}` };
      }
      const v = payload[k];
      if (v != null && typeof v !== 'string') {
        return { valid: false, message: `key ${k} must be string` };
      }
      if (typeof v === 'string' && v.length > 256) {
        return { valid: false, message: `key ${k} too long` };
      }
    }
    return { valid: true };
  }

  updateSettings(update: Partial<Settings>): Settings {
    const { valid, message } = this.validate(update);
    if (!valid) {
      const err = new Error(message || 'invalid settings');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }
    const current = this.getSettings();
    const next: Settings = { ...current, ...update };
    ensureDirExists(CONFIG_DIR);
    const tmp = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, CONFIG_FILE);
    return next;
  }
}