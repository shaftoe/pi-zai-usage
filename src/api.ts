/**
 * Z.ai Usage Checker - Pi Extension
 * Provider-specific API interaction using shared library primitives
 */

import {
  buildAuthHeaders,
  safeFetch,
  safeParseJson,
  UsageError,
} from "@alexanderfortin/pi-usage-lib"
import {
  formatInstantFromEpochMs,
  formatTimeRemainingFromEpochMs,
} from "@alexanderfortin/pi-usage-lib/datetime"
import type { ModelRegistry } from "@earendil-works/pi-coding-agent"

// --- API types ---

/**
 * The Z.ai quota API returns a `limits` array where each entry is a quota
 * window. The window kind is encoded by the `type` + `unit` pair, NOT by
 * array order:
 *
 *   type            | unit | meaning                                    | reset cycle
 *   ----------------|------|--------------------------------------------|----------------------------------
 *   TOKENS_LIMIT    | 3    | 5-hour rolling token quota                 | dynamic, 5h after consumption
 *   TOKENS_LIMIT    | 6    | Weekly token quota (the newer weekly cap)  | fixed 7-day cycle
 *   TIME_LIMIT      | 5    | Monthly web-search / web-reader / zread    | monthly
 *
 * Source of the unit mapping: the Z.ai subscription dashboard frontend and
 * the official GLM Coding Plan docs (5-hour + weekly usage limits).
 */
const UNIT_FIVE_HOUR = 3
const UNIT_WEEKLY = 6
const UNIT_MONTHLY_TOOLS = 5

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit"

export interface ZaiUsageResponse {
  data: {
    limits: Array<ZaiLimit>
    /** Plan tier: "lite" | "pro" | "max" (may be absent on some accounts) */
    level?: string
  }
}

export interface ZaiLimit {
  type: string
  /** Window kind: 3 = 5h, 6 = weekly, 5 = monthly tools */
  unit: number
  percentage?: number
  nextResetTime?: number
  // Fields only present on TIME_LIMIT entries:
  number?: number
  usage?: number
  currentValue?: number
  remaining?: number
}

export interface ZaiApiError {
  code: number
  msg: string
  success: boolean
}

/** A single normalized quota window with formatted time strings. */
export interface ZaiQuotaWindow {
  /** Usage percentage (0–100) */
  percentage: number
  /** Formatted absolute reset time, or undefined when not provided */
  resetTime?: string
  /** Human-readable time remaining until reset, or undefined when not provided */
  timeRemaining?: string
}

/**
 * Normalized Z.ai usage data.
 *
 * `fiveHour` is the rolling 5-hour token quota (always shown when present).
 * `weekly` is the 7-day token cap — the limit most likely to be hit first
 * once Z.ai tightened usage. Both are optional because the API may omit a
 * window depending on the account's plan state.
 */
export interface ZaiUsageData {
  /** Plan tier label, e.g. "lite", "pro", "max" (optional) */
  level?: string
  /** 5-hour rolling token quota */
  fiveHour?: ZaiQuotaWindow
  /** Weekly (7-day) token quota */
  weekly?: ZaiQuotaWindow
  /** Monthly web-search / reader / zread tool budget (optional) */
  monthlyTools?: ZaiQuotaWindow
}

/** Pick the first limit entry matching a type+unit pair. */
function findLimit(
  limits: ZaiLimit[] | undefined,
  type: string,
  unit: number,
): ZaiLimit | undefined {
  return limits?.find((limit) => limit.type === type && limit.unit === unit)
}

/** Convert a raw limit entry into a normalized window with formatted times. */
function toQuotaWindow(limit: ZaiLimit | undefined): ZaiQuotaWindow | undefined {
  if (!limit) return undefined
  const window: ZaiQuotaWindow = {
    percentage: limit.percentage ?? 0,
  }
  if (typeof limit.nextResetTime === "number") {
    window.resetTime = formatInstantFromEpochMs(limit.nextResetTime)
    window.timeRemaining = formatTimeRemainingFromEpochMs(limit.nextResetTime)
  }
  return window
}

/**
 * Fetch Z.ai usage from the API
 *
 * Uses shared library primitives (buildAuthHeaders, safeFetch, safeParseJson)
 * for sandbox-aware auth, error handling, and JSON parsing.
 */
export async function getZaiUsage(
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
): Promise<ZaiUsageData> {
  const headers = await buildAuthHeaders(modelRegistry, "zai")

  const response = await safeFetch(ZAI_USAGE_API_URL, { headers })

  const parsed = await safeParseJson(response)

  // Z.ai API can return HTTP 200 with an error body
  // e.g. {"code":401,"msg":"token expired or incorrect","success":false}
  const apiError = parsed as ZaiApiError
  if (typeof apiError.success === "boolean" && !apiError.success && apiError.msg) {
    throw new UsageError(`Z.ai API error: ${apiError.msg}`, `api${apiError.code ?? "unknown"}`)
  }

  const data = parsed as ZaiUsageResponse
  const limits = data.data?.limits

  if (!Array.isArray(limits) || limits.length === 0) {
    throw new UsageError("No quota limits found in API response", "nolimit")
  }

  const result: ZaiUsageData = {}

  if (typeof data.data?.level === "string" && data.data.level.length > 0) {
    result.level = data.data.level
  }

  const fiveHour = toQuotaWindow(findLimit(limits, "TOKENS_LIMIT", UNIT_FIVE_HOUR))
  if (fiveHour) result.fiveHour = fiveHour

  const weekly = toQuotaWindow(findLimit(limits, "TOKENS_LIMIT", UNIT_WEEKLY))
  if (weekly) result.weekly = weekly

  const monthlyTools = toQuotaWindow(findLimit(limits, "TIME_LIMIT", UNIT_MONTHLY_TOOLS))
  if (monthlyTools) result.monthlyTools = monthlyTools

  // Neither token window present → nothing meaningful to display
  if (!result.fiveHour && !result.weekly) {
    throw new UsageError("TOKENS_LIMIT not found in API response", "nolimit")
  }

  return result
}

// Re-export UsageError for consumers that need it
export { UsageError }
