// Server-side-only Parasut OAuth2 + JSON:API client.
//
// Auth flow per https://apidocs.parasut.com (section "Kimlik Dogrulama"):
//   - password grant: POST {PARASUT_BASE_URL}/oauth/token
//       grant_type=password, client_id, client_secret, username, password,
//       redirect_uri (Parasut requires the same redirect_uri registered on
//       the app; out-of-band apps use urn:ietf:wg:oauth:2.0:oob)
//   - refresh grant:   POST {PARASUT_BASE_URL}/oauth/token
//       grant_type=refresh_token, client_id, client_secret, refresh_token
//
// Tokens are persisted in parasut.oauth_tokens (service_role only) so a
// refresh_token survives across function invocations instead of doing a
// fresh password grant every sync run.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const PARASUT_BASE_URL = Deno.env.get("PARASUT_BASE_URL") ?? "https://api.parasut.com";
const OAUTH_CONNECTION_ID = "default";

interface StoredToken {
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  expires_at: string;
  raw: unknown;
}

interface ParasutTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  created_at?: number;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

async function requestToken(params: Record<string, string>): Promise<ParasutTokenResponse> {
  const body = new URLSearchParams(params);
  const response = await fetch(`${PARASUT_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Parasut oauth/token failed (${response.status}): ${text.slice(0, 500)}`);
  }

  return (await response.json()) as ParasutTokenResponse;
}

async function passwordGrant(): Promise<ParasutTokenResponse> {
  return requestToken({
    grant_type: "password",
    client_id: requireEnv("PARASUT_CLIENT_ID"),
    client_secret: requireEnv("PARASUT_CLIENT_SECRET"),
    username: requireEnv("PARASUT_USERNAME"),
    password: requireEnv("PARASUT_PASSWORD"),
    redirect_uri: Deno.env.get("PARASUT_REDIRECT_URI") ?? "urn:ietf:wg:oauth:2.0:oob",
  });
}

async function refreshGrant(refreshToken: string): Promise<ParasutTokenResponse> {
  return requestToken({
    grant_type: "refresh_token",
    client_id: requireEnv("PARASUT_CLIENT_ID"),
    client_secret: requireEnv("PARASUT_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });
}

async function persistToken(db: SupabaseClient, token: ParasutTokenResponse): Promise<StoredToken> {
  const expiresInSeconds = token.expires_in ?? 7200;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const row = {
    connection: OAUTH_CONNECTION_ID,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    token_type: token.token_type ?? null,
    expires_at: expiresAt,
    raw: token,
  };

  const { error } = await db.schema("parasut").from("oauth_tokens").upsert(row, { onConflict: "connection" });
  if (error) {
    throw new Error(`Failed to persist Parasut oauth token: ${error.message}`);
  }

  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    expires_at: row.expires_at,
    raw: row.raw,
  };
}

/**
 * Returns a valid access token, reusing/refreshing the stored one when
 * possible and falling back to a fresh password grant otherwise.
 */
export async function getAccessToken(db: SupabaseClient): Promise<string> {
  const { data: existing, error } = await db
    .schema("parasut")
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("connection", OAUTH_CONNECTION_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read stored Parasut oauth token: ${error.message}`);
  }

  const now = Date.now();
  const safetyMarginMs = 60_000;

  if (existing && new Date(existing.expires_at).getTime() - safetyMarginMs > now) {
    return existing.access_token;
  }

  if (existing?.refresh_token) {
    try {
      const refreshed = await refreshGrant(existing.refresh_token);
      const stored = await persistToken(db, refreshed);
      return stored.access_token;
    } catch (_refreshError) {
      // Refresh token expired/revoked: fall through to a fresh password grant.
    }
  }

  const fresh = await passwordGrant();
  const stored = await persistToken(db, fresh);
  return stored.access_token;
}

export interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> | null }>;
}

interface JsonApiListResponse {
  data: JsonApiResource[];
  meta?: {
    current_page?: number;
    total_pages?: number;
    total_count?: number;
  };
}

export interface PageResult {
  items: JsonApiResource[];
  meta: JsonApiListResponse["meta"];
  page: number;
}

/**
 * Fetches a single page of a Parasut list endpoint.
 * Throws on any non-2xx response -- callers must treat that as a failed
 * sync, never a partial success.
 */
const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, fallbackSeconds = 5): number {
  const retryAfter = response.headers.get("Retry-After");
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : fallbackSeconds) * 1000;
}

export async function fetchPage(
  accessToken: string,
  path: string,
  page: number,
  pageSize: number,
  extraParams: Record<string, string> = {},
): Promise<PageResult> {
  const companyId = requireEnv("PARASUT_COMPANY_ID");
  const url = new URL(`${PARASUT_BASE_URL}/v4/${companyId}/${path}`);
  url.searchParams.set("page[number]", String(page));
  url.searchParams.set("page[size]", String(pageSize));
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(retryDelayMs(response));
      continue;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Parasut ${path} page ${page} failed (${response.status}): ${text.slice(0, 500)}`);
    }

    const json = (await response.json()) as JsonApiListResponse;
    return { items: json.data ?? [], meta: json.meta, page };
  }

  throw new Error(`Parasut ${path} page ${page} failed: exceeded rate-limit retries`);
}

/**
 * Fetches every page of a Parasut list endpoint. Stops only when a page
 * comes back empty or the reported total_pages has been reached; any
 * request failure aborts the whole fetch (thrown to the caller).
 */
export async function fetchAllPages(
  accessToken: string,
  path: string,
  pageSize = 25,
  extraParams: Record<string, string> = {},
): Promise<{ items: JsonApiResource[]; totalCountReported: number | null }> {
  const items: JsonApiResource[] = [];
  let page = 1;
  let totalPages: number | null = null;
  let totalCountReported: number | null = null;

  while (true) {
    const result = await fetchPage(accessToken, path, page, pageSize, extraParams);
    items.push(...result.items);

    if (result.meta?.total_pages != null) totalPages = result.meta.total_pages;
    if (result.meta?.total_count != null) totalCountReported = result.meta.total_count;

    if (result.items.length === 0) break;
    if (totalPages != null && page >= totalPages) break;
    if (totalPages == null && result.items.length < pageSize) break;

    page += 1;
  }

  if (totalPages != null && page < totalPages) {
    throw new Error(
      `Pagination stopped early: fetched ${page} of ${totalPages} reported pages for ${path}`,
    );
  }

  return { items, totalCountReported };
}
