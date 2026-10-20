import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getShareStats } from "@/lib/share/query";
import { shareCard, SHARE_SIZE, type ShareFormat, type ShareTheme } from "@/lib/share/card";
import { resolveSegment, segmentLanguage, SEGMENT_COOKIE } from "@/lib/ui/segment";
import { resolvePeriod } from "@/lib/ui/period";
import { chisinauDate } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsCache: Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }>> | null = null;
/** Full-glyph Inter (Cyrillic + Latin + symbols) as TTF — Satori ignores a second file with the same name/weight, so subsets cannot be combined. */
function fonts() {
  fontsCache ??= Promise.all(
    ([[400, "Regular"], [700, "Bold"]] as const).map(async ([weight, file]) => {
      const buf = await readFile(path.join(FONT_DIR, `Inter-${file}.ttf`));
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return { name: "Inter", data, weight, style: "normal" as const };
    }),
  );
  return fontsCache;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "square";
  const theme = url.searchParams.get("theme") ?? "light";
  if (format !== "square" && format !== "story") return Response.json({ error: "format must be square|story" }, { status: 400 });
  if (theme !== "light" && theme !== "dark") return Response.json({ error: "theme must be light|dark" }, { status: 400 });

  // An explicit seg wins over the cookie so previews can't go stale after a segment switch.
  const segment = resolveSegment(url.searchParams.get("seg") ?? (await cookies()).get(SEGMENT_COOKIE)?.value);
  const spec = resolvePeriod(Object.fromEntries(url.searchParams), chisinauDate(new Date()));
  const stats = await getShareStats(getDb(), segmentLanguage(segment), spec);
  const { width, height } = SHARE_SIZE[format as ShareFormat];
  return new ImageResponse(shareCard(stats, { format: format as ShareFormat, theme: theme as ShareTheme }), {
    width,
    height,
    fonts: await fonts(),
    headers: { "Cache-Control": "no-store" },
  });
}
