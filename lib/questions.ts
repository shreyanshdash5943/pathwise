export type Option = { id: string; label: string; hint?: string };
export type Question = {
  id: string;
  prompt: string;
  helper?: string;
  multi?: boolean;
  max?: number;
  options: Option[];
};

export const QUESTIONS: Question[] = [
  {
    id: "stage",
    prompt: "Where are you right now?",
    helper: "This sets the pace and starting point of your plan.",
    options: [
      { id: "student", label: "Student", hint: "In school or college" },
      { id: "early", label: "Early in my career", hint: "0 to 3 years of work" },
      { id: "experienced", label: "Experienced professional", hint: "3+ years of work" },
      { id: "switcher", label: "Changing careers", hint: "Moving into a new field" },
    ],
  },
  {
    id: "field",
    prompt: "Which field pulls you in the most?",
    options: [
      { id: "software", label: "Software development" },
      { id: "data-ai", label: "Data and AI" },
      { id: "design", label: "Product and UX design" },
      { id: "product", label: "Product management" },
      { id: "security", label: "Cybersecurity" },
      { id: "cloud", label: "Cloud and DevOps" },
    ],
  },
  {
    id: "energy",
    prompt: "What kind of work gives you energy?",
    options: [
      { id: "build", label: "Building things people use" },
      { id: "analyze", label: "Solving puzzles and finding patterns" },
      { id: "craft", label: "Shaping how things look and feel" },
      { id: "lead", label: "Organising people and decisions" },
    ],
  },
  {
    id: "level",
    prompt: "How much do you already know in that field?",
    options: [
      { id: "beginner", label: "Starting from zero" },
      { id: "basics", label: "I know the basics" },
      { id: "intermediate", label: "I've built real things" },
      { id: "advanced", label: "I work in it already" },
    ],
  },
  {
    id: "goal",
    prompt: "What do you want this plan to get you?",
    options: [
      { id: "first-job", label: "My first job or internship" },
      { id: "switch", label: "A move into a new role" },
      { id: "grow", label: "A promotion or bigger scope" },
      { id: "independent", label: "Freelance work or my own product" },
    ],
  },
  {
    id: "timeline",
    prompt: "When do you want to be ready?",
    options: [
      { id: "3", label: "In 3 months" },
      { id: "6", label: "In 6 months" },
      { id: "12", label: "In a year" },
      { id: "open", label: "No fixed date" },
    ],
  },
  {
    id: "time",
    prompt: "How much time can you give it on a normal day?",
    helper: "Be honest. A plan you keep beats an ambitious one you drop.",
    options: [
      { id: "30", label: "About 30 minutes" },
      { id: "60", label: "About an hour" },
      { id: "120", label: "About two hours" },
      { id: "180", label: "Three hours or more" },
    ],
  },
  {
    id: "style",
    prompt: "How do you learn best?",
    helper: "Pick up to two.",
    multi: true,
    max: 2,
    options: [
      { id: "video", label: "Watching videos" },
      { id: "reading", label: "Reading docs and articles" },
      { id: "projects", label: "Building projects" },
      { id: "courses", label: "Following a structured course" },
    ],
  },
  {
    id: "blockers",
    prompt: "What has held you back so far?",
    helper: "Pick all that apply.",
    multi: true,
    options: [
      { id: "direction", label: "Not knowing where to start" },
      { id: "consistency", label: "Staying consistent" },
      { id: "portfolio", label: "Nothing to show employers" },
      { id: "interviews", label: "Interviews make me nervous" },
      { id: "time", label: "Not enough time" },
    ],
  },
  {
    id: "setting",
    prompt: "Where would you like to end up working?",
    options: [
      { id: "startup", label: "A fast-moving startup" },
      { id: "enterprise", label: "A large tech company" },
      { id: "remote", label: "Fully remote, anywhere" },
      { id: "freelance", label: "For myself" },
    ],
  },
];

export type Answers = Record<string, string[]>;

export function labelFor(questionId: string, optionId: string): string {
  const q = QUESTIONS.find((x) => x.id === questionId);
  return q?.options.find((o) => o.id === optionId)?.label ?? optionId;
}

/** Validates untrusted answers against the question set. Returns null if anything is off. */
export function sanitizeAnswers(input: unknown): Answers | null {
  if (!input || typeof input !== "object") return null;
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const raw = (input as Record<string, unknown>)[q.id];
    if (!Array.isArray(raw)) return null;
    const valid = raw.filter(
      (v): v is string => typeof v === "string" && q.options.some((o) => o.id === v)
    );
    const unique = Array.from(new Set(valid));
    if (unique.length === 0) return null;
    if (!q.multi && unique.length > 1) return null;
    if (q.max && unique.length > q.max) return null;
    out[q.id] = unique;
  }
  return out;
}
