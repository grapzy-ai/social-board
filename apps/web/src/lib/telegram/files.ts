/** Bot API file access. The Bot API refuses downloads above 20 MB; bigger media stays in Drive. */
export const MAX_BOT_FILE_BYTES = 20_000_000;

function token(): string | null {
  return process.env.TG_BOT_TOKEN || null;
}

export function fileUrl(path: string): string {
  return `https://api.telegram.org/file/bot${token() ?? ""}/${path}`;
}

export async function getFileMeta(fileId: string, f: typeof fetch = fetch): Promise<{ path: string; size: number | null } | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await f(`https://api.telegram.org/bot${t}/getFile?file_id=${encodeURIComponent(fileId)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; result?: { file_path?: string; file_size?: number } };
    if (!json.ok || !json.result?.file_path) return null;
    return { path: json.result.file_path, size: json.result.file_size ?? null };
  } catch {
    return null;
  }
}

export async function getFilePath(fileId: string, f: typeof fetch = fetch): Promise<string | null> {
  return (await getFileMeta(fileId, f))?.path ?? null;
}

export async function downloadFile(fileId: string, f: typeof fetch = fetch): Promise<{ buf: Buffer; path: string } | null> {
  const meta = await getFileMeta(fileId, f);
  if (!meta) return null;
  if (meta.size !== null && meta.size > MAX_BOT_FILE_BYTES) return null;
  try {
    const res = await f(fileUrl(meta.path));
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()), path: meta.path };
  } catch {
    return null;
  }
}

export function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", oga: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", pdf: "application/pdf" }[ext] ??
    "application/octet-stream"
  );
}
