"use client";

import { useState } from "react";

import { type MenuUser, MobileMenu } from "./MobileMenu";
import { Navbar } from "./Navbar";

export interface AppHeaderProps {
  user?: MenuUser | null;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
}

export function AppHeader({
  user = null,
  onLogout,
  unreadNotificationsCount = 0,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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
        user={user}
        onLogout={onLogout}
      />
    </>
  );
}
