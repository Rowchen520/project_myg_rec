import { describe, expect, it } from "vitest";
import { buildSimplifiedDepartmentTree } from "@/feishu/department_id";

describe("feishu department tree", () => {
  it("builds a nested simplified tree and keeps department leaders with user contact info", () => {
    const tree = buildSimplifiedDepartmentTree([
      {
        open_department_id: "od-parent",
        name: "父部门",
        parent_department_id: undefined,
        leaders: [
          {
            name: "王主管",
            open_id: "ou-leader",
            user_id: "u-leader",
            union_id: "on-leader",
            email: "leader@example.com",
            mobile: "13800000000",
            enterprise_email: "leader@corp.example.com",
            job_title: "部门负责人",
            leader_type: 1
          }
        ],
        direct_users: [
          {
            name: "张三",
            open_id: "ou-parent",
            user_id: "u-parent",
            union_id: "on-parent",
            email: "zhangsan@example.com",
            mobile: "13900000000",
            enterprise_email: "zhangsan@corp.example.com",
            job_title: "工程师",
            extra: "ignored"
          }
        ],
      },
      {
        open_department_id: "od-child",
        name: { default_value: "子部门" },
        parent_department_id: "od-parent",
        leaders: [],
        direct_users: [
          {
            name: "李四",
            open_id: "ou-child",
            user_id: "u-child",
            union_id: "on-child",
            email: "lisi@example.com",
            mobile: "13700000000",
            enterprise_email: "lisi@corp.example.com",
            job_title: "工程师"
          }
        ],
      }
    ] as any);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toEqual({
      open_department_id: "od-parent",
      department_name: "父部门",
      leaders: [
        {
          name: "王主管",
          open_id: "ou-leader",
          user_id: "u-leader",
          union_id: "on-leader",
          email: "leader@example.com",
          mobile: "13800000000",
          enterprise_email: "leader@corp.example.com",
          job_title: "部门负责人",
          leader_type: 1
        }
      ],
      users: [
        {
          name: "张三",
          open_id: "ou-parent",
          user_id: "u-parent",
          union_id: "on-parent",
          email: "zhangsan@example.com",
          mobile: "13900000000",
          enterprise_email: "zhangsan@corp.example.com",
          job_title: "工程师"
        }
      ],
      children: [
        {
          open_department_id: "od-child",
          department_name: "子部门",
          leaders: [],
          users: [
            {
              name: "李四",
              open_id: "ou-child",
              user_id: "u-child",
              union_id: "on-child",
              email: "lisi@example.com",
              mobile: "13700000000",
              enterprise_email: "lisi@corp.example.com",
              job_title: "工程师"
            }
          ],
          children: []
        }
      ]
    });
  });
});