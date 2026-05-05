export function ProductionLocalOnlyBanner() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-50 border-b border-stone-300/80 bg-[oklch(0.966_0.017_82)]/95 backdrop-blur supports-backdrop-filter:bg-[oklch(0.966_0.017_82)]/88"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-1.5 px-5 py-3 sm:px-8 lg:flex-row lg:items-center lg:gap-4 lg:px-12 xl:px-16 2xl:px-24">
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-stone-700">
          Production build notice
        </p>
        <p className="max-w-4xl text-sm leading-6 text-stone-700 sm:text-[0.95rem]">
          Live AI features are available in local builds only{" "}
          <span className="text-stone-600">
            (to avoid billing and extra auth or account overhead in
            production)
          </span>
          .
        </p>
      </div>
    </div>
  );
}