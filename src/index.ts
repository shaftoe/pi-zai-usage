/**
 * Z.ai Usage Checker - Pi Extension
 *
 * Provides a tool to check Z.ai API token usage quota and automatically displays
 * usage in the footer (information area) when using Z.ai provider.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { clearZaiStatus, isCurrentModelZai, tryShowFooter, updateZaiStatus } from "./status"

export default function (pi: ExtensionAPI) {
  // --- Event listeners for automatic status display ---

  // Show footer at session start - try without checking model (handles errors gracefully)
  pi.on("session_start", async (_event: unknown, ctx) => {
    await tryShowFooter(ctx)
  })

  // Update footer on model select
  pi.on("model_select", async (event: unknown, ctx) => {
    const modelEvent = event as {
      model: { provider: string; id: string } | undefined
    }
    if (modelEvent.model?.provider === "zai") {
      await updateZaiStatus(ctx)
    } else {
      clearZaiStatus(ctx)
    }
  })

  // Update footer after each turn
  pi.on("turn_end", async (_event: unknown, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await updateZaiStatus(ctx)
    }
  })

  // Clear footer on session switch/shutdown
  pi.on("session_switch", async (_event: unknown, ctx) => {
    clearZaiStatus(ctx)
  })

  pi.on("session_shutdown", async (_event: unknown, ctx) => {
    clearZaiStatus(ctx)
  })
}
