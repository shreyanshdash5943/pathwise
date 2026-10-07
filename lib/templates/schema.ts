import { z } from "zod";
import { TaskSchema } from "../roadmap-schema.ts";

/**
 * A roadmap template: the full text of one roadmap for a (role, level) pair.
 * Templates are generated offline (scripts/generate-templates.mts), reviewed, and
 * shipped as JSON in data/templates. Every user with the same role and level shares
 * one template; their answers personalise it at runtime without any AI call.
 *
 * Phases follow a fixed shape so personalisation knows where to add things:
 *   0 foundations, 1 core skills, 2 proof of work (projects), 3 getting ready.
 */
export const LEVELS = ["beginner", "basics", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const TemplateMilestoneSchema = z.object({
  title: z.string().trim().min(3).max(140),
  outcome: z.string().trim().max(300).catch(""),
  /** One of the role's skills this milestone teaches, or null. Used to skip work people already know. */
  skill: z.string().trim().max(80).nullable().catch(null),
  tasks: z.array(TaskSchema).min(2).max(10),
});

export const TemplatePhaseSchema = z.object({
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().max(400).catch(""),
  milestones: z.array(TemplateMilestoneSchema).min(1).max(5),
});

export const TemplateBodySchema = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().max(600).catch(""),
  phases: z.array(TemplatePhaseSchema).length(4),
});

export const TemplateFileSchema = TemplateBodySchema.extend({
  id: z.string().regex(/^[a-z0-9-]{1,48}\.[a-z]{1,24}$/),
  roleId: z.string(),
  level: z.enum(LEVELS),
  version: z.number().int().min(1).max(9999),
  generatedAt: z.string().optional(),
  model: z.string().optional(),
});

export type TemplateBody = z.infer<typeof TemplateBodySchema>;
export type TemplateFile = z.infer<typeof TemplateFileSchema>;

export function templateId(roleId: string, level: string): string {
  return `${roleId}.${level}`;
}
