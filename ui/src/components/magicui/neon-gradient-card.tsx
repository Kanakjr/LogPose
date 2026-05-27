"use client";

import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

interface NeonColorsProps {
  firstColor: string;
  secondColor: string;
}

interface NeonGradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: ReactNode;
  borderSize?: number;
  borderRadius?: number;
  neonColors?: NeonColorsProps;
}

export const NeonGradientCard: React.FC<NeonGradientCardProps> = ({
  className,
  children,
  borderSize = 2,
  borderRadius = 20,
  neonColors = { firstColor: "#f59e0b", secondColor: "#ec4899" },
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions({ width: offsetWidth, height: offsetHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    }
  }, [children]);

  return (
    <div
      ref={containerRef}
      style={
        {
          "--border-size": `${borderSize}px`,
          "--border-radius": `${borderRadius}px`,
          "--neon-first-color": neonColors.firstColor,
          "--neon-second-color": neonColors.secondColor,
          "--card-width": `${dimensions.width}px`,
          "--card-height": `${dimensions.height}px`,
          "--card-content-radius": `${borderRadius - borderSize}px`,
          "--pseudo-element-width": `${dimensions.width + borderSize * 2}px`,
          "--pseudo-element-height": `${dimensions.height + borderSize * 2}px`,
          "--after-blur": `${Math.max(20, dimensions.width / 4)}px`,
        } as CSSProperties
      }
      className={cn("relative z-10 size-full", className)}
      {...props}
    >
      <div
        className={cn(
          "relative size-full min-h-[inherit] bg-zinc-950 p-4",
          "before:absolute before:content-['']",
          "after:absolute after:content-['']",
        )}
        style={{
          borderRadius: `var(--card-content-radius)`,
        }}
      >
        <div
          className="pointer-events-none absolute -z-10"
          style={{
            top: `calc(-1 * var(--border-size))`,
            left: `calc(-1 * var(--border-size))`,
            width: `var(--pseudo-element-width)`,
            height: `var(--pseudo-element-height)`,
            borderRadius: `var(--border-radius)`,
            backgroundImage: `linear-gradient(0deg, var(--neon-first-color), var(--neon-second-color))`,
            backgroundSize: "100% 200%",
            animation: "background-position-spin 3s ease infinite",
          }}
        />
        <div
          className="pointer-events-none absolute -z-10"
          style={{
            top: `calc(-1 * var(--border-size))`,
            left: `calc(-1 * var(--border-size))`,
            width: `var(--pseudo-element-width)`,
            height: `var(--pseudo-element-height)`,
            borderRadius: `var(--border-radius)`,
            backgroundImage: `linear-gradient(0deg, var(--neon-first-color), var(--neon-second-color))`,
            backgroundSize: "100% 200%",
            filter: `blur(var(--after-blur))`,
            opacity: 0.7,
            animation: "background-position-spin 3s ease infinite",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
};
