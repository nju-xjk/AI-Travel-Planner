import fs from 'fs';
import path from 'path';

export interface Settings {
  BAILIAN_API_KEY?: string;
  BAIDU_BROWSER_AK?: string;
  XF_API_KEY?: string;
  XF_API_SECRET?: string;
  XF_APP_ID?: string;
  LLM_TIMEOUT_MS?: number;
  LLM_MAX_RETRIES?: number;
  BUDGET_COEFF_TRANSPORT?: number;
  BUDGET_COEFF_FOOD?: number;
  BUDGET_COEFF_ENTERTAINMENT?: number;
  BUDGET_COEFF_ACCOMMODATION?: number;
  BUDGET_COEFF_SHOPPING?: number;
  BUDGET_COEFF_OTHER?: number;
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
    const allowedKeys = [
      'BAILIAN_API_KEY', 'BAIDU_BROWSER_AK', 'XF_API_KEY', 'XF_API_SECRET', 'XF_APP_ID', 'LLM_TIMEOUT_MS', 'LLM_MAX_RETRIES',
      'BUDGET_COEFF_TRANSPORT', 'BUDGET_COEFF_FOOD', 'BUDGET_COEFF_ENTERTAINMENT', 'BUDGET_COEFF_ACCOMMODATION', 'BUDGET_COEFF_SHOPPING', 'BUDGET_COEFF_OTHER',
      // Removed daily budget factor keys (BUDGET_PERDAY_*)
    ];
    const keys = Object.keys(payload || {});
    for (const k of keys) {
      if (!allowedKeys.includes(k)) {
        return { valid: false, message: `unknown key: ${k}` };
      }
      const v = payload[k];
      if (k === 'LLM_TIMEOUT_MS' || k === 'LLM_MAX_RETRIES' || k.startsWith('BUDGET_')) {
        if (v != null && typeof v !== 'number') {
          return { valid: false, message: `key ${k} must be number` };
        }
        if (k === 'LLM_TIMEOUT_MS') {
          const ms = Number(v);
          if (v != null && (!Number.isFinite(ms) || ms < 100 || ms > 60000)) {
            return { valid: false, message: 'LLM_TIMEOUT_MS must be between 100 and 60000' };
          }
        }
        if (k === 'LLM_MAX_RETRIES') {
          const r = Number(v);
          if (v != null && (!Number.isFinite(r) || r < 0 || r > 5)) {
            return { valid: false, message: 'LLM_MAX_RETRIES must be between 0 and 5' };
          }
        }
        if (k.startsWith('BUDGET_COEFF_')) {
          const n = Number(v);
          if (v != null && (!Number.isFinite(n) || n < 0 || n > 10000)) {
            return { valid: false, message: `${k} must be between 0 and 10000` };
          }
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

    // 简化：仅校验字符串长度与类型
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