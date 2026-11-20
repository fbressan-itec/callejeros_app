"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import type { UserRoleCode } from "@/components/layout/MobileMenu";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { getSafeRedirect } from "@/lib/auth/session";

export interface RequireAuthProps {
  children: ReactNode;
  redirectTo?: string;
  allowedRoles?: readonly UserRoleCode[];
  fallback?: ReactNode;
}

export function RequireAuth({
  children,
  redirectTo,
  allowedRoles,
  fallback,
}: RequireAuthProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const safeRedirect = getSafeRedirect(redirectTo ?? pathname);

  const hasAllowedRole =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    (user !== null &&
      (user.role.code === "admin" || allowedRoles.includes(user.role.code)));

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(safeRedirect)}`);
      return;
    }

    if (!hasAllowedRole) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, hasAllowedRole, router, safeRedirect]);

  if (isLoading) {
    return <>{fallback !== undefined ? fallback : <LoadingScreen />}</>;
  }

  if (!isAuthenticated || !hasAllowedRole) {
    return <>{fallback ?? null}</>;
  }

  return <>{children}</>;
}
