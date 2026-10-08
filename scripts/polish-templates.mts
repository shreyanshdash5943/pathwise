/**
 * Copy-edits roadmap templates to the house style (scripts/template-style.mts) without
 * changing their structure: same phases, milestones and tasks in the same order, same
 * task types, minutes and skill tags. Because task keys come from positions, files are
 * updated in place (same version) and everyone's progress is untouched.
 *
 * Most fixes are exact and need no AI: odd hyphens, and Title Case turned into sentence
 * case while keeping names (Python, OpenAI, MDN...) as written. Only phrases that use
 * banned words go to the model, a few short strings at a time, and the original
 * capitalisation of every name is put back afterwards.
 *
 *   node --experimental-strip-types scripts/polish-templates.mts            # files that fail the lint
 *   node --experimental-strip-types scripts/polish-templates.mts --lint     # just report
 *   node --experimental-strip-types scripts/polish-templates.mts --no-ai    # exact fixes only
 *   node --experimental-strip-types scripts/polish-templates.mts --role frontend --level beginner
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROLES, type Role } from "../lib/roles.ts";
import { TemplateFileSchema, type TemplateFile } from "../lib/templates/schema.ts";
import { BANNED, PHRASES, PROPER, STYLE_RULES, lintTemplate, normalizeText } from "./template-style.mts";

const ROOT = join(import.meta.dirname, "..");
const DIR = join(ROOT, "data", "templates");
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const option = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

for (const file of [".env.local", ".env"]) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ── Every editable string in a template, with a way to write it back ──────────
type Field = { id: string; isTitle: boolean; max: number; get: () => string; set: (v: string) => void };

function fieldsOf(t: TemplateFile): Field[] {
  const out: Field[] = [];
  const add = (id: string, obj: Record<string, unknown>, key: string, isTitle: boolean, max: number) =>
    out.push({ id, isTitle, max, get: () => obj[key] as string, set: (v) => (obj[key] = v) });
  add("t", t as unknown as Record<string, unknown>, "title", true, 140);
  add("s", t as unknown as Record<string, unknown>, "summary", false, 600);
  t.phases.forEach((p, pi) => {
    add(`p${pi}`, p, "title", true, 100);
    add(`p${pi}s`, p, "summary", false, 400);
    p.milestones.forEach((m, mi) => {
      add(`p${pi}m${mi}`, m, "title", true, 140);
      add(`p${pi}m${mi}o`, m, "outcome", false, 300);
      m.tasks.forEach((k, ki) => {
        add(`p${pi}m${mi}t${ki}`, k, "title", true, 160);
        add(`p${pi}m${mi}t${ki}d`, k, "description", false, 500);
      });
    });
  });
  return out;
}

// ── Names: words whose capitalisation must be kept ─────────────────────────────
const WORD = /[A-Za-z][A-Za-z0-9.+#'’-]*[A-Za-z0-9+#]|[A-Za-z]/g;

/** lowercase -> correctly written form, learned from how the template writes each word. */
function nameDictionary(t: TemplateFile, role: Role): Map<string, string> {
  const dict = new Map<string, string>();
  const keep = (w: string) => {
    if (!dict.has(w.toLowerCase())) dict.set(w.toLowerCase(), w);
  };
  for (const w of PROPER) keep(w);
  // From the role, keep acronyms (UX, AI, SQL) and words capitalised mid-phrase ("... in React").
  for (const phrase of [role.title, ...role.skills, ...role.projects]) {
    (phrase.match(WORD) ?? []).forEach((w, i) => {
      if (/[A-Z]/.test(w.slice(1)) || (i > 0 && /^[A-Z]/.test(w))) keep(w);
    });
  }
  for (const f of fieldsOf(t)) {
    const text = f.get();
    for (const m of text.matchAll(WORD)) {
      const w = m[0];
      const before = text.slice(0, m.index).trimEnd();
      const sentenceStart = before === "" || /[.:!?]$/.test(before);
      // Capitals after a hyphen ("Job-Ready") are Title Case, not a name like "OpenAI".
      const core = w.replace(/-[A-Z]/g, (m) => m.toLowerCase());
      const internalCaps = /[A-Z]/.test(core.slice(1));
      // A capitalised word in the middle of a sentence (not a title) is a name.
      if (internalCaps || (!f.isTitle && !sentenceStart && /^[A-Z]/.test(w))) keep(w);
    }
  }
  return dict;
}

