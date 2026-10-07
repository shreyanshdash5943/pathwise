import type { Role } from "../roles.ts";
import type { TaskType } from "../roadmap-schema.ts";
import type { TemplateBody } from "./schema.ts";

/**
 * Built-in template, used for any (role, level) that has no generated template file yet.
 * It depends only on the role, so it is identical for everyone on that role.
 *
 * Changing this file changes the task list (and so the task keys) of every plan built
 * on version 0. Treat it as frozen once users are on it: ship improvements as
 * generated template files instead.
 */

type T = { title: string; description: string; type: TaskType; minutes: number };

function skillMilestone(skill: string) {
  const tasks: T[] = [
    { title: `Study the core ideas of ${skill}`, description: `Use the official documentation or one well-reviewed beginner resource for ${skill}. Write a five-line summary in your own words.`, type: "learn", minutes: 30 },
    { title: `Go one level deeper on ${skill}`, description: `Look into the part of ${skill} that confused you yesterday. Search for a second explanation from a different source.`, type: "learn", minutes: 30 },
    { title: `Practise ${skill} with three small exercises`, description: `Do three short exercises that use ${skill}. Keep them small enough to finish today.`, type: "practice", minutes: 40 },
    { title: `Build a tiny demo using ${skill}`, description: `Make something small that uses what you learned. It doesn't need to be pretty; it needs to work.`, type: "build", minutes: 45 },
    { title: `Explain ${skill} to someone else`, description: `Write a short post or note explaining ${skill} as if to a friend. Teaching it shows you what you still don't know.`, type: "connect", minutes: 20 },
  ];
  return { title: `Get comfortable with ${skill}`, outcome: `You can use ${skill} on your own without following a tutorial step by step.`, skill, tasks };
}

export function projectMilestone(project: string) {
  return {
    title: project,
    outcome: "A finished project you can link to, with a short write-up of the decisions you made.",
    skill: null,
    tasks: [
      { title: `Plan: ${project}`, description: "Write a one-page plan: what it does, who it's for, the smallest version worth shipping, and what you'll leave out.", type: "build" as const, minutes: 30 },
      { title: "Build the core of the project", description: "Get the main feature working end to end before polishing anything.", type: "build" as const, minutes: 60 },
      { title: "Finish the remaining features", description: "Add the rest of your planned scope. Cut anything that isn't essential.", type: "build" as const, minutes: 60 },
      { title: "Polish and fix rough edges", description: "Fix bugs, tidy the interface or output, and test it like a stranger would.", type: "practice" as const, minutes: 45 },
      { title: "Publish it with a short write-up", description: "Put it online or on GitHub with a README covering the problem, your approach and what you learned.", type: "connect" as const, minutes: 30 },
    ],
  };
}

export function builtinTemplate(role: Role): TemplateBody {
  const s = role.skills;
  const readiness = {
    title: "Get ready for the next step",
    outcome: "A sharp profile, a list of targets and practised answers to the questions you'll be asked.",
    skill: null,
    tasks: [
      { title: "Rewrite your resume or profile around your projects", description: `Lead with the projects you built for this plan and the ${role.title} skills they show.`, type: "build" as const, minutes: 45 },
      { title: "Make a list of 20 places you'd like to work with", description: "Note what each one does and why it interests you. Quality beats volume.", type: "practice" as const, minutes: 30 },
      { title: "Message three people already doing this role", description: "Ask one specific question about their work. Keep it short and genuine.", type: "connect" as const, minutes: 20 },
      { title: "Practise answering common interview questions", description: `Prepare short stories for 'tell me about yourself' and 'a hard problem you solved' using your ${role.title} projects.`, type: "practice" as const, minutes: 30 },
    ],
  };

  return {
    title: `Your path to ${role.title}`,
    summary: `A step-by-step plan that takes you from the fundamentals to being ready for ${role.title} roles, with real projects along the way.`,
    phases: [
      { title: "Foundations", summary: "Learn the ideas everything else is built on.", milestones: [skillMilestone(s[0]), skillMilestone(s[1])] },
      { title: "Core skills", summary: `The skills ${role.title}s use every day.`, milestones: [skillMilestone(s[2]), skillMilestone(s[3])] },
      { title: "Proof of work", summary: "Build things you can show, not just talk about.", milestones: role.projects.slice(0, 2).map(projectMilestone) },
      { title: "Going further", summary: "Round out your skills and get in front of the right people.", milestones: [skillMilestone(s[4]), skillMilestone(s[5]), readiness] },
    ],
  };
}
