/**
 * Interview question bank. Hand-written for quality (better than generated here), shared
 * by the server and the client, so this module stays free of `server-only`.
 *
 * Behavioural questions apply to everyone and use the STAR format (Situation, Task,
 * Action, Result) — these are the ones the user builds from their real proof of work.
 * Technical questions are per field and use a single open answer.
 */

export type QuestionFormat = "star" | "open";
export type QuestionCategory = "behavioural" | "technical";

export type Question = {
  key: string;
  category: QuestionCategory;
  format: QuestionFormat;
  /** "*" means every field; otherwise a field id from roles.ts. */
  field: string;
  prompt: string;
  tip?: string;
};

const BEHAVIOURAL: Question[] = [
  { key: "beh.about", category: "behavioural", format: "open", field: "*", prompt: "Tell me about yourself.", tip: "60 seconds: where you are, what you've built, and why this role. Not your life story." },
  { key: "beh.proud", category: "behavioural", format: "star", field: "*", prompt: "Tell me about a project you're proud of.", tip: "Pick one of your proof-of-work projects and walk through it with STAR." },
  { key: "beh.challenge", category: "behavioural", format: "star", field: "*", prompt: "Describe the hardest problem you've solved.", tip: "Show how you think, not just that it worked out." },
  { key: "beh.failure", category: "behavioural", format: "star", field: "*", prompt: "Tell me about a time something went wrong. What did you learn?", tip: "Own it honestly, then focus on what changed afterwards." },
  { key: "beh.learn", category: "behavioural", format: "star", field: "*", prompt: "Tell me about a time you had to learn something quickly.", tip: "Your whole Pathwise plan is evidence of this — use a concrete piece of it." },
  { key: "beh.conflict", category: "behavioural", format: "star", field: "*", prompt: "Tell me about a disagreement with a teammate.", tip: "Show you can hear another view and find a way forward." },
  { key: "beh.why_role", category: "behavioural", format: "open", field: "*", prompt: "Why this role, and why now?", tip: "Tie your answer to what you've been building towards." },
  { key: "beh.change", category: "behavioural", format: "open", field: "*", prompt: "Walk me through your path to this field.", tip: "If you're switching or have a gap, frame it as deliberate, not accidental." },
];

const TECHNICAL: Record<string, string[]> = {
  software: [
    "Which data structures do you reach for most, and when?",
    "When would you choose REST over GraphQL, or the reverse?",
    "A page loads slowly. How do you find and fix the cause?",
    "Explain how asynchronous code works in your main language.",
    "How do you decide what to test, and how do you test it?",
    "Sketch how you'd design a URL shortener.",
  ],
  "data-ai": [
    "What is overfitting, and how do you prevent it?",
    "Walk me through a model you built end to end.",
    "When would you use precision over recall, or the reverse?",
    "How do you validate that a model actually works?",
    "Explain the bias–variance trade-off in your own words.",
    "How would you investigate a sudden drop in a key metric?",
  ],
  design: [
    "Walk me through your design process on a recent project.",
    "How do you handle critical feedback on your work?",
    "What are the accessibility basics you always check?",
    "How do you measure whether a design succeeded?",
    "Show me a product you'd redesign, and why.",
    "What does your tool and handoff workflow look like?",
  ],
  product: [
    "How do you decide what to build next?",
    "How would you define success for a feature you shipped?",
    "Pick a product you use daily. How would you improve it?",
    "You and an engineer disagree on scope. What do you do?",
    "How do you run discovery before committing to building?",
    "What product do you admire, and what makes it good?",
  ],
  security: [
    "Walk me through the OWASP risks you watch for most.",
    "How would you approach testing a web app for weaknesses?",
    "What's the difference between encryption and hashing?",
    "How do you triage and respond to a security incident?",
    "How would you secure a web app's login flow?",
    "Tell me about a box or CTF challenge you worked through.",
  ],
  cloud: [
    "Explain what a CI/CD pipeline does, stage by stage.",
    "Containers versus virtual machines — when and why?",
    "How would you design a service to stay up during failures?",
    "What infrastructure-as-code have you used, and how?",
    "How do you monitor a service and know when it's unhealthy?",
    "Tell me about a deployment that went wrong.",
  ],
};

const technicalQuestions = (field: string): Question[] =>
  (TECHNICAL[field] ?? []).map((prompt, i) => ({ key: `tech.${field}.${i}`, category: "technical" as const, format: "open" as const, field, prompt }));

const ALL: Question[] = [...BEHAVIOURAL, ...Object.keys(TECHNICAL).flatMap(technicalQuestions)];
const BY_KEY = new Map(ALL.map((q) => [q.key, q]));

/** Behavioural (everyone) plus the technical questions for this field. */
export function questionsForField(field: string): Question[] {
  return [...BEHAVIOURAL, ...technicalQuestions(field)];
}

export function getQuestion(key: string): Question | undefined {
  return BY_KEY.get(key);
}

/** How many of the field's questions count towards "interview ready". */
export function keyQuestionCount(field: string): number {
  return questionsForField(field).length;
}
