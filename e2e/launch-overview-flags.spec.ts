import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("launch overview and feature flags", () => {
  test("launch can skip to my page and overview renders KPI cards", async ({ page }) => {
    await page.goto("/launch");
    await expect(page.getByRole("heading", { name: "选择要进入的项目" })).toBeVisible();
    await page.getByRole("button", { name: "进入我的工作台" }).click();
    await expect(page).toHaveURL(/\/my\/page/);

    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: "平台总览" })).toBeVisible();
    await expect(page.getByText("项目总数")).toBeVisible();
    await expect(page.getByRole("link", { name: /AI 项目管理平台/ })).toBeVisible();
  });

  test("admin can hide and restore platform overview from the sidebar", async ({ context, page }) => {
    await context.addCookies([
      {
        name: "pm-active-user-id",
        value: "u-admin",
        url: "http://127.0.0.1:3000"
      }
    ]);

    await page.goto("/admin/feature-flags");
    const row = page.getByRole("row", { name: /platformOverview/ });
    await row.getByRole("button", { name: "已启用" }).click();
    await expect(row.getByRole("button", { name: "已关闭" })).toBeVisible();

    await page.goto("/my/page");
    await expect(page.getByLabel("全局模块").getByRole("link", { name: "平台总览" })).toHaveCount(0);

    await page.goto("/admin/feature-flags");
    await page.getByRole("row", { name: /platformOverview/ }).getByRole("button", { name: "已关闭" }).click();
    await expect(page.getByRole("row", { name: /platformOverview/ }).getByRole("button", { name: "已启用" })).toBeVisible();
  });
});
