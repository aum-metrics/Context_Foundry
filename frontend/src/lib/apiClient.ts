/**
 * apiClient.ts — Centralized API client for AUM Context Foundry
 * 
 * - Single auth header injection point
 * - 502/503 retry with exponential backoff
 * - Typed error responses
 * - Job polling abstraction
 */

import { auth } from "@/lib/firebase";
import { getLocalMockSession, isLocalMockMode } from "@/lib/localMockMode";

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getAuthToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (token) return token;
  if (isLocalMockMode()) return getLocalMockSession().token;
  throw new Error("auth");
}

// ─── Typed API Error ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly isAuth: boolean = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAuthError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiError) return err.isAuth;
  const msg = err instanceof Error ? err.message : String(err);
  return msg === "auth" || msg.includes("401") || msg.includes("403");
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** How many 502/503 retries to allow before throwing. Default: 5 */
  maxGatewayRetries?: number;
  /** Skip auth header (e.g., public endpoints). Default: false */
  noAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { maxGatewayRetries = 5, noAuth = false, headers = {}, ...rest } = options;

  const token = noAuth ? null : await getAuthToken().catch(() => null);
  if (!noAuth && !token) throw new ApiError(401, "Authentication required.", true);

  const finalHeaders: Record<string, string> = {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let gatewayErrors = 0;
  let lastError: Error = new Error("Unknown error");

  while (gatewayErrors <= maxGatewayRetries) {
    let resp: Response;
    try {
      resp = await fetch(url, { ...rest, headers: finalHeaders });
    } catch (networkErr) {
      lastError = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      gatewayErrors++;
      if (gatewayErrors > maxGatewayRetries) throw lastError;
      await sleep(1000 * Math.min(gatewayErrors, 4));
      continue;
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new ApiError(resp.status, "Authentication required.", true);
    }

    if (resp.status === 502 || resp.status === 503) {
      gatewayErrors++;
      if (gatewayErrors > maxGatewayRetries) {
        throw new ApiError(resp.status, "Backend gateway error — please retry in a moment.");
      }
      await sleep(1500 * Math.min(gatewayErrors, 3));
      continue;
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      let message = `Request failed (${resp.status})`;
      try {
        const json = JSON.parse(body) as { detail?: string; message?: string; error?: string };
        message = json.detail || json.message || json.error || message;
      } catch {
        if (body) message = body.slice(0, 200);
      }
      throw new ApiError(resp.status, message);
    }

    // Parse JSON or return empty object
    const text = await resp.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(200, "Unexpected non-JSON response from server.");
    }
  }

  throw lastError;
}

// ─── SWR fetcher (compatible with useSWR key patterns) ───────────────────────

export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

// ─── Job polling ──────────────────────────────────────────────────────────────

interface PollOptions {
  /** Max polling attempts. Default: 60 (= 3 min at 3s) */
  maxAttempts?: number;
  /** Interval between polls in ms. Default: 3000 */
  intervalMs?: number;
  /** Called on each attempt with progress info */
  onProgress?: (attempt: number, max: number, message?: string) => void;
}

export type JobStatus<T = unknown> =
  | { status: "completed"; result: T }
  | { status: "failed"; error: string }
  | { status: "processing" | "queued"; progress?: number; message?: string };

export async function pollJob<T = unknown>(
  statusUrl: string,
  options: PollOptions = {},
): Promise<T> {
  const { maxAttempts = 60, intervalMs = 3000, onProgress } = options;

  let gatewayErrors = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(attempt === 0 ? Math.min(intervalMs, 1500) : intervalMs);

    let data: JobStatus<T>;
    try {
      data = await apiFetch<JobStatus<T>>(statusUrl, { maxGatewayRetries: 3 });
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) throw err;
      gatewayErrors++;
      if (gatewayErrors >= 5) throw err;
      onProgress?.(attempt, maxAttempts, "Backend still processing…");
      continue;
    }

    gatewayErrors = 0; // reset on any successful response

    onProgress?.(attempt + 1, maxAttempts, data.status === "processing" ? (data as { message?: string }).message : undefined);

    if (data.status === "completed") return data.result;
    if (data.status === "failed") throw new ApiError(500, data.error || "Job failed on server.");
  }

  throw new ApiError(408, `Job timed out after ${Math.round((maxAttempts * intervalMs) / 60000)} minutes.`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
