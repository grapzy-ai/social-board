import { setSegmentAction } from "@/app/actions/prefs";
import { SEGMENT_LABEL, type Segment } from "@/lib/ui/segment";

const ORDER: Segment[] = ["ru", "en", "all"];

export function SegmentSwitch({ current }: { current: Segment }) {
  return (
    <form action={setSegmentAction} className="flex rounded-lg border border-line p-0.5 text-xs" aria-label="Сегмент">
      {ORDER.map((s) => (
        <button key={s} name="segment" value={s} aria-pressed={current === s} className={`rounded-md px-2.5 py-1 font-medium ${current === s ? "bg-fg text-surface" : "text-muted hover:text-fg"}`}>
          {SEGMENT_LABEL[s]}
        </button>
      ))}
    </form>
  );
}
