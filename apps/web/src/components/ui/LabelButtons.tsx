import type { Label } from "@/lib/db/schema";
import { setLabelAction } from "@/app/(dashboard)/posts/actions";

export const LABEL_TEXT: Record<Exclude<Label, null>, string> = { hit: "залетело", miss: "мимо", odd: "странно" };

export function LabelButtons({ postId, current }: { postId: string; current: Label }) {
  return (
    <form action={setLabelAction} className="flex gap-1">
      <input type="hidden" name="postId" value={postId} />
      {(["hit", "miss", "odd"] as const).map((l) => (
        <button
          key={l}
          name="label"
          value={current === l ? "none" : l}
          className={`rounded px-2 py-0.5 text-xs ${current === l ? "bg-accent text-accent-fg" : "border border-line text-muted hover:text-fg"}`}
          title={current === l ? "снять метку" : LABEL_TEXT[l]}
        >
          {LABEL_TEXT[l]}
        </button>
      ))}
    </form>
  );
}
