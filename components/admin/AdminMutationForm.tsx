import type { ReactNode } from "react";

type HiddenField = {
  name: string;
  value: string;
};

export default function AdminMutationForm({
  action,
  title,
  description,
  children,
  hiddenFields,
  buttonLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  title: string;
  description: string;
  children?: ReactNode;
  hiddenFields?: HiddenField[];
  buttonLabel: string;
}) {
  return (
    <form action={action} className="rounded-[1.6rem] border border-slate-200 bg-white/85 p-4 shadow-[0_12px_28px_rgba(76,61,139,0.08)]">
      <div className="space-y-2">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {(hiddenFields || []).map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <div className="mt-4 space-y-3">{children}</div>
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Reason
        <textarea
          required
          minLength={8}
          name="reason"
          className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          placeholder="Required for audit trail"
        />
      </label>
      <button className="pm-primary-button mt-4 rounded-2xl px-4 py-2 text-sm font-semibold">
        {buttonLabel}
      </button>
    </form>
  );
}