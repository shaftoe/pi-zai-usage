/**
 * Unit tests for index.ts — renderZaiStatus
 *
 * Ensures the footer renderer correctly applies theme colors
 * and formats the output string (prevents regression of
 * the bug where colorForPercentage was stringified as a function).
 *
 * Color selection is delegated to colorForPercentage (from the shared
 * library), whose thresholds are loaded from the user-managed
 * ~/.pi/agent/usage-lib.json and fall back to built-in defaults. Rather
 * than hardcoding accent/warning/error, the expected color is derived
 * from the same function so the assertions hold for any configured
 * thresholds — i.e. the suite does not assume the settings file is
 * absent.
 */

import { describe, expect, it } from "bun:test"
import { colorForPercentage, loadColorThresholds, type Theme } from "@alexanderfortin/pi-usage-lib"
import type { ZaiUsageData } from "../src/api"
import { renderZaiStatus } from "../src/index"

/** Create a mock theme that wraps strings in [color:text] for assertions */
function createMockTheme(): Theme {
  return {
    fg: (color: string, text: string) => `[${color}:${text}]`,
  } as unknown as Theme
}

/**
 * Return the color token renderZaiStatus will emit for a percentage.
 *
 * Mirrors renderZaiStatus's one-decimal rounding before delegating to
 * colorForPercentage, capturing which color the shared library selects
 * for the currently-loaded thresholds.
 */
function colorFor(percentage: number): string {
  const rounded = Math.round(percentage * 10) / 10
  let color = ""
  const probe = {
    fg: (c: string) => {
      color = c
      return ""
    },
  } as unknown as Theme
  colorForPercentage(rounded, probe)("")
  return color
}

describe("renderZaiStatus", () => {
  const theme = createMockTheme()

  // Percentages chosen relative to the active thresholds so each color
  // branch is exercised regardless of the user's settings file.
  const { warning, critical } = loadColorThresholds().percentage
  const lowPct = Math.max(0, warning - 10) // safely below the warning threshold → accent
  const midPct = Math.floor((warning + critical) / 2) // strictly between the thresholds → warning
  const highPct = Math.min(100, critical) // at the critical threshold → error
  const midBucketReachable = critical - warning >= 2

  it("should render label and percentage without time remaining", () => {
    const data: ZaiUsageData = { percentage: 42.3 }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(42.3)}:42.3%]`)
  })

  it("should round percentage to one decimal place", () => {
    const data: ZaiUsageData = { percentage: 42.371 }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(42.371)}:42.4%]`)
  })

  it("should include time remaining when provided", () => {
    const data: ZaiUsageData = {
      percentage: 85,
      resetTime: "2026-06-18T00:00:00Z",
      timeRemaining: "4h 41m 56s",
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][${colorFor(85)}:85%] [dim:(4h 41m 56s)]`,
    )
  })

  it("should omit time remaining when resetTime is missing", () => {
    const data: ZaiUsageData = {
      percentage: 50,
      timeRemaining: "1h 0m 0s",
    }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(50)}:50%]`)
  })

  it("should omit time remaining when timeRemaining is missing", () => {
    const data: ZaiUsageData = {
      percentage: 50,
      resetTime: "2026-06-18T00:00:00Z",
    }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(50)}:50%]`)
  })

  it("should use accent color for a percentage below the warning threshold", () => {
    const data: ZaiUsageData = { percentage: lowPct }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][accent:${lowPct}%]`)
  })

  ;(midBucketReachable ? it : it.skip)(
    "should use warning color for a percentage between the thresholds",
    () => {
      const data: ZaiUsageData = { percentage: midPct }
      expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][warning:${midPct}%]`)
    },
  )

  it("should use error color for a percentage at or above the critical threshold", () => {
    const data: ZaiUsageData = { percentage: highPct }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][error:${highPct}%]`)
  })

  it("should handle 0% usage", () => {
    const data: ZaiUsageData = { percentage: 0 }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(0)}:0%]`)
  })

  it("should handle 100% usage", () => {
    const data: ZaiUsageData = { percentage: 100 }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][${colorFor(100)}:100%]`)
  })

  it("should not stringify the color function (regression)", () => {
    const data: ZaiUsageData = { percentage: 50 }
    const result = renderZaiStatus(data, theme)
    expect(result).not.toContain("=>")
    expect(result).not.toContain("function")
  })
})
