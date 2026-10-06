"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const DONE_PATH = "M40 220 C 110 220, 120 170, 170 170 S 250 120, 300 120";
const FULL_PATH = `${DONE_PATH} S 420 40, 470 40`;

const NODES = [
  { x: 40, y: 220, label: "Foundations", state: "done" as const, lx: -8, ly: 28 },
  { x: 170, y: 170, label: "Core skills", state: "done" as const, lx: 4, ly: 30 },
  { x: 300, y: 120, label: "Proof of work", state: "current" as const, lx: -44, ly: -26 },
  { x: 470, y: 40, label: "Ready to apply", state: "next" as const, lx: -100, ly: -16 },
];

const ITEMS = [
  { title: "Sketch the data model for your API", minutes: 25 },
  { title: "Build the sign-up endpoint", minutes: 45 },
  { title: "Write the README introduction", minutes: 15 },
];

export function HeroDemo() {
  const reduce = useReducedMotion();
  const [ticked, setTicked] = useState(reduce ? 2 : 0);

  useEffect(() => {
    if (reduce) return;
    const timers = [setTimeout(() => setTicked(1), 2700), setTimeout(() => setTicked(2), 3500)];
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const nodeDelay = [0.1, 0.75, 1.45, 1.7];

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #D4D7DD 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden="true"
        />
        <svg viewBox="0 0 520 262" className="relative block w-full px-2 pt-6" role="img" aria-label="A career path from foundations to ready to apply, currently at proof of work">
          <motion.path
            d={FULL_PATH}
            fill="none"
            stroke="#C5CAD2"
            strokeWidth="2"
            strokeDasharray="2 7"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />
          <motion.path
            d={DONE_PATH}
            fill="none"
            stroke="#1F5EEA"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: [0.45, 0, 0.15, 1], delay: 0.15 }}
          />
          {NODES.map((n, i) => (
            <motion.g
              key={n.label}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22, delay: nodeDelay[i] }}
              style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            >
              {n.state === "current" && <circle cx={n.x} cy={n.y} r="17" fill="#1F5EEA" opacity="0.12" />}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.state === "current" ? 9 : 7}
                fill={n.state === "next" ? "#fff" : "#1F5EEA"}
                stroke={n.state === "next" ? "#C5CAD2" : "#fff"}
                strokeWidth={n.state === "next" ? 2 : 3}
              />
              <text
                x={n.x + n.lx}
                y={n.y + n.ly}
                fontSize="13"
                fontWeight={n.state === "current" ? 600 : 500}
                fill={n.state === "next" ? "#9AA0AA" : "#101216"}
                style={{ fontFamily: "inherit" }}
              >
                {n.label}
              </text>
            </motion.g>
          ))}
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 1.9 }}
          className="relative mx-4 mb-4 mt-2 rounded-2xl border border-line bg-white p-4 shadow-lift sm:mb-6 sm:ml-auto sm:mr-6 sm:-mt-12 sm:w-[300px]"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">Today</p>
            <p className="tabular text-[13px] text-muted">{ticked} of 3 done</p>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-sunk">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${(ticked / 3) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
          <ul className="mt-3 space-y-1">
            {ITEMS.map((item, i) => {
              const done = i < ticked;
              return (
                <li key={item.title} className="flex items-center gap-3 rounded-lg py-1.5">
                  <motion.span
                    className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border"
                    animate={{
                      backgroundColor: done ? "#1F5EEA" : "#FFFFFF",
                      borderColor: done ? "#1F5EEA" : "#C5CAD2",
                      scale: done ? [1, 1.18, 1] : 1,
                    }}
                    transition={{ duration: 0.35 }}
                  >
                    {done && <Check className="h-3 w-3 text-white" strokeWidth={3.2} />}
                  </motion.span>
                  <span className={`flex-1 text-[13.5px] leading-snug transition-colors duration-300 ${done ? "text-faint line-through decoration-faint/60" : "text-ink"}`}>
                    {item.title}
                  </span>
                  <span className="tabular text-[12px] text-faint">{item.minutes}m</span>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
