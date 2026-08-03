"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APP_URL } from "@/utils/constants";

const PROTECTED_PATHS = ["/profile", "/settings", "/wsi"];

export function SessionExpiryGuard() {
  const { status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "unauthenticated" || pathname == null) return;

    const isProtected = PROTECTED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    if (isProtected) {
      signOut({ callbackUrl: "/auth/sign-in", redirect: true });
    }
  }, [status, pathname]);

  return null;
}
