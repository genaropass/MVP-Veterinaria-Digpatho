'use-client';

import {
  XMarkIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Squares2X2Icon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOut } from "@/components/sign-out";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("sidebar");

  // Close sidebar on escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        toggleSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen, toggleSidebar]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        toggleSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen, toggleSidebar]);

  const menuItems = [
    {
      href: "/profile",
      label: t("profile"),
      icon: Squares2X2Icon,
    },
    {
      href: "/bots",
      label: t("bots"),
      icon: SparklesIcon,
    },
    {
      href: "/settings",
      label: t("settings"),
      icon: Cog6ToothIcon,
    },
  ];

  const isActiveRoute = (href: string) => pathname === href;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300 z-40 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 right-0 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl transform transition-all duration-300 ease-out z-50 ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        } border-l border-gray-100 dark:border-gray-800`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
          <h2
            id="sidebar-title"
            className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent"
          >
            {t("title")}
          </h2>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-6 space-y-2" aria-label="User navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/10 dark:bg-primary/20 text-primary shadow-sm ring-1 ring-primary/20"
                    : "text-gray-700 dark:text-gray-200 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
                }`}
                onClick={toggleSidebar} // Close sidebar when navigating
              >
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isActive
                      ? "text-primary"
                      : "text-gray-400 dark:text-gray-500 group-hover:text-primary/70 dark:group-hover:text-primary/80"
                  }`}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Sign Out Section */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-6">
            <div className="flex items-center space-x-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all duration-200 group cursor-pointer">
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors duration-200" />
              <SignOut />
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/60">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t("press")}{" "}
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
              Esc
            </kbd>{" "}
            {t("close")}
          </p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
