export interface SpeechResult {
  text: string;
  confidence: number; // 0-1
}

export interface SpeechServiceOptions {
  xfApiKey?: string;
  xfAppId?: string;
}

export class SpeechService {
  constructor(private opts: SpeechServiceOptions = {}) {}

  async recognize(audio: Buffer, language: string = 'zh-CN'): Promise<SpeechResult> {
    // Mock implementation: in real impl, call Xunfei SDK using opts.xfApiKey/xfAppId
    // Basic heuristic: if audio buffer is non-empty, return a stub text
    const ok = Buffer.isBuffer(audio) && audio.length > 0;
    const baseText = language.startsWith('zh') ? '测试音频识别结果' : 'Sample speech recognition result';
    return {
      text: ok ? baseText : '',
      confidence: ok ? 0.92 : 0.0
    };
  }
}