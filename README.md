# project_myg

OpenProject 风格的 AI 项目管理平台原型，提供项目层级、统一工作项（WorkPackage）、看板 / 甘特图 / 成员视图，并把 AI 诊断、AI 拆解、通知作为可配置模块嵌入项目侧边栏。

## 功能

- OpenProject 16.x 风格的「顶部 + 左侧栏 + 主内容区」三栏布局
- 项目支持 parent / sub-project 层级，可在顶部项目切换器与项目列表中按层级缩进展示
- WorkPackage 统一模型（任务 / 里程碑 / 风险 / 阶段），表格 + 右侧详情的 split-screen 视图
- 项目级模块开关：每个项目独立启用 Overview / Work Packages / Boards / Gantt / Members / AI 诊断 / AI 拆解 / Settings
- 看板（按状态分组）、甘特图（SVG 时间线）、成员视图
- AI 诊断面板（健康度 / 催办 / 调度建议）、AI 拆解工作区（草稿 → 项目经理确认 → 写入 WorkPackage）
- 通知中心（飞书 / 企业微信 / 钉钉 / Slack / 邮件 / 通用 Webhook 适配 + 路由规则 + 投递审计）
- 通知中心站内收件箱，支持已读 / 未读状态、一键已读、顶部未读红点计数；业务操作可通过 API 向指定用户推送消息
- 超过一天未读的站内消息由独立定时入口统一扫描并补发飞书卡片提醒，不依赖用户进入平台
- 已提供独立定时入口：可通过 `npm run notifications:reminders` 或调用定时 API 扫描全量用户的超时未读消息并发送飞书卡片提醒
- 管理员区统一查看通讯通道与路由规则配置
- 管理员、项目经理、项目参与员三种权限视角，支持顶部 UserMenu 切换演示账号
- Prisma + SQLite 数据模型与种子数据

## 本地运行

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

访问 `http://localhost:3000`，会重定向到 `/my/page`。

## 验证

```bash
npm run test
npm run build
```

页面冒烟测试：

```bash
npm run test:e2e
```

## 飞书部门树接口

飞书部门树能力已迁移为 TypeScript 服务和 API。管理员界面的用户板块改为同一面板内切换“权限角色”和“部门树”视图；部门树支持本地搜索与折叠树形展示，默认只读取本地持久化缓存，只有点击“同步部门树”时才会调用飞书接口并刷新缓存。同步按钮下方新增“同步设置”，并已改为部门树样式，可分别勾选上级部门或下级部门；被屏蔽部门及其子部门会在下次同步时被跳过。

`GET /api/feishu/departments` 返回当前缓存快照，包含 `tree`、`availableDepartments`、`excludedDepartmentIds`、`departmentCount`、`userCount`、`syncedAt`。`PATCH /api/feishu/departments` 用于保存下次同步的屏蔽部门列表；`POST /api/feishu/departments` 用于触发飞书拉取并按当前屏蔽设置写入持久化缓存。

通知中心未读红点当前不仅依赖首屏 SSR 计数，还会在已登录状态下按固定周期、页面重新聚焦、标签页重新可见时自动刷新，确保外部新消息进入后头部和侧栏红点能够自动更新。

通知中心当前分为“收件箱”和“待审核”两个视图：待处理的审核请求不会进入收件箱，而是只在“待审核”中展示；收件箱仅展示普通通知消息和审核结果消息。其中审核请求类消息不会被“一键已读”处理，必须在“待审核”中完成审核后，原审核消息才会自动转为已读。头部和侧栏小红点的未读数当前按“普通未读消息 + 待审核数”汇总。

缓存中的每个部门节点保留 `department_name`、`leaders`、`users`、`children`；其中 `leaders` 和 `users` 都会返回 `name`、`open_id`、`user_id`、`union_id`、`email`、`mobile`、`enterprise_email`、`job_title`。`leaders` 额外包含 `leader_type`。

该接口会服务端串联这些飞书 OpenAPI：

- `GET /open-apis/contact/v3/departments/{department_id}/children`
- `POST /open-apis/directory/v1/departments/mget`
- `GET /open-apis/contact/v3/users/batch`
- `GET /open-apis/contact/v3/users/find_by_department`

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

## GitHub Secrets

