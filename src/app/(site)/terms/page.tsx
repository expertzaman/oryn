import { Prose } from "@/components/site/prose";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <Prose eyebrow="Legal" title="Terms of Service" updated="5 November 2026">
      <section>
        <h2>Using Oryn</h2>
        <p>You may use Oryn for your own business. You’re responsible for the content you upload and for having the right to share it with us, including any customer information in CRM exports.</p>
      </section>
      <section>
        <h2>Recommendations, not guarantees</h2>
        <p>Oryn’s actions, drafts and diagnoses are suggestions generated from the evidence you provide and from AI models. They can be wrong. Review them before acting; decisions remain yours.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>You own your content. You grant us permission to process it only to provide the service to you. You can export or delete it at any time.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don’t use Oryn to read websites you aren’t allowed to access, or to process data unlawfully.</li>
          <li>Don’t attempt to break, overload or reverse-engineer the service.</li>
        </ul>
      </section>
      <section>
        <h2>Early access</h2>
        <p>Oryn is in early access. Features may change and the service is provided “as is”. We’ll give at least 30 days’ notice before introducing charges for the Founder plan.</p>
      </section>
    </Prose>
  );
}
