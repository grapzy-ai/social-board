import { sendMagicLink } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span className="vb-badge">VB</span>
          <h1 className="text-xl font-semibold tracking-tight">Social Board</h1>
        </div>
        {sp.sent ? (
          <p className="text-sm text-neutral-300">Ссылка для входа отправлена на почту. Открой её на этом устройстве.</p>
        ) : (
          <form action={sendMagicLink} className="space-y-3">
            <input name="email" type="email" required placeholder="email" className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <button className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black">Получить ссылку</button>
          </form>
        )}
        {sp.denied && <p className="text-sm text-red-400">Этот e-mail не в списке доступа.</p>}
        {sp.error && <p className="text-sm text-red-400">{sp.error}</p>}
      </div>
    </main>
  );
}
