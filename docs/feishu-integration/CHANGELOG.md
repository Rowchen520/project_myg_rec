# Feishu Changelog

## 记录规则

- 每次涉及飞书集成能力的改动，都追加一条记录；如果改动同时触达平台页面、管理界面、缓存、数据模型或文档，也必须一并记录，不只记录飞书业务本身。
- 每条记录至少包含：日期、变更概述、影响范围、接口/数据变更、测试情况、遗留事项。

## 2026-05-14

### 变更概述

- 新建飞书集成功能文档目录。
- 初始化 8 份专题文档骨架。
- 补充“飞书一键登录”和“飞书机器人实时卡片通知”的初始方案内容。
- 确认首个实现切片为“飞书一键登录”，并约定先更新文档再修改代码。
- 确认首轮登录实现复用现有 `pm-active-user-id` cookie session。
- 确认飞书相关代码优先落在 `feishu/` 目录。
- 新增飞书 OAuth 配置与服务端逻辑，补充登录入口、回调和绑定查询路由。
- 新增 `FeishuAccountBinding` 数据模型，并将 API 鉴权兼容到 cookie session。
- 确认下一轮将移除未登录默认演示账号回退，并改为自动弹出飞书登录。
- 确认下一轮补齐错误展示页、解绑/绑定状态查询 UI、首登资料补全和登录审计日志。
- 已新增 `FeishuAuthAuditLog` 审计模型和资料补全标记字段。
- 已实现全局登录弹层、飞书账号设置页、解除绑定并退出登录。
- 已移除未登录默认演示账号回退，未登录访问时改为真实登录拦截。
- 端到端联调发现解绑后 server action 的重定向查询参数需要保持 ASCII 安全，已进入修复。
- 端到端联调进一步发现：解绑后再次飞书登录会误判为“首次登录并自动建档”，需要改为保留可恢复的身份映射，避免重复账号。
- 已完成修复：解绑改为软撤销，重登恢复既有绑定与资料补全状态。
- 已完成真实端到端联调：飞书授权成功、首登资料补全、解绑退出、重登恢复原账号均通过。
- 开始实现飞书机器人长连接与实时卡片通知，明确以 `feishu/robot.ts` 官方 SDK 示例为基础，机器人配置与默认卡片内容均从环境变量读取。
- 已新增机器人接口：`GET /api/feishu/robot` 用于查询运行状态，`POST /api/feishu/robot` 用于发送测试卡片。
- 已完成真实发送验证：使用现有环境变量向指定 `open_id` 成功发送飞书模板卡片，飞书返回 `code=0` 并产生 `message_id`。
- 当前阶段明确收口：飞书卡片通知接口已完成，业务事件接入发送器后置到后续联动需求确认时再实施。

### 影响范围

- 文档目录：`docs/feishu-integration/`
- 代码目录：`feishu/`、`app/api/auth/feishu/`、`lib/services/`、`components/layout/`、`prisma/schema.prisma`
- 页面目录：`app/login/`、`app/(global)/my/feishu/`、`components/auth/`

### 接口/数据变更

- 新增接口：`GET /api/auth/feishu/login`、`GET /api/auth/feishu/callback`、`GET /api/auth/feishu/binding`
- 新增数据模型：`FeishuAccountBinding`
- API 鉴权读取 cookie session，并兼容历史 `x-user-id` header
- 新增接口：`DELETE /api/session`、`DELETE /api/auth/feishu/binding`
- 新增数据模型：`FeishuAuthAuditLog`
- `FeishuAccountBinding` 增加 `email`、`mobile`、`profileCompletedAt` 字段
- 新增接口：`GET /api/feishu/robot`、`POST /api/feishu/robot`
- 机器人卡片配置改为从环境变量读取：`APP_ID`、`APP_SECRET`、`BASE_DOMAIN`、`NOTICE_CARD_ID`、`NOTICE_CARD_TITLE`、`NOTICE_CARD_BODY`

### 测试情况

- 已完成新增文件的静态错误检查。
- 已完成构建级验证，当前飞书目录与新增 auth 路由无编译错误。
- 已完成 `npm run db:push`，数据库结构与最新 Prisma schema 同步。
- 已完成机器人窄范围测试：环境变量读取与模板变量组装通过。
- 已完成真实接口联调：本地服务启动后，调用 `POST /api/feishu/robot` 成功向指定 `open_id` 发送模板卡片。
- 仓库整体构建仍被既有 TypeScript 错误阻塞：当前阻塞点位于 `app/api/work-packages/[id]/progress/route.ts`，非本次改动引入。

