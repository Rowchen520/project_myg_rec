import { getFeishuAppConfig } from "@/feishu/config";

const DEFAULT_REQUIRED_FIELDS = [
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
];

export interface SimplifiedDepartmentUser {
  name: string;
  open_id: string;
  user_id: string;
  union_id: string;
  email: string;
  mobile: string;
  enterprise_email: string;
  job_title: string;
}

export interface SimplifiedDepartmentLeader extends SimplifiedDepartmentUser {
  leader_type?: number;
}

export interface SimplifiedDepartmentNode {
  open_department_id: string;
  department_name: string;
  leaders: SimplifiedDepartmentLeader[];
  users: SimplifiedDepartmentUser[];
  children: SimplifiedDepartmentNode[];
}

interface FeishuApiEnvelope<T> {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
}

type FeishuApiResponse<T> = FeishuApiEnvelope<T> & Partial<T>;

interface DepartmentChildItem {
  department_id?: string;
  name?: string;
  open_department_id?: string;
  parent_department_id?: string;
}

interface DepartmentDetailItem {
  department_id?: string;
  name?: string | { default_value?: string };
  leaders?: DepartmentLeaderReferenceItem[];
  department_path_infos?: Array<{
    department_id?: string;
    department_name?: { default_value?: string };
  }>;
  parent_department_id?: string;
}

interface DepartmentLeaderReferenceItem {
  leader_id?: string;
  leader_type?: number;
}

interface DepartmentUserItem {
  name?: string;
  open_id?: string;
  user_id?: string;
  union_id?: string;
  email?: string;
  mobile?: string;
  enterprise_email?: string;
  job_title?: string;
}

interface DepartmentArchitectureItem {
  department_id?: string;
  open_department_id: string;
  name?: string | { default_value?: string };
  parent_department_id?: string;
  leaders: SimplifiedDepartmentLeader[];
  direct_users: DepartmentUserItem[];
}

export async function getFeishuDepartmentTree(): Promise<SimplifiedDepartmentNode[]> {
  const config = getFeishuAppConfig();
  const tenantAccessToken = await getTenantAccessToken();
  const departments = await getAllDepartmentsRecursive(tenantAccessToken);
  const departmentIds = extractDepartmentIds(departments);
  const departmentDetails = await getDepartmentDetailsByIds(tenantAccessToken, departmentIds);
  const architecture = await buildDepartmentArchitecture(tenantAccessToken, departments, departmentDetails);

  return buildSimplifiedDepartmentTree(architecture);

  async function getTenantAccessToken(): Promise<string> {
    const response = await fetch(`${config.appBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      }),
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as FeishuApiResponse<{ tenant_access_token?: string }> | null;
    const token = payload?.tenant_access_token ?? payload?.data?.tenant_access_token;

    if (!response.ok || payload?.code) {
      throw new Error(`获取 tenant_access_token 失败: ${payload?.msg || payload?.message || response.statusText}`);
    }

    if (!token) {
      throw new Error("获取 tenant_access_token 失败: 飞书响应缺少 tenant_access_token");
    }

    return token;
  }
}

async function getAllDepartmentsRecursive(tenantAccessToken: string): Promise<DepartmentChildItem[]> {
  const config = getFeishuAppConfig();
  const items: DepartmentChildItem[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${config.appBaseUrl}/open-apis/contact/v3/departments/0/children`);
    url.searchParams.set("department_id_type", "open_department_id");
    url.searchParams.set("fetch_child", "true");
    url.searchParams.set("page_size", "50");
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      cache: "no-store"
    });
    const payload = (await response.json()) as FeishuApiResponse<{
      has_more?: boolean;
      page_token?: string;
      items?: DepartmentChildItem[];
    }>;

    if (!response.ok || payload.code !== 0) {
      throw new Error(`获取部门列表失败: ${payload.msg || response.statusText}`);
    }

    items.push(...(payload.data?.items ?? []));
    hasMore = Boolean(payload.data?.has_more);
    pageToken = payload.data?.page_token ?? "";
  }

  return items;
}

function extractDepartmentIds(departments: DepartmentChildItem[]): string[] {
  return departments.map((department) => department.open_department_id).filter((id): id is string => Boolean(id));
}

