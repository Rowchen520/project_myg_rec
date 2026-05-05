import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = resolveDatabasePath(process.env.DATABASE_URL ?? "file:./prisma/dev.db");
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = OFF");
  ensureColumn("WorkPackage", "origin", "TEXT NOT NULL DEFAULT 'MANAGER'");
  ensureColumn("WorkPackage", "createdByUserId", "TEXT");
  ensureColumn("WorkPackage", "isOnCriticalPath", "BOOLEAN NOT NULL DEFAULT false");
  ensureColumn("Project", "startDate", "DATETIME");
  ensureColumn("Project", "endDate", "DATETIME");
  backfillWorkPackageCreators();
  backfillProjectPlanningDates();
  ensureNoMissingCreators();
  ensurePlatformFeatureFlagsTable();
  ensureAgentTables();
  seedPlatformFeatureFlags();
  db.pragma("foreign_keys = ON");
  console.log("Personal work foundation migration completed.");
} finally {
  db.close();
}

/**
 * Resolves the SQLite file URL used by Prisma into an absolute filesystem path.
 */
function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only file: SQLite DATABASE_URL values are supported.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(projectRoot, rawPath);
}

/**
 * Adds a column only when the current SQLite table does not already expose it.
 */
function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
}

/**
 * Backfills existing project work packages to the first project manager for the
 * project, falling back to the first admin account when no manager is present.
 */
function backfillWorkPackageCreators() {
  const fallbackUserId = resolveFallbackUserId();
  const rows = db
    .prepare(
      `
      SELECT id, projectId
      FROM WorkPackage
      WHERE createdByUserId IS NULL OR createdByUserId = ''
      ORDER BY id ASC
      `
    )
    .all();

  const update = db.prepare("UPDATE WorkPackage SET createdByUserId = ? WHERE id = ?");
  for (const row of rows) {
    update.run(resolveProjectManagerUserId(row.projectId) ?? fallbackUserId, row.id);
  }
}

/**
 * Finds the project manager who can act as creator for existing project rows.
 */
function resolveProjectManagerUserId(projectId) {
  if (!projectId) {
    return null;
  }

  const row = db
    .prepare(
      `
      SELECT User.id
      FROM User
      INNER JOIN ProjectMembership ON ProjectMembership.userId = User.id
      WHERE ProjectMembership.projectId = ?
        AND ProjectMembership.isLead = 1
        AND User.role = 'PROJECT_MANAGER'
      ORDER BY User.createdAt ASC
      LIMIT 1
      `
    )
    .get(projectId);

  return row?.id ?? null;
}

/**
 * Resolves the administrator fallback used when project manager ownership is
 * unavailable in a local database.
 */
function resolveFallbackUserId() {
  const admin = db
    .prepare("SELECT id FROM User WHERE role = 'ADMIN' ORDER BY createdAt ASC LIMIT 1")
    .get();
  const firstUser = db.prepare("SELECT id FROM User ORDER BY createdAt ASC LIMIT 1").get();

  if (!admin?.id && !firstUser?.id) {
    throw new Error("Cannot backfill WorkPackage.createdByUserId without any User rows.");
  }

  return admin?.id ?? firstUser.id;
}

/**
 * Fails fast when the local database still contains unowned work packages.
 */
function ensureNoMissingCreators() {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM WorkPackage WHERE createdByUserId IS NULL OR createdByUserId = ''"
    )
    .get();

  if (row.count > 0) {
    throw new Error(`Failed to backfill ${row.count} work packages.`);
  }
}

function backfillProjectPlanningDates() {
  const updates = [
    ["proj-platform", "2026-01-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z"],
    ["proj-ai-pm", "2026-01-05T00:00:00.000Z", "2026-06-30T00:00:00.000Z"],
    ["proj-ai-pm-mobile", "2026-04-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z"]
  ];
  const update = db.prepare(
    "UPDATE Project SET startDate = COALESCE(startDate, ?), endDate = COALESCE(endDate, ?) WHERE id = ?"
  );

  for (const [id, startDate, endDate] of updates) {
    update.run(startDate, endDate, id);
  }
}

function ensurePlatformFeatureFlagsTable() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS PlatformFeatureFlag (
      key TEXT NOT NULL PRIMARY KEY,
      siteEnabled BOOLEAN NOT NULL DEFAULT true,
      roleOverrides TEXT NOT NULL DEFAULT '{}',
      description TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `
  ).run();
}

function seedPlatformFeatureFlags() {
  const flags = [
    ["launchPage", "控制项目启动选择页 /launch 与根路由启动流程。"],
    ["platformOverview", "控制平台总览 /overview 入口、页面与 API。"],
    ["personalWorkPackage", "控制个人事项快速新建与完整新建入口。"],
    ["personalAgentBreakdown", "控制个人 AI 拆解 /my/breakdown 入口。"],
    ["personalNotifications", "控制我的工作台个人通知区块。"],
    ["bigScreen", "控制平台总览大屏看板 /overview/screen。"],
    ["agentTools", "控制 AI 友好工具集 REST / SDK 调用管道。"],
    ["agentMcpServer", "控制 MCP 预留端点；本阶段仅保留 501 壳子。"]
  ];
  const insert = db.prepare(
    `
    INSERT INTO PlatformFeatureFlag (key, siteEnabled, roleOverrides, description, updatedAt)
    VALUES (?, 1, '{}', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET description = excluded.description
    `
  );

  for (const [key, description] of flags) {
    insert.run(key, description);
  }
}

function ensureAgentTables() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS AgentApiKey (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      keyPrefix TEXT NOT NULL UNIQUE,
      hashedKey TEXT NOT NULL,
      allowedTools TEXT NOT NULL DEFAULT '[]',
      allowedRoles TEXT NOT NULL DEFAULT '[]',
      qpsLimit INTEGER NOT NULL DEFAULT 5,
      dailyLimit INTEGER NOT NULL DEFAULT 1000,
      expiresAt DATETIME,
      revokedAt DATETIME,
      createdByUserId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT AgentApiKey_createdByUserId_fkey FOREIGN KEY (createdByUserId) REFERENCES User (id)
    )
    `
  ).run();
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS AgentToolInvocation (
      id TEXT NOT NULL PRIMARY KEY,
      toolName TEXT NOT NULL,
      callerUserId TEXT,
      callerApiKeyId TEXT,
      source TEXT NOT NULL DEFAULT 'rest',
      inputJson TEXT NOT NULL DEFAULT '{}',
      outputJson TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      errorMessage TEXT,
      idempotencyKey TEXT,
      parentInvocationId TEXT,
      durationMs INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT AgentToolInvocation_callerUserId_fkey FOREIGN KEY (callerUserId) REFERENCES User (id),
      CONSTRAINT AgentToolInvocation_callerApiKeyId_fkey FOREIGN KEY (callerApiKeyId) REFERENCES AgentApiKey (id)
    )
    `
  ).run();
  db.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS AgentToolInvocation_idempotencyKey_toolName_key ON AgentToolInvocation(idempotencyKey, toolName)"
  ).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS AgentToolInvocation_toolName_createdAt_idx ON AgentToolInvocation(toolName, createdAt)"
  ).run();
}
