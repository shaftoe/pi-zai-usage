/**
 * Unit tests for index.ts — renderZaiStatus
 *
 * Ensures the footer renderer correctly applies theme colors and formats
 * the output string for the multi-window Z.ai quota model (5-hour +
 * weekly), with independent color thresholds per window.
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

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Return the color token renderZaiStatus will emit for a percentage.
 *
 * Mirrors renderZaiStatus's one-decimal rounding before delegating to
 * colorForPercentage, capturing which color the shared library selects
 * for the currently-loaded thresholds.
 */
function colorFor(percentage: number): string {
  const rounded = round1(percentage)
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

  it("should render both 5h and weekly windows with time remaining", () => {
    const data: ZaiUsageData = {
      level: "lite",
      fiveHour: {
        percentage: 85,
        resetTime: "2026-08-09T20:32:08Z",
        timeRemaining: "3h 7m 17s",
      },
      weekly: {
        percentage: 4,
        resetTime: "2026-08-16T15:09:02Z",
        timeRemaining: "6d 21h",
      },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h(lite) ][${colorFor(85)}:85%] [dim:(3h 7m 17s)] [muted:wk ][${colorFor(4)}:4%] [dim:(6d 21h)]`,
    )
  })

  it("should round each window's percentage to one decimal place", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 42.371 },
      weekly: { percentage: 7.259 },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][${colorFor(42.371)}:42.4%] [muted:wk ][${colorFor(7.259)}:7.3%]`,
    )
  })

  it("should fold the plan tier into the first window's label when present", () => {
    const data: ZaiUsageData = {
      level: "lite",
      fiveHour: { percentage: 42.3 },
      weekly: { percentage: 10 },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h(lite) ][${colorFor(42.3)}:42.3%] [muted:wk ][${colorFor(10)}:10%]`,
    )
  })

  it("should omit the tier suffix when plan level is absent", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 42.3 },
    }
    expect(renderZaiStatus(data, theme)).toBe(`[muted:Z.ai:][muted:5h ][${colorFor(42.3)}:42.3%]`)
  })

  it("should render only the weekly window when the 5h window is missing", () => {
    const data: ZaiUsageData = {
      level: "max",
      weekly: { percentage: 60, timeRemaining: "3d 4h" },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:wk(max) ][${colorFor(60)}:60%] [dim:(3d 4h)]`,
    )
  })

  it("should omit time remaining when a window has none", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 50 },
      weekly: { percentage: 20 },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][${colorFor(50)}:50%] [muted:wk ][${colorFor(20)}:20%]`,
    )
  })

  it("should color each window independently (5h critical, weekly low)", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: highPct, timeRemaining: "1h" },
      weekly: { percentage: lowPct, timeRemaining: "6d" },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][error:${highPct}%] [dim:(1h)] [muted:wk ][accent:${lowPct}%] [dim:(6d)]`,
    )
  })

  it("should use accent color for a percentage below the warning threshold", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: lowPct },
      weekly: { percentage: lowPct },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][accent:${lowPct}%] [muted:wk ][accent:${lowPct}%]`,
    )
  })

  ;(midBucketReachable ? it : it.skip)(
    "should use warning color for a percentage between the thresholds",
    () => {
      const data: ZaiUsageData = {
        fiveHour: { percentage: midPct },
        weekly: { percentage: midPct },
      }
      expect(renderZaiStatus(data, theme)).toBe(
        `[muted:Z.ai:][muted:5h ][warning:${midPct}%] [muted:wk ][warning:${midPct}%]`,
      )
    },
  )

  it("should use error color for a percentage at or above the critical threshold", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: highPct },
      weekly: { percentage: highPct },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][error:${highPct}%] [muted:wk ][error:${highPct}%]`,
    )
  })

  it("should handle 0% usage on both windows", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 0 },
      weekly: { percentage: 0 },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][${colorFor(0)}:0%] [muted:wk ][${colorFor(0)}:0%]`,
    )
  })

  it("should handle 100% usage on both windows (both caps exhausted)", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 100 },
      weekly: { percentage: 100 },
    }
    expect(renderZaiStatus(data, theme)).toBe(
      `[muted:Z.ai:][muted:5h ][${colorFor(100)}:100%] [muted:wk ][${colorFor(100)}:100%]`,
    )
  })

  it("should not stringify the color function (regression)", () => {
    const data: ZaiUsageData = {
      fiveHour: { percentage: 50 },
      weekly: { percentage: 50 },
    }
    const result = renderZaiStatus(data, theme)
    expect(result).not.toContain("=>")
    expect(result).not.toContain("function")
  })
})
