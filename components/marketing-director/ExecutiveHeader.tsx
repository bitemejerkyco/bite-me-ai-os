import Link from "next/link";
import type { MarketingModeSettings } from "@/features/marketing-director/modes";

const modeLabel: Record<MarketingModeSettings["operatingMode"], string> = {
  advisor: "Advisor",
  copilot: "Copilot",
  autopilot: "Autopilot",
};

export default function ExecutiveHeader(props: {
  greeting: string;
  firstName: string;
  workspaceName: string;
  dateLabel: string;
  mode: MarketingModeSettings;
}) {
  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Marketing Director</p>
          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 md:text-[1.8rem]">
            {props.greeting}, {props.firstName}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            {props.workspaceName} · {props.dateLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operating mode</p>
          <p className="mt-1 text-base font-bold text-slate-900">{modeLabel[props.mode.operatingMode]}</p>
          <p className="mt-1.5 text-xs text-slate-500">{props.mode.autopilotMessage}</p>
          <Link href="/settings/marketing-director" className="mt-2 inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
            Mode settings
          </Link>
        </div>
      </div>
    </section>
  );
}
