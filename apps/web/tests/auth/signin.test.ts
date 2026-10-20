import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({ auth: { signInWithPassword } }),
  currentUserEmail: async () => null,
}));
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirectMock(u) }));

import { signIn } from "@/app/(auth)/login/actions";

const fd = (email: string, password: string) => {
  const f = new FormData();
  f.set("email", email);
  f.set("password", password);
  return f;
};

describe("signIn", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = "vadimbordian23@gmail.com";
    signInWithPassword.mockReset();
    redirectMock.mockClear();
  });

  it("refuses an email outside the allowlist without calling Supabase", async () => {
    await expect(signIn(fd("stranger@example.com", "x"))).rejects.toThrow("REDIRECT:/login?denied=1");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with the given credentials and lands on the dashboard", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn(fd("Vadimbordian23@gmail.com", "secret"))).rejects.toThrow("REDIRECT:/");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "vadimbordian23@gmail.com", password: "secret" });
  });

  it("reports a wrong password back on the login page", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await expect(signIn(fd("vadimbordian23@gmail.com", "nope"))).rejects.toThrow(/REDIRECT:\/login\?error=/);
  });
});
