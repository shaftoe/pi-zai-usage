/**
 * Z.ai Usage Checker - Pi Extension
 *
 * Provides a tool to check Z.ai API token usage quota and automatically displays
 * usage in the footer (information area) when using Z.ai provider.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { isCurrentModelZai, isZaiProvider, ZaiUsageCache } from "./status"

export default function (pi: ExtensionAPI) {
  const cache = new ZaiUsageCache()

  // Show footer at session start (only when using Z.ai model)
  pi.on("session_start", async (_event, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await cache.updateStatus(ctx)
    }
  })

  // Update footer on model select
  pi.on("model_select", async (event, ctx) => {
    if (isZaiProvider(event.model.provider)) {
      await cache.updateStatus(ctx)
    } else {
      cache.clear(ctx)
    }
  })

  // Update footer after each turn
  pi.on("turn_end", async (_event, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await cache.updateStatus(ctx)
    }
  })

  // Clear footer on session shutdown
  pi.on("session_shutdown", async (_event, ctx) => {
    cache.clear(ctx)
  })
}
