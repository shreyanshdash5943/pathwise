import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Resume reading without AI. The PDF's text is pulled out on the server, matched
 * against the role's skills by keyword, and then thrown away: only the matched skill
 * names are stored. People always confirm the matches before their plan changes.
 */

const MAX_PAGES = 10;
const MAX_CHARS = 60_000;

export class ResumeError extends Error {}

export async function pdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new ResumeError("That file isn't a PDF.");
  let pdf;
  try {
    // pdf.js takes ownership of (detaches) the buffer it's given, which would leave the
    // caller's bytes empty. Hand it a copy.
    pdf = await getDocumentProxy(bytes.slice());
  } catch {
    throw new ResumeError("We couldn't open that PDF. Try exporting it again.");
  }
  if (pdf.numPages > MAX_PAGES) throw new ResumeError(`Resumes can be at most ${MAX_PAGES} pages.`);
  const { text } = await extractText(pdf, { mergePages: true });
  return text.slice(0, MAX_CHARS);
}

/** Keywords that show each skill. Lowercase; matched as whole words or phrases. */
const KEYWORDS: Record<string, string[]> = {
  "APIs and system basics": ["api", "apis", "rest", "graphql", "system design"],
  Accessibility: ["accessibility", "a11y", "wcag", "aria"],
  "Analytics tools": ["google analytics", "amplitude", "mixpanel", "heap", "posthog", "looker", "tableau"],
  "Auth and crypto basics": ["oauth", "jwt", "authentication", "encryption", "cryptography", "tls"],
  Authentication: ["authentication", "oauth", "jwt", "sso", "openid"],
  "CI security tooling": ["sast", "dast", "snyk", "dependabot", "semgrep", "sonarqube", "codeql"],
  "Caching and queues": ["redis", "memcached", "rabbitmq", "kafka", "sqs", "caching", "message queue"],
  Certifications: ["certified", "certification", "aws certified", "comptia", "ckad", "cka"],
  "Cloud fundamentals": ["aws", "azure", "gcp", "google cloud", "cloud"],
  "Code review": ["code review", "code reviews", "pull request", "pull requests"],
  "Colour and layout": ["colour theory", "color theory", "layout", "grid systems", "visual design"],
  "Compute and storage": ["ec2", "s3", "lambda", "compute engine", "blob storage", "cloud storage"],
  "Copy and onboarding": ["onboarding", "copywriting", "ux writing"],
  "Cost management": ["cost optimisation", "cost reduction", "finops", "cloud cost"],
  "Customer discovery": ["customer discovery", "customer interviews", "user interviews", "jobs to be done"],
  "Data visualisation": ["data visualisation", "visualisation", "tableau", "power bi", "matplotlib", "seaborn", "d3", "plotly", "looker"],
  "Delivery planning": ["delivery planning", "release planning", "sprint planning", "agile", "scrum"],
  Deployment: ["deployment", "deployed", "vercel", "netlify", "heroku", "docker"],
  "Design critique": ["design critique", "design review", "design reviews"],
  "Design systems": ["design system", "design systems", "component library"],
  "Developer communication": ["technical writing", "documentation", "developer advocacy"],
  "Developer empathy": ["developer experience", "devex", "developer tools"],
  "Distributed systems": ["distributed systems", "microservices", "kafka", "consensus"],
  Docker: ["docker", "containers", "containerisation", "dockerfile"],
  Evaluation: ["evals", "evaluation", "benchmarking"],
  "Experiment design": ["a/b test", "a/b testing", "ab testing", "experimentation", "experiment design"],
  Figma: ["figma"],
  "Funnels and metrics": ["funnel", "funnels", "conversion rate", "kpi", "kpis", "metrics"],
  "Git and CI/CD": ["git", "github", "gitlab", "ci/cd", "github actions", "jenkins", "circleci"],
  "HTML and CSS": ["html", "html5", "css", "css3", "tailwind", "sass", "scss"],
  "Handoff to engineers": ["developer handoff", "handoff", "zeplin"],
  "IAM and security": ["iam", "identity and access", "least privilege"],
  "Incident management": ["incident management", "on-call", "on call", "pagerduty", "postmortem", "postmortems"],
  "Incident response": ["incident response", "dfir", "forensics", "triage"],
  "Information architecture": ["information architecture", "card sorting", "sitemap"],
  "Infrastructure as code": ["infrastructure as code", "terraform", "pulumi", "cloudformation", "ansible", "iac"],
  "Interaction design": ["interaction design", "ixd", "user flows"],
  JavaScript: ["javascript", "js", "es6", "ecmascript"],
  "JavaScript and TypeScript": ["javascript", "typescript", "js", "ts"],
  Kubernetes: ["kubernetes", "k8s", "helm", "eks", "gke", "aks"],
  "LLM APIs": ["llm", "llms", "openai", "anthropic", "claude", "gpt", "large language model", "large language models"],
  "Lab practice": ["hack the box", "hackthebox", "tryhackme", "ctf", "home lab", "homelab"],
  "Linear algebra and probability": ["linear algebra", "probability", "calculus"],
  Linux: ["linux", "ubuntu", "debian", "bash", "unix"],
  "Linux and networking": ["linux", "tcp/ip", "networking", "dns", "unix"],
  "Linux and scripting": ["linux", "bash", "shell scripting", "powershell", "python"],
  "Log analysis": ["log analysis", "splunk", "elk", "elasticsearch", "kibana", "logs"],
  "MLOps basics": ["mlops", "mlflow", "kubeflow", "sagemaker", "model deployment"],
  Metrics: ["metrics", "kpi", "kpis", "okrs"],
  "Metrics and analytics": ["metrics", "analytics", "kpi", "kpis", "sql"],
  "Model evaluation": ["model evaluation", "cross-validation", "precision", "recall", "f1", "auc"],
  Monitoring: ["monitoring", "prometheus", "grafana", "datadog", "new relic"],
  Networking: ["networking", "tcp/ip", "dns", "subnetting", "firewalls", "wireshark"],
  "Networking fundamentals": ["networking", "tcp/ip", "dns", "subnetting", "osi model", "wireshark", "ccna"],
  "Node or Django": ["node", "node.js", "nodejs", "express", "django", "nestjs"],
  "OWASP Top 10": ["owasp", "xss", "sql injection", "csrf"],
  Observability: ["observability", "opentelemetry", "tracing", "prometheus", "grafana", "datadog"],
  Prioritisation: ["prioritisation", "rice", "moscow", "backlog"],
  "Product thinking": ["product thinking", "product sense", "product strategy"],
  Programming: ["python", "golang", "java", "javascript", "typescript", "rust", "c++", "programming"],
  "Prompt design": ["prompt engineering", "prompt design", "prompting"],
  "Prototyping and motion": ["prototyping", "prototype", "prototypes", "motion design", "after effects", "principle", "protopie"],
  PyTorch: ["pytorch", "torch"],
  Python: ["python"],
  "Python or Go": ["python", "golang"],
  "Python or TypeScript": ["python", "typescript"],
  "Python with pandas": ["pandas", "python", "numpy", "jupyter"],
  "REST API design": ["rest", "restful", "api design", "openapi", "swagger"],
  React: ["react", "react.js", "reactjs"],
  "React or Next.js": ["react", "react.js", "reactjs", "next.js", "nextjs"],
  Reporting: ["reporting", "reports", "pentest report"],
  "Retrieval (RAG)": ["rag", "retrieval augmented", "retrieval-augmented", "vector database", "embeddings", "pinecone", "pgvector"],
  Roadmapping: ["roadmap", "roadmaps", "roadmapping"],
  "SIEM tools": ["siem", "splunk", "qradar", "sentinel", "elastic security"],
  SLOs: ["slo", "slos", "sli", "slis", "error budget", "error budgets"],
  SQL: ["sql", "postgresql", "postgres", "mysql", "sqlite", "bigquery", "snowflake"],
  "SQL and data modelling": ["sql", "postgresql", "postgres", "mysql", "data modelling", "schema design"],
  "Secure coding": ["secure coding", "owasp", "input validation"],
  "Shipping web apps": ["web app", "web apps", "web application", "full stack", "full-stack", "next.js", "react"],
  Spreadsheets: ["excel", "google sheets", "spreadsheets", "spreadsheet", "vlookup", "pivot tables"],
  "Stakeholder communication": ["stakeholder", "stakeholders", "stakeholder management"],
  Statistics: ["statistics", "statistical", "regression", "hypothesis testing"],
  "Storytelling with data": ["data storytelling", "storytelling", "presented findings", "dashboards"],
  "System design basics": ["system design", "scalability", "architecture"],
  "Technical specs": ["technical spec", "technical specs", "technical specification", "design doc", "design docs", "rfc"],
  Testing: ["testing", "unit tests", "jest", "pytest", "cypress", "playwright", "tdd"],
  "Threat intelligence": ["threat intelligence", "threat intel", "mitre att&ck", "ioc", "iocs"],
  "Threat modelling": ["threat modelling", "threat model", "stride"],
  TypeScript: ["typescript", "ts"],
  Typography: ["typography", "typefaces", "type design"],
  "Usability testing": ["usability testing", "usability tests", "user testing"],
  "User research": ["user research", "ux research", "user interviews", "personas", "surveys"],
  "Web app security": ["web application security", "web app security", "burp suite", "burp", "owasp"],
  "Web performance": ["web performance", "core web vitals", "lighthouse", "performance optimisation"],
  Wireframing: ["wireframe", "wireframes", "wireframing", "balsamiq"],
  "Working with engineers": ["cross-functional", "engineering teams", "worked with engineers"],
  "Writing specs": ["prd", "prds", "product requirements", "specs", "user stories"],
  "scikit-learn": ["scikit-learn", "sklearn", "scikit"],
};

/** Lowercase, collapse whitespace and fold -ize/-isation spellings so US and UK forms match. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/([a-z])iz(e|es|ed|ing|ation|ations)\b/g, "$1is$2")
    .replace(/\bcolor/g, "colour")
    .replace(/\bmodeling\b/g, "modelling");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = new Map<string, RegExp>();
function patternFor(skill: string): RegExp {
  let re = patterns.get(skill);
  if (!re) {
    const words = (KEYWORDS[skill] ?? [skill.toLowerCase()]).map((k) => escape(normalize(k)));
    re = new RegExp(`(?<![a-z0-9])(?:${words.join("|")})(?![a-z0-9])`);
    patterns.set(skill, re);
  }
  return re;
}

/** The skills from the list that the text shows. */
export function matchSkills(text: string, skills: string[]): string[] {
  const t = normalize(text);
  return skills.filter((s) => patternFor(s).test(t));
}
