"use client";
import { MotionConfig } from "framer-motion";

export const spring = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;
export const ease = [0.2, 0, 0, 1] as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease }}>
      {children}
    </MotionConfig>
  );
}
