"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  ListChecks,
  Users,
  Gem,
  Map as MapIcon,
  ScrollText,
} from "lucide-react";
import { Dock, DockIcon } from "@/components/magicui/dock";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: Compass },
  { href: "/voyages", label: "Voyages", icon: ListChecks },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/treasure", label: "Treasure", icon: Gem },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/journal", label: "Journal", icon: ScrollText },
];

/**
 * Bottom navigation built on the Magic UI Dock. On hover (desktop) it
 * magnifies icons; on touch it stays compact. Each icon shows its label
 * only when active to keep the dock minimal.
 */
export function DockNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 lg:hidden"
      // env(safe-area-inset-bottom) defends against iOS home-indicator
      // overlap on notched devices; the static padding-bottom keeps the
      // dock floating off the bottom edge on Android / web.
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <Dock
        iconSize={42}
        iconMagnification={56}
        iconDistance={120}
        className="bg-zinc-950/80 ring-1 ring-white/5"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
          return (
            <DockIcon
              key={href}
              className={cn(
                "rounded-xl transition-colors",
                active ? "bg-white/10" : "hover:bg-white/5",
              )}
            >
              <Link
                href={href}
                aria-label={label}
                className="flex h-full w-full flex-col items-center justify-center"
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-amber-300" : "text-zinc-400",
                  )}
                />
              </Link>
            </DockIcon>
          );
        })}
      </Dock>
    </nav>
  );
}
