/**
 * Z.ai Usage Checker - Pi Extension
 * API interaction functions
 */

import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "./datetime"
import type { ModelRegistry, ZaiUsageData, ZaiUsageResponse } from "./types"

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

  const response = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  const data = (await response.json()) as ZaiUsageResponse
  const tokensLimit = data.data.limits.find((limit) => limit.type === "TOKENS_LIMIT")

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
