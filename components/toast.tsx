"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, show };
}

export function Toast({ message }: { message: { id: number; text: string } | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto max-w-md rounded-xl bg-ink px-4 py-3 text-[14px] text-white shadow-lift"
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
