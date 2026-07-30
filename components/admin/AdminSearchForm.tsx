type AdminSearchFormProps = {
  fields: Array<{
    name: string;
    label: string;
    defaultValue?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
};

export default function AdminSearchForm({ fields }: AdminSearchFormProps) {
  return (
    <form className="pm-glass rounded-[2rem] border border-white/90 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <label key={field.name} className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {field.label}
            {field.options ? (
              <select
                name={field.name}
                defaultValue={field.defaultValue || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              >
                <option value="">All</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                defaultValue={field.defaultValue || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="pm-primary-button rounded-2xl px-4 py-2 text-sm font-semibold">
          Apply filters
        </button>
        <a
          href="?"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
        >
          Reset
        </a>
      </div>
    </form>
  );
}