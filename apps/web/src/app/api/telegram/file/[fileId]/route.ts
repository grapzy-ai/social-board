import { downloadFile, mimeFromPath } from "@/lib/telegram/files";

export const runtime = "nodejs";

/** Authenticated preview proxy for bot media (photos in /inbox). proxy.ts gates it behind the login. */
export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const file = await downloadFile(fileId);
  if (!file) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(file.buf), { headers: { "content-type": mimeFromPath(file.path), "cache-control": "private, max-age=3600" } });
}
