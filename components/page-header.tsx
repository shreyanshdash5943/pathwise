export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">{title}</h1>
        {description && <div className="mt-1.5 text-[15.5px] text-muted">{description}</div>}
      </div>
      {action}
    </div>
  );
}
