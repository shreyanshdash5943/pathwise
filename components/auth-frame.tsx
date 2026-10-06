import { Logo } from "./logo";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex h-16 items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
