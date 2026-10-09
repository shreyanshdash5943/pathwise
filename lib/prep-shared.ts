/**
 * Types and constants for the application tracker and interview answers, shared by the
 * server (lib/prep.ts) and client components. No `server-only` here, so it's safe to
 * import from "use client" code.
 */

export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;
export type Status = (typeof STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  role_title: string;
  url: string;
  location: string;
  status: Status;
  notes: string;
  next_step: string;
  next_step_on: string | null;
  applied_on: string | null;
  created_at: string;
  updated_at: string;
};

export type Answer = {
  id: string;
  question_key: string;
  question_text: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  proof_id: string | null;
  updated_at: string;
};
