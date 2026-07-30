import Link from "next/link";
import Image from "next/image";
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
    <main className="min-h-screen px-5 py-12 text-slate-700">
      <article className="pm-glass mx-auto max-w-4xl overflow-hidden rounded-[2rem]">
        <header className="border-b border-white/80 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-cyan-100 px-6 py-10 sm:px-10">
          <Link className="inline-flex items-center gap-3" href="/">
            <Image
              src="/postmotive-mark.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-2xl shadow-lg"
            />
            <span className="pm-brand text-lg font-black tracking-tight">
              PostMotive
            </span>
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">{description}</p>
        </header>

        <div className="space-y-8 px-6 py-10 leading-7 text-slate-700 sm:px-10">
          {children}
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 px-6 py-6 text-sm text-slate-500 sm:px-10">
          <span>© 2026 CaliKing Distro</span>
          <Link className="hover:text-violet-700" href="/terms">
            Terms of Service
          </Link>
          <Link className="hover:text-violet-700" href="/privacy">
            Privacy Policy
          </Link>
          <a
            className="hover:text-violet-700"
            href="mailto:calikingdistro@gmail.com"
          >
            Contact
          </a>
        </footer>
      </article>
    </main>
  );
}
