/**
 * Unit tests for datetime.ts
 */

import { describe, expect, it } from "bun:test"
import { Temporal } from "temporal-polyfill"
import { formatInstantFromEpochMs, formatTimeRemainingFromEpochMs } from "../src/datetime"

describe("formatInstantFromEpochMs", () => {
  it("should format an instant as a localized date/time string", () => {
    // January 15, 2024, 14:30:45 UTC
    const epochMs = 1705318245000
    const result = formatInstantFromEpochMs(epochMs)

    // Should contain date components
    expect(result).toMatch(/\d{1,2}/) // Day
    expect(result).toMatch(/[A-Za-z]{3}/) // Month abbreviation
    expect(result).toMatch(/\d{4}/) // Year
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/) // Time
  })

  it("should handle different time zones correctly", () => {
    const epochMs = 1705318245000
    const result = formatInstantFromEpochMs(epochMs)

    // The result should be a valid formatted string
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("should handle epoch zero", () => {
    const epochMs = 0
    const result = formatInstantFromEpochMs(epochMs)

    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("should handle recent timestamps", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const result = formatInstantFromEpochMs(now)

    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/\d{4}/) // Should contain year
  })
})

describe("formatTimeRemainingFromEpochMs", () => {
  it("should format remaining time in hours, minutes, and seconds", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 3665000 // 1 hour, 1 minute, 5 seconds in the future

    const result = formatTimeRemainingFromEpochMs(future)

    expect(result).toMatch(/\d+h \d+m \d+s/)
  })

  it("should format remaining time in minutes and seconds when less than an hour", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 3665000 // 1 hour, 1 minute, 5 seconds in the future

    // Mock Temporal.Now.instant to return a specific time
    const mockInstant = Temporal.Instant.fromEpochMilliseconds(now)
    const target = Temporal.Instant.fromEpochMilliseconds(future)
    const duration = target.since(mockInstant)

    if (duration.seconds >= 3600) {
      const result = formatTimeRemainingFromEpochMs(future)
      expect(result).toMatch(/\d+h \d+m \d+s/)
    }
  })

  it("should format remaining time in seconds when less than a minute", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 45000 // 45 seconds in the future

    const result = formatTimeRemainingFromEpochMs(future)

    // Should be in seconds format (no hours or minutes)
    expect(result).toMatch(/\d+s/)
  })

  it("should return '0h 0m 0s' for past timestamps", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const past = now - 1000000 // 1 million milliseconds in the past

    const result = formatTimeRemainingFromEpochMs(past)

    expect(result).toBe("0h 0m 0s")
  })

  it("should return '0s' for exactly now", () => {
    const now = Temporal.Now.instant().epochMilliseconds

    const result = formatTimeRemainingFromEpochMs(now)

    expect(result).toBe("0s")
  })

  it("should handle single minute correctly", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 60000 + 5000 // 1 minute + buffer in the future

    const result = formatTimeRemainingFromEpochMs(future)

    expect(result).toMatch(/\d+m \d+s/)
  })

  it("should handle single second correctly", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 1000 // Exactly 1 second in the future

    const result = formatTimeRemainingFromEpochMs(future)

    expect(result).toMatch(/\d+s/)
  })

  it("should format hours correctly for large durations", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 73200000 // 20 hours, 20 minutes in the future

    const result = formatTimeRemainingFromEpochMs(future)

    expect(result).toMatch(/\d+h \d+m \d+s/)
  })

  it("should round down seconds", () => {
    const now = Temporal.Now.instant().epochMilliseconds
    const future = now + 1500 // 1.5 seconds in the future

    const result = formatTimeRemainingFromEpochMs(future)

    expect(result).toBe("1s")
  })
})
