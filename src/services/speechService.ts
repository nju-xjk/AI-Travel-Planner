export interface SpeechResult {
  text: string;
  confidence: number; // 0-1
}

export interface SpeechServiceOptions {
  xfApiKey?: string;
  xfApiSecret?: string;
  xfAppId?: string;
}

export class SpeechService {
  constructor(private opts: SpeechServiceOptions = {}) {}

  private buildIatUrl(): string {
    const host = 'iat-api.xfyun.cn';
    const path = '/v2/iat';
    const date = new Date().toUTCString();
    const apiKey = this.opts.xfApiKey || '';
    const apiSecret = this.opts.xfApiSecret || '';
    const signatureOrigin = `host: ${host}\n` + `date: ${date}\n` + `GET ${path} HTTP/1.1`;
    const crypto = require('crypto');
    const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
    const authorization = Buffer.from(
      `api_key=\"${apiKey}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signatureSha}\"`
    ).toString('base64');
    return `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
  }

  async recognize(audio: Buffer, language: string = 'zh-CN'): Promise<SpeechResult> {
    const ok = Buffer.isBuffer(audio) && audio.length > 0;
    if (!ok) return { text: '', confidence: 0 };

    const hasCreds = !!(this.opts.xfApiKey && this.opts.xfApiSecret && this.opts.xfAppId);
    if (!hasCreds) {
      // Fallback mock when credentials are missing
      const baseText = language.startsWith('zh') ? '测试音频识别结果' : 'Sample speech recognition result';
      return { text: baseText, confidence: 0.9 };
    }

    // IMPORTANT: iFLYTEK IAT expects PCM/WAV 16k mono raw frames.
    // Here we assume the input is WAV-PCM. Without transcoding, non-PCM (e.g., webm/mp3) will fail.

    const WS = require('ws');
    const url = this.buildIatUrl();
    const appId = this.opts.xfAppId as string;
    const lang = language && language.toLowerCase().startsWith('en') ? 'en_us' : 'zh_cn';

    return await new Promise<SpeechResult>((resolve, reject) => {
      let textChunks: string[] = [];
      let closed = false;
      const ws = new WS(url, { rejectUnauthorized: true });

      ws.on('open', () => {
        try {
          const frame0 = {
            common: { app_id: appId },
            business: {
              language: lang,
              domain: 'iat',
              accent: lang === 'zh_cn' ? 'mandarin' : undefined,
              vad_eos: 1600,
              dwa: 'wpgs',
              // audio format: raw PCM 16k mono
              auf: 'audio/L16;rate=16000',
              aue: 'raw'
            },
            data: {
              status: 0,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: audio.toString('base64')
            }
          };
          ws.send(JSON.stringify(frame0));
          const frameEnd = { data: { status: 2 } };
          ws.send(JSON.stringify(frameEnd));
        } catch (err) {
          reject(err);
        }
      });

      ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          const code = msg.code;
          if (code !== 0) {
            return reject(new Error(`XF IAT error: ${code} ${msg.message || ''}`));
          }
          const status = msg.data?.status;
          const wsArr = msg.data?.result?.ws || [];
          for (const w of wsArr) {
            const cws = w.cw || [];
            for (const cw of cws) {
              if (cw.w) textChunks.push(cw.w);
            }
          }
          if (status === 2) {
            if (!closed) {
              closed = true;
              ws.close();
              const fullText = textChunks.join('');
              resolve({ text: fullText, confidence: fullText ? 0.85 : 0.0 });
            }
          }
        } catch (err) {
          reject(err);
        }
      });

      ws.on('error', (err: any) => {
        reject(err);
      });
      ws.on('close', () => {
        if (!closed) {
          const fullText = textChunks.join('');
          resolve({ text: fullText, confidence: fullText ? 0.85 : 0.0 });
        }
      });
    });
  }
}