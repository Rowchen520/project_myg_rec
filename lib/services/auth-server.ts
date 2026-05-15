import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { mapUser } from "@/lib/repositories/workspace-mappers";
import { resolveStoredUserByIdentity } from "./auth-context";
import { SESSION_COOKIE_NAME } from "./session-cookie";

/**
 * Resolves the current user inside a Next.js Server Component / Route handler
 * via a cookie set by the user menu, falling back to the first seeded user.
 */
export async function getCurrentUserFromSession(): Promise<User | undefined> {
  const cookieStore = await cookies();
  const cookieIdentity = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieIdentity) {
    return undefined;
  }

  try {
    const user = await resolveStoredUserByIdentity(cookieIdentity);

    if (user) {
      return mapUser(user);
    }
  } catch {
    return undefined;
  }

  return undefined;
}
