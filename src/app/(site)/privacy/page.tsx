import { Prose } from "@/components/site/prose";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <Prose eyebrow="Legal" title="Privacy Policy" updated="5 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name, email address and company name.</li>
          <li><strong>Workspace content:</strong> the website address you give us and the text we read from it, files you upload, notes you paste, your answers during setup, and everything Oryn produces for you (facts, actions, drafts, memos).</li>
          <li><strong>Usage records:</strong> an activity log of what you and Oryn did in your workspace, and basic technical logs needed to run the service.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>Only to provide Oryn to you: building your Company Brain, writing your weekly brief, drafts and answers, and keeping the service secure. We do not sell your data or use it for advertising.</p>
      </section>
      <section>
        <h2>Who processes it</h2>
        <ul>
          <li>Vercel (hosting) and our database provider (storage).</li>
          <li>Groq and Google (AI processing of the excerpts needed for each request).</li>
        </ul>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>We keep your workspace until you delete it. Deleting a source removes it and the deals imported from it. Deleting your account removes your workspace and all its content immediately.</p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>You can access, export, correct and delete your data from Settings at any time. For anything else, contact the team that operates this Oryn deployment.</p>
      </section>
    </Prose>
  );
}
