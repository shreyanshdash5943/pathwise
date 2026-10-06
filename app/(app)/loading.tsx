export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-3 h-9 w-72" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="panel space-y-5 p-6">
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-1.5 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-[22px] w-[22px] rounded-full" />
              <div className="skeleton h-4 flex-1" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="panel h-44 p-5">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton mt-3 h-9 w-16" />
          </div>
          <div className="panel h-40 p-5">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton mt-3 h-5 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
