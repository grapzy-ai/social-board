export class MetaApiError extends Error {
  status: number;
  code?: number;
  isAuth: boolean;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.code = code;
    this.isAuth = status === 401 || code === 190;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOptions {
  token?: string;
  retries?: number;
  init?: RequestInit;
}

/** JSON GET/POST against Meta Graph-style APIs. 429/5xx retried with backoff; auth errors thrown immediately. */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { token, retries = 3, init = {} } = opts;
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, { ...init, headers });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.ok) return body as T;
    const err = (body as { error?: { message?: string; code?: number } } | null)?.error;
    const apiErr = new MetaApiError(err?.message ?? `HTTP ${res.status}`, res.status, err?.code);
    const retryable = !apiErr.isAuth && (res.status === 429 || res.status >= 500);
    if (!retryable || attempt >= retries) throw apiErr;
    await sleep(500 * 2 ** attempt);
    attempt += 1;
  }
}

export function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.set(k, String(v));
  return u.toString();
}

type InsightRow = { name: string; values?: { value: number }[]; total_value?: { value: number } };

/** Flattens a Graph insights payload into {metric: lastValue}. */
export function insightsToMap(data: InsightRow[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.total_value && typeof row.total_value.value === "number") out[row.name] = row.total_value.value;
    else if (row.values && row.values.length) out[row.name] = row.values[row.values.length - 1].value;
  }
  return out;
}
