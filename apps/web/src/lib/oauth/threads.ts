import { fetchJson, qs } from "@/lib/adapters/meta-http";

export const THREADS_SCOPES = ["threads_basic", "threads_manage_insights", "threads_read_replies", "threads_manage_replies", "threads_content_publish"];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function threadsRedirectUri(): string {
  return `${env("APP_BASE_URL")}/api/auth/threads/callback`;
}

export function threadsAuthorizeUrl(state: string): string {
  return `https://threads.net/oauth/authorize?${qs({
    client_id: env("THREADS_APP_ID"),
    redirect_uri: threadsRedirectUri(),
    scope: THREADS_SCOPES.join(","),
    response_type: "code",
    state,
  })}`;
}

export interface ThreadsTokens {
  longLivedToken: string;
  expiresAt: Date;
  userId: string;
  username: string;
}

/** code → short-lived → long-lived token (+ profile). */
export async function exchangeThreadsCode(code: string): Promise<ThreadsTokens> {
  const body = new URLSearchParams({
    client_id: env("THREADS_APP_ID"),
    client_secret: env("THREADS_APP_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: threadsRedirectUri(),
    code,
  });
  const short = await fetchJson<{ access_token: string; user_id: number | string }>("https://graph.threads.net/oauth/access_token", {
    init: { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  });
  const long = await fetchJson<{ access_token: string; expires_in: number }>(
    `https://graph.threads.net/access_token?${qs({ grant_type: "th_exchange_token", client_secret: env("THREADS_APP_SECRET"), access_token: short.access_token })}`,
  );
  const me = await fetchJson<{ id: string; username: string }>(`https://graph.threads.net/v1.0/me?${qs({ fields: "id,username" })}`, { token: long.access_token });
  return { longLivedToken: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000), userId: me.id, username: me.username };
}
