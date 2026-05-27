"use client";

import React from "react";
import { motion, type MotionProps } from "motion/react";

import { cn } from "@/lib/utils";

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.95 } as never,
  animate: { "--x": "-100%", scale: 1 } as never,
  whileTap: { scale: 0.96 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
};

interface ShinyButtonProps
  extends Omit<React.HTMLAttributes<HTMLElement>, keyof MotionProps>,
    MotionProps {
  children: React.ReactNode;
  className?: string;
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-xl transition-shadow duration-300 ease-in-out hover:bg-white/10 hover:shadow",
          className,
        )}
        {...animationProps}
        {...props}
      >
        <span
          className="relative block size-full text-sm tracking-wide text-white/90"
          style={{
            maskImage:
              "linear-gradient(-75deg, rgba(255,255,255,1) calc(var(--x) + 20%), rgba(255,255,255,0.3) calc(var(--x) + 30%), rgba(255,255,255,1) calc(var(--x) + 100%))",
          }}
        >
          {children}
        </span>
      </motion.button>
    );
  },
);

ShinyButton.displayName = "ShinyButton";
