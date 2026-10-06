import type { Answers } from "./questions";

export type Role = {
  id: string;
  field: string;
  title: string;
  summary: string;
  energy: string[];
  demand: "High" | "Very high" | "Steady";
  difficulty: "Approachable" | "Moderate" | "Demanding";
  monthsToReady: [number, number];
  skills: string[];
  projects: string[];
};

export const ROLES: Role[] = [
  // Software
  { id: "frontend", field: "software", title: "Frontend Engineer", summary: "Build the parts of products people see and touch, from layouts to interactions.", energy: ["build", "craft"], demand: "High", difficulty: "Approachable", monthsToReady: [4, 8], skills: ["HTML and CSS", "JavaScript", "TypeScript", "React", "Accessibility", "Web performance"], projects: ["A responsive portfolio site", "A dashboard that talks to a public API", "A component library with documentation"] },
  { id: "backend", field: "software", title: "Backend Engineer", summary: "Design the APIs, data models and services that keep products running.", energy: ["build", "analyze"], demand: "Very high", difficulty: "Moderate", monthsToReady: [5, 10], skills: ["Python or Go", "SQL and data modelling", "REST API design", "Authentication", "Caching and queues", "Testing"], projects: ["A REST API with auth and tests", "A URL shortener with analytics", "A background job worker"] },
  { id: "fullstack", field: "software", title: "Full-Stack Engineer", summary: "Ship whole features end to end, from the database to the screen.", energy: ["build", "lead"], demand: "Very high", difficulty: "Moderate", monthsToReady: [6, 12], skills: ["JavaScript and TypeScript", "React or Next.js", "Node or Django", "SQL", "Deployment", "System design basics"], projects: ["A SaaS app with billing", "A real-time chat app", "A clone of a product you use daily"] },
  // Data & AI
  { id: "data-analyst", field: "data-ai", title: "Data Analyst", summary: "Turn messy data into answers and dashboards that drive decisions.", energy: ["analyze", "lead"], demand: "High", difficulty: "Approachable", monthsToReady: [3, 6], skills: ["Spreadsheets", "SQL", "Python with pandas", "Statistics", "Data visualisation", "Storytelling with data"], projects: ["A sales dashboard from a public dataset", "An A/B test analysis write-up", "A cohort retention report"] },
  { id: "ml-engineer", field: "data-ai", title: "Machine Learning Engineer", summary: "Train, evaluate and ship models that make products smarter.", energy: ["analyze", "build"], demand: "Very high", difficulty: "Demanding", monthsToReady: [8, 14], skills: ["Python", "Linear algebra and probability", "scikit-learn", "PyTorch", "Model evaluation", "MLOps basics"], projects: ["A churn prediction model with a write-up", "An image classifier deployed as an API", "A model monitoring dashboard"] },
  { id: "ai-engineer", field: "data-ai", title: "Applied AI Engineer", summary: "Build products on top of large language models and AI APIs.", energy: ["build", "analyze"], demand: "Very high", difficulty: "Moderate", monthsToReady: [4, 9], skills: ["Python or TypeScript", "LLM APIs", "Prompt design", "Retrieval (RAG)", "Evaluation", "Shipping web apps"], projects: ["A document Q&A app with citations", "An AI agent that uses tools", "An evaluation harness for prompts"] },
  // Design
  { id: "ux-designer", field: "design", title: "UX Designer", summary: "Research problems and design flows that feel obvious to use.", energy: ["craft", "analyze"], demand: "Steady", difficulty: "Approachable", monthsToReady: [4, 8], skills: ["User research", "Information architecture", "Wireframing", "Usability testing", "Figma", "Design critique"], projects: ["A redesign case study of an app you use", "A usability study with 5 participants", "An onboarding flow prototype"] },
  { id: "ui-designer", field: "design", title: "UI and Visual Designer", summary: "Craft interfaces, design systems and the details people notice.", energy: ["craft", "build"], demand: "Steady", difficulty: "Approachable", monthsToReady: [4, 8], skills: ["Typography", "Colour and layout", "Figma", "Design systems", "Prototyping and motion", "Handoff to engineers"], projects: ["A small design system", "Three polished app screens", "A motion prototype of an interaction"] },
  { id: "product-designer", field: "design", title: "Product Designer", summary: "Own a product area end to end, from research to shipped pixels.", energy: ["craft", "lead"], demand: "High", difficulty: "Moderate", monthsToReady: [6, 12], skills: ["Product thinking", "User research", "Interaction design", "Figma", "Metrics", "Working with engineers"], projects: ["An end-to-end product case study", "A feature spec with designs", "A design sprint write-up"] },
  // Product
  { id: "apm", field: "product", title: "Associate Product Manager", summary: "Learn to decide what gets built and why, alongside a product team.", energy: ["lead", "analyze"], demand: "Steady", difficulty: "Moderate", monthsToReady: [4, 9], skills: ["Customer discovery", "Writing specs", "Prioritisation", "Metrics and analytics", "Roadmapping", "Stakeholder communication"], projects: ["A product teardown", "A PRD for a feature you'd build", "A metrics plan for a launch"] },
  { id: "tpm", field: "product", title: "Technical Product Manager", summary: "Bridge engineering and business on platform and API products.", energy: ["lead", "build"], demand: "High", difficulty: "Demanding", monthsToReady: [6, 12], skills: ["APIs and system basics", "Technical specs", "Prioritisation", "SQL", "Delivery planning", "Developer empathy"], projects: ["An API product spec", "A technical roadmap for a platform", "A data-backed feature proposal"] },
  { id: "growth-pm", field: "product", title: "Growth Product Manager", summary: "Run experiments that move signups, activation and retention.", energy: ["analyze", "lead"], demand: "Steady", difficulty: "Moderate", monthsToReady: [5, 10], skills: ["Funnels and metrics", "Experiment design", "SQL", "Copy and onboarding", "Prioritisation", "Analytics tools"], projects: ["A funnel analysis of a public product", "An experiment backlog with sizing", "An onboarding teardown"] },
  // Security
  { id: "soc-analyst", field: "security", title: "Security Analyst", summary: "Watch for threats, investigate alerts and respond to incidents.", energy: ["analyze", "lead"], demand: "High", difficulty: "Approachable", monthsToReady: [4, 8], skills: ["Networking fundamentals", "Linux", "Log analysis", "SIEM tools", "Incident response", "Threat intelligence"], projects: ["A home lab with logging", "An incident report from a CTF", "A detection rule set"] },
  { id: "pentester", field: "security", title: "Penetration Tester", summary: "Break into systems legally to find weaknesses before attackers do.", energy: ["analyze", "build"], demand: "High", difficulty: "Demanding", monthsToReady: [8, 14], skills: ["Networking", "Linux and scripting", "Web app security", "OWASP Top 10", "Reporting", "Lab practice"], projects: ["Write-ups of practice boxes", "A vulnerable app you secure", "A professional pentest report"] },
  { id: "appsec", field: "security", title: "Application Security Engineer", summary: "Help engineering teams build software that is secure by default.", energy: ["build", "analyze"], demand: "High", difficulty: "Demanding", monthsToReady: [8, 14], skills: ["Secure coding", "Threat modelling", "Code review", "Auth and crypto basics", "CI security tooling", "Developer communication"], projects: ["A threat model of an open-source app", "A CI pipeline with security checks", "A secure-coding guide"] },
  // Cloud
  { id: "devops", field: "cloud", title: "DevOps Engineer", summary: "Automate how software is built, tested and released.", energy: ["build", "analyze"], demand: "Very high", difficulty: "Moderate", monthsToReady: [6, 10], skills: ["Linux", "Git and CI/CD", "Docker", "Kubernetes", "Infrastructure as code", "Monitoring"], projects: ["A CI/CD pipeline for a web app", "A containerised multi-service app", "Infrastructure defined in Terraform"] },
  { id: "cloud-engineer", field: "cloud", title: "Cloud Engineer", summary: "Design and run reliable infrastructure on AWS, GCP or Azure.", energy: ["build", "lead"], demand: "Very high", difficulty: "Moderate", monthsToReady: [5, 10], skills: ["Cloud fundamentals", "Networking", "IAM and security", "Compute and storage", "Cost management", "Certifications"], projects: ["A 3-tier app on a cloud provider", "A cost-optimised architecture write-up", "An associate-level certification"] },
  { id: "sre", field: "cloud", title: "Site Reliability Engineer", summary: "Keep systems fast and available, and make outages rare and short.", energy: ["analyze", "build"], demand: "High", difficulty: "Demanding", monthsToReady: [8, 14], skills: ["Linux and networking", "Programming", "Observability", "Incident management", "SLOs", "Distributed systems"], projects: ["A monitoring stack with alerts", "A load test and capacity report", "A postmortem for a simulated outage"] },
];

