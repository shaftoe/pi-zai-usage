/**
 * Z.ai Usage Checker - Pi Extension
 *
 * Uses createUsageExtension from the shared library to handle all
 * event registration, provider matching, caching, and footer lifecycle.
 */

import { colorForPercentage, createUsageExtension, type Theme } from "@alexanderfortin/pi-usage-lib"
import { getZaiUsage, type ZaiQuotaWindow, type ZaiUsageData } from "./api"

/** Round to one decimal place, matching the shared color thresholds' granularity. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Render a single quota window: `5h 23% (3h 7m)` with usage-colored percentage.
 *
 * The colored part is just the percentage; the window label and time
 * remaining stay muted/dim so the eye is drawn to the number that matters.
 */
function renderWindow(label: string, window: ZaiQuotaWindow, theme: Theme): string {
  const pct = round1(window.percentage)
  const color = colorForPercentage(pct, theme)
  let out = `${theme.fg("muted", `${label} `)}${color(`${pct}%`)}`
  if (window.timeRemaining) {
    out += ` ${theme.fg("dim", `(${window.timeRemaining})`)}`
  }
  return out
}

/** Render Z.ai usage data into a themed footer string */
export function renderZaiStatus(data: ZaiUsageData, theme: Theme): string {
  // Always prefix with the provider label; the plan tier (e.g. "lite")
  // is folded into the first window's label so it stays compact while
  // keeping "Z.ai:" as the recognizable footer anchor.
  const label = theme.fg("muted", "Z.ai:")
  const tier = data.level ? `(${data.level})` : ""

  const windows: string[] = []
  if (data.fiveHour) {
    windows.push(renderWindow(`5h${tier}`, data.fiveHour, theme))
  } else if (data.weekly) {
    // No 5h window — attach the tier to the weekly window instead.
    windows.push(renderWindow(`wk${tier}`, data.weekly, theme))
  }
  if (data.weekly && data.fiveHour) {
    windows.push(renderWindow("wk", data.weekly, theme))
  }

  // Fallback: no known windows at all (shouldn't normally happen since
  // getZaiUsage throws in that case, but keep the renderer defensive).
  if (windows.length === 0) {
    return label
  }

  // Label is attached directly to the first window ("Z.ai:5h …") to match
  // the original compact footer style, then windows are space-separated.
  return `${label}${windows.join(" ")}`
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
