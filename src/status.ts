/**
 * Z.ai Usage Checker - Pi Extension
 * Footer status management
 */

import { Temporal } from "temporal-polyfill"
import { getZaiUsage } from "./api"
import type { ExtensionContext, ModelRegistry, ZaiUsageData } from "./types"

// Type for the fetch usage function (same signature as getZaiUsage)
export type FetchUsageFn = (
  modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">,
) => Promise<ZaiUsageData>

// --- Widget state ---

let lastUsage: ZaiUsageData | null = null
let lastFetchTime = 0
const FETCH_COOLDOWN_MS = 30_000 // Only fetch every 30 seconds

/**
 * Reset internal state (for testing only)
 */
export function _resetStateForTesting(): void {
  lastUsage = null
  lastFetchTime = 0
}

/**
 * Update the footer status with Z.ai usage information
 * @param ctx - Extension context
 * @param fetchUsage - Optional function to fetch usage data (injected for testing)
 */
export async function updateZaiStatus(
  ctx: ExtensionContext,
  fetchUsage: FetchUsageFn = getZaiUsage,
): Promise<void> {
  try {
    const now = Temporal.Now.instant().epochMilliseconds

    // Use cached data if still fresh
    if (lastUsage && lastFetchTime && now - lastFetchTime < FETCH_COOLDOWN_MS) {
      const theme = ctx.ui.theme
      let status = theme.fg("muted", "Z.ai: ") + theme.fg("accent", `${lastUsage.percentage}%`)
      if (lastUsage.resetTime && lastUsage.timeRemaining) {
        status += ` ${theme.fg("dim", `(${lastUsage.timeRemaining})`)}`
      }
      ctx.ui.setStatus("zai-usage", status)
      return
    }

    const usage = await fetchUsage(ctx.modelRegistry)
    lastUsage = usage
    lastFetchTime = now

    const theme = ctx.ui.theme
    let status = theme.fg("muted", "Z.ai: ") + theme.fg("accent", `${usage.percentage}%`)
    if (usage.resetTime && usage.timeRemaining) {
      status += ` ${theme.fg("dim", `(${usage.timeRemaining})`)}`
    }
    ctx.ui.setStatus("zai-usage", status)
  } catch (_error) {
    // Silently clear status on error
    ctx.ui.setStatus("zai-usage", undefined)
  }
}

/**
 * Clear the Z.ai usage footer status
 */
export function clearZaiStatus(ctx: ExtensionContext): void {
  ctx.ui.setStatus("zai-usage", undefined)
}

/**
 * Try to show footer status, handling errors gracefully
 * @param ctx - Extension context
 * @param fetchUsage - Optional function to fetch usage data (injected for testing)
 */
export async function tryShowFooter(
  ctx: ExtensionContext,
  fetchUsage?: FetchUsageFn,
): Promise<void> {
  await updateZaiStatus(ctx, fetchUsage)
}

/**
 * Check if the current model is a Z.ai model
 */
export function isCurrentModelZai(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === "zai"
}
