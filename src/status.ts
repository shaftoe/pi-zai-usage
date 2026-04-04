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

// Type for fetch usage function (same signature as getZaiUsage)
export type FetchUsageFn = (
  modelRegistry: Pick<PiModelRegistry, "getApiKeyForProvider">,
) => Promise<ZaiUsageData>

/** Cache for Z.ai usage data to avoid excessive API calls */
export class ZaiUsageCache {
  private lastUsage: ZaiUsageData | null = null
  private lastFetchTime = 0
  private static readonly FETCH_COOLDOWN_MS = 30_000 // Only fetch every 30 seconds

  /** Build and set footer status string from usage data */
  private setStatusFromUsage(ctx: PiExtensionContext, usageData: ZaiUsageData): void {
    const theme = ctx.ui.theme
    const displayPercentage = Math.round(usageData.percentage * 10) / 10
    let status = theme.fg("muted", "Z.ai:") + theme.fg("accent", `${displayPercentage}%`)
    if (usageData.resetTime && usageData.timeRemaining) {
      status += ` ${theme.fg("dim", `(${usageData.timeRemaining})`)}`
    }
    ctx.ui.setStatus("zai-usage", status)
  }

  /** Update footer status with Z.ai usage information */
  async updateStatus(
    ctx: PiExtensionContext,
    fetchUsage: FetchUsageFn = getZaiUsage,
  ): Promise<void> {
    try {
      const now = Temporal.Now.instant().epochMilliseconds

      // Use cached data if still fresh
      if (
        this.lastUsage &&
        this.lastFetchTime &&
        now - this.lastFetchTime < ZaiUsageCache.FETCH_COOLDOWN_MS
      ) {
        this.setStatusFromUsage(ctx, this.lastUsage)
        return
      }

      const usage = await fetchUsage(ctx.modelRegistry)
      this.lastUsage = usage
      this.lastFetchTime = now

      this.setStatusFromUsage(ctx, usage)
    } catch (error) {
      console.error(`Error updating Z.ai usage: ${error}`)
      this.clear(ctx)
    }
  }

  /** Clear Z.ai usage footer status */
  clear(ctx: PiExtensionContext): void {
    ctx.ui.setStatus("zai-usage", undefined)
  }
}

/** Check if a provider name is a Z.ai provider (e.g., "zai", "zai-extra", etc.) */
export function isZaiProvider(provider: string | undefined): boolean {
  return provider?.toLowerCase().startsWith("zai") ?? false
}

/** Check if current model is a Z.ai model */
export function isCurrentModelZai(ctx: PiExtensionContext): boolean {
  return isZaiProvider(ctx.model?.provider)
}
