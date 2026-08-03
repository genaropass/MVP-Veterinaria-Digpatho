"use client"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react";
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { UserCircleIcon } from "@heroicons/react/24/outline";
import LanguageSwitcher from "../language-switcher"
import Sidebar from "../side-bar"

const Navbar = () => {
  const t = useTranslations("navbar")
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-300 sticky top-0 z-50">
      <div className="site-container flex justify-between items-center py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-primary">
          <Image src={"/assets/logo.png"} width={150} height={150} priority alt="Image Logo" />
        </Link>

        {/* Right-side items: Language Switcher and Authentication */}
        <div className="flex items-center space-x-6">
          <LanguageSwitcher />

          {/* Sidebar Toggle Button (User Icon) */}
          {isAuthenticated ? (
            <button onClick={toggleSidebar} className="btn flex items-center gap-2">
              <UserCircleIcon className="w-8 h-8 text-gray-600 hover:text-primary" />
            </button>
          ) : (
            <Link href="/auth/sign-in" prefetch={true} className="btn">
              {t("login")}
            </Link>
          )}
        </div>
      </div>

      {/* Sidebar Component */}
      {isAuthenticated && <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />}
    </nav>
  );
};

export default Navbar;