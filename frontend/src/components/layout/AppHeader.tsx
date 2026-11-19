"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { toMenuUser } from "@/lib/auth/session";

import { MENU_OPEN_EVENT } from "./AlertFab";
import { useNavigationHistoryTracker } from "./BackButton";
import { type MenuUser, MobileMenu } from "./MobileMenu";
import { Navbar } from "./Navbar";

export interface AppHeaderProps {
  user?: MenuUser | null;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
}

export function AppHeader({
  user,
  onLogout,
  unreadNotificationsCount = 0,
}: AppHeaderProps) {
  const { user: authUser, logout } = useAuth();
  const resolvedUser = user !== undefined ? user : toMenuUser(authUser);
  const resolvedLogout =
    onLogout ??
    (() => {
      void logout();
    });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useNavigationHistoryTracker();

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(MENU_OPEN_EVENT, { detail: { isOpen: isMenuOpen } }),
    );
  }, [isMenuOpen]);

  function handleMenuToggle() {
    setIsMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsNotificationsOpen(false);
      }
      return next;
    });
  }

  function handleNotificationsToggle() {
    setIsNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsMenuOpen(false);
      }
      return next;
    });
  }

  return (
    <>
      <Navbar
        isMenuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        isNotificationsOpen={isNotificationsOpen}
        onNotificationsToggle={handleNotificationsToggle}
        unreadNotificationsCount={unreadNotificationsCount}
      />
      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={resolvedUser}
        onLogout={resolvedLogout}
      />
    </>
  );
}
