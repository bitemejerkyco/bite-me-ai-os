import LegalPage from "@/components/legal/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | PostMotive",
  description: "Terms governing use of the PostMotive platform.",
};

const headingClass = "text-2xl font-bold text-white";
const listClass = "list-disc space-y-2 pl-6";

export default function TermsPage() {
  return (
    <LegalPage
      description="The rules and responsibilities that apply when using PostMotive."
      title="Terms of Service"
    >
      <p>
        <strong className="text-white">Effective date:</strong> July 30, 2026
      </p>

      <section className="space-y-3">
        <h2 className={headingClass}>1. Agreement and operator</h2>
        <p>
          These Terms of Service govern your access to and use of PostMotive, an
          AI marketing platform operated by CaliKing Distro. By creating an
          account or using PostMotive, you agree to these terms. If you use the
          service for a business or organization, you confirm that you have
          authority to accept these terms on its behalf.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>2. The service</h2>
        <p>
          PostMotive helps users create, review, organize, schedule, publish,
          and measure marketing content, advertisements, images, videos,
          captions, voiceovers, and related materials. Features may use
          artificial intelligence and may connect to third-party platforms.
        </p>
        <p>
          We may improve, change, suspend, or discontinue features when
          reasonably necessary for security, legal compliance, platform
          compatibility, or product development.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>3. Accounts and security</h2>
        <ul className={listClass}>
          <li>You must provide accurate account information.</li>
          <li>
            You are responsible for protecting your password and connected
            account credentials.
          </li>
          <li>
            You must promptly notify us if you suspect unauthorized access.
          </li>
          <li>
            You may not access another person&apos;s workspace without
            permission.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>4. Your content and approvals</h2>
        <p>
          You retain ownership of content and media you provide to PostMotive.
          You grant CaliKing Distro a limited license to host, process,
          transform, and transmit that content only as needed to operate,
          secure, support, and improve the service.
        </p>
        <p>
          You are responsible for reviewing and approving content before it is
          published. You must verify claims, prices, offers, disclosures,
          licenses, music rights, privacy permissions, and compliance with
          applicable laws and platform rules.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>5. AI-generated material</h2>
        <p>
          Artificial intelligence can produce incomplete, inaccurate, or
          similar results for different users. PostMotive does not guarantee
          that generated material is unique, error-free, legally compliant, or
          suitable for publication. You must apply human review and obtain any
          rights or permissions required for your use.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>6. Acceptable use</h2>
        <p>You may not use PostMotive to:</p>
        <ul className={listClass}>
          <li>break the law or facilitate fraud or deception;</li>
          <li>
            publish unlawful, harmful, infringing, defamatory, or misleading
            content;
          </li>
          <li>
            impersonate another person or use their identity, voice, or likeness
            without permission;
          </li>
          <li>
            probe, disrupt, reverse engineer, or gain unauthorized access to
            the service;
          </li>
          <li>
            distribute malware, spam, or content that violates a connected
            platform&apos;s rules; or
          </li>
          <li>
            use the service in a way that harms other users or our systems.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>7. Third-party platforms</h2>
        <p>
          Connections to TikTok and other third-party services are governed by
          those providers&apos; terms, policies, permissions, and technical
          limits. A provider may review, restrict, reject, delay, or remove
          content or access. We are not responsible for third-party outages,
          account actions, policy changes, or decisions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>8. Fees</h2>
        <p>
          If paid features are offered, pricing and billing terms will be shown
          before purchase. Except where required by law or expressly stated at
          purchase, fees are non-refundable. You are responsible for applicable
          taxes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>9. Suspension and termination</h2>
        <p>
          You may stop using PostMotive at any time. We may restrict or
          terminate access when reasonably necessary to address a material
          violation of these terms, security risk, unlawful activity,
          nonpayment, or third-party platform requirement. Sections that by
          their nature should survive termination will continue to apply.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>10. Disclaimers</h2>
        <p>
          PostMotive is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis to the maximum extent permitted by law. We do
          not promise uninterrupted availability, specific marketing results,
          revenue, engagement, platform approval, or fitness for a particular
          purpose.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, CaliKing Distro will not be
          liable for indirect, incidental, special, consequential, exemplary,
          or punitive damages, or for lost profits, revenue, data, goodwill, or
          business opportunities arising from use of PostMotive or connected
          platforms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>12. Governing law</h2>
        <p>
          These terms are governed by the laws of the State of California,
          without regard to conflict-of-law principles. Any mandatory rights
          available to you under applicable law remain unaffected.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={headingClass}>13. Changes and contact</h2>
        <p>
          We may update these terms and will post the revised effective date on
          this page. For questions, contact CaliKing Distro at{" "}
          <a
            className="text-red-400 underline hover:text-red-300"
            href="mailto:calikingdistro@gmail.com"
          >
            calikingdistro@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
