/**
 * House style for roadmap text, shared by the generator and the polish script.
 * The goal: read like a thoughtful mentor wrote it, not a model. lintTemplate() catches
 * the common tells so they can be fixed before anyone sees them.
 */
import type { Role } from "../lib/roles.ts";
import type { TemplateBody } from "../lib/templates/schema.ts";

export const STYLE_RULES = `Style rules (follow all of them):
- Sentence case for every title: capitalise only the first word and proper nouns or acronyms. "Build a REST API with auth", not "Build A REST API With Auth".
- Plain, specific words. Never use: mastery, master (as a verb or adjective), deep dive, dive into, delve, robust, comprehensive, seamless, leverage, elevate, unlock, empower, harness the power, cutting-edge, level up, fluency, journey (except "user journey" in UX work), embark, crucial, vital, in today's.
- No em dashes or en dashes. Use commas, full stops or "to".
- Short titles: phases 1 to 3 words, milestones 2 to 6 words, tasks under 12 words starting with a verb.
- When a skill offers a choice like "Python or Go", don't paste it into a title. Write a natural title, e.g. "Pick your main language and get comfortable with it".
- Talk to the reader as "you". No hype, no exclamation marks, no emojis.
- Keep named tools and free resources (MDN, freeCodeCamp, Kaggle, official docs). Never invent URLs.`;

/** Multi-word names that sentence case must leave alone. */
export const PHRASES = [
  "GitHub Actions", "GitHub Pages", "GitHub Copilot", "LeetCode Discuss", "Hugging Face", "Google Colab", "Google Analytics",
  "Google Cloud", "Google Sheets", "Power BI", "Burp Suite", "Hack The Box", "Andrew Ng", "Visual Studio Code", "VS Code",
  "Stack Overflow", "Product Hunt", "Hacker News", "Indie Hackers", "Khan Academy", "The Odin Project", "Full Stack Open",
  "Material Design", "Human Interface Guidelines", "Nielsen Norman Group", "Design Systems Repo", "OWASP Top 10",
  "Site Reliability Engineering", "Google SRE", "AWS Free Tier", "Azure Fundamentals", "Cloud Practitioner",
  "Security+", "Network+", "Docker Compose", "Jupyter Notebook", "Google Data Analytics", "Mode Analytics",
];

export const BANNED: [RegExp, string][] = [
  [/\bmaster(y|ing|ed)?\b/i, "mastery/master"],
  [/\bdeep[- ]dive\b|\bdive into\b/i, "deep dive"],
  [/\bdelve/i, "delve"],
  [/\brobust\b/i, "robust"],
  [/\bcomprehensive\b/i, "comprehensive"],
  [/\bseamless/i, "seamless"],
  [/\bleverag/i, "leverage"],
  [/\belevat/i, "elevate"],
  [/\bunlock/i, "unlock"],
  [/\bempower/i, "empower"],
  [/\bcutting[- ]edge\b/i, "cutting-edge"],
  [/\blevel up\b/i, "level up"],
  [/\bfluency\b/i, "fluency"],
  [/(?<!user )\bjourney\b/i, "journey"],
  [/\bembark/i, "embark"],
  [/\bcrucial\b|\bvital\b/i, "crucial/vital"],
  [/[—–]/, "dash"],
  [/[‐‑‒― ]/, "unusual hyphen or space"],
  [/!/, "exclamation"],
];

// Words that are fine capitalised mid-title.
export const PROPER = new Set(
  `API APIs REST SQL CSS HTML JavaScript TypeScript React Next.js Node Node.js Django Python Go Golang Rust Java Linux Git GitHub GitLab CI CD CI/CD AWS GCP Azure Docker Kubernetes Terraform Figma PyTorch TensorFlow Kaggle OWASP SIEM SOC SLO SLOs SRE LLM LLMs RAG ML MLOps UX UI PM PRD PRDs JWT OAuth IAM DNS TCP/IP HTTP HTTPS MDN freeCodeCamp Excel Sheets Tableau Power BI Postgres PostgreSQL MySQL Redis Kafka Prometheus Grafana Splunk Burp Suite Wireshark Nmap Jest Pytest Cypress Playwright Jupyter NumPy Kubeflow MLflow Hugging Face OpenAI Anthropic Claude Vercel Netlify Heroku AWS-certified CTF CTFs A/B KPI KPIs OKRs STAR Agile Scrum Jira Notion Miro Medium LinkedIn Slack Discord HackTheBox TryHackMe Hack The Box I`.split(/\s+/)
);

function titleCaseProblem(title: string, role: Role): boolean {
  const extra = new Set((role.title + " " + role.skills.join(" ") + " " + role.projects.join(" ")).split(/[\s,()]+/).filter((w) => /^[A-Z]/.test(w) && w !== w.toLowerCase()));
  const words = title.replace(/[:,.()]/g, " ").split(/\s+/).filter(Boolean).slice(1);
  const caps = words.filter((w) => /^[A-Z][a-z]/.test(w) && !PROPER.has(w) && !extra.has(w));
  return caps.length >= 2;
}

/** Returns human-readable problems; empty means the template passes the house style. */
export function lintTemplate(body: TemplateBody, role: Role): string[] {
  const issues: string[] = [];
  const check = (raw: string, where: string, isTitle: boolean) => {
    for (const [re, name] of BANNED) if (re.test(raw)) issues.push(`${where}: "${raw}" uses ${name}`);
    const text = raw.replace(/[‐-―]/g, "-");
    if (text !== raw && /deep-dive/i.test(text)) issues.push(`${where}: "${raw}" uses deep dive`);
    if (isTitle && titleCaseProblem(text, role)) issues.push(`${where}: "${text}" is Title Case`);
    if (isTitle && / or /.test(text) && role.skills.some((s) => / or /.test(s) && text.includes(s))) issues.push(`${where}: "${text}" pastes a skill choice`);
  };
  check(body.title, "title", true);
  check(body.summary, "summary", false);
  body.phases.forEach((p, pi) => {
    check(p.title, `phase ${pi + 1}`, true);
    check(p.summary, `phase ${pi + 1} summary`, false);
    p.milestones.forEach((m, mi) => {
      check(m.title, `milestone ${pi + 1}.${mi + 1}`, true);
      check(m.outcome, `milestone ${pi + 1}.${mi + 1} outcome`, false);
      m.tasks.forEach((t, ti) => {
        check(t.title, `task ${pi + 1}.${mi + 1}.${ti + 1}`, true);
        check(t.description, `task ${pi + 1}.${mi + 1}.${ti + 1} description`, false);
      });
    });
  });
  return issues;
}

/** Fixes typographic tells exactly, no AI: odd hyphens and non-breaking spaces become plain ones. */
export function normalizeText<T>(value: T): T {
  if (typeof value === "string") return value.replace(/[‐‑‒―]/g, "-").replace(/ /g, " ") as T;
  if (Array.isArray(value)) return value.map(normalizeText) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeText(v)])) as T;
  return value;
}
