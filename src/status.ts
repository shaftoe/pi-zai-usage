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
 * Build and set the footer status string from usage data
 */
function setStatusFromUsage(ctx: ExtensionContext, usageData: ZaiUsageData): void {
  const theme = ctx.ui.theme
  let status = theme.fg("muted", "Z.ai: ") + theme.fg("accent", `${usageData.percentage}%`)
  if (usageData.resetTime && usageData.timeRemaining) {
    status += ` ${theme.fg("dim", `(${usageData.timeRemaining})`)}`
  }
  ctx.ui.setStatus("zai-usage", status)
}

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
      setStatusFromUsage(ctx, lastUsage)
      return
    }

    const usage = await fetchUsage(ctx.modelRegistry)
    lastUsage = usage
    lastFetchTime = now

    setStatusFromUsage(ctx, usage)
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
