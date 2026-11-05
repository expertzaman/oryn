export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="skeleton h-9 w-72" />
      <div className="skeleton h-5 w-96 max-w-full" />
      <div className="grid gap-6 pt-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-40" />)}</div>
        <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="skeleton h-32" />)}</div>
      </div>
    </div>
  );
}
