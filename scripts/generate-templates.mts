/**
 * Generates roadmap templates offline: one per (role, level), 18 roles × 4 levels = 72.
 * This is the only place roadmap text is written by AI. Run it once, review the JSON in
 * a pull request, and every user shares the result. No per-user AI cost.
 *
 *   node --experimental-strip-types scripts/generate-templates.mts            # missing templates only
 *   node --experimental-strip-types scripts/generate-templates.mts --role frontend --level beginner --force
 *   node --experimental-strip-types scripts/generate-templates.mts --check    # validate files, no AI
 *
 * Needs AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL) in the environment or .env.local.
 * --force writes a NEW version file and points the manifest at it. Never edit or delete an
 * old version file while plans may still use it: plans pin the version they started on.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES, type Role } from "../lib/roles.ts";
import { STYLE_RULES, lintTemplate, normalizeText } from "./template-style.mts";
import { LEVELS, TemplateBodySchema, TemplateFileSchema, templateId, type Level, type TemplateBody } from "../lib/templates/schema.ts";

const ROOT = join(import.meta.dirname, "..");
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DIR = join(ROOT, "data", "templates");
const MANIFEST = join(DIR, "manifest.json");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

type Manifest = { templates: Record<string, number> };
const readManifest = (): Manifest => JSON.parse(readFileSync(MANIFEST, "utf8"));
const writeManifest = (m: Manifest) => {
  const sorted = Object.fromEntries(Object.entries(m.templates).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify({ templates: sorted }, null, 2) + "\n");
};

const LEVEL_TEXT: Record<Level, string> = {
  beginner: "Starting from zero. Explain fundamentals; assume no prior experience in the field.",
  basics: "Knows the basics. Skip absolute beginner material; firm up fundamentals quickly and move to real work.",
  intermediate: "Has built real things. Focus on depth, best practice, larger projects and professional habits.",
  advanced: "Already works in or next to this field. Focus on advanced topics, leadership, portfolio polish and senior-level interview prep.",
};

const SYSTEM = `You are a senior career coach who writes concrete, realistic learning roadmaps.
Return ONLY a JSON object, no markdown, matching exactly:
{
  "title": string,
  "summary": string (2 sentences max),
  "phases": [ {
    "title": string (2-4 words),
    "summary": string (1 sentence),
    "milestones": [ {
      "title": string,
      "outcome": string (1 sentence: what the person can do after),
      "skill": string or null (EXACTLY one of the listed key skills this milestone teaches, else null),
      "tasks": [ { "title": string (imperative, under 12 words), "description": string (1-2 sentences, specific), "type": "learn"|"build"|"practice"|"reflect"|"connect", "minutes": integer 10-90 } ]
    } ]
  } ]
}
Rules:
- Exactly 4 phases, in this order: 1) foundations, 2) core skills, 3) proof of work (portfolio projects), 4) getting ready (advanced topics plus job or client readiness).
- 2-3 milestones per phase. 4-6 tasks per milestone.
- Every listed key skill should be the "skill" of at least one milestone in phases 1, 2 or 4. Project milestones use null.
- Each task must be finishable in one sitting and name a concrete action. No vague tasks like "learn more".
- Name well-known free resources where helpful (official docs, freeCodeCamp, MDN, Kaggle, etc.) but never invent URLs.
- Mix task types. Every milestone has at least one build or practice task.
- This roadmap is shared by many people, so do not assume a learning style, schedule, or personal details.
- Plain, friendly language. No emojis.
${STYLE_RULES}`;

function userPrompt(role: Role, level: Level) {
  return `Target role: ${role.title}
Role summary: ${role.summary}
Key skills (use these exact strings for "skill"): ${JSON.stringify(role.skills)}
Example portfolio projects: ${role.projects.join("; ")}
Starting level: ${LEVEL_TEXT[level]}

Write the roadmap.`;
}

/** Errors no retry will fix (bad key, unknown model). The whole run stops on these. */
class FatalError extends Error {}

/** Groq durations look like "7.66s", "1m26.4s" or "250ms". Returns milliseconds. */
function parseDuration(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 1000; // plain Retry-After seconds
  let ms = 0;
  for (const [, n, unit] of value.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    ms += Number(n) * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[unit as "ms" | "s" | "m" | "h"];
  }
  return ms || null;
}

/** Per-model request options. Reasoning tokens count against the output limit, so keep them low. */
function modelOptions(model: string): Record<string, unknown> {
  if (model.startsWith("qwen/")) return { reasoning_format: "hidden" };
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low", include_reasoning: false };
  return {};
}

