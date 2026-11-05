import { Prose } from "@/components/site/prose";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <Prose eyebrow="Security" title="How Oryn protects your data">
      <section>
        <h2>Read-only by design</h2>
        <p>Oryn reads what you give it — your public website, files you upload and notes you paste. It has no write access to your CRM, inbox or website, and it never sends anything on your behalf.</p>
      </section>
      <section>
        <h2>Accounts and sessions</h2>
        <ul>
          <li>Passwords are hashed with bcrypt; we never store them in plain text.</li>
          <li>Sessions use random, HTTP-only, same-site cookies that expire after 30 days. Only a hash of the session token is stored.</li>
          <li>Repeated failed sign-ins are rate-limited.</li>
        </ul>
      </section>
      <section>
        <h2>Infrastructure</h2>
        <ul>
          <li>The app runs on Vercel with HTTPS everywhere. Data is stored in a managed Postgres database encrypted at rest.</li>
          <li>Website reading blocks private and internal network addresses, limits page size and times out slow responses.</li>
          <li>Uploads are limited to PDF, TXT, MD and CSV files up to 5 MB; only extracted text is kept.</li>
        </ul>
      </section>
      <section>
        <h2>AI processing</h2>
        <p>To write briefs and answers, relevant excerpts of your data are sent to our AI providers (Groq and Google Gemini) over encrypted connections. Your data is used only to produce your results.</p>
      </section>
      <section>
        <h2>Your controls</h2>
        <p>You can pause Oryn, export your Company Brain, delete individual sources, or delete your whole workspace from Settings. Deletion is immediate and permanent.</p>
      </section>
    </Prose>
  );
}
