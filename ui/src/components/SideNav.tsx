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
 * Desktop sidebar navigation. Shown only at lg+ - on mobile/tablet the
 * floating DockNav takes over instead. Sticks under the TopBar so it stays
 * in view while the main scrolls.
 */
export function SideNav({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <aside
      className={cn(
        "hidden lg:block lg:w-56 lg:shrink-0",
        className,
      )}
    >
      <div className="sticky top-16 flex flex-col gap-1 py-4 pr-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-white/10 text-amber-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-amber-300" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-amber-300" : "text-zinc-500 group-hover:text-zinc-300",
                )}
              />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
