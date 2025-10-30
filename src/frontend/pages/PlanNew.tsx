import React, { useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import MapView from '../components/MapView';
import BudgetView from '../components/BudgetView';
import ItineraryView from '../components/ItineraryView';

type Itinerary = { destination: string; start_date: string; end_date: string; days: any[] };

export default function PlanNew() {
  const [destination, setDestination] = useState('Hangzhou');
  const [start_date, setStart] = useState('2025-05-01');
  const [end_date, setEnd] = useState('2025-05-02');
  const [preferencesText, setPreferencesText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [amapKey, setAmapKey] = useState<string | undefined>(undefined);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh-CN');
  const [speechText, setSpeechText] = useState<string>('');
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);
  const [speechMsg, setSpeechMsg] = useState<string>('');
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

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<Record<string, any>>('/settings');
        if (res.data && typeof res.data.AMAP_API_KEY === 'string') {
          setAmapKey(res.data.AMAP_API_KEY);
        }
      } catch { /* noop */ }
    })();
  }, []);

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setResult(null);
    setBudget(null);
    setLoading(true);
    const payload: any = { destination, start_date, end_date };
    if (preferencesText && preferencesText.trim()) {
      payload.preferences = { notes: preferencesText.trim() };
    }
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
    const est = await api<any>('/budget/estimate', {
      method: 'POST',
      body: JSON.stringify({ destination, start_date, end_date, party_size: 2, itinerary: gen.data })
    });
    setLoading(false);
    if (est.data) setBudget(est.data);
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
      };
      recorderRef.current = rec;
      rec.start();
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

  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="grid two">
        <Card title="新建行程">
          <form onSubmit={onGenerate} className="stack">
            <Input label="目的地" placeholder="目的地" value={destination} onChange={e => setDestination(e.target.value)} />
            <div className="grid two">
              <Input label="开始日期" placeholder="YYYY-MM-DD" value={start_date} onChange={e => setStart(e.target.value)} />
              <Input label="结束日期" placeholder="YYYY-MM-DD" value={end_date} onChange={e => setEnd(e.target.value)} />
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
              <Button type="submit" variant="primary" disabled={loading}>{loading ? '生成中...' : '生成行程并估算预算'}</Button>
              {msg && <span className="note">{msg}</span>}
            </div>
            <div className="note">生成后将自动调用预算估算。</div>
          </form>
        </Card>

        <Card title="语音识别（录音/上传）">
          <div className="stack">
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                <Button type="button" variant="primary" onClick={recording ? stopRecording : startRecording}>
                  {recording ? '停止录音' : '开始录音'}
                </Button>
                <span className="note" style={{ minWidth: 160 }}>
                  {recording ? `录音中… ${Math.floor(recordMs / 1000)}s / ${MAX_RECORD_SEC}s` : (audioFile ? `已生成：${audioFile.name}` : '尚未生成音频')}
                </span>
                <div style={{ width: 120, height: 8, background: '#1b2545', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ width: `${Math.min(100, Math.round((recordMs / 1000) / MAX_RECORD_SEC * 100))}%`, height: '100%', background: '#4caf50' }} />
                </div>
                <div style={{ width: 80, height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(volume * 100)}%`, height: '100%', background: recording ? '#4caf50' : '#555' }} />
                </div>
              </div>
              <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                <span className="label">或上传文件</span>
                <input type="file" accept="audio/*" onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setAudioFile(f);
                  try {
                    if (audioUrl) URL.revokeObjectURL(audioUrl);
                    setAudioUrl(f ? URL.createObjectURL(f) : null);
                  } catch {}
                }} />
                {audioUrl && (
                  <audio controls src={audioUrl} style={{ maxWidth: 260 }} />
                )}
              </div>
            </div>
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <div className="label">语言</div>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="zh-CN">中文（zh-CN）</option>
                <option value="en-US">英语（en-US）</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button type="button" onClick={async () => {
                setSpeechMsg('');
                setSpeechText('');
                setSpeechConfidence(null);
                if (!audioFile || recording) {
                  setSpeechMsg('请先选择音频文件');
                  return;
                }
                try {
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
                  } else {
                    setSpeechMsg(json?.message || '识别失败');
                  }
                } catch (err: any) {
                  setSpeechMsg('识别调用异常');
                }
              }}>识别当前音频</Button>
              {speechMsg && <span className="note">{speechMsg}</span>}
            </div>
            {(speechText || speechConfidence != null) && (
              <div className="stack">
                <div className="kpi">识别文本：{speechText || '(空)'}</div>
                {speechConfidence != null && <div className="note">置信度：{Math.round(speechConfidence * 100)}%</div>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
        </Card>

        {result && (
          <>
            <ItineraryView itinerary={result} />
            <div className="spacer" />
            <MapView itinerary={result} apiKey={amapKey} />
          </>
        )}
      </div>

      {budget && (
        <>
          <div className="spacer" />
          <BudgetView estimate={budget} />
        </>
      )}
    </div>
  );
}