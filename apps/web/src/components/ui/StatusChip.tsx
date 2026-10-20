import type { DraftStatus } from "@/lib/db/schema";
import { DRAFT_STATUS_LABEL } from "@/lib/ui/factory-labels";

const TONE: Record<DraftStatus, string> = {
  idea: "border-line text-muted",
  draft: "border-line text-fg",
  ready: "border-accent text-accent",
  approved: "border-good text-good",
  scheduled: "border-good text-good",
  published: "bg-good text-accent-fg border-good",
  rejected: "border-bad text-bad",
};

export function StatusChip({ status }: { status: DraftStatus }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] leading-4 ${TONE[status]}`}>{DRAFT_STATUS_LABEL[status]}</span>;
}
