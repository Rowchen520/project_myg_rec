# Feishu API Contract

本文件仅保留平台内部接口与飞书对接契约，作为当前实现和后续联调的约束基线。

## 1. 鉴权接口

### 1.1 发起飞书登录

- 方法：`GET`
- 路径：`/api/auth/feishu/login`
- 请求参数：`redirectTo`（可选）
- 响应：302 跳转到飞书授权地址

### 1.2 飞书登录回调

- 方法：`GET`
- 路径：`/api/auth/feishu/callback`
- 请求参数：`code`、`state`、`error`
- 成功响应：302 跳转站内目标页，并写入 session cookie
- 说明：当前阶段登录成功后，会把当前飞书 `open_id` 写入 session，后续服务端鉴权优先按 `open_id` 识别用户，再映射回平台内部 `user.id`。
- 失败响应：302 到错误提示页或返回结构化错误

### 1.3 当前用户绑定状态

- 方法：`GET`
- 路径：`/api/auth/feishu/binding`
- 成功响应：

```json
{
  "connected": true,
  "feishuUser": {
    "openId": "ou_xxx",
    "unionId": "on_xxx",
    "name": "张三"
  }
}
```

### 1.4 解除飞书绑定

- 方法：`DELETE`
- 路径：`/api/auth/feishu/binding`
- 鉴权：需要已登录
- 成功响应：清理当前绑定状态，并要求重新登录

## 2. 通知接口

### 2.1 查询机器人状态

- 方法：`GET`
- 路径：`/api/feishu/robot`
- 鉴权：需要已登录，且调用者具备通知管理权限。
- 成功响应：

```json
{
  "enabled": true,
  "status": "connected",
  "startedAt": "2026-05-14T10:00:00.000Z",
  "lastError": null
}
```

### 2.2 发送通知卡片

- 方法：`POST`
- 路径：`/api/feishu/robot`
- 鉴权：需要已登录，且调用者具备通知管理权限。
- 说明：`title` 与 `body` 不再从环境变量读取，必须由业务触发方在调用时显式传入。
- 请求体：

```json
{
  "receiveIdType": "open_id",
  "receiveId": "ou_xxx",
  "title": "平台实时通知",
  "body": "请查看最新平台动态。",
  "templateVariables": {
    "foo": "bar"
  }
}
```

- 字段约束：`receiveId`、`title`、`body` 均为必填；缺失时返回 `400`。

- 成功响应：

```json
{
  "ok": true,
  "connectionStatus": "connected",
  "notification": {
    "title": "平台实时通知",
    "body": "请查看最新平台动态。"
  },
  "templateVariables": {
    "title": "平台实时通知",
    "body": "请查看最新平台动态。",
    "sent_at": "2026/05/14 16:00:00 (UTC+8)"
  },
  "response": {
    "code": 0,
    "msg": "success"
  }
}
```

### 2.3 内部事件投递入口

- 方法：内部服务调用
- 名称：`dispatchFeishuNotification(event)`
- 输入：标准化 `NotificationEvent`
- 输出：投递结果对象或异步任务 ID
- 说明：当前阶段保留内部服务契约，用于后续业务事件接入飞书通知；事件侧需要自行组装卡片标题与正文后再传给发送器。

### 2.4 站内通知收件箱查询

- 方法：`GET`
- 路径：`/api/notifications`
- 鉴权：需要已登录。
- 说明：通知中心与“我的通知”均从该接口对应的服务端逻辑读取当前用户收件箱消息；当前用户身份优先通过 session 中的 `open_id` 解析。收件箱只返回普通通知和审核结果消息，不再包含待处理审核请求；待处理审核请求统一通过通知中心“待审核”视图读取。应用壳层会同步汇总未读条数，用于头部通知入口和全局侧栏显示红点计数。
- 成功响应：