/** Restores every known name to its proper form, e.g. "openai" -> "OpenAI". */
function restoreNames(text: string, dict: Map<string, string>): string {
  return text.replace(WORD, (w) => {
    const base = w.replace(/[’']s$/, "");
    const fixed = dict.get(base.toLowerCase());
    return fixed ? fixed + w.slice(base.length) : w;
  });
}

/** Words seen written in lowercase as ordinary words somewhere in any template. */
const ordinaryWords = new Set<string>();
function learnOrdinaryWords(t: TemplateFile) {
  for (const f of fieldsOf(t)) for (const w of f.get().match(WORD) ?? []) if (w === w.toLowerCase()) ordinaryWords.add(w);
}

/**
 * Title Case -> sentence case. A word is lowered only if it's plainly Capitalised, isn't
 * a known name, isn't part of a multi-word name, and appears in lowercase elsewhere as an
 * ordinary word. When unsure, it's left alone: a stray capital is better than "python".
 */
function sentenceCase(title: string, dict: Map<string, string>): string {
  const protectedRanges: [number, number][] = [];
  for (const phrase of PHRASES) {
    let i = title.toLowerCase().indexOf(phrase.toLowerCase());
    while (i >= 0) {
      protectedRanges.push([i, i + phrase.length]);
      title = title.slice(0, i) + phrase + title.slice(i + phrase.length);
      i = title.toLowerCase().indexOf(phrase.toLowerCase(), i + phrase.length);
    }
  }
  let first = true;
  let afterColon = false;
  return title.replace(/[A-Za-z][A-Za-z0-9.+#'’-]*|[:]/g, (w, offset: number) => {
    if (w === ":") {
      afterColon = true;
      return w;
    }
    const isProtected = protectedRanges.some(([a, b]) => offset >= a && offset < b);
    const lowerable = (part: string) => {
      const base = part.replace(/[’']s$/, "");
      return /^[A-Z][a-z'’]+$/.test(part) && !dict.has(base.toLowerCase()) && (ordinaryWords.has(base.toLowerCase()) || ordinaryWords.has(w.toLowerCase()));
    };
    // Hyphenated words are cased part by part: "Job-Ready" -> "Job-ready" (or "job-ready" mid-title).
    const parts = w.split("-");
    const out = isProtected || dict.has(w.toLowerCase())
      ? w
      : parts.map((part, i) => ((first || afterColon) && i === 0) || !lowerable(part) ? part : part.toLowerCase()).join("-");
    first = false;
    afterColon = false;
    return out;
  });
}

// ── AI rewrite for the few phrases that use banned words ──────────────────────
class DailyLimit extends Error {}

async function rewritePhrases(items: { id: string; text: string; kind: string }[], roleTitle: string): Promise<Record<string, string>> {
  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "qwen/qwen3.8-27b";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 4000,
      ...(model.startsWith("qwen/") ? { reasoning_format: "hidden" } : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You copy-edit short phrases from a career learning roadmap so they read like an experienced mentor wrote them.
Rewrite each phrase to remove the problem words, keeping its meaning, its length roughly the same, and every name, tool and acronym written exactly as given (keep "Python", "OpenAI", "MDN" capitalised).
Titles are sentence case. Reply with json only, in the form {"items":[{"id":"...","text":"..."}]}, with the same ids.
${STYLE_RULES}`,
        },
        { role: "user", content: `Roadmap for: ${roleTitle}\n${JSON.stringify({ items })}` },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 429) {
    const body = await res.text();
    if (/per day|TPD|RPD/i.test(body)) throw new DailyLimit(body.slice(0, 200));
    await new Promise((r) => setTimeout(r, 20_000));
    throw new Error("rate limited");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = (json.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(content) as { items?: { id?: unknown; text?: unknown }[] };
  const out: Record<string, string> = {};
  for (const it of parsed.items ?? []) if (typeof it.id === "string" && typeof it.text === "string" && it.text.trim()) out[it.id] = it.text.trim();
  return out;
}

async function polish(t: TemplateFile, role: Role): Promise<{ changed: number; ai: number }> {
  const dict = nameDictionary(t, role);
  const fields = fieldsOf(t);
  let changed = 0;
  let ai = 0;

  // 1. Exact fixes.
  for (const f of fields) {
    const before = f.get();
    const after = f.isTitle ? sentenceCase(before, dict) : before;
    if (after !== before) {
      f.set(after);
      changed++;
    }
  }

  // 2. Banned words, a batch of short phrases per request.
  if (flag("no-ai")) return { changed, ai };
  const flagged = fields.filter((f) => BANNED.some(([re]) => re.test(f.get())));
  for (let i = 0; i < flagged.length; i += 25) {
    const batch = flagged.slice(i, i + 25);
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const out = await rewritePhrases(batch.map((f) => ({ id: f.id, text: f.get(), kind: f.isTitle ? "title" : "sentence" })), role.title);
        for (const f of batch) {
          const raw = out[f.id];
          if (!raw) continue;
          let text = restoreNames(normalizeText(raw), dict);
          if (f.isTitle) text = sentenceCase(text, dict);
          if (text.length <= f.max && text !== f.get()) {
            f.set(text);
            changed++;
            ai++;
          }
        }
        done = true;
      } catch (err) {
        if (err instanceof DailyLimit) throw err;
        console.warn(`  attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return { changed, ai };
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as { templates: Record<string, number> };
  const onlyRole = option("role");
  const onlyLevel = option("level");
  const entries = Object.entries(manifest.templates).filter(([id]) => (!onlyRole || id.startsWith(`${onlyRole}.`)) && (!onlyLevel || id.endsWith(`.${onlyLevel}`)));

  // Learn ordinary lowercase words from every template first, so casing decisions are informed.
  for (const [id, version] of Object.entries(manifest.templates)) {
    learnOrdinaryWords(TemplateFileSchema.parse(normalizeText(JSON.parse(readFileSync(join(DIR, `${id}.v${version}.json`), "utf8")))));
  }

  let clean = 0;
  for (const [id, version] of entries) {
    const path = join(DIR, `${id}.v${version}.json`);
    const original = readFileSync(path, "utf8");
    const t = TemplateFileSchema.parse(normalizeText(JSON.parse(original)));
    const role = ROLES.find((r) => r.id === t.roleId)!;
    const before = lintTemplate(t, role);

    if (flag("lint")) {
      if (!before.length) clean++;
      console.log(`${before.length ? "✗" : "✓"} ${id} v${version}${before.length ? `  ${before.length} issues, e.g. ${before[0]}` : ""}`);
      continue;
    }

    try {
      const { changed, ai } = before.length ? await polish(t, role) : { changed: 0, ai: 0 };
      const result = TemplateFileSchema.parse(t);
      const text = JSON.stringify(result, null, 2) + "\n";
      if (text !== original) writeFileSync(path, text);
      const after = lintTemplate(result, role);
      if (!after.length) clean++;
      console.log(`${after.length ? "~" : "✓"} ${id}: ${changed} edits (${ai} by AI)${after.length ? `, ${after.length} left, e.g. ${after[0]}` : ""}`);
    } catch (err) {
      if (err instanceof DailyLimit) {
        console.error(`Daily limit reached. Run again later to continue. ${err.message}`);
        process.exit(2);
      }
      console.error(`✗ ${id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`${clean}/${entries.length} templates pass the style check.`);
}

main();