自动部署到 VPS 需要配置：

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `APP_URL`
- `APP_ENV`
- `DOCKERHUB_NAME`
- `DOCKER_TOKEN`

CI 在推送到 `main` 或 `master` 时会把镜像推送到 `DOCKERHUB_NAME/project-myg`，例如 `yuguang822/project-myg:latest` 和 `yuguang822/project-myg:<commit-sha>`。

缺少 VPS 变量时，CI 仍会完成测试、构建、Docker 镜像验证和 DockerHub 推送，但会跳过真实 VPS 部署。

## 关键路由

| 路径 | 说明 |
| --- | --- |
| `/my/page` | 我的工作台（默认入口） |
| `/projects` | 所有项目（层级树） |
| `/projects/new` | 创建项目 |
| `/projects/[identifier]/overview` | 项目概览 |
| `/projects/[identifier]/work-packages` | 工作项表格 + split-screen 详情 |
| `/projects/[identifier]/boards` | 看板 |
| `/projects/[identifier]/gantt` | 甘特图 |
| `/projects/[identifier]/members` | 成员 |
| `/projects/[identifier]/ai-diagnosis` | AI 诊断 |
| `/projects/[identifier]/ai-breakdown` | AI 拆解 |
| `/projects/[identifier]/settings` | 项目设置（含模块开关） |
| `/work-packages` | 跨项目工作项列表 |
| `/notifications` | 通知中心站内收件箱 |
| `/admin/notifications` | 通讯通道与路由规则配置 |
| `/admin` | 管理员区 |

## 关键 API

| API | 说明 |
| --- | --- |
| `GET /api/workspace` | 工作区引导（projects + counts） |
| `GET / POST /api/projects` | 项目列表 / 创建 |
| `GET / PATCH /api/projects/[identifier]` | 单项目读取 / 更新（含模块开关） |
| `GET / POST /api/work-packages` | 工作项列表 / 创建 |
| `PATCH /api/work-packages/[id]` | 更新工作项进展 |
| `POST /api/work-packages/[id]/comments` | 写入评论 / 决策 / 阻塞 / 证据 |
| `POST /api/work-packages/[id]/approvals` | 项目经理签核 |
| `POST /api/assistant` | AI 拆解草稿 |
| `POST /api/agent-workflow/confirm` | 草稿确认 → 写入正式 WorkPackage |
| `POST /api/im-comment?persist=1` | 外部 IM 评论回流（幂等） |
| `GET /api/steward` | AI 管家进展摘要 |
| `GET /api/health` | 健康检查 |
| `GET / POST / PATCH /api/notifications` | 查询当前用户收件箱 / 按 `recipientOpenIds` 或 `recipientUserIds` 发送站内通知 / 一键标记已读 |
| `POST /api/notifications/reviews` | 创建审核消息并发送给审核人 |
| `PATCH /api/notifications/reviews/[id]` | 审核人提交结果，并自动回发给被审核用户 |
| `GET /api/feishu/departments` | 读取持久化的飞书部门树缓存快照 |
| `PATCH /api/feishu/departments` | 保存下次同步时要屏蔽的部门列表 |
| `POST /api/feishu/departments` | 管理员触发飞书部门树同步并刷新缓存 |
| `GET / POST /api/feishu/robot` | 查询飞书机器人状态 / 由业务显式传入标题和正文发送飞书卡片 |

详细架构与模块边界见 [`docs/platform-architecture.md`](docs/platform-architecture.md)。

## Cursor Skill 选择

| 场景 | 使用 skill |
| --- | --- |
| 定义新功能、页面、用户旅程或验收标准 | `product-definition` |
| 拆分需求池、优先级、依赖、里程碑和任务 | `demand-management` |
| 实现明确范围内的代码或文档改动 | `development-execution` |
| 验证单测、API、页面冒烟、构建或回归 | `test-verification` |
| 检查 Docker、GitHub Actions、VPS 和健康检查 | `deploy-operations` |
| 核对当前项目进度、风险、验证和部署事实 | `progress-check` |
| 生成面向项目经理或团队的同步简报和风险提醒 | `steward-reporting` |
| 大范围、多轮、多 Subagent 的 Cursor 研发闭环 | `unattended-platform-development` |

小改动优先走轻量链路：`product-definition` → `demand-management` → `development-execution` → `test-verification`。
