import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getFeishuConfig } from "./config";

export const FEISHU_STATE_COOKIE = "pm-feishu-oauth-state";
export const FEISHU_REDIRECT_COOKIE = "pm-feishu-oauth-redirect";
export const FEISHU_STATE_MAX_AGE = 60 * 10;

interface FeishuApiEnvelope<T> {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
}

type FeishuApiResponse<T> = FeishuApiEnvelope<T> & Partial<T>;

interface AppAccessTokenData {
  app_access_token?: string;
}

interface UserAccessTokenData {
  access_token?: string;
}

interface FeishuUserInfoData {
  open_id?: string;
  union_id?: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  mobile?: string;
}

export interface FeishuOAuthSession {
  state: string;
  redirectTo: string;
  authorizeUrl: string;
}

export interface FeishuProfile {
  openId: string;
  unionId?: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  mobile?: string;
}

export interface FeishuLoginResult {
  userId: string;
  isNewUser: boolean;
  needsProfileCompletion: boolean;
}

export class FeishuAuthError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function createOAuthSession(inputRedirectTo?: string): FeishuOAuthSession {
  const config = getFeishuConfig();
  const state = randomUUID();
  const redirectTo = normalizeRedirectTo(inputRedirectTo);
  const authorizeUrl = new URL(`${config.oauthBaseUrl}/open-apis/authen/v1/authorize`);

  authorizeUrl.searchParams.set("app_id", config.appId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("state", state);
  if (config.scope) {
    authorizeUrl.searchParams.set("scope", config.scope);
  }

  return { state, redirectTo, authorizeUrl: authorizeUrl.toString() };
}

export async function resolveFeishuProfile(code: string): Promise<FeishuProfile> {
  const config = getFeishuConfig();
  const appAccessToken = await getAppAccessToken(config.appBaseUrl, config.appId, config.appSecret);
  const userAccessToken = await exchangeCodeForUserAccessToken(config.appBaseUrl, appAccessToken, code);
  const userInfo = await getUserInfo(config.appBaseUrl, userAccessToken);

  if (!userInfo.open_id || !userInfo.name) {
    throw new FeishuAuthError("飞书返回的用户信息不完整，缺少 open_id 或 name。", 502);
  }

  return {
    openId: userInfo.open_id,
    unionId: userInfo.union_id,
    name: userInfo.name,
    avatarUrl: userInfo.avatar_url,
    email: userInfo.email,
    mobile: userInfo.mobile
  };
}

export async function findOrCreateUserFromFeishuProfile(profile: FeishuProfile): Promise<FeishuLoginResult> {
  const config = getFeishuConfig();

  const existingBinding = await prisma.feishuAccountBinding.findFirst({
    where: {
      tenantKey: config.tenantKey,
      OR: [
        { openId: profile.openId },
        ...(profile.unionId ? [{ unionId: profile.unionId }] : [])
      ]
    },
    include: { user: { include: { memberships: true } } }
  });

  if (existingBinding) {
    const binding = await prisma.feishuAccountBinding.update({
      where: { id: existingBinding.id },
      data: {
        unionId: profile.unionId,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        mobile: profile.mobile,
        revokedAt: null,
        lastLoginAt: new Date()
      },
      include: { user: true }
    });

    return {
      userId: binding.userId,
      isNewUser: false,
      needsProfileCompletion: !binding.profileCompletedAt
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        name: profile.name,
        role: "飞书成员",
        capacity: 100,
        skills: "[]"
      }
    });

    const user = await tx.user.create({
      data: {
        name: profile.name,
        role: "PARTICIPANT",
        personId: person.id
      }
    });

    await tx.feishuAccountBinding.create({
      data: {
        userId: user.id,
        tenantKey: config.tenantKey,
        openId: profile.openId,
        unionId: profile.unionId,
        avatarUrl: profile.avatarUrl,
        displayName: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        lastLoginAt: new Date()
      }
    });

    return user;
  });

  return {
    userId: created.id,
    isNewUser: true,
    needsProfileCompletion: true
  };
}

export async function getCurrentUserBinding(userId: string) {
  return prisma.feishuAccountBinding.findUnique({
    where: { userId },
    select: {
      tenantKey: true,
      openId: true,
      unionId: true,
      displayName: true,
      avatarUrl: true,
      email: true,
      mobile: true,
      profileCompletedAt: true,
      revokedAt: true,
      lastLoginAt: true
    }
  }).then((binding) => (binding?.revokedAt ? null : binding));
}

function normalizeRedirectTo(redirectTo?: string) {
  if (!redirectTo || !redirectTo.startsWith("/")) {
    return "/";
  }

  return redirectTo;
}

async function getAppAccessToken(appBaseUrl: string, appId: string, appSecret: string) {
  const response = await fetch(`${appBaseUrl}/open-apis/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as FeishuApiResponse<AppAccessTokenData> | null;
  const token = payload?.app_access_token ?? payload?.data?.app_access_token;

  if (!response.ok || payload?.code) {
    throw new FeishuAuthError(payload?.msg || payload?.message || "获取飞书 app_access_token 失败。", 502);
  }

  if (!token) {
    throw new FeishuAuthError("飞书 app_access_token 响应缺少令牌。", 502);
  }

  return token;
}

async function exchangeCodeForUserAccessToken(appBaseUrl: string, appAccessToken: string, code: string) {
  const response = await fetch(`${appBaseUrl}/open-apis/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appAccessToken}`
    },
    body: JSON.stringify({ grant_type: "authorization_code", code }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as FeishuApiResponse<UserAccessTokenData> | null;
  const token = payload?.access_token ?? payload?.data?.access_token;

  if (!response.ok || payload?.code) {
    throw new FeishuAuthError(payload?.msg || payload?.message || "飞书授权码换取用户令牌失败。", 502);
  }

  if (!token) {
    throw new FeishuAuthError("飞书用户令牌响应缺少 access_token。", 502);
  }

  return token;
}

async function getUserInfo(appBaseUrl: string, userAccessToken: string) {
  const response = await fetch(`${appBaseUrl}/open-apis/authen/v1/user_info`, {
    headers: {
      Authorization: `Bearer ${userAccessToken}`
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as FeishuApiResponse<FeishuUserInfoData> | null;
  const data = payload?.data ?? payload ?? null;

  if (!response.ok || (payload && "code" in payload && payload.code)) {
    const message = payload && "msg" in payload ? payload.msg : "获取飞书用户信息失败。";
    throw new FeishuAuthError(message || "获取飞书用户信息失败。", 502);
  }

  if (!data) {
    throw new FeishuAuthError("飞书用户信息响应为空。", 502);
  }

  return data;
}