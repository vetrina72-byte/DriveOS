import React, { useEffect, useRef, useState } from 'react';

/**
 * Mathematical Apple Continuous Corner (Squircle) Path Generator
 * Computes cubic Bézier control points for C0 (position), C1 (tangent), and C2 (curvature) continuity.
 * Based on Apple's Squircle geometry (superellipse fitting).
 * 
 * @param w Width of the container in pixels
 * @param h Height of the container in pixels
 * @param radius Corner radius in pixels (default 24)
 * @returns SVG Path string 'd="..."'
 */
export function getAppleContinuousCornerPath(w: number, h: number, radius: number = 24): string {
  if (w <= 0 || h <= 0) return '';

  const r = Math.min(radius, Math.min(w, h) / 2);
  const p = Math.min(1.2819 * r, Math.min(w, h) / 2);
  const a = r;

  // Formatting helper to keep floating numbers clean
  const f = (n: number) => Number(n.toFixed(3));

  // Top-Right
  const trStart = f(w - p);
  const trC1x = f(w - p + 0.5592 * a);
  const trC1y = 0;
  const trC2x = f(w - p + 0.8543 * a);
  const trC2y = f(0.0805 * a);
  const trMx = f(w - p + 1.0505 * a);
  const trMy = f(0.2312 * a);
  const trC3x = f(w - 0.2312 * a);
  const trC3y = f(p - 1.0505 * a);
  const trC4x = f(w - 0.0805 * a);
  const trC4y = f(p - 0.8543 * a);
  const trEnd = f(p);

  // Bottom-Right
  const brStart = f(h - p);
  const brC1x = f(w);
  const brC1y = f(h - p + 0.5592 * a);
  const brC2x = f(w - 0.0805 * a);
  const brC2y = f(h - p + 0.8543 * a);
  const brMx = f(w - 0.2312 * a);
  const brMy = f(h - p + 1.0505 * a);
  const brC3x = f(w - p + 1.0505 * a);
  const brC3y = f(h - 0.2312 * a);
  const brC4x = f(w - p + 0.8543 * a);
  const brC4y = f(h - 0.0805 * a);
  const brEnd = f(w - p);

  // Bottom-Left
  const blStart = f(p);
  const blC1x = f(p - 0.5592 * a);
  const blC1y = f(h);
  const blC2x = f(p - 0.8543 * a);
  const blC2y = f(h - 0.0805 * a);
  const blMx = f(p - 1.0505 * a);
  const blMy = f(h - p + 1.0505 * a);
  const blC3x = f(0.2312 * a);
  const blC3y = f(h - p + 1.0505 * a);
  const blC4x = f(0.0805 * a);
  const blC4y = f(h - p + 0.8543 * a);
  const blEnd = f(h - p);

  // Top-Left
  const tlStart = f(p);
  const tlC1x = 0;
  const tlC1y = f(p - 0.5592 * a);
  const tlC2x = f(0.0805 * a);
  const tlC2y = f(p - 0.8543 * a);
  const tlMx = f(0.2312 * a);
  const tlMy = f(p - 1.0505 * a);
  const tlC3x = f(p - 1.0505 * a);
  const tlC3y = f(0.2312 * a);
  const tlC4x = f(p - 0.8543 * a);
  const tlC4y = f(0.0805 * a);
  const tlEnd = f(p);

  return [
    `M ${tlEnd},0`,
    `L ${trStart},0`,
    `C ${trC1x},${trC1y} ${trC2x},${trC2y} ${trMx},${trMy}`,
    `C ${trC3x},${trC3y} ${trC4x},${trC4y} ${f(w)},${trEnd}`,
    `L ${f(w)},${brStart}`,
    `C ${brC1x},${brC1y} ${brC2x},${brC2y} ${brMx},${brMy}`,
    `C ${brC3x},${brC3y} ${brC4x},${brC4y} ${brEnd},${f(h)}`,
    `L ${blStart},${f(h)}`,
    `C ${blC1x},${blC1y} ${blC2x},${blC2y} ${blMx},${blMy}`,
    `C ${blC3x},${blC3y} ${blC4x},${blC4y} 0,${blEnd}`,
    `L 0,${tlStart}`,
    `C ${tlC1x},${tlC1y} ${tlC2x},${tlC2y} ${tlMx},${tlMy}`,
    `C ${tlC3x},${tlC3y} ${tlC4x},${tlC4y} ${tlEnd},0`,
    'Z'
  ].join(' ');
}

/**
 * Calculates concentric inner radius following Apple's concentric corner math:
 * r_inner = max(4, r_outer - padding)
 */
export function getConcentricRadius(parentRadius: number, padding: number): number {
  return Math.max(4, parentRadius - padding);
}

/**
 * Custom React Hook that automatically calculates and applies an Apple Continuous Corner clip path
 * to an element via ResizeObserver for C2 curvature continuity.
 */
export function useAppleContinuousCorner<T extends HTMLElement>(radius: number = 24) {
  const ref = useRef<T | null>(null);
  const [clipPath, setClipPath] = useState<string>('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateClipPath = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const path = getAppleContinuousCornerPath(w, h, radius);
        const stylePath = `path('${path}')`;
        setClipPath(stylePath);
        el.style.clipPath = stylePath;
      }
    };

    updateClipPath();

    const ro = new ResizeObserver(() => {
      updateClipPath();
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [radius]);

  return { ref, clipPath };
}

/**
 * Reusable wrapper component for Apple Continuous Corner surfaces
 */
export interface AppleCornerBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  radius?: number;
  children?: React.ReactNode;
}

export const AppleCornerBox: React.FC<AppleCornerBoxProps> = ({
  radius = 24,
  children,
  className = '',
  style,
  ...props
}) => {
  const { ref, clipPath } = useAppleContinuousCorner<HTMLDivElement>(radius);

  return (
    <div
      ref={ref}
      className={`apple-continuous-corner ${className}`}
      style={{
        ...style,
        ...(clipPath ? { clipPath } : {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
};
