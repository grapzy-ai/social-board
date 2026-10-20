import type { SortTags } from "@/lib/db/schema";
import { PILLAR_LABEL, SORT_KIND_LABEL, TARGET_LABEL } from "@/lib/ui/factory-labels";

const chip = "rounded-full border border-line px-2 py-0.5 text-[11px] leading-4";

/** Pillar · target · kind chips for an inbox item. Pillar is the only coloured one (accent outline). */
export function TagChips({ tags, language }: { tags: SortTags | null; language?: "ru" | "en" | null }) {
  if (!tags) return <span className={`${chip} text-muted`}>не разобрано</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.pillar && <span className={`${chip} border-accent text-accent`}>{PILLAR_LABEL[tags.pillar]}</span>}
      {tags.format && <span className={chip}>{TARGET_LABEL[tags.format]}</span>}
      <span className={`${chip} text-muted`}>{SORT_KIND_LABEL[tags.kind]}</span>
      {language === "en" && <span className={`${chip} text-muted`}>EN</span>}
    </span>
  );
}
