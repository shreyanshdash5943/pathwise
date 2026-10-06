import "server-only";
import { labelFor, QUESTIONS, type Answers } from "./questions";
import type { Role } from "./roles";
import { RoadmapSchema, type GeneratedRoadmap } from "./roadmap-schema";
import { buildFallbackRoadmap } from "./fallback-roadmap";

function describeAnswers(answers: Answers): string {
  return QUESTIONS.map((q) => {
    const picked = (answers[q.id] ?? []).map((id) => labelFor(q.id, id)).join(", ");
    return `- ${q.prompt} ${picked}`;
  }).join("\n");
}

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
      "tasks": [ { "title": string (imperative, under 12 words), "description": string (1-2 sentences, specific), "type": "learn"|"build"|"practice"|"reflect"|"connect", "minutes": integer 10-90 } ]
    } ]
  } ]
}
Rules:
- 4 phases. 2-3 milestones per phase. 4-6 tasks per milestone.
- Each task must be finishable in one sitting and name a concrete action. No vague tasks like "learn more".
- Name well-known free resources where helpful (official docs, freeCodeCamp, MDN, Kaggle, etc.) but never invent URLs.
- Mix task types. Every milestone has at least one build or practice task.
- Respect the person's daily time: most tasks should fit inside it.
- Plain, friendly language. No emojis.`;

export async function generateRoadmap(role: Role, answers: Answers): Promise<{ roadmap: GeneratedRoadmap; source: "ai" | "template" }> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return { roadmap: buildFallbackRoadmap(role, answers), source: "template" };

  const base = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "llama-3.3-70b-versatile";
  const user = `Target role: ${role.title}
Role summary: ${role.summary}
Key skills for this role: ${role.skills.join(", ")}
Example portfolio projects: ${role.projects.join("; ")}

About the person:
${describeAnswers(answers)}

Write their roadmap.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`AI request failed with ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = RoadmapSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) throw new Error("AI output failed validation");
    return { roadmap: parsed.data, source: "ai" };
  } catch (err) {
    console.error("[roadmap] falling back to template:", err instanceof Error ? err.message : err);
    return { roadmap: buildFallbackRoadmap(role, answers), source: "template" };
  } finally {
    clearTimeout(timer);
  }
}
