import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import DatePicker from '../components/DatePicker';
import Button from '../components/Button';
import MapView from '../components/MapView';
import ItineraryView from '../components/ItineraryView';

type Itinerary = { destination: string; start_date: string; end_date: string; days: any[]; budget?: number; party_size?: number };

export default function PlanNew() {
  const [destination, setDestination] = useState('Hangzhou');
  // 默认开始日期为今天、结束日期为次日
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const defaultStart = fmt(today);
  const defaultEnd = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const [start_date, setStart] = useState(defaultStart);
  const [end_date, setEnd] = useState(defaultEnd);
  const [preferencesText, setPreferencesText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh-CN');
  const [speechText, setSpeechText] = useState<string>('');
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);
  const [speechMsg, setSpeechMsg] = useState<string>('');
  const [speechStage, setSpeechStage] = useState<'initial' | 'recording' | 'recorded' | 'upload'>('initial');
  const [recognizing, setRecognizing] = useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const [recordMs, setRecordMs] = useState(0);
  const timerRef = React.useRef<number | null>(null);
  const limitTimerRef = React.useRef<number | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const volTimerRef = React.useRef<number | null>(null);
  const [volume, setVolume] = useState(0);
  const MAX_RECORD_SEC = 60;
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [baiduAk, setBaiduAk] = useState<string | undefined>();
  const [partySize, setPartySize] = useState<number | ''>(1);
  const [budgetHint, setBudgetHint] = useState<number | ''>('');

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<Record<string, any>>('/settings');
        if (res.data && typeof res.data.BAIDU_BROWSER_AK === 'string') {
          setBaiduAk(res.data.BAIDU_BROWSER_AK);
        }
      } catch { /* noop */ }
    })();
  }, []);

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setResult(null);
    setLoading(true);
    const payload: any = { destination, start_date, end_date };
    if (preferencesText && preferencesText.trim()) {
      payload.preferences = { notes: preferencesText.trim() };
    }
    if (partySize !== '' && Number(partySize) > 0) payload.party_size = Number(partySize);
    if (budgetHint !== '' && Number(budgetHint) > 0) payload.budget = Number(budgetHint);
    const gen = await api<Itinerary>('/planner/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!gen.data) {
      setLoading(false);
      setMsg(gen.message || '生成失败');
      return;
    }
    setResult(gen.data);
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // setup audio context for volume meter
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        analyserRef.current = analyser;
        const data = new Float32Array(analyser.fftSize);
        volTimerRef.current = window.setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
          }
          const rms = Math.sqrt(sum / data.length);
          setVolume(Math.min(1, rms * 3));
        }, 100);
      } catch (_err) {
        // ignore volume meter errors
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mpeg';
      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      rec.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `recording.${mimeType.includes('webm') ? 'webm' : 'mp3'}`, { type: mimeType });
        setAudioFile(file);
        try {
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          setAudioUrl(URL.createObjectURL(file));
        } catch {}
        // stop tracks
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (limitTimerRef.current) {
          window.clearTimeout(limitTimerRef.current);
          limitTimerRef.current = null;
        }
        if (volTimerRef.current) {
          window.clearInterval(volTimerRef.current);
          volTimerRef.current = null;
        }
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close(); } catch {}
          audioCtxRef.current = null;
        }
        setSpeechStage('recorded');
      };
      recorderRef.current = rec;
      rec.start();
      setSpeechMsg('');
      setSpeechText('');
      setSpeechConfidence(null);
      setSpeechStage('recording');
      setRecording(true);
      setRecordMs(0);
      timerRef.current = window.setInterval(() => setRecordMs(prev => prev + 100), 100);
      limitTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }, MAX_RECORD_SEC * 1000);
    } catch (err: any) {
      setSpeechMsg(`无法开始录音：${err.message || '未知错误'}`);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const recognizeCurrentAudio = async () => {
    setSpeechMsg('');
    setSpeechText('');
    setSpeechConfidence(null);
    if (!audioFile || recording) {
      setSpeechMsg('请先选择或生成音频');
      return;
    }
    try {
      setRecognizing(true);
      const form = new FormData();
      form.append('audio', audioFile);
      form.append('language', language);
      const token = localStorage.getItem('token');
      const res = await fetch('/speech/recognize', {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        setSpeechText(json.data.text || '');
        setSpeechConfidence(typeof json.data.confidence === 'number' ? json.data.confidence : null);
        setSpeechMsg('识别完成');
      } else {
        setSpeechMsg(json?.message || '识别失败');
      }
    } catch (err: any) {
      setSpeechMsg('识别调用异常');
    } finally {
      setRecognizing(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <div className="grid two">
        <Card title="新建行程">
          <form onSubmit={onGenerate} className="stack">
            <Input label="目的地" placeholder="目的地" value={destination} onChange={e => setDestination(e.target.value)} />
            <div className="grid two">
              <DatePicker label="开始日期" value={start_date} onChange={v => setStart(v)} />
              <DatePicker label="结束日期" value={end_date} onChange={v => setEnd(v)} />
            </div>
            <div className="grid two">
              <Input label="预算（可选）" type="number" placeholder="不填则由AI预测" value={budgetHint} onChange={e => setBudgetHint(Number((e.target as HTMLInputElement).value) || '')} />
              <Input label="同行人数" type="number" placeholder="默认1人" value={partySize} onChange={e => setPartySize(Number((e.target as HTMLInputElement).value) || '')} />
            </div>
            <div className="stack">
              <div className="label">偏好（可选）</div>
              <textarea
                rows={3}
                placeholder="例如：节奏偏慢、偏好博物馆、避开拥挤景点"
                value={preferencesText}
                onChange={e => setPreferencesText(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button type="submit" variant="primary" disabled={loading}>{loading ? '生成中...' : '生成行程'}</Button>
              {msg && <span className="note">{msg}</span>}
            </div>
            <div className="note">提示：若未填写预算，AI 将在生成行程时一并预测总预算。</div>
          </form>
        </Card>

        <Card title="语音识别">
          <div className="speech-card">
          <div className="speech-stage">
            {speechStage === 'initial' && (
              <div className="speech-module">
                <div className="speech-actions">
                  <button type="button" className="circle-btn circle-primary" onClick={startRecording} disabled={recording}>开始录音</button>
                  <button type="button" className="circle-btn circle-secondary" onClick={() => uploadInputRef.current?.click()}>音频上传</button>
                </div>
                <input ref={uploadInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setAudioFile(f);
                  setSpeechMsg('');
                  setSpeechText('');
                  setSpeechConfidence(null);
                  try {
                    if (audioUrl) URL.revokeObjectURL(audioUrl);
                    setAudioUrl(f ? URL.createObjectURL(f) : null);
                  } catch {}
                  setSpeechStage(f ? 'upload' : 'initial');
                }} />
              </div>
            )}

            {speechStage === 'recording' && (
              <div className="speech-module">
                <div className="speech-timer">录音中… {Math.floor(recordMs / 1000)}s / {MAX_RECORD_SEC}s</div>
                <div className="wave-outer" style={{ width: 160 }}>
                  <div className="wave-inner" style={{ width: `${Math.round(volume * 100)}%`, background: recording ? '#22c55e' : '#555' }} />
                </div>
                <div className="speech-actions">
                  <button type="button" className="circle-btn circle-danger" onClick={stopRecording}>结束录音</button>
                </div>
              </div>
            )}

            {speechStage === 'recorded' && (
              <div className="speech-module">
                {audioUrl && <audio controls src={audioUrl} className="speech-player" />}
                <div className="speech-actions">
                  <Button type="button" variant="primary" disabled={recognizing || recording || !audioFile} onClick={recognizeCurrentAudio}>{recognizing ? '识别中…' : '识别当前音频'}</Button>
                  <Button type="button" onClick={startRecording} disabled={recording}>重新录音</Button>
                  <Button type="button" onClick={() => { setAudioFile(null); setAudioUrl(null); setSpeechText(''); setSpeechConfidence(null); setSpeechMsg(''); setSpeechStage('initial'); }}>退出录音</Button>
                </div>
                <div className="speech-row">
                  <span className="label">语言</span>
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="zh-CN">中文（zh-CN）</option>
                    <option value="en-US">英语（en-US）</option>
                  </select>
                </div>
                {speechMsg && <span className="note">{speechMsg}</span>}
                {(speechText || speechConfidence != null) && (
                  <div className="stack" style={{ alignItems: 'center' }}>
                    <div className="kpi">识别文本：{speechText || '(空)'}{speechConfidence != null ? ` · 置信度：${Math.round(speechConfidence * 100)}%` : ''}</div>
                    <div className="speech-actions">
                      <Button type="button" onClick={() => {
                        if (speechText && speechText.trim()) {
                          setDestination(speechText.trim());
                          setSpeechMsg('已填充到目的地');
                        }
                      }}>填充到目的地</Button>
                      <Button type="button" onClick={() => {
                        if (speechText && speechText.trim()) {
                          setPreferencesText(prev => (prev ? `${prev}\n${speechText.trim()}` : speechText.trim()));
                          setSpeechMsg('已追加到偏好');
                        }
                      }}>追加到偏好</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {speechStage === 'upload' && (
              <div className="speech-module">
                {audioUrl && <audio controls src={audioUrl} className="speech-player" />}
                <div className="speech-actions">
                  <Button type="button" variant="primary" disabled={recognizing || !audioFile} onClick={recognizeCurrentAudio}>{recognizing ? '识别中…' : '识别当前音频'}</Button>
                  <Button type="button" onClick={() => uploadInputRef.current?.click()}>重新上传音频</Button>
                  <Button type="button" onClick={() => { setAudioFile(null); setAudioUrl(null); setSpeechText(''); setSpeechConfidence(null); setSpeechMsg(''); setSpeechStage('initial'); }}>退出上传</Button>
                </div>
                <div className="speech-row">
                  <span className="label">语言</span>
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="zh-CN">中文（zh-CN）</option>
                    <option value="en-US">英语（en-US）</option>
                  </select>
                </div>
                {speechMsg && <span className="note">{speechMsg}</span>}
                {(speechText || speechConfidence != null) && (
                  <div className="stack" style={{ alignItems: 'center' }}>
                    <div className="kpi">识别文本：{speechText || '(空)'}{speechConfidence != null ? ` · 置信度：${Math.round(speechConfidence * 100)}%` : ''}</div>
                    <div className="speech-actions">
                      <Button type="button" onClick={() => {
                        if (speechText && speechText.trim()) {
                          setDestination(speechText.trim());
                          setSpeechMsg('已填充到目的地');
                        }
                      }}>填充到目的地</Button>
                      <Button type="button" onClick={() => {
                        if (speechText && speechText.trim()) {
                          setPreferencesText(prev => (prev ? `${prev}\n${speechText.trim()}` : speechText.trim()));
                          setSpeechMsg('已追加到偏好');
                        }
                      }}>追加到偏好</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </Card>

        {result && (
          <div className="stack" style={{ gridColumn: '1 / -1', gap: 16 }}>
            {result.days.map((d: any, idx: number) => (
              <div key={idx} className="grid two">
                <ItineraryView itinerary={result} singleDayIndex={idx} />
                <MapView itinerary={result} apiKey={baiduAk} dayIndex={idx} hideControls={true} />
              </div>
            ))}
          </div>
        )}
      </div>


    </div>
  );
}