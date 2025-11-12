# AI-Travel-Planner项目说明

## 1. 运行方式

### 1.1 使用阿里云镜像运行（推荐，简单）

首先拉取镜像：

```bash
docker pull crpi-rahdxr5q5v6l8sry.cn-shanghai.personal.cr.aliyuncs.com/nju_xjk/ai-travel-planner:latest
```

运行镜像（一次性运行，退出后即删除容器）：

```bash
docker run --rm -p 3000:3000 -e JWT_SECRET=change-me crpi-rahdxr5q5v6l8sry.cn-shanghai.personal.cr.aliyuncs.com/nju_xjk/ai-travel-planner:latest
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可运行项目。

---

### 1.2 使用源代码构建运行

首先拉取项目：

```bash
git clone https://github.com/nju-xjk/AI-Travel-Planner.git
```

构建并启动后端：

```bash
npm run build
npm start
```

启动前端：

```bash
npm run dev
```

浏览器打开命令行输出的地址（例如 [http://127.0.0.1:5174/](http://127.0.0.1:5174/)），即可运行项目。

---

## 2. 使用指南

请查看 [使用指南.pdf](./使用指南.pdf)
