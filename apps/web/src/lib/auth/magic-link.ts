/** Sign-in options for the magic link: signups are closed, so an unknown email never creates a user. */
export function magicLinkOptions(baseUrl: string) {
  return { shouldCreateUser: false, emailRedirectTo: `${baseUrl.replace(/\/$/, "")}/api/auth/callback` } as const;
}
