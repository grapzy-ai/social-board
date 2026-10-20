import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("pages hosting «Обновить» export a function duration budget", () => {
  for (const f of ["src/app/(dashboard)/page.tsx", "src/app/(dashboard)/posts/page.tsx"]) {
    it(f, () => {
      expect(readFileSync(path.join(process.cwd(), f), "utf8")).toMatch(/export const maxDuration = 300/);
    });
  }
});
