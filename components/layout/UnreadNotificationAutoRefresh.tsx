"use client";

import { startTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 15000;

export function UnreadNotificationAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!active) {
      return;
    }

    const refresh = () => {
      startTransition(() => {
        router.refresh();
      });
    };

    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const handleFocus = () => refresh();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [active, router, pathname]);

  return null;
}