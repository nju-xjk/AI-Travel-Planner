# 技术方案（语音与录音）

## 概述
- 目标：在 `PlanNew` 页面提供两类语音输入方式，以便快捷填写目的地与偏好。
  - 浏览器实时识别（Web Speech API）：点击按钮后直接说话，实时转文字。
  - 录音/上传识别：使用麦克风录制（`MediaRecorder`），或上传本地音频文件，经后端识别。

## 前端设计
- 页面：`src/frontend/pages/PlanNew.tsx`
  - 实时识别：检测 `window.SpeechRecognition || window.webkitSpeechRecognition`；提供开始/停止按钮、语言选择（`zh-CN`/`en-US`）；在识别事件中持续更新文本。
  - 录音：`MediaRecorder` 采集麦克风音频，默认 `audio/webm`（兼容 `audio/mpeg` 作为回退）；
    - 录音时长上限：`MAX_RECORD_SEC = 15`（自动停止）；
    - 音量提示：`AudioContext + AnalyserNode` 计算 RMS，提供简易音量条反馈；
  - 上传：文件输入 `accept="audio/*"`，支持多种音频类型；
  - 识别结果处理：
    - 显示文本与可选置信度；
    - 提供“填充到目的地”“追加到偏好”按钮，方便快速录入需求；
  - 语言：识别调用附带 `language`（`zh-CN`/`en-US`），用于前端实时识别与后端识别的统一。

## 后端设计
- 路由：`POST /speech/recognize`（`src/api/speechRoutes.ts`）
  - 上传字段：`audio`（单文件），`language`（可选，默认 `zh-CN`）；
  - 大小限制：10MB；
  - MIME 白名单：`audio/wav`, `audio/x-wav`, `audio/wave`, `audio/webm`, `audio/mpeg`, `audio/mp3`, `audio/ogg`。
  - 调用服务：`SpeechService.recognize(Buffer, language)` 返回 `{ text, confidence }`。
- 服务：`src/services/speechService.ts`
  - 使用 `SettingsService` 读取配置：`XF_API_KEY`, `XF_APP_ID`；
  - 当前实现：若无有效第三方配置，返回可用的本地 Mock 结果；
  - 扩展位：集成科大讯飞/iFLYTEK 语音识别 WebAPI（上传音频、带语言参数）或其他厂商（如 OpenAI Whisper）。

## 配置与密钥
- 设置页：`/settings`（`src/frontend/pages/Settings.tsx`）支持输入并保存：
  - `XF_API_KEY`（科大讯飞 API Key）
  - `XF_APP_ID`（科大讯飞 AppID）
  - 其他可选键（如 `LLM_API_KEY`, `AMAP_API_KEY`）。
- 存储位置：`config/local.json`，通过 `SettingsService` 读写；不在仓库保存任何密钥。

## 兼容性与限制
- 浏览器实时识别（Web Speech API）：
  - Chrome/Edge 支持良好；Firefox 暂不支持；Safari 支持受限。
  - 当浏览器不支持时，UI 显示提示并可改用录音/上传方式。
- 录音格式：默认 `audio/webm`（Opus 编码），后端已放宽类型白名单；如需调用只接受 PCM/WAV 的第三方 API，可在后端增加转码流程（如集成 `ffmpeg`）。
- 文件大小：后台限制为 10MB；较长录音建议前端限时或分段上传。

## 流程概述
1. 用户在 `PlanNew` 页面点击“开始实时识别”并说话，或点击“开始录音”后发言；
2. 实时识别：文本直接显示在页面；录音：生成 `audio/webm` 文件，点击“识别当前音频”后上传至后端；
3. 后端返回识别文本与可选置信度；
4. 用户选择“一键填充到目的地”或“追加到偏好”，再提交生成行程；

## 后续优化建议
- 接入科大讯飞正式识别 API（REST 或 SDK），并根据 `language` 做参数映射与编码兼容；
- 增加录音转码到 WAV/PCM 的后端流程；
- 增强 UI：波形、录音倒计时、错误与重试提示；
- 自动将识别内容结构化（目的地、日期、天数、偏好）并填充对应字段；