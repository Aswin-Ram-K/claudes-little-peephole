"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Radio,
  GitFork,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/live", icon: Radio, label: "Live" },
  { href: "/repos", icon: GitFork, label: "Repos" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity",
          expanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setExpanded(false)}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-50 flex flex-col",
          "bg-bg-card/95 backdrop-blur-md border-r border-border-subtle",
          "transition-all duration-300 ease-in-out",
          expanded ? "w-60" : "w-16",
          "max-lg:w-60",
          !expanded && "max-lg:-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border-subtle">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-indigo to-accent-violet flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span
            className={cn(
              "font-semibold text-text-primary whitespace-nowrap transition-opacity duration-200",
              expanded ? "opacity-100" : "opacity-0 lg:hidden"
            )}
          >
            Claude Portal
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                  "transition-all duration-200 group relative",
                  isActive
                    ? "bg-accent-glow text-accent-indigo"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-accent-indigo"
                      : "text-text-muted group-hover:text-text-primary"
                  )}
                />
                <span
                  className={cn(
                    "whitespace-nowrap transition-opacity duration-200",
                    expanded ? "opacity-100" : "opacity-0 lg:hidden"
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-accent-indigo to-accent-violet rounded-full" />
                )}
                {item.href === "/live" && (
                  <div className="status-dot status-dot-active ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Settings + Collapse */}
        <div className="p-2 border-t border-border-subtle space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-opacity duration-200",
                expanded ? "opacity-100" : "opacity-0 lg:hidden"
              )}
            >
              Settings
            </span>
          </Link>
          <button
            onClick={() => setExpanded(!expanded)}
            className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200 w-full"
          >
            {expanded ? (
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            )}
            <span
              className={cn(
                "whitespace-nowrap transition-opacity duration-200",
                expanded ? "opacity-100" : "opacity-0"
              )}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>

      {/* Spacer to push content */}
      <div
        className={cn(
          "hidden lg:block flex-shrink-0 transition-all duration-300",
          expanded ? "w-60" : "w-16"
        )}
      />
    </>
  );
}
