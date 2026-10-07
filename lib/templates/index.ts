import "server-only";
import manifest from "@/data/templates/manifest.json";
import { getRole, type Role } from "../roles";
import { builtinTemplate } from "./builtin";
import { LEVELS, TemplateFileSchema, templateId, type Level, type TemplateBody } from "./schema";

/**
 * Template lookup. Templates ship inside the app bundle, so reading one costs no
 * database or network call. data/templates/manifest.json names the current version of
 * each template; older version files must stay in the repo for as long as any plan
 * still points at them, because plans pin the version they were built from.
 * Version 0 means the built-in template (lib/templates/builtin.ts).
 */

const CURRENT = (manifest as { templates: Record<string, number> }).templates;

export type LoadedTemplate = { id: string; version: number; role: Role; body: TemplateBody };

export function toLevel(value: string | undefined): Level {
  return (LEVELS as readonly string[]).includes(value ?? "") ? (value as Level) : "beginner";
}

/** The template a new plan for this role and level should use. */
export function currentTemplate(roleId: string, level: string | undefined): { id: string; version: number } {
  const id = templateId(roleId, toLevel(level));
  return { id, version: CURRENT[id] ?? 0 };
}

const loaded = new Map<string, Promise<LoadedTemplate>>();

export function loadTemplate(id: string, version: number): Promise<LoadedTemplate> {
  const cacheKey = `${id}@${version}`;
  let p = loaded.get(cacheKey);
  if (!p) {
    p = read(id, version);
    loaded.set(cacheKey, p);
    p.catch(() => loaded.delete(cacheKey));
  }
  return p;
}

async function read(id: string, version: number): Promise<LoadedTemplate> {
  const role = getRole(id.split(".")[0]);
  if (!role) throw new Error(`Unknown role in template id ${id}`);
  if (version === 0) return { id, version, role, body: builtinTemplate(role) };

  const mod = (await import(`../../data/templates/${id}.v${version}.json`)) as { default: unknown };
  const parsed = TemplateFileSchema.safeParse(mod.default);
  if (!parsed.success) throw new Error(`Template ${id} v${version} is invalid: ${parsed.error.message}`);
  if (parsed.data.id !== id || parsed.data.version !== version) throw new Error(`Template file ${id}.v${version} has mismatched id or version`);
  return { id, version, role, body: parsed.data };
}
