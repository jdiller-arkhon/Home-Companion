/** Instant skeleton while a screen's data loads — never a blank page. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 md:px-10 pt-10 md:pt-14" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-32 rounded-full" />
      <div className="skeleton mt-4 h-10 w-80 max-w-full rounded-xl" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-36 rounded-[var(--radius)]" style={{ animationDelay: `${i * 80}ms` }} />)}
      </div>
    </div>
  );
}
