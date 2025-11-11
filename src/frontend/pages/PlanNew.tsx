import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/Card';
import Input from '../components/Input';
import DatePicker from '../components/DatePicker';
import Button from '../components/Button';
import MapView from '../components/MapView';
import ItineraryView from '../components/ItineraryView';

type Itinerary = { origin?: string; destination: string; start_date: string; end_date: string; days: any[]; budget?: number; party_size?: number };

export default function PlanNew() {
  const navigate = useNavigate();
  const CACHE_KEY = 'plan_new_cache_v1';
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
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
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('zh-CN');
  const [speechText, setSpeechText] = useState<string>('');
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);
  const [speechMsg, setSpeechMsg] = useState<string>('');
  const [speechStage, setSpeechStage] = useState<'initial' | 'recording' | 'recorded' | 'upload' | 'edit' | 'error'>('initial');
  const [recognizing, setRecognizing] = useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [editableText, setEditableText] = useState('');
  const [speechSource, setSpeechSource] = useState<'record' | 'upload' | null>(null);
  const [extracting, setExtracting] = useState(false);
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
  const [fieldErrors, setFieldErrors] = useState<{ origin: boolean; destination: boolean; start_date: boolean; end_date: boolean; party_size: boolean }>(() => ({ origin: false, destination: false, start_date: false, end_date: false, party_size: false }));

  // 初次挂载时，从本地缓存恢复页面状态
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cache = JSON.parse(raw);
      if (typeof cache.origin === 'string') setOrigin(cache.origin);
      if (typeof cache.destination === 'string') setDestination(cache.destination);
      if (typeof cache.start_date === 'string') setStart(cache.start_date);
      if (typeof cache.end_date === 'string') setEnd(cache.end_date);
      if (typeof cache.preferencesText === 'string') setPreferencesText(cache.preferencesText);
      if (typeof cache.partySize === 'number' || cache.partySize === '') setPartySize(cache.partySize);
      if (typeof cache.budgetHint === 'number' || cache.budgetHint === '') setBudgetHint(cache.budgetHint);
      if (cache.result) setResult(cache.result);
      if (typeof cache.selectedDay === 'number') setSelectedDay(cache.selectedDay);
    } catch { /* ignore parse error */ }
  }, []);

  // 当关键字段变化时，写入本地缓存，确保切页返回后仍保留
  React.useEffect(() => {
    const data = {
      origin,
      destination,
      start_date,
      end_date,
      preferencesText,
      partySize,
      budgetHint,
      result,
      selectedDay
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch { /* ignore storage error */ }
  }, [origin, destination, start_date, end_date, preferencesText, partySize, budgetHint, result, selectedDay]);

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
    // 前端必填校验：出发地、目的地、开始/结束日期、同行人数
    const needOrigin = !(typeof origin === 'string' && origin.trim());
    const needDest = !(typeof destination === 'string' && destination.trim());
    const needStart = !(typeof start_date === 'string' && start_date.trim());
    const needEnd = !(typeof end_date === 'string' && end_date.trim());
    const needParty = !(partySize !== '' && Number(partySize) > 0);
    const nextErrors = {
      origin: needOrigin,
      destination: needDest,
      start_date: needStart,
      end_date: needEnd,
      party_size: needParty,
    };
    setFieldErrors(nextErrors);
    if (needOrigin || needDest || needStart || needEnd || needParty) {
      setMsg('请补全必填项：出发地、目的地、开始日期、结束日期、同行人数');
      return;
    }
    setLoading(true);
    await generateCurrent();
  };

  const generateCurrent = async () => {
    const payload: any = { origin, destination, start_date, end_date };
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
    setSelectedDay(0);
    setLoading(false);
  };

  const onSavePlan = async () => {
    if (!result) return;
    const res = await api<{ id: number }>(
      '/plans',
      { method: 'POST', body: JSON.stringify({ itinerary: result }) }
    );
    if (!res.data) {
      setMsg(res.message || '保存失败');
      return;
    }
    navigate(`/plan/${res.data.id}`);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setSpeechSource('record');
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
        const txt = json.data.text || '';
        setSpeechText(txt);
        setEditableText(txt);
        setSpeechConfidence(typeof json.data.confidence === 'number' ? json.data.confidence : null);
        setSpeechMsg('识别完成，可编辑文本');
        setSpeechStage('edit');
      } else {
        setSpeechMsg(json?.message || '识别失败');
      }
    } catch (err: any) {
      setSpeechMsg('识别调用异常');
    } finally {
      setRecognizing(false);
    }
  };

  const applyExtractedFields = (fields: any) => {
    if (typeof fields?.origin === 'string' && fields.origin.trim()) setOrigin(fields.origin.trim());
    if (typeof fields?.destination === 'string' && fields.destination.trim()) setDestination(fields.destination.trim());
    if (typeof fields?.start_date === 'string' && fields.start_date.trim()) setStart(fields.start_date.trim());
    if (typeof fields?.end_date === 'string' && fields.end_date.trim()) setEnd(fields.end_date.trim());
    if (typeof fields?.party_size === 'number' && fields.party_size > 0) setPartySize(fields.party_size);
    if (typeof fields?.budget === 'number' && fields.budget > 0) setBudgetHint(fields.budget);
    if (typeof fields?.notes === 'string' && fields.notes.trim()) setPreferencesText(prev => prev ? `${prev}\n${fields.notes.trim()}` : fields.notes.trim());
  };

  const handleReInput = () => {
    if (speechSource === 'record') {
      startRecording();
    } else {
      uploadInputRef.current?.click();
    }
  };

  const generateInfoFromText = async () => {
    setSpeechMsg('');
    setExtracting(true);
    try {
      const resp = await fetch('/planner/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editableText })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.data) {
        const msg = json?.message || '文本提取失败';
        // 当后端返回缺少大模型密钥的错误时，弹窗提示并引导至设置页面
        if (json?.code === 'BAD_REQUEST' && typeof msg === 'string' && (msg.includes('BAILIAN_API_KEY') || msg.includes('未配置大模型'))) {
          window.alert('未配置大模型BAILIAN_API_KEY，请先至设置页面进行配置！');
          // 可选：跳转到设置页面，方便用户立即配置
          try { window.location.href = '/settings'; } catch {}
        }
        setSpeechMsg(msg);
        setSpeechStage('error');
        return;
      }
      const data = json.data;
      if (data.coverage === 'none') {
        setSpeechMsg('识别的内容与行程信息无关，请重新录音/上传音频');
        setSpeechStage('error');
        return;
      }
      // 填充已识别字段
      applyExtractedFields(data);
      if (data.coverage === 'full') {
        setSpeechMsg('识别成功，正在生成行程信息');
        setLoading(true);
        await generateCurrent();
        setSpeechStage('initial');
      } else {
        // 当信息不完整时，清空缺失字段并标红提醒用户补全
        const nextErrors = { origin: false, destination: false, start_date: false, end_date: false, party_size: false };
        const needOrigin = !(typeof data.origin === 'string' && data.origin.trim());
        const needDest = !(typeof data.destination === 'string' && data.destination.trim());
        const needStart = !(typeof data.start_date === 'string' && data.start_date.trim());
        const needEnd = !(typeof data.end_date === 'string' && data.end_date.trim());
        const needParty = !(typeof data.party_size === 'number' && data.party_size > 0);
        if (needOrigin) { setOrigin(''); nextErrors.origin = true; }
        else { nextErrors.origin = false; }
        if (needDest) { setDestination(''); nextErrors.destination = true; }
        else { nextErrors.destination = false; }
        if (needStart) { setStart(''); nextErrors.start_date = true; }
        else { nextErrors.start_date = false; }
        if (needEnd) { setEnd(''); nextErrors.end_date = true; }
        else { nextErrors.end_date = false; }
        if (needParty) { setPartySize(''); nextErrors.party_size = true; }
        else { nextErrors.party_size = false; }
        setFieldErrors(nextErrors);
        setSpeechMsg('识别成功，但信息不完整，请在左侧进行信息补全');
        // 等待用户点击“我已知晓，退出此次识别”
      }
    } catch (e: any) {
      setSpeechMsg('文本提取调用异常');
      setSpeechStage('error');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1180 }}>
      <div className="grid two">
        <Card title="新建行程">
          <form onSubmit={onGenerate} className="stack">
            <Input label="出发地" placeholder="出发地" value={origin} onChange={e => { setOrigin(e.target.value); setFieldErrors(prev => ({ ...prev, origin: false })); }} error={fieldErrors.origin} />
            <Input label="目的地" placeholder="目的地" value={destination} onChange={e => { setDestination(e.target.value); setFieldErrors(prev => ({ ...prev, destination: false })); }} error={fieldErrors.destination} />
            <div className="grid two">
              <DatePicker label="开始日期" value={start_date} onChange={v => { setStart(v); setFieldErrors(prev => ({ ...prev, start_date: false })); }} error={fieldErrors.start_date} />
              <DatePicker label="结束日期" value={end_date} onChange={v => { setEnd(v); setFieldErrors(prev => ({ ...prev, end_date: false })); }} error={fieldErrors.end_date} />
            </div>
            <div className="grid two">
              <Input label="预算（可选）" type="number" placeholder="不填则由AI预测" value={budgetHint} onChange={e => setBudgetHint(Number((e.target as HTMLInputElement).value) || '')} />
              <Input label="同行人数" type="number" placeholder="默认1人" value={partySize} onChange={e => { const val = Number((e.target as HTMLInputElement).value) || ''; setPartySize(val); setFieldErrors(prev => ({ ...prev, party_size: false })); }} error={fieldErrors.party_size} />
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

            {speechStage === 'edit' && (
              <div className="speech-module" style={{ width: '100%', alignItems: 'center' }}>
                <div className="speech-row" style={{ width: '100%', justifyContent: 'center' }}>
                  <textarea
                    rows={6}
                    value={editableText}
                    onChange={e => setEditableText(e.target.value)}
                    style={{ width: 'min(720px, 95%)', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)' }}
                    placeholder="可在此编辑识别文本"
                  />
                </div>
                <div className="speech-actions">
                  <Button type="button" onClick={handleReInput}>{speechSource === 'upload' ? '重新上传' : '重新录音'}</Button>
                  <Button type="button" onClick={() => setSpeechStage('initial')}>退出</Button>
                  <Button type="button" variant="primary" disabled={extracting || !editableText.trim()} onClick={generateInfoFromText}>{extracting ? '提取中…' : '生成行程信息'}</Button>
                </div>
                {speechMsg && <span className="note">{speechMsg}</span>}
              </div>
            )}

            {speechStage === 'error' && (
              <div className="speech-module">
                <div className="kpi">{speechMsg || '识别的内容与行程信息无关，请重新录音/上传音频'}</div>
                <div className="speech-actions">
                  <Button type="button" onClick={handleReInput}>{speechSource === 'upload' ? '重新上传' : '重新录音'}</Button>
                  <Button type="button" onClick={() => setSpeechStage('initial')}>退出</Button>
                </div>
              </div>
            )}
          </div>
          </div>
        </Card>

        {result && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card
              title="行程与地图"
              footer={(
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                  <Button type="button" variant="primary" onClick={onSavePlan}>保存行程</Button>
                  {msg && <span className="note">{msg}</span>}
                </div>
              )}
            >
              <div className="stack" style={{ gap: 16 }}>
                <Card title="选择查看的日期">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(result.days || []).map((_: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDay(idx)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: idx === selectedDay ? 'var(--primary)' : 'var(--bg)',
                          color: idx === selectedDay ? '#fff' : 'var(--fg)',
                          cursor: 'pointer'
                        }}
                      >第{idx + 1}天</button>
                    ))}
                  </div>
                </Card>

                <div className="grid two">
                  <div className={((result.days?.[selectedDay]?.segments || []).length) < 4 ? 'fit-column' : undefined} style={{ minHeight: ((result.days?.[selectedDay]?.segments || []).length) < 4 ? 550 : undefined }}>
                    <ItineraryView itinerary={result} singleDayIndex={selectedDay} />
                  </div>
                  <MapView itinerary={result} apiKey={baiduAk} dayIndex={selectedDay} hideControls={true} />
                </div>
                </div>
            </Card>
          </div>
        )}
      </div>


    </div>
  );
}