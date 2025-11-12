# AI Travel Planner

一个前后端一体的旅行规划与费用管理应用，基于 React + Vite（前端）与 Express + TypeScript（后端）。

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