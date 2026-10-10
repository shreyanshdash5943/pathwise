import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy", description: "How Pathwise handles your data: private by default, no selling, no tracking across days." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="October 2026">
      <p>
        This is a plain-language summary of how Pathwise handles your information. It is a starting point for an early-stage product,
        not legal advice. If you have a question, reach out before relying on it.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>Your account (name, email, photo) is handled by our sign-in provider, Clerk. We don&apos;t store your password.</li>
        <li>Your plan, habits, notes, proof of work, applications and interview answers, so the app works for you.</li>
        <li>If you upload a resume, the file is kept in private storage. We read the skills from it once and do not keep its text.</li>
      </ul>

      <h2>What&apos;s private, and what&apos;s not</h2>
      <p>
        Everything is private by default. A profile only becomes public if you turn on a public profile, and even then your email,
        phone and resume stay hidden unless you explicitly choose to show them. Accountability pods show your streak and activity only
        to the few people in your pod.
      </p>

      <h2>Analytics</h2>
      <p>
        If you make your profile public, we count views and clicks so you can see your reach. We count each visitor once a day using a
        salted, daily-rotating hash — we do not store IP addresses, and visitors can&apos;t be tracked across days.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data.</li>
        <li>We don&apos;t post anything or contact anyone on your behalf.</li>
        <li>Reminders only go to the devices where you turned them on.</li>
      </ul>

      <h2>Your control</h2>
      <p>
        You can delete your plan, remove your resume, make your profile private, and turn off reminders at any time from inside the app.
        To delete your account entirely, contact us.
      </p>
    </LegalPage>
  );
}