```json
{
  "notifications": [
    {
      "id": "notif_001",
      "recipientUserId": "user_001",
      "recipientOpenId": "ou_xxx",
      "title": "流程提醒",
      "body": "请尽快处理待办。",
      "level": "High",
      "source": "workflow",
      "link": "/projects/demo/overview",
      "payload": {
        "projectId": "demo"
      },
      "readAt": null,
      "createdAt": "2026-05-15T15:00:00.000Z"
    }
  ]
}
```

### 2.5 发送站内通知

- 方法：`POST`
- 路径：`/api/notifications`
- 鉴权：需要已登录。
- 说明：业务操作可调用该接口向一个或多个用户发送站内通知，通知会进入通知中心收件箱。当前推荐使用 `recipientOpenIds` 作为外部身份标识；服务端会先映射到平台内部 `user.id`，再写入站内通知表。
- 请求体：

```json
{
  "recipientOpenIds": ["ou_xxx", "ou_yyy"],
  "recipientUserIds": ["user_001"],
  "title": "任务分配提醒",
  "body": "你有新的任务需要跟进。",
  "level": "Medium",
  "source": "work-package",
  "link": "/work-packages",
  "payload": {
    "workPackageId": 123
  }
}
```

- 字段约束：`recipientOpenIds` 与 `recipientUserIds` 至少传一种；若传 `recipientOpenIds`，对应飞书账号需已完成平台绑定。

- 成功响应：

```json
{
  "createdCount": 2
}
```

### 2.6 标记站内通知已读

- 方法：`PATCH`
- 路径：`/api/notifications`
- 鉴权：需要已登录。
- 说明：当前阶段用于通知中心“一键已读”；不传 `notificationIds` 时，会把当前用户所有普通未读消息标记为已读。来源为 `notification-review-request` 的审核请求消息不会被该接口置为已读，必须在待审核视图完成审核后自动回写已读时间。通知中心小红点按“普通未读消息 + 待审核数”汇总，不会遗漏待审核，也不会把审核请求镜像消息重复计数。
- 请求体：

```json
{
  "notificationIds": []
}
```

- 成功响应：

```json
{
  "updatedCount": 5
}
```

### 2.7 创建审核消息

- 方法：`POST`
- 路径：`/api/notifications/reviews`
- 鉴权：需要已登录。
- 说明：业务操作可调用该接口向审核人 A 发送审核消息；创建成功后，审核人会在通知中心收到一条审核待办消息。
- 请求体：

```json
{
  "reviewerOpenId": "ou_reviewer",
  "reviewedOpenId": "ou_reviewed",
  "title": "请审核入场申请",
  "body": "请确认该用户是否可以通过审核。",
  "link": "/notifications",
  "payload": {
    "ticketId": "t-1"
  }
}
```

- 字段约束：审核人和被审核用户都必须提供一种身份标识（`userId` 或 `openId`）；标题和正文必填。
- 通知中心行为：创建成功后，审核请求只会进入通知中心“待审核”视图，不再出现在收件箱中，也不能通过“一键已读”跳过。
- 成功响应：

```json
{
  "reviewRequest": {
    "id": "nr_001",
    "requesterUserId": "user_requester",
    "reviewerUserId": "user_reviewer",
    "reviewedUserId": "user_reviewed",
    "title": "请审核入场申请",
    "body": "请确认该用户是否可以通过审核。",
    "status": "pending",
    "createdAt": "2026-05-15T16:00:00.000Z",
    "updatedAt": "2026-05-15T16:00:00.000Z"
  }
}
```

### 2.8 提交审核结果

- 方法：`PATCH`
- 路径：`/api/notifications/reviews/[id]`
- 鉴权：需要已登录，且当前用户必须是该审核请求的审核人。
- 说明：审核人 A 完成审核后调用该接口；系统会自动把审核结果以站内通知回发给被审核用户，并将审核人侧对应的原审核请求消息自动标记为已读/移出待处理集合。
- 请求体：

```json
{
  "status": "approved",
  "resultComment": "资料完整，可以通过。",
  "resultTitle": "审核通过通知",
  "resultBody": "审核已通过，请继续后续流程。"
}
```

- 成功响应：