async function getDepartmentDetailsByIds(
  tenantAccessToken: string,
  departmentIds: string[],
  requiredFields: string[] = DEFAULT_REQUIRED_FIELDS
): Promise<DepartmentDetailItem[]> {
  const config = getFeishuAppConfig();
  const details: DepartmentDetailItem[] = [];

  for (const batch of chunkItems(departmentIds, 50)) {
    const url = new URL(`${config.appBaseUrl}/open-apis/directory/v1/departments/mget`);
    url.searchParams.set("department_id_type", "open_department_id");
    url.searchParams.set("employee_id_type", "open_id");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        department_ids: batch,
        required_fields: requiredFields
      }),
      cache: "no-store"
    });
    const payload = (await response.json()) as FeishuApiResponse<{
      departments?: DepartmentDetailItem[];
    }>;

    if (!response.ok || payload.code !== 0) {
      throw new Error(`获取部门详情失败: ${payload.msg || response.statusText}`);
    }

    details.push(...(payload.data?.departments ?? []));
  }

  return details;
}

async function getDepartmentUsers(
  tenantAccessToken: string,
  departmentId: string
): Promise<DepartmentUserItem[]> {
  const config = getFeishuAppConfig();
  const users: DepartmentUserItem[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${config.appBaseUrl}/open-apis/contact/v3/users/find_by_department`);
    url.searchParams.set("department_id", departmentId);
    url.searchParams.set("department_id_type", "open_department_id");
    url.searchParams.set("user_id_type", "open_id");
    url.searchParams.set("page_size", "50");
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      cache: "no-store"
    });
    const payload = (await response.json()) as FeishuApiResponse<{
      items?: DepartmentUserItem[];
      has_more?: boolean;
      page_token?: string;
    }>;

    if (!response.ok || payload.code !== 0) {
      throw new Error(`获取部门直属用户失败: ${payload.msg || response.statusText}`);
    }

    users.push(...(payload.data?.items ?? []));
    hasMore = Boolean(payload.data?.has_more);
    pageToken = payload.data?.page_token ?? "";
  }

  return users;
}

async function getUsersByIds(tenantAccessToken: string, userIds: string[]): Promise<Map<string, DepartmentUserItem>> {
  const config = getFeishuAppConfig();
  const userByOpenId = new Map<string, DepartmentUserItem>();

  for (const batch of chunkItems(userIds, 50)) {
    const url = new URL(`${config.appBaseUrl}/open-apis/contact/v3/users/batch`);
    url.searchParams.set("user_id_type", "open_id");
    url.searchParams.set("department_id_type", "open_department_id");
    for (const userId of batch) {
      url.searchParams.append("user_ids", userId);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      cache: "no-store"
    });
    const payload = (await response.json()) as FeishuApiResponse<{
      items?: DepartmentUserItem[];
    }>;

    if (!response.ok || payload.code !== 0) {
      throw new Error(`批量获取用户详情失败: ${payload.msg || response.statusText}`);
    }

    for (const item of payload.data?.items ?? []) {
      if (item.open_id) {
        userByOpenId.set(item.open_id, item);
      }
    }
  }

  return userByOpenId;
}

async function buildDepartmentArchitecture(
  tenantAccessToken: string,
  sourceDepartments: DepartmentChildItem[],
  departmentDetails: DepartmentDetailItem[]
): Promise<DepartmentArchitectureItem[]> {
  const detailItemsByOpenDepartmentId = new Map<string, DepartmentDetailItem>();
  for (const item of departmentDetails) {
    const openDepartmentId = getDepartmentOpenIdFromDetail(item);
    if (openDepartmentId) {
      detailItemsByOpenDepartmentId.set(openDepartmentId, item);
    }
  }

  const architecture: DepartmentArchitectureItem[] = [];
  const allUserOpenIds = new Set<string>(
    departmentDetails.flatMap((item) =>
      (item.leaders ?? []).map((leader) => leader.leader_id).filter((leaderId): leaderId is string => Boolean(leaderId))
    )
  );

  for (const sourceDepartment of sourceDepartments) {
    const openDepartmentId = sourceDepartment.open_department_id;
    if (!openDepartmentId) {
      continue;
    }

    const departmentDetail = detailItemsByOpenDepartmentId.get(openDepartmentId);
    const directUsers = await getDepartmentUsers(tenantAccessToken, openDepartmentId);
    for (const directUser of directUsers) {
      if (directUser.open_id) {
        allUserOpenIds.add(directUser.open_id);
      }
    }

    architecture.push({
      department_id: sourceDepartment.department_id,
      open_department_id: openDepartmentId,
      name: sourceDepartment.name || departmentDetail?.name,
      parent_department_id:
        getParentOpenDepartmentIdFromDetail(departmentDetail) || sourceDepartment.parent_department_id || departmentDetail?.parent_department_id,
      leaders: [],
      direct_users: directUsers
    });
  }

  const userDetailsByOpenId = await getUsersByIds(tenantAccessToken, Array.from(allUserOpenIds));

  for (const item of architecture) {
    const departmentDetail = detailItemsByOpenDepartmentId.get(item.open_department_id);
    item.leaders = simplifyLeaders(departmentDetail?.leaders, userDetailsByOpenId);
    item.direct_users = enrichUsers(item.direct_users, userDetailsByOpenId);
  }

  return architecture;
}

function getDepartmentOpenIdFromDetail(departmentDetail?: DepartmentDetailItem): string | undefined {
  return departmentDetail?.department_path_infos?.at(-1)?.department_id;
}

function getParentOpenDepartmentIdFromDetail(departmentDetail?: DepartmentDetailItem): string | undefined {
  return departmentDetail?.department_path_infos && departmentDetail.department_path_infos.length > 1
    ? departmentDetail.department_path_infos.at(-2)?.department_id
    : undefined;
}

function normalizeDepartmentName(rawName: DepartmentArchitectureItem["name"]): string {
  if (typeof rawName === "string") {
    return rawName;
  }
  return rawName?.default_value ?? "";
}

function simplifyUser(user: DepartmentUserItem): SimplifiedDepartmentUser {
  return {
    name: user.name ?? "",
    open_id: user.open_id ?? "",
    user_id: user.user_id ?? "",
    union_id: user.union_id ?? "",
    email: user.email ?? "",
    mobile: user.mobile ?? "",
    enterprise_email: user.enterprise_email ?? "",
    job_title: user.job_title ?? ""
  };
}

function simplifyLeaders(
  leaders: DepartmentLeaderReferenceItem[] | undefined,
  userDetailsByOpenId: Map<string, DepartmentUserItem>
): SimplifiedDepartmentLeader[] {
  return (leaders ?? []).map((leader) => {
    const leaderId = leader.leader_id ?? "";
    const userDetails = leaderId ? userDetailsByOpenId.get(leaderId) : undefined;

    return {
      ...simplifyUser(userDetails ?? { open_id: leaderId }),
      leader_type: leader.leader_type
    };
  });
}

function enrichUsers(users: DepartmentUserItem[], userDetailsByOpenId: Map<string, DepartmentUserItem>): DepartmentUserItem[] {
  return users.map((user) => {
    const openId = user.open_id;
    if (!openId) {
      return user;
    }

    return {
      ...user,
      ...userDetailsByOpenId.get(openId)
    };
  });
}

export function buildSimplifiedDepartmentTree(departmentArchitecture: DepartmentArchitectureItem[]): SimplifiedDepartmentNode[] {
  const nodeById = new Map<string, SimplifiedDepartmentNode>();
  const rootNodes: SimplifiedDepartmentNode[] = [];

  for (const item of departmentArchitecture) {
    nodeById.set(item.open_department_id, {
      open_department_id: item.open_department_id,
      department_name: normalizeDepartmentName(item.name),
      leaders: item.leaders,
      users: item.direct_users.map(simplifyUser),
      children: []
    });
  }

  for (const item of departmentArchitecture) {
    const currentNode = nodeById.get(item.open_department_id);
    if (!currentNode) {
      continue;
    }

    const parentDepartmentId = item.parent_department_id;
    if (parentDepartmentId && parentDepartmentId !== item.open_department_id) {
      const parentNode = nodeById.get(parentDepartmentId);
      if (parentNode) {
        parentNode.children.push(currentNode);
        continue;
      }
    }

    rootNodes.push(currentNode);
  }

  return rootNodes;
}

function* chunkItems(items: string[], chunkSize: number): Iterable<string[]> {
  for (let index = 0; index < items.length; index += chunkSize) {
    yield items.slice(index, index + chunkSize);
  }
}