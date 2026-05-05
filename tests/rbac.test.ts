import { describe, expect, it } from "vitest";
import { can, filterWorkspaceForUser, permissionMatrix, roleLabels } from "@/lib/rbac";
import { sampleWorkspace } from "@/lib/sample-data";

describe("rbac", () => {
  it("exposes the OpenProject-style permission matrix", () => {
    expect(permissionMatrix.some((permission) => permission.key === "manageProjectModules")).toBe(true);
    expect(permissionMatrix.some((permission) => permission.key === "approveWorkPackages")).toBe(true);
    expect(permissionMatrix.some((permission) => permission.key === "useAgentBreakdown")).toBe(true);
    expect(permissionMatrix.some((permission) => permission.key === "createPersonalWorkPackage")).toBe(true);
    expect(permissionMatrix.some((permission) => permission.key === "deleteAnyWorkPackage")).toBe(true);
  });

  it("translates roles to localized labels", () => {
    expect(roleLabels.admin).toBe("管理员");
    expect(roleLabels.projectManager).toBe("项目经理");
    expect(roleLabels.participant).toBe("项目参与员");
  });

  it("only allows admins / project managers to manage modules", () => {
    expect(can("admin", "manageProjectModules")).toBe(true);
    expect(can("projectManager", "manageProjectModules")).toBe(true);
    expect(can("participant", "manageProjectModules")).toBe(false);
  });

  it("allows all roles to create personal work packages but only admins delete any", () => {
    expect(can("participant", "createPersonalWorkPackage")).toBe(true);
    expect(can("projectManager", "deleteOwnWorkPackage")).toBe(true);
    expect(can("admin", "deleteAnyWorkPackage")).toBe(true);
    expect(can("projectManager", "deleteAnyWorkPackage")).toBe(false);
  });

  it("filters participant workspace to own work packages", () => {
    const participant = sampleWorkspace.users.find((user) => user.role === "participant");
    expect(participant).toBeDefined();

    const scoped = filterWorkspaceForUser(sampleWorkspace, participant!);
    expect(scoped.workPackages.every((wp) => wp.assigneeId === participant!.personId)).toBe(true);
    expect(scoped.workPackages.some((wp) => !wp.projectId && wp.createdByUserId === participant!.id)).toBe(true);
    expect(scoped.projects.every((project) => participant!.participatingProjectIds.includes(project.id))).toBe(true);
  });

  it("admins see the full snapshot", () => {
    const admin = sampleWorkspace.users.find((user) => user.role === "admin")!;
    const scoped = filterWorkspaceForUser(sampleWorkspace, admin);
    expect(scoped.workPackages.length).toBe(sampleWorkspace.workPackages.length);
    expect(scoped.projects.length).toBe(sampleWorkspace.projects.length);
  });
});
