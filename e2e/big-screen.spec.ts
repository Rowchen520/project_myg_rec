import { expect, test } from "@playwright/test";

test.describe("platform big screen", () => {
  test("renders the overview screen with timeline and legend", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    await expect(page.getByRole("heading", { name: "AI 项目管理平台" })).toBeVisible();
    await expect(page.locator(".screen-today-line")).toContainText("今日");
    await expect(page.getByLabel("图例").getByText("关键节点")).toBeVisible();
    await expect(page.getByText("M1", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "当前节点" })).toBeVisible();
    await expect(page.getByText("阶段 / 任务名称", { exact: true })).toBeVisible();
  });

  test("shows only the hovered node popover while another node stays selected", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    const nodes = page.locator(".screen-gantt-task-bar, .screen-gantt-milestone");
    const visiblePopovers = page.locator(".screen-gantt-popover").filter({ visible: true });

    await expect(nodes.nth(1)).toBeVisible();
    await nodes.first().click();
    await expect(nodes.first()).toHaveAttribute("data-selected", "true");
    await expect(visiblePopovers).toHaveCount(1);

    await nodes.nth(1).hover();

    await expect(nodes.first()).toHaveAttribute("data-selected", "true");
    await expect(nodes.first()).toHaveAttribute("data-popover-open", "false");
    await expect(nodes.nth(1)).toHaveAttribute("data-popover-open", "true");
    await expect(visiblePopovers).toHaveCount(1);
  });

  test("clears node and phase selection when clicking empty canvas space", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    const nodes = page.locator(".screen-gantt-task-bar, .screen-gantt-milestone");
    const firstPhase = page.locator(".screen-gantt-name-cell.phase").first();

    await expect(nodes.first()).toBeVisible();
    await nodes.first().click();
    await expect(nodes.first()).toHaveAttribute("data-selected", "true");
    await expect(firstPhase).toHaveAttribute("data-selected", "true");

    const canvasBox = await page.locator(".screen-gantt-canvas-body").boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + Math.min(360, canvasBox.width - 24), canvasBox.y + 12);

    await expect(nodes.first()).toHaveAttribute("data-selected", "false");
    await expect(firstPhase).toHaveAttribute("data-selected", "false");
    await expect(page.locator(".screen-gantt-popover").filter({ visible: true })).toHaveCount(0);
  });

  test("renames a phase inline from the gantt name column", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    const nextName = "阶段名称 E2E 修改";
    await page.getByLabel(/修改阶段名称/).first().click();
    await page.getByLabel(/阶段名称：/).fill(nextName);
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.locator(".screen-gantt-name-cell.phase").first()).toContainText(nextName);
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeEnabled();
  });

  test("resizes the gantt name column by dragging the header handle", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    const nameBody = page.locator(".screen-gantt-name-body");
    const handle = page.getByLabel("调整阶段任务名称列宽");
    const before = await nameBody.evaluate((element) => element.getBoundingClientRect().width);
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) return;

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 96, handleBox.y + handleBox.height / 2);
    await page.mouse.up();

    const after = await nameBody.evaluate((element) => element.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before + 40);
  });

  test("creates a critical path line between two nodes from link mode", async ({ page }) => {
    await page.goto("/overview/screen?projectId=proj-ai-pm");

    const nodes = page.locator(".screen-gantt-task-bar, .screen-gantt-milestone");
    await expect(nodes.nth(1)).toBeVisible();

    await page.getByRole("button", { name: "关键路径连线" }).click();
    await expect(page.locator(".screen-gantt-shell")).toHaveAttribute("data-link-mode", "critical");
    await nodes.first().click();
    await expect(nodes.first()).toHaveAttribute("data-link-source", "true");
    await expect(page.locator(".screen-gantt-popover").filter({ visible: true })).toHaveCount(0);
    await nodes.nth(1).click();

    const criticalPaths = page.locator(".screen-dependency-layer path.critical");
    await expect(criticalPaths).not.toHaveCount(0);
    const countAfterCreate = await criticalPaths.count();
    await expect(page.getByRole("button", { name: "删除选中连线" })).toBeVisible();
    await page.getByRole("button", { name: "删除选中连线" }).click();
    await expect(criticalPaths).toHaveCount(countAfterCreate - 1);
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeEnabled();
  });

  test("serves anonymous screen data with token", async ({ request }) => {
    const response = await request.get("/api/overview/screen?projectId=proj-ai-pm&token=demo-big-screen");

    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as { plan: { projectName: string }; source: string };
    expect(payload.plan.projectName).toBe("AI 项目管理平台");
    expect(payload.source).toBe("baseline");
  });
});
