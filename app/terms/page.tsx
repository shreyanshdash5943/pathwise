import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms", description: "Plain-language terms for using Pathwise." };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="October 2026">
      <p>
        These are plain-language terms for using Pathwise. They&apos;re a starting point for an early-stage product, not a substitute
        for formal legal terms. By using Pathwise you agree to the following in good faith.
      </p>

      <h2>What Pathwise is</h2>
      <p>
        Pathwise helps you plan and build toward a career goal, and track daily habits. The roadmaps, roles and guidance are here to
        help you decide — they are not a guarantee of a job, an outcome, or professional career advice.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for what you do with your account and for keeping your sign-in secure.</li>
        <li>Use Pathwise for yourself. Don&apos;t upload content you don&apos;t have the right to, or anything unlawful or harmful.</li>
        <li>Anything you choose to make public (a public profile, pod posts) should be yours to share.</li>
      </ul>

      <h2>Pro</h2>
      <p>
        The core of Pathwise is free. Pro is an optional paid upgrade. When paid billing is available, you&apos;ll be able to cancel any
        time, and any pricing shown in the app applies at the time of purchase.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Pathwise running, but it&apos;s provided as is, without warranties, and may change or have downtime. We aren&apos;t
        liable for lost progress, though we do our best to avoid that.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms as the product grows. If we make a significant change, we&apos;ll note it here.</p>
    </LegalPage>
  );
}
