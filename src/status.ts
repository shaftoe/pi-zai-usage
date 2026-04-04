/**
 * Z.ai Usage Checker - Pi Extension
 * Footer status management
 */

import type {
  ExtensionContext as PiExtensionContext,
  ModelRegistry as PiModelRegistry,
} from "@mariozechner/pi-coding-agent"
import { Temporal } from "temporal-polyfill"
import { getZaiUsage, type ZaiUsageData } from "./api"

// Type for the fetch usage function (same signature as getZaiUsage)
export type FetchUsageFn = (
  modelRegistry: Pick<PiModelRegistry, "getApiKeyForProvider">,
) => Promise<ZaiUsageData>

// --- Widget state ---

let lastUsage: ZaiUsageData | null = null
let lastFetchTime = 0
const FETCH_COOLDOWN_MS = 30_000 // Only fetch every 30 seconds

/**
 * Build and set the footer status string from usage data
 */
function setStatusFromUsage(ctx: PiExtensionContext, usageData: ZaiUsageData): void {
  const theme = ctx.ui.theme
  let status = theme.fg("muted", "Z.ai:") + theme.fg("accent", `${usageData.percentage}%`)
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
  ctx: PiExtensionContext,
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
  } catch (error) {
    console.error(`Error updating Z.ai usage: ${error}`)
    clearZaiStatus(ctx)
  }
}

/**
 * Clear the Z.ai usage footer status
 */
export function clearZaiStatus(ctx: PiExtensionContext): void {
  ctx.ui.setStatus("zai-usage", undefined)
}

/**
 * Check if a provider name is a Z.ai provider (e.g., "zai", "zai-extra", etc.)
 */
export function isZaiProvider(provider: string | undefined): boolean {
  return provider?.toLowerCase().startsWith("zai") ?? false
}

/**
 * Check if the current model is a Z.ai model
 */
export function isCurrentModelZai(ctx: PiExtensionContext): boolean {
  return isZaiProvider(ctx.model?.provider)
}
