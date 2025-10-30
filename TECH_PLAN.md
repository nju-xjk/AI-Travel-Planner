# 技术方案与WBS

**高层总览**
- 项目名称：AI Travel Planner（桌面 Web、本地后端与本地数据）
- 一句话目标：用语音/文字输入自动生成个性化行程，含预算与本地记账。
- 关键需求与边界：语音识别必需；地图展示与导航；本地后端与本地数据存储；不涉及云端同步与跨设备登录；不在仓库中存放任何 API Key；提供 Docker 镜像与运行说明。
- 技术偏好与约束：TypeScript + Node.js (Express) + SQLite（better-sqlite3）；前端 React + Vite；地图选用高德；语音识别选用科大讯飞；LLM 接口通过后端代理；Windows 桌面浏览器。
- 非功能性指标：单元测试覆盖≥70%；核心操作响应≤2s；本地数据可靠持久化；安全地管理密钥；总体依赖成本可控。
- 交付节奏：优先上线最小可用流程（本地登录 → 需求输入 → 行程生成 → 地图展示 → 预算估计 → 记录开销）；随后完善语音录入与 Docker 化；最后补充观测与告警。

```json
{
  "work_packages": [
    {
      "name": "建立本地数据库与领域模型（SQLite + better-sqlite3）",
      "goal_DOD": "完成表结构与DAO层CRUD；单测覆盖≥70%；可在本地创建/读取/更新/删除计划与费用记录。",
      "io_contract": {
        "inputs": [
          "领域对象：TravelPlan, ExpenseRecord, User, Preference",
          "配置文件：`config/local.json`"
        ],
        "outputs": [
          "本地数据库文件：`data/app.db`",
          "DAO 方法返回的领域对象实例"
        ],
        "apis": [
          "内部库接口：`PlanDAO`, `ExpenseDAO`, `UserDAO`（方法：create/findById/list/update/delete）"
        ],
        "data_models": [
          "表：`users(id, email, password_hash, created_at)` 索引：`users_email_unique`",
          "表：`plans(id, user_id, destination, start_date, end_date, budget, party_size, preferences_json, created_at)` 索引：`plans_user_id_idx`",
          "表：`plan_days(id, plan_id, day_index, segments_json)` 索引：`plan_days_plan_id_idx`",
          "表：`expenses(id, plan_id, date, amount, category, note, input_method, created_at)` 索引：`expenses_plan_id_idx`"
        ]
      },
      "tech_constraints": [
        "语言：TypeScript",
        "运行环境：Node.js >= 18",
        "数据库：SQLite（本地），库：better-sqlite3 >= 8",
        "禁止项：外网依赖不可用于单元测试；不得写入API Key到代码仓库"
      ],
      "deliverable_boundaries": { "max_files": 8, "max_lines_per_file": 300 },
      "tests": {
        "unit": [
          "DAO CRUD 正常路径：创建/查询/更新/删除",
          "边界：空结果、重复主键、无效外键",
          "异常：数据库文件不可写、SQL约束错误"
        ],
        "integration": [
          "DAO 与实际 SQLite 文件交互（使用临时测试库）"
        ],
        "contract": [
          "DAO 方法签名与返回结构的类型契约校验"
        ]
      },
      "skeleton_layout": [
        "`src/domain/models.ts`",
        "`src/data/db.ts`",
        "`src/data/dao/planDao.ts`",
        "`src/data/dao/expenseDao.ts`",
        "`src/data/dao/userDao.ts`",
        "`tests/data/dao/*.spec.ts`"
      ],
      "risks": [
        "模式变更导致迁移复杂度增加",
        "JSON字段规模与索引选择影响查询效率"
      ],
      "fallbacks": [
        "使用简单迁移脚本管理版本",
        "将 segments 切分为表结构以提升查询，但当前版本保留 JSON"
      ],
      "token_budget_hint": "建议≤10,000字符；DAO与测试模板简洁，避免冗长注释。"
    },
    {
      "name": "本地认证服务（单机登录、密码哈希与会话）",
      "goal_DOD": "实现注册/登录/登出；密码哈希（bcrypt或argon2）；会话token（JWT）；单测覆盖≥70%。",
      "io_contract": {
        "inputs": [
          "HTTP 请求体：`{ email, password }`"
        ],
        "outputs": [
          "响应体：注册成功或登录返回`{ token }`",
          "本地用户记录"
        ],
        "apis": [
          "HTTP：`POST /auth/register` 201/400",
          "HTTP：`POST /auth/login` 200/401",
          "HTTP：`POST /auth/logout` 204"
        ],
        "data_models": [
          "`users`表（见WP1）；Token 不入库，签发与校验在内存/配置密钥上完成"
        ]
      },
      "tech_constraints": [
        "语言：TypeScript；框架：Express 4+",
        "库：jsonwebtoken, argon2 或 bcryptjs",
        "禁止项：持久化明文密码；将JWT密钥hardcode到仓库"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "密码哈希与验证",
          "JWT签发与校验"
        ],
        "integration": [
          "注册/登录端到端（使用内存Express或supertest）"
        ],
        "contract": [
          "接口状态码与错误消息一致性"
        ]
      },
      "skeleton_layout": [
        "`src/services/authService.ts`",
        "`src/api/authRoutes.ts`",
        "`tests/api/auth.spec.ts`"
      ],
      "risks": [
        "JWT泄露风险",
        "错误处理不一致"
      ],
      "fallbacks": [
        "短期使用短TTL与HttpOnly Cookie",
        "集中错误处理中间件统一返回体"
      ],
      "token_budget_hint": "≤8,000字符；路由与服务分层清晰。"
    },
    {
      "name": "行程规划服务（LLM代理与结构化输出校验）",
      "goal_DOD": "实现LLM调用与提示模板；输出按行程JSON模式校验；单测≥70%。",
      "io_contract": {
        "inputs": [
          "用户需求：`{ destination, dates, budget, partySize, preferences }`",
          "环境变量：`LLM_PROVIDER`, `LLM_API_KEY`（运行时注入）"
        ],
        "outputs": [
          "结构化行程：`{ days: [...], places: [...] }`",
          "估算成本字段（初步）"
        ],
        "apis": [
          "HTTP：`POST /planner/generate` 200/400/502"
        ],
        "data_models": [
          "行程模式：`days[].segments[]`（timeRange,type,placeId,title,notes,costEstimate）",
          "地点模式：`places[]`（placeId,name,coords,category,imageUrl,mapLink）"
        ]
      },
      "tech_constraints": [
        "禁止项：在代码中写死API Key；单测不访问外网（使用Mock）",
        "库：`zod`或`ajv`进行模式校验"
      ],
      "deliverable_boundaries": { "max_files": 8, "max_lines_per_file": 300 },
      "tests": {
        "unit": [
          "提示模板生成",
          "模式校验通过与失败用例"
        ],
        "integration": [
          "接口层与服务层联调（使用LLM客户端Mock）"
        ],
        "contract": [
          "`POST /planner/generate`请求/响应模式契约"
        ]
      },
      "skeleton_layout": [
        "`src/services/plannerService.ts`",
        "`src/api/plannerRoutes.ts`",
        "`src/schemas/itinerary.ts`",
        "`tests/services/plannerService.spec.ts`",
        "`tests/api/plannerRoutes.contract.spec.ts`"
      ],
      "risks": [
        "LLM输出不稳定，需要严格校验与重试",
        "成本与延迟不可预测"
      ],
      "fallbacks": [
        "引入简化规则生成器作为降级",
        "加入重试与超时控制"
      ],
      "token_budget_hint": "≤12,000字符；模式定义与Mock占比高。"
    },
    {
      "name": "预算估算服务（分项成本聚合与预警）",
      "goal_DOD": "基于行程生成分项预算（交通/住宿/餐饮/景点），输出总预算与预警；单测≥70%。",
      "io_contract": {
        "inputs": [
          "行程结构：`ItineraryJSON`",
          "参数：价格默认系数或区间"
        ],
        "outputs": [
          "`{ total, breakdown, warnings }`"
        ],
        "apis": [
          "内部：`estimateBudget(itinerary)`",
          "HTTP：`POST /budget/estimate` 200/400"
        ],
        "data_models": [
          "`BudgetEstimate`（total: number, breakdown: Record, warnings: string[]）"
        ]
      },
      "tech_constraints": [
        "可选LLM参与估算；单测使用固定规则保证可重复性"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "规则计算的典型/边界",
          "异常输入处理"
        ],
        "integration": [
          "与行程规划输出对接（使用固定样本）"
        ],
        "contract": [
          "`POST /budget/estimate`响应结构契约"
        ]
      },
      "skeleton_layout": [
        "`src/services/budgetService.ts`",
        "`src/api/budgetRoutes.ts`",
        "`tests/services/budgetService.spec.ts`"
      ],
      "risks": [
        "价格区间误差导致用户不满"
      ],
      "fallbacks": [
        "提供可调参数与明确免责声明"
      ],
      "token_budget_hint": "≤7,000字符；保持规则简洁。"
    },
    {
      "name": "费用管理服务（记账与统计）",
      "goal_DOD": "支持新增/查询/统计费用；语音录入管道留接口；单测≥70%。",
      "io_contract": {
        "inputs": [
          "HTTP：`POST /expenses` `{ planId, date, amount, category, note, inputMethod }`",
          "HTTP：`GET /expenses?planId=...`"
        ],
        "outputs": [
          "列表与统计：`{ total, byCategory }`"
        ],
        "apis": [
          "HTTP：`POST /expenses` 201/400",
          "HTTP：`GET /expenses` 200",
          "HTTP：`GET /expenses/stats` 200"
        ],
        "data_models": [
          "`expenses`表（见WP1）"
        ]
      },
      "tech_constraints": [
        "分类集受控：transport/accommodation/food/attraction/other"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "统计聚合逻辑",
          "输入校验与异常路径"
        ],
        "integration": [
          "与DAO层联动（本地测试库）"
        ],
        "contract": [
          "`/expenses` 请求/响应契约"
        ]
      },
      "skeleton_layout": [
        "`src/services/expenseService.ts`",
        "`src/api/expenseRoutes.ts`",
        "`tests/api/expense.spec.ts`"
      ],
      "risks": [
        "统计精度与时区问题"
      ],
      "fallbacks": [
        "统一时区处理；向上取整规则"
      ],
      "token_budget_hint": "≤8,000字符。"
    },
    {
      "name": "语音识别后端代理与接口（科大讯飞）",
      "goal_DOD": "实现后端代理将音频转文字；前端上传音频，后端调用ASR；Mock单测≥70%。",
      "io_contract": {
        "inputs": [
          "HTTP：`POST /speech/recognize` form-data `{ audio: file, language }`",
          "环境变量：`XF_API_KEY`, `XF_APP_ID`"
        ],
        "outputs": [
          "响应体：`{ text, confidence }`"
        ],
        "apis": [
          "HTTP：`POST /speech/recognize` 200/400/502"
        ],
        "data_models": [
          "`SpeechResult`（text: string, confidence: number）"
        ]
      },
      "tech_constraints": [
        "禁止在仓库中包含真实密钥；单测使用本地Mock，不访问外网",
        "音频大小与格式限制：≤10MB，`audio/wav`或`audio/webm`"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "表单解析与参数校验",
          "结果解析与错误映射"
        ],
        "integration": [
          "supertest 上传伪音频，走代理逻辑（Mock外部SDK）"
        ],
        "contract": [
          "`/speech/recognize` 请求/响应契约"
        ]
      },
      "skeleton_layout": [
        "`src/services/speechService.ts`",
        "`src/api/speechRoutes.ts`",
        "`tests/api/speech.spec.ts`"
      ],
      "risks": [
        "音频格式兼容性问题",
        "第三方限流与错误码差异"
      ],
      "fallbacks": [
        "统一转码至wav或webm",
        "错误码映射与重试策略"
      ],
      "token_budget_hint": "≤9,000字符。"
    },
    {
      "name": "地图集成（高德JS SDK与地点标注）",
      "goal_DOD": "前端集成高德地图；根据行程在地图上标注地点并提供导航链接；单测≥70%。",
      "io_contract": {
        "inputs": [
          "前端：`ItineraryJSON`",
          "运行时配置：`BAIDU_BROWSER_AK`（前端），`BAIDU_SERVER_AK`（后端可选）"
        ],
        "outputs": [
          "地图渲染组件与标注交互"
        ],
        "apis": [
          "前端组件API：`<MapView places={...} />`"
        ],
        "data_models": [
          "`Place`（name, coords[lat,lng], category, mapLink）"
        ]
      },
      "tech_constraints": [
        "不在仓库包含真实密钥；前端从本地配置或设置页面注入",
        "前端测试使用组件快照与逻辑单测，避免真实地图外网调用"
      ],
      "deliverable_boundaries": { "max_files": 5, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "坐标转换与标注渲染逻辑",
          "导航链接生成"
        ],
        "integration": [
          "使用测试替身（Stub）渲染组件快照"
        ],
        "contract": [
          "组件props与渲染输出契约"
        ]
      },
      "skeleton_layout": [
        "`src/frontend/components/MapView.tsx`",
        "`tests/frontend/MapView.spec.tsx`"
      ],
      "risks": [
        "地图SDK加载失败或地域限制"
      ],
      "fallbacks": [
        "加载失败降级为静态列表与链接"
      ],
      "token_budget_hint": "≤6,000字符。"
    },
    {
      "name": "前端SPA骨架与核心页面（React + Vite）",
      "goal_DOD": "搭建React应用骨架；实现需求输入页、行程展示页、费用管理页、设置页；单测≥70%。",
      "io_contract": {
        "inputs": [
          "API 端点：`/auth/*`, `/planner/generate`, `/budget/estimate`, `/expenses/*`, `/speech/recognize`",
          "本地配置：`config/local.json`"
        ],
        "outputs": [
          "可运行SPA，基本导航与状态管理"
        ],
        "apis": [
          "前端路由：`/login`, `/plan/new`, `/plan/:id`, `/expenses`, `/settings`"
        ],
        "data_models": [
          "前端状态：`AuthState`, `PlanState`, `ExpenseState`, `SettingsState`"
        ]
      },
      "tech_constraints": [
        "语言：TypeScript；React 18+；Vite 5+",
        "UI 测试使用`@testing-library/react`与`vitest`"
      ],
      "deliverable_boundaries": { "max_files": 12, "max_lines_per_file": 300 },
      "tests": {
        "unit": [
          "表单校验与请求触发",
          "状态管理与页面渲染"
        ],
        "integration": [
          "前后端联调（本地环境）",
          "路由跳转与数据流"
        ],
        "contract": [
          "页面与API交互的请求/响应契约"
        ]
      },
      "skeleton_layout": [
        "`src/frontend/App.tsx`",
        "`src/frontend/pages/*.tsx`",
        "`src/frontend/state/*.ts`",
        "`tests/frontend/*.spec.tsx`"
      ],
      "risks": [
        "跨域与代理配置问题"
      ],
      "fallbacks": [
        "本地devServer代理规则与统一错误Toast"
      ],
      "token_budget_hint": "≤12,000字符。"
    },
    {
      "name": "REST API网关与路由（Express）",
      "goal_DOD": "实现统一路由与中间件：认证、错误处理、日志、CORS；单测≥70%。",
      "io_contract": {
        "inputs": [
          "HTTP 请求与会话Token"
        ],
        "outputs": [
          "标准化响应体与错误码"
        ],
        "apis": [
          "HTTP：`/auth/*`, `/planner/*`, `/budget/*`, `/expenses/*`, `/speech/*`"
        ],
        "data_models": [
          "统一错误响应：`{ code, message, details? }`",
          "成功响应包裹：`{ data, meta? }`"
        ]
      },
      "tech_constraints": [
        "Express 4+；中间件：`cors`, `morgan`或`pino-http`",
        "错误统一到一个中间件出口"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "错误处理中间件映射",
          "认证守卫"
        ],
        "integration": [
          "路由连通性与状态码检查"
        ],
        "contract": [
          "统一响应结构契约"
        ]
      },
      "skeleton_layout": [
        "`src/api/server.ts`",
        "`src/api/middlewares/*.ts`",
        "`tests/api/server.spec.ts`"
      ],
      "risks": [
        "跨路由错误码不一致"
      ],
      "fallbacks": [
        "集中错误码表与枚举"
      ],
      "token_budget_hint": "≤8,000字符。"
    },
    {
      "name": "配置与密钥管理（设置页与本地配置载入）",
      "goal_DOD": "实现前端设置页输入API Key与地图Key；后端安全载入运行；单测≥70%。",
      "io_contract": {
        "inputs": [
          "前端表单：`LLM_API_KEY`, `BAIDU_BROWSER_AK`, `BAIDU_SERVER_AK`, `XF_API_KEY`, `XF_APP_ID`",
          "本地配置文件写入：`config/local.json`"
        ],
        "outputs": [
          "运行时读取与校验结果"
        ],
        "apis": [
          "HTTP：`POST /settings` 200/400（写入本地配置）",
          "HTTP：`GET /settings` 200（读取）"
        ],
        "data_models": [
          "`Settings`（provider与key字段）"
        ]
      },
      "tech_constraints": [
        "禁止将密钥存入仓库；本地加密存储可选（如`crypto`对称加密）"
      ],
      "deliverable_boundaries": { "max_files": 6, "max_lines_per_file": 250 },
      "tests": {
        "unit": [
          "配置校验（必填与格式）"
        ],
        "integration": [
          "读写配置文件流程"
        ],
        "contract": [
          "`/settings` 请求/响应契约"
        ]
      },
      "skeleton_layout": [
        "`src/services/settingsService.ts`",
        "`src/api/settingsRoutes.ts`",
        "`src/frontend/pages/Settings.tsx`",
        "`tests/api/settings.spec.ts`"
      ],
      "risks": [
        "文件权限与路径问题",
        "误操作导致密钥丢失"
      ],
      "fallbacks": [
        "提供导入/导出与备份提示",
        "路径可配置并校验可写权限"
      ],
      "token_budget_hint": "≤9,000字符。"
    },
    {
      "name": "日志与观测（本地）",
      "goal_DOD": "接入结构化日志、请求ID；最小健康检查与错误告警（日志级别）；单测≥70%。",
      "io_contract": {
        "inputs": [
          "HTTP 请求与服务日志事件"
        ],
        "outputs": [
          "日志文件：`logs/app.log`；控制台输出"
        ],
        "apis": [
          "内部：`logger.info/warn/error`",
          "HTTP：`GET /health` 200"
        ],
        "data_models": [
          "日志事件结构：`{ time, level, msg, requestId? }`"
        ]
      },
      "tech_constraints": [
        "库：`pino`或`winston`",
        "日志轮转可选；默认控制台与文件双写"
      ],
      "deliverable_boundaries": { "max_files": 5, "max_lines_per_file": 200 },
      "tests": {
        "unit": [
          "日志格式化与级别过滤"
        ],
        "integration": [
          "健康检查端点返回与日志写入"
        ],
        "contract": [
          "日志事件结构契约"
        ]
      },
      "skeleton_layout": [
        "`src/observability/logger.ts`",
        "`src/api/healthRoutes.ts`",
        "`tests/api/health.spec.ts`"
      ],
      "risks": [
        "日志文件权限问题"
      ],
      "fallbacks": [
        "仅控制台输出；提供路径配置"
      ],
      "token_budget_hint": "≤6,000字符。"
    },
    {
      "name": "本地开发与容器化脚本（Dockerfile/Compose）",
      "goal_DOD": "提供Dockerfile与本地启动脚本；前后端与数据库在容器中可运行；单测≥70%（脚本与配置单测以lint与烟雾测试为主）。",
      "io_contract": {
        "inputs": [
          "源代码目录结构：`src`, `tests`, `config`"
        ],
        "outputs": [
          "镜像与`docker-compose.yml`"
        ],
        "apis": [
          "CLI：`docker build`, `docker compose up`"
        ],
        "data_models": [
          "容器环境变量与卷映射契约（`config/`, `data/`）"
        ]
      },
      "tech_constraints": [
        "不包含任何真实密钥；本地配置通过挂载卷注入",
        "Windows 环境优先；兼容Linux容器运行时"
      ],
      "deliverable_boundaries": { "max_files": 5, "max_lines_per_file": 200 },
      "tests": {
        "unit": [
          "配置脚本lint（例如`shellcheck`替代方案或Node脚本校验）"
        ],
        "integration": [
          "本地烟雾测试：启动容器后访问`/health`"
        ],
        "contract": [
          "容器环境变量与卷契约检查"
        ]
      },
      "skeleton_layout": [
        "`Dockerfile`",
        "`docker-compose.yml`",
        "`scripts/dev.ps1`",
        "`tests/devops/smoke.spec.ts`"
      ],
      "risks": [
        "Windows与容器路径/权限差异"
      ],
      "fallbacks": [
        "为Windows提供PowerShell脚本与路径适配",
        "降级为本机运行不容器化亦可"
      ],
      "token_budget_hint": "≤7,000字符。"
    }
  ]
}
```

**执行顺序清单**
- 第1步：建立本地数据库与领域模型（WP1）。
- 第2步：REST API网关与基础中间件（WP8）与本地认证服务（WP2）串行完成（先WP2，再WP8的守卫与错误统一）。
- 第3步：行程规划服务（WP3）与预算估算服务（WP4）并行开发，接口契约先在WP8中预留路径。
- 第4步：费用管理服务（WP5）串行接入（依赖WP1与WP8）。
- 第5步：语音识别后端代理（WP6）与地图集成前端组件（WP7）并行推进，双方契约在前端SPA中预留。
- 第6步：前端SPA骨架与核心页面（WP7的后续、WP9）与API完成联调，形成最小端到端流程。
- 第7步：配置与密钥管理（WP10）完成设置页与后端配置写入/读取。
- 第8步：日志与观测（WP11）补充请求ID与健康检查，完善单测。
- 第9步：本地开发与容器化脚本（WP12），完成Docker镜像构建与本地烟雾测试。

**关键路径说明**
- 关键路径：WP1 → WP2 → WP8 → WP3 → WP9 → 端到端联调。理由：
  - 没有本地数据库（WP1），后续认证与数据持久化无法落地。
  - 认证（WP2）与统一API网关（WP8）是所有服务暴露的基础。
  - 行程规划（WP3）是核心业务能力，直接驱动前端展示（WP9）。
  - 前端联调形成最小可运行Demo（登录 → 输入 → 生成 → 展示），满足优先上线的最小功能。
- 并行窗口：
  - WP4（预算）与WP3可并行，只需对行程JSON模式达成一致。
  - WP5（费用）可在WP1与WP8完成后进入；WP6（语音）与WP7（地图）可在API契约初版稳定后并行。
- 风险控制：
  - 若LLM不稳定，WP3提供降级规则以保障可运行；同时保留Mock以确保单测覆盖与契约一致。
  - 若地图或语音API受限，前端降级为静态列表与表单文本输入，确保关键路径不中断。