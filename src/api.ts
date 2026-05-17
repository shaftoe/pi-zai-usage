/**
 * Z.ai Usage Checker - Pi Extension
 * API interaction functions
 */

import type { ModelRegistry } from "@earendil-works/pi-coding-agent"
import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "./datetime"

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit"

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

/**
 * Fetch Z.ai usage from the API
 */
export async function getZaiUsage(
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
): Promise<ZaiUsageData> {
  const apiKey = await modelRegistry.getApiKeyForProvider("zai")
  if (!apiKey) {
    throw new Error("Missing Z.ai API credentials. Run /login for Z.ai.")
  }

  const response = await fetch(ZAI_USAGE_API_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  // Read body as text first to handle potential empty responses gracefully.
  // Pi v0.75.0 changed how fetch is implemented (removed globalThis.fetch override,
  // routes through undici 8 dispatcher support) which can in edge cases produce
  // an empty response body.
  const bodyText = await response.text()
  if (!bodyText) {
    throw new Error("Z.ai API returned an empty response")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    throw new Error(`Z.ai API returned invalid JSON: ${bodyText.substring(0, 200)}`)
  }

  // Z.ai API can return HTTP 200 with an error body
  // e.g. {"code":401,"msg":"token expired or incorrect","success":false}
  const apiError = parsed as ZaiApiError
  if (typeof apiError.success === "boolean" && !apiError.success && apiError.msg) {
    throw new Error(`Z.ai API error: ${apiError.msg}`)
  }

  const data = parsed as ZaiUsageResponse
  const tokensLimit = data.data?.limits?.find((limit) => limit.type === "TOKENS_LIMIT")

  if (!tokensLimit) {
    throw new Error("TOKENS_LIMIT not found in API response")
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
