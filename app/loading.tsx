export default function AppLoading() {
  return (
    <div className="min-h-screen px-4 py-8 md:px-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pm-glass-premium rounded-[2rem] p-6">
          <div className="pm-skeleton h-4 w-36" />
          <div className="mt-3 pm-skeleton h-10 w-80" />
          <div className="mt-4 pm-skeleton h-6 w-96" />
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-white/70 bg-white/70 p-4">
                <div className="pm-skeleton h-3 w-20" />
                <div className="mt-3 pm-skeleton h-8 w-14" />
                <div className="mt-3 pm-skeleton h-2 w-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="pm-glass-premium rounded-[2rem] p-5">
            <div className="pm-skeleton h-5 w-44" />
            <div className="mt-3 pm-skeleton h-20 w-full" />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="pm-skeleton h-28 w-full" />
              <div className="pm-skeleton h-28 w-full" />
            </div>
          </div>
          <div className="pm-glass-premium rounded-[2rem] p-5">
            <div className="pm-skeleton h-5 w-36" />
            <div className="mt-3 pm-skeleton h-12 w-full" />
            <div className="mt-2 pm-skeleton h-12 w-full" />
            <div className="mt-2 pm-skeleton h-12 w-full" />
            <div className="mt-4 pm-skeleton h-24 w-full" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <article key={index} className="pm-glass-premium rounded-[1.6rem] p-4">
              <div className="pm-skeleton h-3 w-24" />
              <div className="mt-3 pm-skeleton h-8 w-16" />
              <div className="mt-3 pm-skeleton h-2 w-full" />
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="pm-glass-premium rounded-[2rem] p-5">
            <div className="pm-skeleton h-5 w-36" />
            <div className="mt-3 pm-skeleton h-44 w-full" />
          </div>
          <div className="pm-glass-premium rounded-[2rem] p-5">
            <div className="pm-skeleton h-5 w-44" />
            <div className="mt-3 pm-skeleton h-44 w-full" />
          </div>
        </section>
      </div>
    </div>
  );
}
