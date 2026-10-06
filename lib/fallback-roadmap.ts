import type { Answers } from "./questions";
import type { Role } from "./roles";
import type { GeneratedRoadmap, TaskType } from "./roadmap-schema";

type T = { title: string; description: string; type: TaskType; minutes: number };

function learnTask(skill: string, styles: string[]): T {
  if (styles.includes("video"))
    return { title: `Watch an introduction to ${skill}`, description: `Find a well-reviewed beginner video on ${skill} and take notes on the three ideas that matter most.`, type: "learn", minutes: 30 };
  if (styles.includes("courses"))
    return { title: `Start a course module on ${skill}`, description: `Pick one structured course for ${skill} and finish its first module. Stick with this course rather than hopping between many.`, type: "learn", minutes: 40 };
  return { title: `Read the core guide for ${skill}`, description: `Read the official documentation or a respected getting-started guide for ${skill}. Write a five-line summary in your own words.`, type: "learn", minutes: 30 };
}

function skillMilestone(skill: string, styles: string[], reflect: boolean) {
  const tasks: T[] = [
    learnTask(skill, styles),
    { title: `Go one level deeper on ${skill}`, description: `Look into the part of ${skill} that confused you yesterday. Search for a second explanation from a different source.`, type: "learn", minutes: 30 },
    { title: `Practise ${skill} with three small exercises`, description: `Do three short exercises that use ${skill}. Keep them small enough to finish today.`, type: "practice", minutes: 40 },
    { title: `Build a tiny demo using ${skill}`, description: `Make something small that uses what you learned. It doesn't need to be pretty; it needs to work.`, type: "build", minutes: 45 },
    { title: `Explain ${skill} to someone else`, description: `Write a short post or note explaining ${skill} as if to a friend. Teaching it shows you what you still don't know.`, type: "connect", minutes: 20 },
  ];
  if (reflect)
    tasks.push({ title: "Look back on this week", description: "Write down what went well, what got in the way, and one thing you'll change next week.", type: "reflect", minutes: 10 });
  return { title: `Get comfortable with ${skill}`, outcome: `You can use ${skill} on your own without following a tutorial step by step.`, tasks };
}

function projectMilestone(project: string) {
  return {
    title: project,
    outcome: "A finished project you can link to, with a short write-up of the decisions you made.",
    tasks: [
      { title: `Plan: ${project}`, description: "Write a one-page plan: what it does, who it's for, the smallest version worth shipping, and what you'll leave out.", type: "build" as const, minutes: 30 },
      { title: "Build the core of the project", description: "Get the main feature working end to end before polishing anything.", type: "build" as const, minutes: 60 },
      { title: "Finish the remaining features", description: "Add the rest of your planned scope. Cut anything that isn't essential.", type: "build" as const, minutes: 60 },
      { title: "Polish and fix rough edges", description: "Fix bugs, tidy the interface or output, and test it like a stranger would.", type: "practice" as const, minutes: 45 },
      { title: "Publish it with a short write-up", description: "Put it online or on GitHub with a README covering the problem, your approach and what you learned.", type: "connect" as const, minutes: 30 },
    ],
  };
}

export function buildFallbackRoadmap(role: Role, answers: Answers): GeneratedRoadmap {
  const styles = answers.style ?? [];
  const blockers = answers.blockers ?? [];
  const reflect = blockers.includes("consistency");
  const s = role.skills;

  const readiness = {
    title: answers.goal?.[0] === "independent" ? "Find your first clients" : "Get ready to apply",
    outcome: "A sharp profile, a list of targets and practised answers to the questions you'll be asked.",
    tasks: [
      { title: "Rewrite your resume or profile around your projects", description: `Lead with the projects you built for this plan and the ${role.title} skills they show.`, type: "build" as const, minutes: 45 },
      { title: "Make a list of 20 places you'd like to work with", description: "Note what each one does and why it interests you. Quality beats volume.", type: "practice" as const, minutes: 30 },
      { title: "Message three people already doing this role", description: "Ask one specific question about their work. Keep it short and genuine.", type: "connect" as const, minutes: 20 },
      ...(blockers.includes("interviews")
        ? [
            { title: "Run a mock interview with yourself on video", description: "Answer three common questions out loud, then watch it back once and note one thing to improve.", type: "practice" as const, minutes: 30 },
            { title: "Do a mock interview with a friend", description: "Ask them to play the interviewer for 30 minutes. Ask for blunt feedback.", type: "practice" as const, minutes: 40 },
          ]
        : [{ title: "Practise answering common interview questions", description: `Prepare short stories for 'tell me about yourself' and 'a hard problem you solved' using your ${role.title} projects.`, type: "practice" as const, minutes: 30 }]),
      { title: "Send your first five applications or pitches", description: "Tailor the first line of each to the company. Track them somewhere simple.", type: "connect" as const, minutes: 45 },
    ],
  };

  return {
    title: `Your path to ${role.title}`,
    summary: `A step-by-step plan that takes you from the fundamentals to being ready for ${role.title} roles, with real projects along the way.`,
    phases: [
      { title: "Foundations", summary: "Learn the ideas everything else is built on.", milestones: [skillMilestone(s[0], styles, false), skillMilestone(s[1], styles, reflect)] },
      { title: "Core skills", summary: `The skills ${role.title}s use every day.`, milestones: [skillMilestone(s[2], styles, false), skillMilestone(s[3], styles, reflect)] },
      { title: "Proof of work", summary: "Build things you can show, not just talk about.", milestones: blockers.includes("portfolio") ? role.projects.map(projectMilestone) : role.projects.slice(0, 2).map(projectMilestone) },
      { title: "Going further", summary: "Round out your skills and get in front of the right people.", milestones: [skillMilestone(s[4], styles, false), skillMilestone(s[5], styles, false), readiness] },
    ],
  };
}
