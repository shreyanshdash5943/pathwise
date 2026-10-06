import { z } from "zod";

export const TASK_TYPES = ["learn", "build", "practice", "reflect", "connect"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TaskSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(500).catch(""),
  type: z.enum(TASK_TYPES).catch("learn"),
  minutes: z.coerce.number().int().min(5).max(180).catch(30),
});

export const MilestoneSchema = z.object({
  title: z.string().trim().min(3).max(140),
  outcome: z.string().trim().max(300).catch(""),
  tasks: z.array(TaskSchema).min(2).max(10),
});

export const PhaseSchema = z.object({
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().max(400).catch(""),
  milestones: z.array(MilestoneSchema).min(1).max(5),
});

export const RoadmapSchema = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().max(600).catch(""),
  phases: z.array(PhaseSchema).min(2).max(6),
});

export type GeneratedRoadmap = z.infer<typeof RoadmapSchema>;

/** Shape stored in roadmaps.outline. Tasks live in their own table. */
export type RoadmapOutline = {
  title: string;
  summary: string;
  phases: { title: string; summary: string; milestones: { title: string; outcome: string }[] }[];
};

export function toOutline(r: GeneratedRoadmap): RoadmapOutline {
  return {
    title: r.title,
    summary: r.summary,
    phases: r.phases.map((p) => ({
      title: p.title,
      summary: p.summary,
      milestones: p.milestones.map((m) => ({ title: m.title, outcome: m.outcome })),
    })),
  };
}
