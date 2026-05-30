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

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit"

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
  const tokensLimit = data.data?.limits?.find((limit) => limit.type === "TOKENS_LIMIT")

  if (!tokensLimit) {
    throw new UsageError("TOKENS_LIMIT not found in API response", "nolimit")
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

// Re-export UsageError for consumers that need it
export { UsageError }