async function generate(role: Role, level: Level): Promise<TemplateBody> {
  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || DEFAULT_MODEL;
  let lastError: unknown;
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 10000,
          ...modelOptions(model),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt(role, level) },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429 || res.status === 413) {
        const body = (await res.text()).slice(0, 400);
        // "Request too large" (e.g. the model's per-minute output cap is below what one roadmap
        // needs) can never succeed by waiting. Groq flags that with x-should-retry: false.
        if (res.headers.get("x-should-retry") === "false" || res.status === 413 || /too large/i.test(body)) {
          throw new FatalError(`HTTP ${res.status}: ${body}
This model's limits on your plan are too small for one roadmap. Use a model with a higher
output limit (AI_MODEL=openai/gpt-oss-120b) or upgrade the plan.`);
        }
        const wait =
          parseDuration(res.headers.get("retry-after")) ??
          parseDuration(res.headers.get("x-ratelimit-reset-tokens")) ??
          15_000 * attempt;
        if (attempt < attempts) {
          console.warn(`  rate limited, waiting ${Math.ceil(wait / 1000)}s`);
          await new Promise((r) => setTimeout(r, wait + 1000));
        }
        throw new Error("rate limited");
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new FatalError(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}
Check AI_API_KEY and AI_MODEL in .env.local.`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = (json.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim();
      const raw = JSON.parse(content);
      const parsed = TemplateBodySchema.parse(normalizeText(raw));
      for (const p of parsed.phases) for (const m of p.milestones) if (m.skill && !role.skills.includes(m.skill)) m.skill = null;
      // Skills without a milestone can't be skipped from the profile page, so retry if too many are missing.
      const tagged = new Set(parsed.phases.flatMap((p) => p.milestones.map((m) => m.skill)));
      const untagged = role.skills.filter((s) => !tagged.has(s));
      if (untagged.length > 1) throw new Error(`no milestone for ${untagged.length} skills: ${untagged.join(", ")}`);
      const style = lintTemplate(parsed, role);
      if (style.length > 2) throw new Error(`${style.length} style issues, e.g. ${style[0]}`);
      return parsed;
    } catch (err) {
      if (err instanceof FatalError) throw err;
      lastError = err;
      console.warn(`  attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw lastError;
}

function check(): boolean {
  const manifest = readManifest();
  let ok = true;
  for (const [id, version] of Object.entries(manifest.templates)) {
    const path = join(DIR, `${id}.v${version}.json`);
    if (!existsSync(path)) {
      console.error(`✗ ${id}: manifest points at v${version} but ${path} is missing`);
      ok = false;
      continue;
    }
    const parsed = TemplateFileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    if (!parsed.success || parsed.data.id !== id || parsed.data.version !== version) {
      console.error(`✗ ${id} v${version}: ${parsed.success ? "id/version mismatch" : parsed.error.message}`);
      ok = false;
      continue;
    }
    const role = ROLES.find((r) => r.id === parsed.data.roleId);
    const used = new Set(parsed.data.phases.flatMap((p) => p.milestones.map((m) => m.skill)));
    const missing = role?.skills.filter((s) => !used.has(s)) ?? [];
    console.log(`✓ ${id} v${version}${missing.length ? `  (no milestone for: ${missing.join(", ")})` : ""}`);
  }
  const total = ROLES.length * LEVELS.length;
  console.log(`${Object.keys(manifest.templates).length}/${total} templates generated; the rest use the built-in template.`);
  return ok;
}

async function main() {
  if (flag("check")) process.exit(check() ? 0 : 1);

  loadEnv();
  if (!process.env.AI_API_KEY) {
    console.error("AI_API_KEY is not set. Put it in .env.local or the environment.");
    process.exit(1);
  }
  const onlyRole = option("role");
  const onlyLevel = option("level");
  const force = flag("force");
  const roles = ROLES.filter((r) => !onlyRole || r.id === onlyRole);
  const levels = LEVELS.filter((l) => !onlyLevel || l === onlyLevel);
  if (!roles.length || !levels.length) {
    console.error("No matching role or level.");
    process.exit(1);
  }

  let failures = 0;
  for (const role of roles) {
    for (const level of levels) {
      const id = templateId(role.id, level);
      const manifest = readManifest();
      const current = manifest.templates[id];
      if (current && !force) {
        console.log(`- ${id} v${current} exists, skipping`);
        continue;
      }
      const version = (current ?? 0) + 1;
      console.log(`… ${id} v${version}`);
      try {
        const body = await generate(role, level);
        const file = TemplateFileSchema.parse({
          id,
          roleId: role.id,
          level,
          version,
          generatedAt: new Date().toISOString(),
          model: process.env.AI_MODEL || DEFAULT_MODEL,
          ...body,
        });
        writeFileSync(join(DIR, `${id}.v${version}.json`), JSON.stringify(file, null, 2) + "\n");
        manifest.templates[id] = version;
        writeManifest(manifest);
        console.log(`✓ ${id} v${version}`);
      } catch (err) {
        if (err instanceof FatalError) {
          console.error(`✗ ${id}: ${err.message}`);
          process.exit(1);
        }
        failures++;
        console.error(`✗ ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  if (failures) {
    console.error(`${failures} template(s) failed. Run again to retry just those.`);
    process.exit(1);
  }
}

main();
