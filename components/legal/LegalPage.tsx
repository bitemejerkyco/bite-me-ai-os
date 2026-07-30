import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export default function LegalPage({
  children,
  description,
  title,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#090d14] px-5 py-12 text-slate-100">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl">
        <header className="border-b border-red-900 bg-gradient-to-r from-[#ef0011] to-[#a90010] px-6 py-10 sm:px-10">
          <Link
            className="text-sm font-bold uppercase tracking-[0.24em] text-white"
            href="/"
          >
            PostMotive
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-red-50">{description}</p>
        </header>

        <div className="space-y-8 px-6 py-10 leading-7 text-slate-300 sm:px-10">
          {children}
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-700 px-6 py-6 text-sm text-slate-400 sm:px-10">
          <span>© 2026 CaliKing Distro</span>
          <Link className="hover:text-white" href="/terms">
            Terms of Service
          </Link>
          <Link className="hover:text-white" href="/privacy">
            Privacy Policy
          </Link>
          <a
            className="hover:text-white"
            href="mailto:calikingdistro@gmail.com"
          >
            Contact
          </a>
        </footer>
      </article>
    </main>
  );
}