### 遗留事项

- 如需业务自动通知，再与业务事件源联动确定触发点和模板变量。
- 如需生产化能力，再补投递审计、失败重试、限流与幂等键。

## 2026-05-15

### 变更概述

- 已将用户提供的飞书 Python SDK `directory/v1/departments/mget` 示例集成到根目录脚本 `department_id.py`。
- 已将脚本流程调整为：先递归获取全部部门 ID，再批量查询部门详情。
- 已新增部门详情文件输出，结果写入 `feishu/department_details.json`。
- 联调中发现 `mget` 返回结构为 `data.departments` 而非 `data.items`，已修正解析逻辑。
- 已补全 `required_fields` 默认字段，输出结果改为完整响应体而非仅部门数组。
- 已在 `department_id.py` 中接入按部门获取直属用户的 SDK 调用，并把结果汇总进 `data.department_architecture[].direct_users`。
- 已将输出进一步精简为真实部门树，并仅保留部门名、人员名、人员 `open_id`。
- 已将部门树逻辑从 Python 脚本迁移为 TypeScript 服务 `feishu/department_id.ts`。
- 已新增前端可调用接口 `GET /api/feishu/departments`，用于返回精简部门树名单。
- 已统一飞书环境变量，机器人与部门树能力统一使用 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_BASE_URL`。
- 已新增 `FeishuDepartmentTreeSnapshot` 持久化模型，管理员页用户板块默认读取本地缓存。
- 已在管理员用户板块加入“同步部门树”按钮，只有手动触发时才会再次调用飞书接口并刷新缓存。
- 已在“同步部门树”按钮下方新增“同步设置”，可选择下次同步时要屏蔽的部门；同步时会跳过这些部门及其子部门，但保存设置不会立刻改写当前缓存树。
- 已将“同步设置”改为部门树样式，并支持在树上分别勾选上级部门和下级部门；同步选项数据新增父子关系信息，便于按层级展示和选择。
- 已修复通知中心未读红点“只有首屏渲染后才更新”的问题：当前在登录态下会自动轮询刷新，并在页面重新聚焦或重新可见时立即刷新，确保外部新通知进入后头部/侧栏红点能自动更新。
- 已将通知中心拆为“收件箱 / 待审核”两个视图；其中待处理审核请求已完全移出收件箱，只在“待审核”中展示，收件箱仅保留普通通知和审核结果消息。审核请求不会被“一键已读”跳过，必须完成审核后才会自动转为已读。
- 已调整通知中心小红点统计口径：待审核消息也计入红点，当前按“普通未读消息 + 待审核数”汇总，并排除审核请求镜像消息的重复统计。
- 已将管理员用户板块重构为两个子板块：一个展示固定权限角色（平台管理员、项目经理、项目参与员），一个展示部门树缓存与同步入口。
- 已取消部门树查询与同步接口的登录/角色权限校验，当前阶段直接允许调用。
- 已将“权限角色”和“部门树”收口到同一个“用户”板块，通过切换按钮展示不同视图。
- 已为部门树视图补充本地搜索和可折叠树形展示，支持按部门名、负责人、成员信息快速过滤。
- 已将通知中心改造成站内收件箱，不再展示通讯通道、路由规则和投递审计。
- 已新增管理员“通知配置”页面，统一查看通讯通道与路由规则。
- 已新增站内通知模型、发送接口与查询接口，业务操作可向指定用户发送消息到通知中心。
- 已为通知中心与“我的通知”补充已读 / 未读状态展示，并新增“一键已读”能力。
- 已将飞书通知卡片标题 / 正文改为业务触发时显式传参，不再由环境变量 `NOTICE_CARD_TITLE`、`NOTICE_CARD_BODY` 控制。
- 已将飞书登录态与 `open_id` 绑定，服务端 session / 鉴权优先按 `open_id` 识别用户；站内通知发送接口新增 `recipientOpenIds`，统一由绑定表映射到内部 `user.id`。
- 已修复通知中心收件箱查询回归：`listUserNotifications` 改为使用 Prisma 模型中真实的 `UserNotification.recipient` 关系字段，避免 `/notifications` 页面因错误 include 字段返回 500。
- 已为顶部通知入口和全局侧栏补充未读红点与未读条数展示。
- 已为站内通知增加“超一天未读自动发飞书卡片提醒”能力；提醒文案固定为“通知中心提醒 / 您有消息超过一天未处理，请前往通知中心查看。”，且发送成功后会记录提醒时间避免重复触发。
- 已将超时未读提醒扩展为真正的定时入口：新增 `POST /api/notifications/reminders/overdue` 与脚本 `npm run notifications:reminders`，可按计划扫描全量用户并发送飞书提醒，即使用户当天未登录平台也可触发。
- 已移除超时未读提醒的页面被动触发链路；当前仅保留独立定时入口扫描，避免用户进入平台时重复执行提醒检查。
- 已新增通知中心审核消息闭环接口：业务可向审核人 A 发送审核消息，A 审核完成后系统会自动把结果回发给被审核用户。

### 影响范围

- 代码：`feishu/department_id.ts`、`app/api/feishu/departments/route.ts`、`feishu/robot.ts`、`app/api/feishu/robot/route.ts`、`feishu/config.ts`
- 代码：`lib/services/feishu-department-tree.ts`、`components/admin/AdminUsersPanel.tsx`、`app/(global)/admin/page.tsx`、`prisma/schema.prisma`
- 代码：`components/layout/AppShell.tsx`、`components/layout/UnreadNotificationAutoRefresh.tsx`
- 代码：`components/notifications/NotificationCenterView.tsx`、`app/(global)/notifications/page.tsx`
- 代码：`prisma/schema.prisma`、`lib/services/user-notifications.ts`、`app/api/notifications/route.ts`
- 代码：`lib/services/auth-context.ts`、`lib/services/auth-server.ts`、`lib/services/session-cookie.ts`、`lib/agent/auth.ts`、`app/api/auth/feishu/callback/route.ts`、`app/api/session/route.ts`
- 代码：`lib/services/shell-request-context.ts`、`components/layout/AppShell.tsx`、`components/layout/AppHeader.tsx`、`components/layout/GlobalSidebar.tsx`
- 代码：`app/api/notifications/reminders/overdue/route.ts`、`scripts/send-overdue-notification-reminders.mjs`
- 代码：`app/api/notifications/reviews/route.ts`、`app/api/notifications/reviews/[id]/route.ts`
- 代码：`components/notifications/NotificationCenterView.tsx`、`components/notifications/MyNotificationsPanel.tsx`、`components/admin/NotificationSettingsView.tsx`
- 测试：`tests/feishu-robot.test.ts`、`tests/feishu-department-tree.test.ts`、`tests/feishu-department-snapshot.test.ts`、`tests/user-notifications.test.ts`、`tests/notification-reviews.test.ts`、`tests/notifications.test.ts`
- 页面：`app/(global)/notifications/page.tsx`、`app/(global)/admin/notifications/page.tsx`
- 文档：`README.md`、`docs/platform-architecture.md`、`docs/feishu-integration/API_CONTRACT.md`、`docs/feishu-integration/ENV_AND_DEPLOY.md`

### 接口/数据变更

- 部门树服务详情查询接口明确为：`POST /open-apis/directory/v1/departments/mget?department_id_type=open_department_id&employee_id_type=open_id`
- 部门树服务直属用户查询接口明确为：`GET /open-apis/contact/v3/users/find_by_department`
- 新增内部 API：`GET /api/feishu/departments`
- 新增内部 API：`PATCH /api/feishu/departments`
- 新增内部 API：`POST /api/feishu/departments`
- 部门树 API 输出结构明确为：部门树节点 `department_name`、`users`、`children`
- 部门树 API 用户输出字段明确为：`name`、`open_id`
- 统一环境变量为：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_BASE_URL`
- 新增数据模型：`FeishuDepartmentTreeSnapshot`
- `FeishuDepartmentTreeSnapshot` 新增 `departmentOptionsJson`、`excludedDepartmentIdsJson`，用于保存可选部门列表与下次同步的屏蔽部门设置
- `departmentOptionsJson` 现包含 `parentOpenDepartmentId`，用于前端按部门树层级展示同步设置
- 管理员页面改为默认读取持久化部门树缓存，只有手动同步才刷新飞书名单
- 管理员可在“同步设置”中勾选下次同步要屏蔽的部门；同步时会按 `open_department_id` 跳过这些部门及其子部门
- 通知中心未读红点改为在登录态下自动刷新，不再只依赖首屏 SSR 快照
- 通知中心新增“待审核”视图，并限制批量已读只能处理普通消息，不能处理待审核消息
- 待处理审核请求已不再进入收件箱，通知中心实现为“收件箱普通消息 / 待审核请求”分开展示
- 通知中心未读红点现已覆盖待审核消息，不再只统计普通通知未读数
- 管理员用户板块改为“权限角色 + 部门树”双区块展示
- `GET /api/feishu/departments` 与 `POST /api/feishu/departments` 当前阶段取消登录/角色权限校验
- 管理员用户板块进一步改为单一“用户”面板内切换展示“权限角色 / 部门树”
- 部门树前端新增本地搜索过滤与折叠树形浏览交互
- 新增站内通知数据模型：`UserNotification`
- 新增站内通知接口：`GET /api/notifications`、`POST /api/notifications`、`PATCH /api/notifications`
- 通知中心改为只展示站内收件箱；通讯通道和路由规则迁移到管理员页 `/admin/notifications`
- 收件箱新增已读 / 未读状态，以及一键已读能力
- 飞书机器人卡片内容改为业务触发时显式传入 `title`、`body`，环境变量仅保留模板 ID 与连接配置
- 飞书登录成功后，session 当前写入 `open_id`；服务端鉴权优先按 `open_id` 识别用户，并兼容历史 `userId`
- 站内通知发送新增 `recipientOpenIds`，服务端通过 `FeishuAccountBinding` 映射到内部 `user.id`
- `UserNotification` 新增 `unreadReminderSentAt` 字段，用于记录超时未读飞书提醒的发送时间
- 应用壳层新增未读通知汇总，头部通知按钮与全局侧栏展示未读红点与计数
- 服务端新增超时未读提醒逻辑：消息超过 24 小时未读时，自动向当前用户的 `open_id` 发送飞书卡片并回写提醒时间
- 新增定时入口：`POST /api/notifications/reminders/overdue` 通过 `NOTIFICATION_REMINDER_CRON_TOKEN` 鉴权后扫描全量超时未读消息
- 新增脚本：`npm run notifications:reminders`，用于从系统计划任务或外部调度器调用定时入口
- 未读消息汇总接口不再触发飞书提醒，提醒发送统一收口到定时扫描链路
- 新增数据模型：`NotificationReviewRequest`
- 新增审核消息接口：`POST /api/notifications/reviews`、`PATCH /api/notifications/reviews/[id]`
- 创建审核请求时，系统向审核人发送站内审核待办；审核人提交结果后，系统自动向被审核用户发送审核结果通知