```json
{
  "reviewRequest": {
    "id": "nr_001",
    "status": "approved",
    "resultComment": "资料完整，可以通过。",
    "reviewedAt": "2026-05-15T16:10:00.000Z",
    "updatedAt": "2026-05-15T16:10:00.000Z"
  }
}
```

### 2.9 超一天未读飞书提醒

- 方法：由定时入口主动触发
- 触发点：`POST /api/notifications/reminders/overdue`
- 触发条件：存在创建时间超过 24 小时、`readAt` 仍为空、且尚未发送过超时提醒的站内消息
- 飞书卡片内容：

```json
{
  "title": "通知中心提醒",
  "body": "您有消息超过一天未处理，请前往通知中心查看。"
}
```

- 去重策略：提醒发送成功后，会回写该批消息的提醒时间，避免后续重复发送。
- 定时入口鉴权：`Authorization: Bearer <NOTIFICATION_REMINDER_CRON_TOKEN>`

#### 定时入口请求

- 方法：`POST`
- 路径：`/api/notifications/reminders/overdue`
- 用途：供计划任务或外部调度器扫描全量用户，哪怕用户当天未登录平台，也会按规则发送超时未读飞书提醒。

#### 定时入口成功响应

```json
{
  "scannedNotifications": 12,
  "remindedNotifications": 10,
  "notifiedUsers": 4,
  "skippedUsers": 1
}
```

### 2.10 查询飞书部门树

- 方法：`GET`
- 路径：`/api/feishu/departments`
- json文件路径：`D:\project_myg\feishu\department_details.json`
- 鉴权：当前阶段不做登录与角色校验。
- 说明：返回当前持久化快照，以及“下次同步”的部门屏蔽配置。
- 成功响应：

```json
{
  "availableDepartments": [
    {
      "openDepartmentId": "od_root",
      "departmentName": "总经理",
      "parentOpenDepartmentId": null
    },
    {
      "openDepartmentId": "od_hr",
      "departmentName": "人事行政",
      "parentOpenDepartmentId": "od_root"
    }
  ],
  "excludedDepartmentIds": ["od_hr"],
  "departmentCount": 2,
  "userCount": 5,
  "syncedAt": "2026-05-15T10:00:00.000Z",
  "tree": [
    {
      "open_department_id": "od_root",
      "department_name": "总经理",
      "leaders": [],
      "users": [
        {
          "name": "张三",
          "open_id": "ou_xxx",
          "user_id": "u_xxx",
          "union_id": "on_xxx",
          "email": "zhangsan@example.com",
          "mobile": "13800000000",
          "enterprise_email": "zhangsan@corp.example.com",
          "job_title": "工程师"
        }
      ],
      "children": [
        {
          "open_department_id": "od_hr",
          "department_name": "人事行政",
          "leaders": [],
          "users": [],
          "children": []
        }
      ]
    }
  ]
}
```

### 2.11 同步飞书部门树缓存

- 方法：`PATCH`
- 路径：`/api/feishu/departments`
- 鉴权：当前阶段不做登录与角色校验。
- 说明：保存“下次同步”的屏蔽部门列表；该请求不会立即改写当前缓存树，只会影响下一次点击“同步部门树”时的同步结果。前端同步设置界面已按部门树层级展示 `availableDepartments`，支持独立勾选上级部门和下级部门。
- 请求体：

```json
{
  "excludedDepartmentIds": ["od_hr", "od_finance"]
}
```

- 成功响应：与 `GET /api/feishu/departments` 相同。

### 2.12 同步飞书部门树缓存

- 方法：`POST`
- 路径：`/api/feishu/departments`
- 鉴权：当前阶段不做登录与角色校验。
- 说明：管理员界面“用户”板块在同一面板内切换“权限角色”和“部门树”视图；进入“部门树”视图后可按部门名、负责人、成员做本地搜索，并以可折叠树形结构浏览。点击“同步部门树”后，服务端会实时调用飞书接口、按已保存的 `excludedDepartmentIds` 过滤部门及其子部门、更新持久化缓存，并返回最新快照。未触发同步时，管理员页仅读取本地缓存，不会再次请求飞书。
- 成功响应：与 `GET /api/feishu/departments` 相同。

