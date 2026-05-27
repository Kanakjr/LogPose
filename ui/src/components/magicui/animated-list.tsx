"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { AnimatePresence, motion, type MotionProps } from "motion/react";

import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0.95, opacity: 0, y: 8 },
    animate: { scale: 1, opacity: 1, y: 0, originY: 0 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} layout className="w-full">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 120, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children],
    );

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      if (index < childrenArray.length) {
        timeout = setTimeout(() => {
          setIndex((prev) => Math.min(prev + 1, childrenArray.length));
        }, delay);
      }
      return () => {
        if (timeout !== null) clearTimeout(timeout);
      };
    }, [index, delay, childrenArray.length]);

    const itemsToShow = useMemo(
      () => childrenArray.slice(0, index),
      [index, childrenArray],
    );

    return (
      <div className={cn("flex flex-col gap-3", className)} {...props}>
        <AnimatePresence initial={false}>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as React.ReactElement).key}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedList.displayName = "AnimatedList";
