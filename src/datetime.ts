/**
 * Z.ai Usage Checker - Pi Extension
 * Date/time formatting utilities using Temporal
 */

import { Temporal } from "temporal-polyfill"

/**
 * Format an instant (epoch milliseconds) as a localized date/time string
 */
export function formatInstantFromEpochMs(ms: number): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(ms)
  const zonedDateTime = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId())
  return zonedDateTime.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
}

/**
 * Format the remaining time from an instant (epoch milliseconds) to now
 */
export function formatTimeRemainingFromEpochMs(ms: number): string {
  const now = Temporal.Now.instant()
  const target = Temporal.Instant.fromEpochMilliseconds(ms)
  const duration = target.since(now)

  // If the time is in the past but within 1 second, treat as now (0s)
  // This handles edge cases where the target time is exactly now or slightly in the past
  if (duration.sign < 0 && duration.seconds < -1) {
    return "0h 0m 0s"
  }

  const totalSeconds = Math.round(Math.abs(duration.seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
