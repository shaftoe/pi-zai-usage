/**
 * Z.ai Usage Checker - Pi Extension
 *
 * Provides a tool to check Z.ai API token usage quota and automatically displays
 * usage in the footer (information area) when using Z.ai provider.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { clearZaiStatus, isCurrentModelZai, isZaiProvider, updateZaiStatus } from "./status"

export default function (pi: ExtensionAPI) {
  // Show footer at session start (handles errors gracefully)
  pi.on("session_start", async (_event, ctx) => {
    await updateZaiStatus(ctx)
  })

  // Update footer on model select
  pi.on("model_select", async (event, ctx) => {
    if (isZaiProvider(event.model.provider)) {
      await updateZaiStatus(ctx)
    } else {
      clearZaiStatus(ctx)
    }
  })

  // Update footer after each turn
  pi.on("turn_end", async (_event, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await updateZaiStatus(ctx)
    }
  })

  // Clear footer on session shutdown
  pi.on("session_shutdown", async (_event, ctx) => {
    clearZaiStatus(ctx)
  })
}