### 测试情况

- 已完成窄范围单测：`tests/feishu-robot.test.ts`、`tests/feishu-department-tree.test.ts` 均通过。
- 已完成窄范围单测：`tests/feishu-department-snapshot.test.ts` 通过。
- 已完成窄范围单测：`tests/feishu-department-snapshot.test.ts` 新增“屏蔽部门后同步裁剪”和“保存屏蔽设置不立即改当前缓存”场景并通过。
- 已完成窄范围单测：`tests/user-notifications.test.ts`、`tests/notifications.test.ts` 通过。
- 已完成窄范围单测：飞书机器人卡片参数改造后，`tests/feishu-robot.test.ts` 复跑通过。
- 已完成窄范围单测：`tests/user-notifications.test.ts` 覆盖 `recipientOpenIds` 映射发送场景并通过。
- 已完成通知相关回归验证：`tests/user-notifications.test.ts`、`tests/notifications.test.ts` 共 12 个用例复跑通过。
- 已完成 Prisma 客户端生成与 `db:push`，未读提醒时间字段已同步到本地数据库。
- 已完成窄范围单测：`tests/user-notifications.test.ts` 新增“超一天未读自动发飞书提醒”场景并通过。
- 已完成窄范围单测：`tests/user-notifications.test.ts` 新增“定时入口全量扫描多个用户”场景并通过。
- 已完成窄范围单测：`tests/user-notifications.test.ts` 现已覆盖“未读汇总不触发提醒副作用”场景并通过。
- 已完成窄范围单测：`tests/notification-reviews.test.ts` 覆盖“创建审核请求”和“审核结果回传”两个场景并通过。
- 已完成窄范围单测：`tests/user-notifications.test.ts` 新增“审核消息不能被一键已读”断言并通过。
- 已完成静态错误检查：新增 TypeScript 服务、路由、管理界面组件与文档均无本地错误。
- 已完成 `prisma generate` 与 `db:push`，本地数据库结构已同步到最新通知模型。

### 遗留事项

- 如需提高可用性，可继续补充部门树接口的缓存策略与前端筛选参数。