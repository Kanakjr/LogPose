"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type Grid = {
  rows: number;
  cols: number;
};

const DEFAULT_GRIDS: Record<string, Grid> = {
  "6x4": { rows: 4, cols: 6 },
  "8x8": { rows: 8, cols: 8 },
  "8x3": { rows: 3, cols: 8 },
  "4x6": { rows: 6, cols: 4 },
  "3x8": { rows: 8, cols: 3 },
};

type PredefinedGridKey = keyof typeof DEFAULT_GRIDS;

interface PixelImageProps {
  src: string;
  alt?: string;
  className?: string;
  grid?: PredefinedGridKey;
  customGrid?: Grid;
  grayscaleAnimation?: boolean;
  pixelFadeInDuration?: number;
  maxAnimationDelay?: number;
  colorRevealDelay?: number;
  rounded?: string;
}

export const PixelImage = ({
  src,
  alt = "",
  className,
  grid = "8x8",
  grayscaleAnimation = false,
  pixelFadeInDuration = 700,
  maxAnimationDelay = 600,
  colorRevealDelay = 700,
  customGrid,
  rounded = "rounded-2xl",
}: PixelImageProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showColor, setShowColor] = useState(!grayscaleAnimation);

  const { rows, cols } = useMemo(() => {
    const isValid = (g?: Grid) =>
      !!g && Number.isInteger(g.rows) && Number.isInteger(g.cols);
    return isValid(customGrid) ? customGrid! : DEFAULT_GRIDS[grid];
  }, [customGrid, grid]);

  useEffect(() => {
    setIsVisible(true);
    if (grayscaleAnimation) {
      const t = setTimeout(() => setShowColor(true), colorRevealDelay);
      return () => clearTimeout(t);
    }
  }, [colorRevealDelay, grayscaleAnimation]);

  const pieces = useMemo(() => {
    return Array.from({ length: rows * cols }, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const clipPath = `polygon(${col * (100 / cols)}% ${row * (100 / rows)}%, ${(col + 1) * (100 / cols)}% ${row * (100 / rows)}%, ${(col + 1) * (100 / cols)}% ${(row + 1) * (100 / rows)}%, ${col * (100 / cols)}% ${(row + 1) * (100 / rows)}%)`;
      const delay = Math.random() * maxAnimationDelay;
      return { clipPath, delay };
    });
  }, [rows, cols, maxAnimationDelay]);

  return (
    <div className={cn("relative aspect-square w-full select-none", className)}>
      {pieces.map((piece, index) => (
        <div
          key={index}
          className={cn(
            "absolute inset-0 transition-all ease-out",
            isVisible ? "opacity-100" : "opacity-0",
          )}
          style={{
            clipPath: piece.clipPath,
            transitionDelay: `${piece.delay}ms`,
            transitionDuration: `${pixelFadeInDuration}ms`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={cn(
              "z-1 size-full object-cover",
              rounded,
              grayscaleAnimation && (showColor ? "grayscale-0" : "grayscale"),
            )}
            style={{
              transition: grayscaleAnimation
                ? `filter ${pixelFadeInDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`
                : "none",
              imageRendering: "pixelated",
            }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
};
