import type { DraftBody, DraftStatus, DraftType } from "@/lib/db/schema";

/** Editorial state machine. `published` is reached only through the publish action, never through this table. */
const ALLOWED: Record<DraftStatus, DraftStatus[]> = {
  idea: ["draft"],
  draft: ["ready"],
  ready: ["approved", "rejected", "draft"],
  approved: ["draft"],
  scheduled: ["approved", "draft"],
  published: [],
  rejected: ["draft"],
};

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatuses(from: DraftStatus): DraftStatus[] {
  return ALLOWED[from] ?? [];
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").replace(/\r\n/g, "\n");

/** Maps the editor form back to the jsonb body shape of the draft type. */
export function bodyFromForm(type: DraftType, fd: FormData): DraftBody {
  if (type === "reel") {
    const body: DraftBody = {
      script: str(fd, "script").trim(),
      hooks: str(fd, "hooks").split("\n").map((s) => s.trim()).filter(Boolean),
      cover: str(fd, "cover").trim(),
    };
    for (const k of ["angle", "hookMechanic", "funnel"] as const) {
      const v = str(fd, k).trim();
      if (v) (body as Record<string, unknown>)[k] = v;
    }
    return body;
  }
  if (type === "carousel") {
    return { slides: str(fd, "slides").split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean), caption: str(fd, "caption").trim() };
  }
  return { text: str(fd, "text").trim() };
}

/** Plain-text view of any body, for lists, bot cards and previews. */
export function bodyText(body: DraftBody): string {
  if ("text" in body) return body.text;
  if ("script" in body) return body.script;
  return body.slides.join("\n---\n");
}
