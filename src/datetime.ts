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
  return zonedDateTime.toLocaleString(undefined, {
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

  // If the target time is in the past, return zero
  if (target.epochMilliseconds < now.epochMilliseconds) {
    return "0h 0m 0s"
  }

  const duration = target.since(now)

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
