import { describe, it, expect, vi, beforeEach } from "vitest";

const emailMock = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/supabase/server", () => ({ currentUserEmail: () => emailMock() }));
const getDbMock = vi.fn();
vi.mock("@/lib/db/client", () => ({ getDb: () => getDbMock() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { assertAllowed, requireAllowedUser } from "@/lib/auth/require";
import { setLabelAction } from "@/app/(dashboard)/posts/actions";

describe("server-action auth", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = "bordian07@gmail.com";
    emailMock.mockReset();
    getDbMock.mockReset();
  });
  it("assertAllowed throws for a missing or non-allowlisted email", () => {
    expect(() => assertAllowed(null)).toThrow(/unauthorized/i);
    expect(() => assertAllowed("stranger@example.com")).toThrow(/unauthorized/i);
    expect(assertAllowed("Bordian07@gmail.com")).toBe("bordian07@gmail.com");
  });
  it("requireAllowedUser resolves the session email through the allowlist", async () => {
    emailMock.mockResolvedValue("bordian07@gmail.com");
    await expect(requireAllowedUser()).resolves.toBe("bordian07@gmail.com");
    emailMock.mockResolvedValue(null);
    await expect(requireAllowedUser()).rejects.toThrow(/unauthorized/i);
  });
  it("setLabelAction refuses before touching the database when there is no allowed session", async () => {
    emailMock.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("postId", "11111111-1111-4111-8111-111111111111");
    fd.set("label", "hit");
    await expect(setLabelAction(fd)).rejects.toThrow(/unauthorized/i);
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
