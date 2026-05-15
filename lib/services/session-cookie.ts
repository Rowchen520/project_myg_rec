export const SESSION_COOKIE_NAME = "pm-active-user-id";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function buildSessionCookie(identity: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: identity,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax" as const
  };
}

export function buildClearedSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: false,
    sameSite: "lax" as const
  };
}