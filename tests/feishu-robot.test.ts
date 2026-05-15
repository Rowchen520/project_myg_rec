import { afterEach, describe, expect, it } from "vitest";
import {
  buildNoticeTemplateVariables,
  buildRobotNotification,
  getFeishuRobotConfig
} from "@/feishu/robot";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("feishu robot config", () => {
  it("reads official SDK env vars without deriving card title/body defaults", () => {
    const env = {
      ...originalEnv,
      FEISHU_APP_ID: "cli_robot_app",
      FEISHU_APP_SECRET: "robot_secret",
      FEISHU_APP_BASE_URL: "https://open.feishu.cn",
      NOTICE_CARD_ID: "ctp_robot_notice"
    } satisfies NodeJS.ProcessEnv;

    const config = getFeishuRobotConfig(env);

    expect(config.appId).toBe("cli_robot_app");
    expect(config.noticeCardId).toBe("ctp_robot_notice");
    expect("defaultNotification" in config).toBe(false);
  });

  it("only writes title/body plus explicit template overrides into card template variables", () => {
    const notification = buildRobotNotification({
      title: "工作项已逾期",
      body: "请在今天内更新进展。"
    });

    const variables = buildNoticeTemplateVariables(notification, { tenant: "override" });

    expect(variables.title).toBe("工作项已逾期");
    expect(variables.body).toBe("请在今天内更新进展。");
    expect(variables.tenant).toBe("override");
    expect(variables.level).toBeUndefined();
    expect(variables.event_type).toBeUndefined();
    expect(variables.highlights).toBeUndefined();
    expect(variables.link).toBeUndefined();
  });

  it("requires business side to provide both title and body", () => {
    expect(() => buildRobotNotification({ title: "", body: "正文" })).toThrow("缺少标题");
    expect(() => buildRobotNotification({ title: "标题", body: "   " })).toThrow("缺少正文");
  });
});