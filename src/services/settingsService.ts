import fs from 'fs';
import path from 'path';

export interface Settings {
  llmProvider?: string;
  llmEnabled?: boolean;
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

  validate(payload: any, current?: Settings): { valid: boolean; message?: string } {
    const allowedKeys = ['llmProvider', 'llmEnabled', 'LLM_API_KEY', 'AMAP_API_KEY', 'XF_API_KEY', 'XF_APP_ID'];
    const keys = Object.keys(payload || {});
    for (const k of keys) {
      if (!allowedKeys.includes(k)) {
        return { valid: false, message: `unknown key: ${k}` };
      }
      const v = payload[k];
      if (k === 'llmEnabled') {
        if (v != null && typeof v !== 'boolean') {
          return { valid: false, message: `key ${k} must be boolean` };
        }
      } else {
        if (v != null && typeof v !== 'string') {
          return { valid: false, message: `key ${k} must be string` };
        }
        if (typeof v === 'string' && v.length > 256) {
          return { valid: false, message: `key ${k} too long` };
        }
      }
    }

    // llmProvider enum validation if provided
    const providerRaw = (payload?.llmProvider ?? current?.llmProvider);
    if (typeof providerRaw === 'string') {
      const provider = providerRaw.toLowerCase();
      const allowedProviders = ['mock', 'openai', 'bailian', 'xunfei'];
      if (!allowedProviders.includes(provider)) {
        return { valid: false, message: `llmProvider must be one of: ${allowedProviders.join(', ')}` };
      }
    }

    // if enabling real LLM (non-mock), ensure API key present
    const enabled = payload?.llmEnabled ?? current?.llmEnabled;
    const providerFinal = (payload?.llmProvider ?? current?.llmProvider)?.toLowerCase();
    if (enabled === true && providerFinal && providerFinal !== 'mock') {
      const key = (payload?.LLM_API_KEY ?? current?.LLM_API_KEY);
      if (!key || typeof key !== 'string' || key.trim() === '') {
        return { valid: false, message: 'LLM_API_KEY is required when llmEnabled=true and provider is not mock' };
      }
    }
    return { valid: true };
  }

  updateSettings(update: Partial<Settings>): Settings {
    const current = this.getSettings();
    const { valid, message } = this.validate(update, current);
    if (!valid) {
      const err = new Error(message || 'invalid settings');
      (err as any).code = 'BAD_REQUEST';
      throw err;
    }
    const next: Settings = { ...current, ...update };
    ensureDirExists(CONFIG_DIR);
    const tmp = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, CONFIG_FILE);
    return next;
  }
}