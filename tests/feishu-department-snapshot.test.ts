import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    feishuDepartmentTreeSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  },
  getFeishuDepartmentTree: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/feishu/department_id", () => ({ getFeishuDepartmentTree: mocks.getFeishuDepartmentTree }));

describe("feishu department snapshot service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the persisted snapshot without calling Feishu", async () => {
    mocks.prisma.feishuDepartmentTreeSnapshot.findUnique.mockResolvedValue({
      treeJson: JSON.stringify([
        {
          open_department_id: "od-1",
          department_name: "研发中心",
          leaders: [],
          users: [{ name: "张三", open_id: "ou-1", user_id: "u-1", union_id: "on-1", email: "", mobile: "", enterprise_email: "", job_title: "" }],
          children: []
        }
      ]),
      departmentOptionsJson: JSON.stringify([{ openDepartmentId: "od-1", departmentName: "研发中心", parentOpenDepartmentId: undefined }]),
      excludedDepartmentIdsJson: JSON.stringify(["od-2"]),
      departmentCount: 1,
      userCount: 1,
      syncedAt: new Date("2026-05-15T10:00:00.000Z")
    });

    const { getStoredFeishuDepartmentTreeSnapshot } = await import("@/lib/services/feishu-department-tree");
    const snapshot = await getStoredFeishuDepartmentTreeSnapshot();

    expect(snapshot.departmentCount).toBe(1);
    expect(snapshot.userCount).toBe(1);
    expect(snapshot.tree[0]?.department_name).toBe("研发中心");
    expect(snapshot.availableDepartments).toEqual([{ openDepartmentId: "od-1", departmentName: "研发中心", parentOpenDepartmentId: undefined }]);
    expect(snapshot.excludedDepartmentIds).toEqual(["od-2"]);
    expect(mocks.getFeishuDepartmentTree).not.toHaveBeenCalled();
  });

  it("syncs from Feishu only when explicitly requested", async () => {
    mocks.prisma.feishuDepartmentTreeSnapshot.findUnique.mockResolvedValue({
      excludedDepartmentIdsJson: JSON.stringify([])
    });
    mocks.getFeishuDepartmentTree.mockResolvedValue([
      {
        open_department_id: "od-root",
        department_name: "研发中心",
        leaders: [{ name: "王主管", open_id: "ou-leader", user_id: "u-leader", union_id: "on-leader", email: "", mobile: "", enterprise_email: "", job_title: "", leader_type: 1 }],
        users: [{ name: "张三", open_id: "ou-1", user_id: "u-1", union_id: "on-1", email: "", mobile: "", enterprise_email: "", job_title: "" }],
        children: [
          {
            open_department_id: "od-frontend",
            department_name: "前端组",
            leaders: [],
            users: [{ name: "李四", open_id: "ou-2", user_id: "u-2", union_id: "on-2", email: "", mobile: "", enterprise_email: "", job_title: "" }],
            children: []
          }
        ]
      }
    ]);
    mocks.prisma.feishuDepartmentTreeSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      id: "snapshot-1"
    }));

    const { syncFeishuDepartmentTreeSnapshot } = await import("@/lib/services/feishu-department-tree");
    const snapshot = await syncFeishuDepartmentTreeSnapshot();

    expect(mocks.getFeishuDepartmentTree).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.feishuDepartmentTreeSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          departmentCount: 2,
          userCount: 2
        }),
        update: expect.objectContaining({
          departmentCount: 2,
          userCount: 2
        })
      })
    );
    expect(snapshot.departmentCount).toBe(2);
    expect(snapshot.userCount).toBe(2);
    expect(snapshot.availableDepartments).toEqual([
      { openDepartmentId: "od-frontend", departmentName: "前端组", parentOpenDepartmentId: "od-root" },
      { openDepartmentId: "od-root", departmentName: "研发中心", parentOpenDepartmentId: undefined }
    ]);
  });

  it("excludes configured departments from the next sync result", async () => {
    mocks.prisma.feishuDepartmentTreeSnapshot.findUnique.mockResolvedValue({
      excludedDepartmentIdsJson: JSON.stringify(["od-frontend"])
    });
    mocks.getFeishuDepartmentTree.mockResolvedValue([
      {
        open_department_id: "od-root",
        department_name: "研发中心",
        leaders: [],
        users: [{ name: "张三", open_id: "ou-1", user_id: "u-1", union_id: "on-1", email: "", mobile: "", enterprise_email: "", job_title: "" }],
        children: [
          {
            open_department_id: "od-frontend",
            department_name: "前端组",
            leaders: [],
            users: [{ name: "李四", open_id: "ou-2", user_id: "u-2", union_id: "on-2", email: "", mobile: "", enterprise_email: "", job_title: "" }],
            children: []
          }
        ]
      }
    ]);
    mocks.prisma.feishuDepartmentTreeSnapshot.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      id: "snapshot-2"
    }));

    const { syncFeishuDepartmentTreeSnapshot } = await import("@/lib/services/feishu-department-tree");
    const snapshot = await syncFeishuDepartmentTreeSnapshot();

    expect(snapshot.excludedDepartmentIds).toEqual(["od-frontend"]);
    expect(snapshot.departmentCount).toBe(1);
    expect(snapshot.userCount).toBe(1);
    expect(snapshot.tree[0]?.department_name).toBe("研发中心");
    expect(snapshot.tree[0]?.children).toEqual([]);
    expect(mocks.prisma.feishuDepartmentTreeSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          excludedDepartmentIdsJson: JSON.stringify(["od-frontend"]),
          departmentCount: 1,
          userCount: 1
        })
      })
    );
  });

  it("stores excluded departments for the next sync without mutating the current snapshot tree", async () => {
    mocks.prisma.feishuDepartmentTreeSnapshot.findUnique.mockResolvedValue({
      treeJson: JSON.stringify([
        {
          open_department_id: "od-root",
          department_name: "研发中心",
          leaders: [],
          users: [],
          children: [
            {
              open_department_id: "od-frontend",
              department_name: "前端组",
              leaders: [],
              users: [],
              children: []
            }
          ]
        }
      ]),
      departmentOptionsJson: JSON.stringify([
        { openDepartmentId: "od-root", departmentName: "研发中心", parentOpenDepartmentId: undefined },
        { openDepartmentId: "od-frontend", departmentName: "前端组", parentOpenDepartmentId: "od-root" }
      ]),
      excludedDepartmentIdsJson: JSON.stringify([]),
      departmentCount: 2,
      userCount: 0,
      syncedAt: new Date("2026-05-15T10:00:00.000Z")
    });
    mocks.prisma.feishuDepartmentTreeSnapshot.upsert.mockImplementation(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
      ...(Object.keys(update).length ? update : create),
      departmentCount: 2,
      userCount: 0,
      syncedAt: new Date("2026-05-15T10:00:00.000Z")
    }));

    const { updateFeishuDepartmentSyncSettings } = await import("@/lib/services/feishu-department-tree");
    const snapshot = await updateFeishuDepartmentSyncSettings({ excludedDepartmentIds: ["od-frontend"] });

    expect(snapshot.excludedDepartmentIds).toEqual(["od-frontend"]);
    expect(snapshot.tree[0]?.children).toHaveLength(1);
    expect(mocks.prisma.feishuDepartmentTreeSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          excludedDepartmentIdsJson: JSON.stringify(["od-frontend"]),
          treeJson: expect.any(String)
        })
      })
    );
  });
});