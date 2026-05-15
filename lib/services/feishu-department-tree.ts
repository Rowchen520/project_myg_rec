import { getFeishuDepartmentTree, type SimplifiedDepartmentNode } from "@/feishu/department_id";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_KEY = "default";

export interface FeishuDepartmentSyncOption {
  openDepartmentId: string;
  departmentName: string;
  parentOpenDepartmentId?: string;
}

export interface FeishuDepartmentTreeSnapshotDto {
  tree: SimplifiedDepartmentNode[];
  availableDepartments: FeishuDepartmentSyncOption[];
  excludedDepartmentIds: string[];
  departmentCount: number;
  userCount: number;
  syncedAt: string | null;
}

export async function getStoredFeishuDepartmentTreeSnapshot(): Promise<FeishuDepartmentTreeSnapshotDto> {
  const row = await prisma.feishuDepartmentTreeSnapshot.findUnique({
    where: { tenantKey: DEFAULT_TENANT_KEY }
  });

  const tree = parseTreeJson(row?.treeJson);
  const availableDepartments = parseDepartmentOptionsJson(row?.departmentOptionsJson, tree);
  const excludedDepartmentIds = parseStringArrayJson(row?.excludedDepartmentIdsJson);

  return {
    tree,
    availableDepartments,
    excludedDepartmentIds,
    departmentCount: row?.departmentCount ?? 0,
    userCount: row?.userCount ?? 0,
    syncedAt: row?.syncedAt?.toISOString() ?? null
  };
}

export async function syncFeishuDepartmentTreeSnapshot(): Promise<FeishuDepartmentTreeSnapshotDto> {
  const existing = await prisma.feishuDepartmentTreeSnapshot.findUnique({
    where: { tenantKey: DEFAULT_TENANT_KEY },
    select: {
      excludedDepartmentIdsJson: true
    }
  });
  const fullTree = await getFeishuDepartmentTree();
  const excludedDepartmentIds = parseStringArrayJson(existing?.excludedDepartmentIdsJson);
  const availableDepartments = collectDepartmentOptions(fullTree);
  const tree = filterExcludedDepartments(fullTree, new Set(excludedDepartmentIds));
  const stats = collectTreeStats(tree);
  const syncedAt = new Date();

  const row = await prisma.feishuDepartmentTreeSnapshot.upsert({
    where: { tenantKey: DEFAULT_TENANT_KEY },
    create: {
      tenantKey: DEFAULT_TENANT_KEY,
      treeJson: JSON.stringify(tree),
      departmentOptionsJson: JSON.stringify(availableDepartments),
      excludedDepartmentIdsJson: JSON.stringify(excludedDepartmentIds),
      departmentCount: stats.departmentCount,
      userCount: stats.userCount,
      syncedAt
    },
    update: {
      treeJson: JSON.stringify(tree),
      departmentOptionsJson: JSON.stringify(availableDepartments),
      excludedDepartmentIdsJson: JSON.stringify(excludedDepartmentIds),
      departmentCount: stats.departmentCount,
      userCount: stats.userCount,
      syncedAt
    }
  });

  return {
    tree,
    availableDepartments,
    excludedDepartmentIds,
    departmentCount: row.departmentCount,
    userCount: row.userCount,
    syncedAt: row.syncedAt?.toISOString() ?? syncedAt.toISOString()
  };
}

export async function updateFeishuDepartmentSyncSettings(input: { excludedDepartmentIds: string[] }) {
  const excludedDepartmentIds = Array.from(new Set(input.excludedDepartmentIds.map((item) => item.trim()).filter(Boolean)));
  const existing = await prisma.feishuDepartmentTreeSnapshot.findUnique({
    where: { tenantKey: DEFAULT_TENANT_KEY }
  });
  const tree = parseTreeJson(existing?.treeJson);
  const availableDepartments = parseDepartmentOptionsJson(existing?.departmentOptionsJson, tree);
  const stats = collectTreeStats(tree);

  const row = await prisma.feishuDepartmentTreeSnapshot.upsert({
    where: { tenantKey: DEFAULT_TENANT_KEY },
    create: {
      tenantKey: DEFAULT_TENANT_KEY,
      treeJson: JSON.stringify(tree),
      departmentOptionsJson: JSON.stringify(availableDepartments),
      excludedDepartmentIdsJson: JSON.stringify(excludedDepartmentIds),
      departmentCount: stats.departmentCount,
      userCount: stats.userCount,
      syncedAt: existing?.syncedAt ?? null
    },
    update: {
      departmentOptionsJson: JSON.stringify(availableDepartments),
      excludedDepartmentIdsJson: JSON.stringify(excludedDepartmentIds),
      treeJson: JSON.stringify(tree)
    }
  });

  return {
    tree,
    availableDepartments,
    excludedDepartmentIds,
    departmentCount: row.departmentCount,
    userCount: row.userCount,
    syncedAt: row.syncedAt?.toISOString() ?? null
  };
}

function parseTreeJson(value?: string): SimplifiedDepartmentNode[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as SimplifiedDepartmentNode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDepartmentOptionsJson(value: string | undefined, fallbackTree: SimplifiedDepartmentNode[]): FeishuDepartmentSyncOption[] {
  if (!value) {
    return collectDepartmentOptions(fallbackTree);
  }

  try {
    const parsed = JSON.parse(value) as FeishuDepartmentSyncOption[];
    if (!Array.isArray(parsed)) {
      return collectDepartmentOptions(fallbackTree);
    }

    return parsed.filter(
      (item): item is FeishuDepartmentSyncOption =>
        Boolean(
          item &&
          typeof item.openDepartmentId === "string" &&
          typeof item.departmentName === "string" &&
          (item.parentOpenDepartmentId === undefined || typeof item.parentOpenDepartmentId === "string")
        )
    );
  } catch {
    return collectDepartmentOptions(fallbackTree);
  }
}

function parseStringArrayJson(value?: string): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
  } catch {
    return [];
  }
}

function collectDepartmentOptions(tree: SimplifiedDepartmentNode[]): FeishuDepartmentSyncOption[] {
  const options: FeishuDepartmentSyncOption[] = [];

  const visit = (nodes: SimplifiedDepartmentNode[], parentOpenDepartmentId?: string) => {
    for (const node of nodes) {
      if (node.open_department_id) {
        options.push({
          openDepartmentId: node.open_department_id,
          departmentName: node.department_name || node.open_department_id,
          parentOpenDepartmentId
        });
      }
      visit(node.children, node.open_department_id || parentOpenDepartmentId);
    }
  };

  visit(tree);

  return options.sort((left, right) => left.departmentName.localeCompare(right.departmentName, "zh-CN"));
}

function filterExcludedDepartments(tree: SimplifiedDepartmentNode[], excludedDepartmentIds: Set<string>): SimplifiedDepartmentNode[] {
  return tree.flatMap((node) => {
    if (node.open_department_id && excludedDepartmentIds.has(node.open_department_id)) {
      return [];
    }

    return [{
      ...node,
      children: filterExcludedDepartments(node.children, excludedDepartmentIds)
    }];
  });
}

function collectTreeStats(tree: SimplifiedDepartmentNode[]) {
  let departmentCount = 0;
  let userCount = 0;

  const visit = (nodes: SimplifiedDepartmentNode[]) => {
    for (const node of nodes) {
      departmentCount += 1;
      userCount += node.users.length;
      visit(node.children);
    }
  };

  visit(tree);

  return { departmentCount, userCount };
}