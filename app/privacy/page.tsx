import LegalPage from "@/components/legal/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | PostMotive",
  description: "How PostMotive collects, uses, and protects information.",
};

const headingClass = "text-2xl font-bold text-white";
const listClass = "list-disc space-y-2 pl-6";

export default function PrivacyPage() {
  return (
    <LegalPage
      description="How CaliKing Distro collects, uses, shares, and protects information through PostMotive."
      title="Privacy Policy"
    >
      <p>
        <strong className="text-white">Effective date:</strong> July 30, 2026
      </p>

      <section className="space-y-3">
        <h2 className={headingClass}>1. Who we are</h2>
        <p>
          PostMotive is an AI marketing platform operated by CaliKing Distro.
          This policy explains how we handle personal information when you use
          our website, applications, and connected services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>2. Information we collect</h2>
        <ul className={listClass}>
          <li>
            <strong className="text-white">Account information:</strong> name,
            email address, authentication details, and workspace membership.
          </li>
          <li>
            <strong className="text-white">Business information:</strong> brand,
            website, audience, goals, voice, industry, and compliance settings.
          </li>
          <li>
            <strong className="text-white">Content:</strong> prompts, drafts,
            campaigns, uploaded files, images, video, audio, captions,
            approvals, schedules, and feedback.
          </li>
          <li>
            <strong className="text-white">
              Connected-platform information:
            </strong>{" "}
            authorized account identifiers, profile information, permission
            scopes, access tokens, publishing status, and performance data.
          </li>
          <li>
            <strong className="text-white">Technical information:</strong> IP
            address, device and browser details, timestamps, usage events,
            diagnostics, and security logs.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>3. How we use information</h2>
        <ul className={listClass}>
          <li>create and secure accounts and workspaces;</li>
          <li>generate, store, review, schedule, and publish content;</li>
          <li>connect authorized social and advertising accounts;</li>
          <li>
            measure results and improve recommendations based on approved
            content and performance;
          </li>
          <li>provide support and communicate service information;</li>
          <li>detect misuse, troubleshoot errors, and protect the service; and</li>
          <li>comply with legal obligations and enforce our terms.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>4. TikTok and connected platforms</h2>
        <p>
          When you connect TikTok, PostMotive accesses only the information and
          permissions you authorize. Depending on the approved features, this
          may include basic profile information and permission to upload or
          publish content. We use that information to connect your account,
          display authorized profiles, submit approved content, report
          publishing status, and measure available results.
        </p>
        <p>
          We do not sell TikTok user data. You can revoke PostMotive&apos;s
          access through TikTok or disconnect the account in PostMotive. You may
          also request deletion by emailing us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>5. AI processing</h2>
        <p>
          We may send the information needed for a requested generation task to
          artificial-intelligence service providers. This can include your
          prompt, brand context, selected content, and feedback. Do not submit
          sensitive personal information that is unnecessary for your marketing
          task.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>6. How we share information</h2>
        <p>We may share information:</p>
        <ul className={listClass}>
          <li>
            with service providers that support hosting, authentication,
            databases, storage, AI generation, security, and analytics;
          </li>
          <li>
            with TikTok or another platform when you direct PostMotive to
            connect, upload, publish, or retrieve authorized results;
          </li>
          <li>
            when required by law or reasonably necessary to protect users,
            CaliKing Distro, or the public; or
          </li>
          <li>
            as part of a merger, financing, acquisition, or sale of business
            assets, subject to appropriate safeguards.
          </li>
        </ul>
        <p>We do not sell personal information.</p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>7. Service providers</h2>
        <p>
          PostMotive currently relies on providers such as Vercel for
          application hosting, Supabase for authentication, database, and
          storage services, OpenAI for AI-powered generation, and authorized
          social platforms for account connections and publishing. Each
          provider processes information under its own terms and privacy
          commitments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>8. Retention and deletion</h2>
        <p>
          We keep information for as long as needed to provide the service,
          maintain security and records, resolve disputes, and meet legal
          obligations. Retention periods vary by data type and account status.
          You may request account or personal-information deletion at the email
          below. We may retain limited information where legally required or
          necessary for security and fraud prevention.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>9. Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational
          safeguards designed to protect information. No online service can
          guarantee absolute security, so you should use a strong password and
          protect access to connected accounts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>10. Your choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete, or obtain a copy of personal information, or to object to or
          restrict certain processing. California residents may exercise
          applicable privacy rights without discriminatory treatment. To make a
          request, email us. We may need to verify your identity before
          completing it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>11. Children</h2>
        <p>
          PostMotive is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13. If you
          believe a child has provided information, please contact us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>
          12. International processing and changes
        </h2>
        <p>
          Information may be processed in the United States and other locations
          where our providers operate. We may update this policy and will post
          the revised effective date on this page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>13. Contact us</h2>
        <p>
          For privacy questions, access or deletion requests, or complaints,
          contact:
        </p>
        <address className="not-italic">
          CaliKing Distro
          <br />
          <a
            className="text-red-400 underline hover:text-red-300"
            href="mailto:calikingdistro@gmail.com"
          >
            calikingdistro@gmail.com
          </a>
        </address>
      </section>
    </LegalPage>
  );
}
