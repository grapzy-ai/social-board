import { isAllowed } from "./allowlist";
import { currentUserEmail } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized: no allowed session");
    this.name = "UnauthorizedError";
  }
}

/** Pure gate: returns the normalized email or throws. */
export function assertAllowed(email: string | null | undefined): string {
  if (!isAllowed(email)) throw new UnauthorizedError();
  return email!.trim().toLowerCase();
}

/** Call at the top of every server action: resolves the Supabase session and applies the allowlist. */
export async function requireAllowedUser(): Promise<string> {
  return assertAllowed(await currentUserEmail());
}
