/**
 * Z.ai Usage Checker - Pi Extension
 * API interaction functions
 */

import type { ModelRegistry } from "@earendil-works/pi-coding-agent"
import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "./datetime"

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit"

// --- Custom error ---

/** Error thrown by Z.ai API interactions; carries a short code for footer display */
export class ZaiUsageError extends Error {
  override readonly name = "ZaiUsageError"
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}

// --- API types ---

export interface ZaiUsageResponse {
  data: {
    limits: Array<{
      type: string
      percentage: number
      nextResetTime?: number
    }>
  }
}

export interface ZaiApiError {
  code: number
  msg: string
  success: boolean
}

export interface ZaiUsageData {
  percentage: number
  resetTime?: string
  timeRemaining?: string
}

/** Sentinel value injected by Docker Sandbox proxy when an env var is
 * proxy-managed (listed under environment.proxyManaged in spec.yaml).
 * When the API key reads as this value, the proxy will inject the real
 * Authorization header, so we should not set it ourselves. */
const PROXY_MANAGED_SENTINEL = "proxy-managed"

/**
 * Fetch Z.ai usage from the API
 *
 * Sandbox-aware auth:
 * - If a real API key is available (from environment / login), it is sent as
 *   "Authorization: Bearer <key>" in the request headers.
 * - If the key is the Docker Sandbox sentinel "proxy-managed", auth is left
 *   to the sandbox proxy — it injects Authorization via serviceAuth rules.
 * - If no key is available at all, the request is made without Authorization.
 *   The API returns HTTP 401 and the caller sees the standard error.
 */
export async function getZaiUsage(
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
): Promise<ZaiUsageData> {
  const apiKey = await modelRegistry.getApiKeyForProvider("zai")

  const headers: Record<string, string> = {
    // Prevent gzip encoding: Pi v0.75.0 routes fetch() through undici's
    // EnvHttpProxyAgent which fails to decompress gzip responses, causing
    // response.json() to see garbled bytes and throw SyntaxError.
    "Accept-Encoding": "identity",
  }
  if (apiKey && apiKey !== PROXY_MANAGED_SENTINEL) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  let response: Response
  try {
    response = await fetch(ZAI_USAGE_API_URL, { headers })
  } catch (e) {
    // Network-level errors (DNS failure, connection refused, proxy errors, etc.)
    // are surfaced as TypeError by fetch(). Wrap them in ZaiUsageError so the
    // footer can display a short error code instead of a raw stack trace.
    throw new ZaiUsageError(`Network error: ${e instanceof Error ? e.message : String(e)}`, "fetch")
  }

  if (!response.ok) {
    throw new ZaiUsageError(
      `API request failed with status ${response.status}`,
      `http${response.status}`,
    )
  }

  // Pi v0.75.0 changed how fetch is implemented (removed globalThis.fetch override,
  // routes through undici 8 dispatcher support) which can in edge cases produce
  // an empty or malformed response body. We use response.json() which properly
  // handles Content-Encoding (e.g. gzip decompression), unlike response.text()
  // which would return raw compressed bytes as garbled text.
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch (e) {
    // response.json() throws SyntaxError for empty bodies ("" is not valid JSON)
    // or for genuinely malformed JSON. Detect the empty-body case for clarity.
    const message = e instanceof SyntaxError ? "empty or malformed response" : String(e)
    throw new ZaiUsageError(`Z.ai API returned invalid JSON (${message})`, "badjson")
  }

  // Z.ai API can return HTTP 200 with an error body
  // e.g. {"code":401,"msg":"token expired or incorrect","success":false}
  const apiError = parsed as ZaiApiError
  if (typeof apiError.success === "boolean" && !apiError.success && apiError.msg) {
    throw new ZaiUsageError(`Z.ai API error: ${apiError.msg}`, `api${apiError.code ?? "unknown"}`)
  }

  const data = parsed as ZaiUsageResponse
  const tokensLimit = data.data?.limits?.find((limit) => limit.type === "TOKENS_LIMIT")

  if (!tokensLimit) {
    throw new ZaiUsageError("TOKENS_LIMIT not found in API response", "nolimit")
  }

  const result: ZaiUsageData = {
    percentage: tokensLimit.percentage,
  }

  if (tokensLimit.nextResetTime) {
    result.resetTime = formatInstantFromEpochMs(tokensLimit.nextResetTime)
    result.timeRemaining = formatTimeRemainingFromEpochMs(tokensLimit.nextResetTime)
  }

  return result
}
