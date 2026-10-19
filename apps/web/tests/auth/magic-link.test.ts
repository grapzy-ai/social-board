import { describe, it, expect } from "vitest";
import { magicLinkOptions } from "@/lib/auth/magic-link";

describe("magicLinkOptions", () => {
  it("never creates users on sign-in (signups are closed) and redirects to the callback", () => {
    const o = magicLinkOptions("https://social.vadim.bio");
    expect(o.shouldCreateUser).toBe(false);
    expect(o.emailRedirectTo).toBe("https://social.vadim.bio/api/auth/callback");
  });
});
