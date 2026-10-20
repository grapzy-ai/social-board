import type { Platform } from "@/lib/db/schema";
import { PLATFORM_LABEL } from "@/lib/ui/platform";

/** Colored dot + platform name (+ handle, + EN chip when asked). No brand logos. */
export function PlatformChip({ platform, language, handle, color, showLang = false, size = "md" }: { platform: Platform; language: "ru" | "en"; handle?: string; color: string; showLang?: boolean; size?: "sm" | "md" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === "sm" ? "text-xs" : "text-sm"}`}>
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-medium">{PLATFORM_LABEL[platform]}</span>
      {showLang && language === "en" && <span className="rounded border border-line px-1 text-[10px] leading-4 text-muted">EN</span>}
      {handle && <span className="text-muted">@{handle}</span>}
    </span>
  );
}
