import { expect, test } from "@playwright/test";

test.describe("OpenProject-style shell smoke", () => {
  test("root redirects to launch page and shows project choices", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/launch/);
    await expect(page.getByRole("heading", { name: "选择要进入的项目" })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI 项目管理平台/ })).toBeVisible();
  });

  test("global sidebar exposes the OpenProject-style modules", async ({ page }) => {
    await page.goto("/my/page");
    const sidebar = page.getByLabel("全局模块");
    await expect(sidebar.getByRole("link", { name: "我的工作" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "启动" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "平台总览" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "项目" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "工作项" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "通知中心" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "管理员" })).toBeVisible();
  });

  test("project list shows hierarchy and lets users open a project", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "所有项目" })).toBeVisible();
    const projectLink = page.getByRole("link", { name: "AI 项目管理平台" }).first();
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/ai-pm\/overview/);
    await expect(page.locator("h1", { hasText: "AI 项目管理平台" })).toBeVisible();
  });

  test("project sidebar swaps to project modules and opens work packages", async ({ page }) => {
    await page.goto("/projects/ai-pm/overview");
    const sidebar = page.getByLabel(/AI 项目管理平台 模块导航/);
    await expect(sidebar.getByRole("link", { name: "概览" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "工作项" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "AI 诊断" })).toBeVisible();
    await sidebar.getByRole("link", { name: "工作项" }).click();
    await expect(page).toHaveURL(/\/projects\/ai-pm\/work-packages/);
    await expect(page.getByText("工作项", { exact: false }).first()).toBeVisible();
  });

  test("notification center is reachable and shows steward-driven deliveries", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "通讯通道" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "路由规则" })).toBeVisible();
  });
});
