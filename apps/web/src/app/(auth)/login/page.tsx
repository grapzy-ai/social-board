import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const field =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent";
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span className="vb-badge">VB</span>
          <h1 className="text-xl font-semibold tracking-tight">Social Board</h1>
        </div>
        <form action={signIn} className="space-y-3">
          <input name="email" type="email" required autoComplete="username" placeholder="email" className={field} />
          <input name="password" type="password" required autoComplete="current-password" placeholder="пароль" className={field} />
          <button className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg">Войти</button>
        </form>
        {sp.denied && <p className="text-sm text-red-400">Этот e-mail не в списке доступа.</p>}
        {sp.error && <p className="text-sm text-red-400">{sp.error}</p>}
      </div>
    </main>
  );
}
