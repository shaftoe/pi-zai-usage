/**
 * Unit tests for index.ts — renderZaiStatus
 *
 * Ensures the footer renderer correctly applies theme colors
 * and formats the output string (prevents regression of
 * the bug where colorForPercentage was stringified as a function).
 */

import { describe, expect, it } from "bun:test"
import type { Theme } from "@alexanderfortin/pi-usage-lib"
import type { ZaiUsageData } from "../src/api"
import { renderZaiStatus } from "../src/index"

/** Create a mock theme that wraps strings in [color:text] for assertions */
function createMockTheme(): Theme {
  return {
    fg: (color: string, text: string) => `[${color}:${text}]`,
  } as unknown as Theme
}

describe("renderZaiStatus", () => {
  const theme = createMockTheme()

  it("should render label and percentage without time remaining", () => {
    const data: ZaiUsageData = { percentage: 42.3 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:42.3%]")
  })

  it("should round percentage to one decimal place", () => {
    const data: ZaiUsageData = { percentage: 42.371 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:42.4%]")
  })

  it("should include time remaining when provided", () => {
    const data: ZaiUsageData = {
      percentage: 85,
      resetTime: "2026-06-18T00:00:00Z",
      timeRemaining: "4h 41m 56s",
    }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][warning:85%] [dim:(4h 41m 56s)]")
  })

  it("should omit time remaining when resetTime is missing", () => {
    const data: ZaiUsageData = {
      percentage: 50,
      timeRemaining: "1h 0m 0s",
    }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:50%]")
  })

  it("should omit time remaining when timeRemaining is missing", () => {
    const data: ZaiUsageData = {
      percentage: 50,
      resetTime: "2026-06-18T00:00:00Z",
    }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:50%]")
  })

  it("should use warning color for percentage > 80", () => {
    const data: ZaiUsageData = { percentage: 85 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][warning:85%]")
  })

  it("should use error color for percentage >= 90", () => {
    const data: ZaiUsageData = { percentage: 92 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][error:92%]")
  })

  it("should use accent color for percentage <= 80", () => {
    const data: ZaiUsageData = { percentage: 80 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:80%]")
  })

  it("should handle 0% usage", () => {
    const data: ZaiUsageData = { percentage: 0 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][accent:0%]")
  })

  it("should handle 100% usage", () => {
    const data: ZaiUsageData = { percentage: 100 }
    expect(renderZaiStatus(data, theme)).toBe("[muted:Z.ai:][error:100%]")
  })

  it("should not stringify the color function (regression)", () => {
    const data: ZaiUsageData = { percentage: 50 }
    const result = renderZaiStatus(data, theme)
    expect(result).not.toContain("=>")
    expect(result).not.toContain("function")
  })
})