## 3. 标准事件模型

```ts
type NotificationEvent = {
  idempotencyKey: string;
  type: 'work-package.assigned' | 'work-package.overdue' | 'risk.escalated' | 'ai.diagnosis.alert';
  projectId?: string;
  workPackageId?: string;
  actorId?: string;
  recipients: string[];
  occurredAt: string;
  notification?: {
    title: string;
    body: string;
  };
  payload: Record<string, unknown>;
};
```

## 4. 飞书侧交互边界

- OAuth 授权地址：由服务端拼装，不在前端硬编码。
- Access Token 获取：服务端完成。
- 用户信息获取：服务端完成。
- 机器人消息发送：服务端完成。

## 4.1 部门树服务链路

- 服务：`feishu/department_id.ts`
- 持久化服务：`lib/services/feishu-department-tree.ts`
- 对外接口：`GET /api/feishu/departments`（读缓存）、`PATCH /api/feishu/departments`（保存同步屏蔽设置）、`POST /api/feishu/departments`（触发同步）
- 第一步接口：`GET /open-apis/contact/v3/departments/{department_id}/children`
- 第二步接口：`POST /open-apis/directory/v1/departments/mget?department_id_type=open_department_id&employee_id_type=open_id`
- 第三步接口：`GET /open-apis/contact/v3/users/batch?user_id_type=open_id&department_id_type=open_department_id&user_ids=ou_xxx`
- 第四步接口：`GET /open-apis/contact/v3/users/find_by_department`
- 第二步请求体：

```json
{
  "department_ids": ["od_xxx"],
  "required_fields": [
    "department_count",
    "has_child",
    "leaders",
    "parent_department_id",
    "name",
    "enabled_status",
    "order_weight",
    "custom_field_values",
    "department_path_infos",
    "data_source"
  ]
}
```

- 第二步成功响应关键结构：

```json
{
  "code": 0,
  "data": {
    "abnormals": [],
    "departments": [
      {
        "department_id": "0",
        "name": {
          "default_value": "总经理"
        }
      }
    ]
  },
  "msg": ""
}
```

- 当前实现说明：服务端先汇总全部部门 ID，再按批次调用 `mget` 获取部门详情；随后按部门调用 `find_by_department` 拉直属用户，并把部门领导 open_id 与直属用户 open_id 一并汇总，统一调用 `users/batch` 补齐姓名、邮箱、手机号等详细信息；最后基于 `department_path_infos` 组装部门树，并在管理员用户板块显式触发同步时写入 `FeishuDepartmentTreeSnapshot`。同步前会按已保存的 `excludedDepartmentIds` 用 `open_department_id` 过滤整棵树，被屏蔽部门及其子部门不会写入快照；而同步设置本身通过 `PATCH /api/feishu/departments` 单独保存，不会立即改写当前缓存。管理员页当前在同一个“用户”板块内切换“权限角色”和“部门树”视图，其中部门树视图默认读取该持久化快照，不会在每次打开页面时重新请求飞书，并支持本地搜索、折叠树形浏览，以及在同步按钮下方配置下次同步的屏蔽部门。树节点保留 `open_department_id`、`department_name`、`leaders`、`users`、`children`；其中 `leaders` 和 `users` 都返回 `name`、`open_id`、`user_id`、`union_id`、`email`、`mobile`、`enterprise_email`、`job_title`，`leaders` 额外返回 `leader_type`。

## 5. 错误语义

- `FEISHU_AUTH_STATE_INVALID`：授权态校验失败。
- `FEISHU_AUTH_EXCHANGE_FAILED`：令牌交换失败。
- `FEISHU_USER_BINDING_CONFLICT`：身份绑定冲突。
- `FEISHU_MESSAGE_RATE_LIMITED`：消息发送被限流。
- `FEISHU_CONNECTION_UNAVAILABLE`：实时连接不可用。