export const FIELD_LABELS: Record<string, string> = {
  software: "Software development",
  "data-ai": "Data and AI",
  design: "Product and UX design",
  product: "Product management",
  security: "Cybersecurity",
  cloud: "Cloud and DevOps",
};

export function getRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}

export type RoleMatch = Role & { fit: number; reason: string };

const levelWeight: Record<string, number> = { beginner: 0, basics: 1, intermediate: 2, advanced: 3 };
const difficultyWeight: Record<Role["difficulty"], number> = { Approachable: 0, Moderate: 1, Demanding: 2 };

/** Ranks the roles in the chosen field and returns them with a fit score and a plain reason. */
export function matchRoles(answers: Answers): RoleMatch[] {
  const field = answers.field?.[0] ?? "software";
  const energy = answers.energy?.[0] ?? "build";
  const level = levelWeight[answers.level?.[0] ?? "beginner"] ?? 0;
  const months = answers.timeline?.[0] === "open" ? 12 : Number(answers.timeline?.[0] ?? 6);
  const goal = answers.goal?.[0];

  const scored = ROLES.filter((r) => r.field === field).map((role) => {
    let score = 50;
    let slow = false;
    const reasons: string[] = [];
    const energyIdx = role.energy.indexOf(energy);
    if (energyIdx === 0) {
      score += 18;
      reasons.push("centres on the work that energises you");
    } else if (energyIdx === 1) {
      score += 8;
      reasons.push("uses the kind of work you enjoy");
    }
    const gap = difficultyWeight[role.difficulty] - level;
    if (gap <= 0) {
      score += 8;
      reasons.push("fits what you already know");
    } else if (gap === 1) score += 2;
    else score -= 10;
    if (role.demand === "Very high") {
      score += 3;
      reasons.push("has very high demand right now");
    }
    if (role.monthsToReady[0] <= months) {
      score += 6;
      reasons.push("is realistic in your timeline");
    } else {
      score -= 8;
      slow = true;
    }
    if (goal === "first-job" && role.difficulty === "Approachable") score += 5;
    if (goal === "grow" && role.difficulty === "Demanding") score += 5;
    if (goal === "independent" && role.energy.includes("build")) score += 3;
    const fit = Math.max(40, Math.min(96, score));
    const reason = slow
      ? `It ${reasons[0] ?? "is a strong option in this field"}, but will likely take longer than your timeline.`
      : `It ${reasons.slice(0, 2).join(" and ")}.`;
    return { ...role, fit, reason };
  });

  // Sort, then nudge ties apart so the ranking always reads as a ranking.
  scored.sort((a, b) => b.fit - a.fit);
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].fit >= scored[i - 1].fit) scored[i].fit = scored[i - 1].fit - 2;
  }
  return scored;
}
