import { expect, test } from "@playwright/test";

test.describe("personal work package foundation UI", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "pm-active-user-id",
        value: "u-member",
        url: "http://127.0.0.1:3000"
      }
    ]);
  });

  test("shows personal work packages on my page and enforces delete rules", async ({
    page,
    request
  }) => {
    const subject = `UI测试个人事项-${Date.now()}`;
    const createResponse = await request.post("/api/work-packages", {
      headers: { "x-user-id": "u-member" },
      data: {
        projectId: null,
        type: "task",
        subject,
        priority: "P2"
      }
    });
    expect(createResponse.ok()).toBe(true);

    const created = (await createResponse.json()) as { workPackage: { id: number } };
    const workPackageId = created.workPackage.id;

    try {
      await page.goto("/my/page");
      await expect(page.getByRole("heading", { name: "我的工作台" })).toBeVisible();
      await expect(page.getByText(subject)).toBeVisible();

      const forbiddenDelete = await request.delete("/api/work-packages/3", {
        headers: { "x-user-id": "u-member" }
      });
      expect(forbiddenDelete.status()).toBe(403);
    } finally {
      const cleanupResponse = await request.delete(`/api/work-packages/${workPackageId}`, {
        headers: { "x-user-id": "u-member" }
      });
      expect(cleanupResponse.ok()).toBe(true);
    }

    await page.reload();
    await expect(page.getByText(subject)).toHaveCount(0);
  });

  test("quick create adds a personal work package and delete button removes it", async ({ page }) => {
    const subject = `快速新建个人事项-${Date.now()}`;

    await page.goto("/my/page");
    await page.getByRole("button", { name: "+ 新建工作项" }).click();
    await page.getByLabel("标题").fill(subject);
    await page.getByRole("button", { name: "创建", exact: true }).click();

    const row = page.getByRole("row", { name: new RegExp(subject) });
    await expect(row).toBeVisible();
    await expect(row.getByText("自创建")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "删除" }).click();
    await expect(page.getByText(subject)).toHaveCount(0);
  });

  test("full create page can create and attach a personal item to a project", async ({ page }) => {
    const subject = `完整新建个人事项-${Date.now()}`;

    await page.goto("/my/work-packages/new");
    await page.getByLabel("主题").fill(subject);
    await page.getByLabel("描述").fill("通过完整表单创建的个人事项。");
    await page.getByRole("button", { name: "创建工作项" }).click();

    await expect(page).toHaveURL(/\/my\/page/);
    const row = page.getByRole("row", { name: new RegExp(subject) });
    await expect(row).toBeVisible();
    await row.getByRole("combobox").selectOption({ label: "AI 项目管理平台" });
    await row.getByRole("button", { name: "挂载" }).click();
    await expect(row.getByRole("link", { name: "AI 项目管理平台" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "删除" }).click();
    await expect(page.getByText(subject)).toHaveCount(0);
  });

  test("personal AI breakdown writes edited candidates into my page", async ({ page }) => {
    const subject = `AI编辑个人事项-${Date.now()}`;

    await page.goto("/my/breakdown");
    await page
      .getByRole("textbox")
      .first()
      .fill("整理客户汇报，补充测试计划，自动跟进部署风险");
    await page.getByRole("button", { name: "生成草稿" }).click();
    await expect(page.getByRole("heading", { name: /候选工作项/ })).toBeVisible();

    const taskSection = page.locator("section").filter({ hasText: "候选工作项" });
    await taskSection.locator("input").first().fill(subject);
    await page.getByRole("button", { name: "写入我的工作台" }).click();

    await expect(page.getByText("已写入", { exact: false })).toBeVisible();
    await page.goto("/my/page");
    const row = page.getByRole("row", { name: new RegExp(subject) });
    await expect(row).toBeVisible();
    await expect(row.getByText("AI", { exact: true })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "删除" }).click();
    await expect(page.getByText(subject)).toHaveCount(0);
  });
});
