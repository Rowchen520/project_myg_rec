const DEFAULT_APP_BASE_URL = "https://open.feishu.cn";
const DEFAULT_OAUTH_BASE_URL = "https://accounts.feishu.cn";

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appBaseUrl: string;
  oauthBaseUrl: string;
  redirectUri: string;
  scope?: string;
  tenantKey: string;
}

export interface FeishuAppConfig {
  appId: string;
  appSecret: string;
  appBaseUrl: string;
}

export function getFeishuAppConfig(env: NodeJS.ProcessEnv = process.env): FeishuAppConfig {
  const appId = env.FEISHU_APP_ID?.trim();
  const appSecret = env.FEISHU_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new Error("飞书应用未配置完成，请检查 FEISHU_APP_ID、FEISHU_APP_SECRET。");
  }

  return {
    appId,
    appSecret,
    appBaseUrl: (env.FEISHU_APP_BASE_URL?.trim() || DEFAULT_APP_BASE_URL).replace(/\/$/, "")
  };
}

export function getFeishuConfig(): FeishuConfig {
  const appConfig = getFeishuAppConfig();
  const redirectUri = process.env.FEISHU_OAUTH_REDIRECT_URI?.trim();

  if (!redirectUri) {
    throw new Error("飞书登录未配置完成，请检查 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_OAUTH_REDIRECT_URI。");
  }

  return {
    appId: appConfig.appId,
    appSecret: appConfig.appSecret,
    appBaseUrl: appConfig.appBaseUrl,
    oauthBaseUrl: (process.env.FEISHU_OAUTH_BASE_URL?.trim() || DEFAULT_OAUTH_BASE_URL).replace(/\/$/, ""),
    redirectUri,
    scope: process.env.FEISHU_OAUTH_SCOPE?.trim() || undefined,
    tenantKey: process.env.FEISHU_OAUTH_TENANT_KEY?.trim() || "default"
  };
}