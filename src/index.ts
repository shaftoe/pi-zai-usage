/**
 * Z.ai Usage Checker - Pi Extension
 *
 * Uses createUsageExtension from the shared library to handle all
 * event registration, provider matching, caching, and footer lifecycle.
 */

import { colorForPercentage, createUsageExtension, type Theme } from "@alexanderfortin/pi-usage-lib"
import { getZaiUsage, type ZaiUsageData } from "./api"

/** Render Z.ai usage data into a themed footer string */
export function renderZaiStatus(data: ZaiUsageData, theme: Theme): string {
  const displayPercentage = Math.round(data.percentage * 10) / 10
  let status = `${theme.fg("muted", "Z.ai:")}${colorForPercentage(displayPercentage, theme)(`${displayPercentage}%`)}`
  if (data.resetTime && data.timeRemaining) {
    status += ` ${theme.fg("dim", `(${data.timeRemaining})`)}`
  }
  return status
}

const extension: ReturnType<typeof createUsageExtension<ZaiUsageData>> =
  createUsageExtension<ZaiUsageData>({
    providerPrefix: "zai",
    statusKey: "zai-usage",
    label: "Z.ai",
    fetchUsage: getZaiUsage,
    renderStatus: renderZaiStatus,
  })

export default extension
