import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import type { User } from "@/lib/types";

const COOKIE_NAME = "pm-active-user-id";

/**
 * Resolves the current user inside a Next.js Server Component / Route handler
 * via a cookie set by the user menu, falling back to the first seeded user.
 */
export async function getCurrentUserFromSession(): Promise<User | undefined> {
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get(COOKIE_NAME)?.value;

  try {
    const user = (await prisma.user.findFirst({
      where: cookieUserId ? { id: cookieUserId } : undefined,
      include: { memberships: true },
      orderBy: { createdAt: "asc" }
    })) as StoredUser | null;

    if (user) {
      return mapUser(user);
    }

    const fallback = (await prisma.user.findFirst({
      include: { memberships: true },
      orderBy: { createdAt: "asc" }
    })) as StoredUser | null;
    return fallback ? mapUser(fallback) : undefined;
  } catch {
    return undefined;
  }
}
