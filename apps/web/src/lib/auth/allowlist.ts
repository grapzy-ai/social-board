/** Emails allowed into the dashboard: ALLOWED_EMAILS="a@x.com, b@y.com" (case-insensitive). */
export function isAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
