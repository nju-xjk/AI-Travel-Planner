import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';

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

  /**
   * Convert audio to WAV PCM 16k mono format for iFLYTEK IAT
   * @param audioBuffer Input audio buffer (webm, mp3, ogg, etc.)
   * @param mimeType MIME type of input audio
   * @returns Promise<Buffer> WAV PCM 16k mono buffer
   */
  private async convertToWav(audioBuffer: Buffer, mimeType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Create temporary files
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `input_${Date.now()}.${this.getExtensionFromMime(mimeType)}`);
      const outputFile = path.join(tempDir, `output_${Date.now()}.wav`);

      try {
        // Write input buffer to temp file
        fs.writeFileSync(inputFile, audioBuffer);

        // Convert using ffmpeg
        ffmpeg(inputFile)
          .audioCodec('pcm_s16le')  // PCM 16-bit little-endian
          .audioFrequency(16000)    // 16kHz sample rate
          .audioChannels(1)         // Mono
          .format('wav')
          .on('end', () => {
            try {
              // Read converted file
              const wavBuffer = fs.readFileSync(outputFile);
              
              // Clean up temp files
              this.cleanupTempFiles([inputFile, outputFile]);
              
              resolve(wavBuffer);
            } catch (err) {
              this.cleanupTempFiles([inputFile, outputFile]);
              reject(err);
            }
          })
          .on('error', (err: any) => {
            this.cleanupTempFiles([inputFile, outputFile]);
            reject(new Error(`Audio conversion failed: ${err.message}`));
          })
          .save(outputFile);
      } catch (err) {
        this.cleanupTempFiles([inputFile, outputFile]);
        reject(err);
      }
    });
  }

  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav'
    };
    return mimeMap[mimeType] || 'bin';
  }

  private cleanupTempFiles(files: string[]): void {
    files.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup temp file ${file}:`, err);
      }
    });
  }

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

  /**
   * Recognize speech with automatic audio format conversion
   * @param audio Audio buffer in any format (webm, mp3, ogg, wav, etc.)
   * @param mimeType MIME type of the audio
   * @param language Language code (default: 'zh-CN')
   * @returns Promise<SpeechResult>
   */
  async recognizeWithAutoConvert(audio: Buffer, mimeType: string, language: string = 'zh-CN'): Promise<SpeechResult> {
    const ok = Buffer.isBuffer(audio) && audio.length > 0;
    if (!ok) return { text: '', confidence: 0 };

    const hasCreds = !!(this.opts.xfApiKey && this.opts.xfApiSecret && this.opts.xfAppId);
    if (!hasCreds) {
      // Fallback mock when credentials are missing
      const baseText = language.startsWith('zh') ? '测试音频识别结果（自动转码）' : 'Sample speech recognition result (auto-converted)';
      return { text: baseText, confidence: 0.9 };
    }

    try {
      // Check if audio is already WAV format
      let wavBuffer: Buffer;
      if (mimeType.includes('wav') || mimeType.includes('wave')) {
        // Assume it's already in correct format, but we might still need to convert to ensure 16k mono
        wavBuffer = await this.convertToWav(audio, mimeType);
      } else {
        // Convert from other formats (webm, mp3, ogg, etc.) to WAV PCM 16k mono
        wavBuffer = await this.convertToWav(audio, mimeType);
      }

      // Use the existing recognize method with converted WAV
      return await this.recognize(wavBuffer, language);
    } catch (err) {
      console.error('Audio conversion failed:', err);
      throw new Error(`音频转码失败: ${err instanceof Error ? err.message : String(err)}`);
    }
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