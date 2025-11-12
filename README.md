# AI Travel Planner

一个前后端一体的旅行规划与费用管理应用，基于 React + Vite（前端）与 Express + TypeScript（后端）。

## 快速上手（如何运行）

- 前置要求：`Node.js >= 18（推荐 20）`，`npm`；可选 `Docker >= 24`
- 安装依赖：`npm ci`
- 开发模式（前端 + 代理，推荐）：
  - 启动前端：`npm run dev`
  - 访问前端：`http://127.0.0.1:5174`（若占用则 5173/5175）
  - 前端会将 `/api/*` 代理到后端 `http://127.0.0.1:3000`（见 `vite.config.ts`）
- 后端开发/本地测试：
  - 构建后端：`npm run build`
  - 启动后端：`npm start`（访问 `http://127.0.0.1:3000`）
  - 生产模式下，后端同时提供静态前端：访问 `http://127.0.0.1:3000/`

环境变量（后端）：
- `PORT`（默认 `3000`）
- `JWT_SECRET`（默认 `dev-secret`，生产请更换）
- `LOG_LEVEL`（`debug|info|warn|error`，默认随环境）
- `REQUEST_LOG`（设为 `false` 关闭请求日志）

## 本地运行

- 安装依赖：`npm ci`
- 开发模式（前端 + 代理）：`npm run dev`（访问 `http://127.0.0.1:5174`，后端代理到 `http://127.0.0.1:3000`）
- 后端开发或测试：`npm run build && npm start`（访问 `http://127.0.0.1:3000`）

环境变量（后端）：
- `PORT`（默认 `3000`）
- `JWT_SECRET`（默认 `dev-secret`）
- `LOG_LEVEL`（`debug|info|warn|error`，默认随环境）
- `REQUEST_LOG`（设为 `false` 关闭请求日志）

## Docker 镜像

镜像包含已构建的前端与后端，容器启动后可直接访问。

本地构建与运行：

```bash
docker build -t ai-travel-planner:latest .
docker run --rm -p 3000:3000 -e JWT_SECRET=change-me ai-travel-planner:latest
# 打开 http://localhost:3000
```

结束容器：
- 前台运行：在运行容器的终端按 `Ctrl+C`（使用 `--rm` 会自动删除容器）
- 命名运行：
  - 启动：`docker run --rm --name ai-travel-planner -p 3000:3000 -e JWT_SECRET=change-me ai-travel-planner:latest`
  - 停止：`docker stop ai-travel-planner`
- 未命名容器（PowerShell）：`docker stop (docker ps -q --filter ancestor=ai-travel-planner:latest)`

从 GitHub Actions 下载镜像文件（tar）：
- 触发或等待工作流“Build and Push Docker Image to Aliyun ACR”运行完成
- 在该运行的 Artifacts 中下载 `ai-travel-planner-image`（文件名 `ai-travel-planner.tar`）
- 本地导入并运行：
  ```bash
  docker load -i ai-travel-planner.tar
  docker run --rm -p 3000:3000 -e JWT_SECRET=change-me ai-travel-planner:latest
  ```

## GitHub Actions 推送到阿里云 ACR

工作流文件：`.github/workflows/docker-acr.yml`

在 GitHub 仓库的 Secrets 中配置以下键：
- `ALIYUN_REGISTRY`：如 `registry.cn-hangzhou.aliyuncs.com`
- `ALIYUN_NAMESPACE`：命名空间，如 `your-namespace`
- `ALIYUN_REPO`：仓库名，如 `ai-travel-planner`
- `ALIYUN_USERNAME`：ACR 登录用户名（可使用 `ALIYUN_ACCESS_KEY_ID`）
- `ALIYUN_PASSWORD`：ACR 登录密码（可使用 `ALIYUN_ACCESS_KEY_SECRET`）

推送规则：
- 触发条件：推送到 `main` 分支或手动触发
- 镜像标签：`latest` 与提交 SHA
- 完成后可通过如下命令拉取：

```bash
docker pull $ALIYUN_REGISTRY/$ALIYUN_NAMESPACE/$ALIYUN_REPO:latest
docker run --rm -p 3000:3000 -e JWT_SECRET=change-me \
  $ALIYUN_REGISTRY/$ALIYUN_NAMESPACE/$ALIYUN_REPO:latest
```

## 生产运行说明

- 单容器提供 API 与静态前端（`/dist`），前端通过 `/api/*` 调用后端；后端自动兼容 `/api` 前缀。
- 配置与密钥不入库；通过设置页或挂载卷提供 `config/local.json`（已在 `.gitignore` 中）。

## 评分用 API Key（请按作业要求补充）

- 如果你使用阿里云百炼平台（助教有可用 Key），则本项目无需在 README 暴露密钥。
- 如果你使用其他平台（非阿里云），请在此处填入评测所需的 Key，并保证 3 个月内可用。示例说明：
  - 语音识别（科大讯飞）：环境变量 `XF_API_KEY`, `XF_APP_ID`（可在容器运行时通过 `-e` 注入）；或在设置页写入后端配置文件。
  - LLM（可选替代方案）：按相应平台的 Key 变量说明注入。

示例：
```
XF_API_KEY=your-xf-key
XF_APP_ID=your-xf-app-id
```
运行时：
```
docker run --rm -p 3000:3000 -e JWT_SECRET=change-me \
  -e XF_API_KEY=$XF_API_KEY -e XF_APP_ID=$XF_APP_ID \
  ai-travel-planner:latest
```

## API 与前端路由约定

- 开发模式：
  - 前端地址：`http://127.0.0.1:5174`
  - 后端地址：`http://127.0.0.1:3000`
  - 前端调用后端统一使用 `/api/*`，由 Vite 代理到后端（见 `vite.config.ts` 的 `rewrite(/^\/api/, '')`）
- 生产/容器模式：
  - 前端页面与路由：`http://127.0.0.1:3000/`（如 `/login`、`/plans` 等）
  - 后端 API：`http://127.0.0.1:3000/api/*`（后端会自动去除 `/api` 前缀与内部路由匹配）
  - API 索引：访问 `http://127.0.0.1:3000/api` 可查看 JSON 索引

## 常见问题（FAQ）

- 打开 `http://127.0.0.1:3000/` 只显示 API JSON？
  - 这是后端根路径的 API 索引；现已调整为仅在原始请求带 `/api` 时返回索引，正常情况下会返回前端页面。
- Windows PowerShell 下命令用 `&&` 失败？
  - PowerShell 不支持用 `&&` 连接命令，请分别执行：先 `npm run build` 再 `npm start`。
- Docker 构建拉取 `node:20-alpine` 失败？
  - 已改用 `mcr.microsoft.com/devcontainers/javascript-node:20` 作为基础镜像，规避镜像源网络问题。
 - 需要“可直接下载运行”的镜像文件？
   - 请在 GitHub Actions 的 Artifacts 下载 `ai-travel-planner-image`（tar），用 `docker load -i` 导入，再按文档运行。